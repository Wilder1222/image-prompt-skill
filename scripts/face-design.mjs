import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileProductionPrompt, objectHash} from './production-prompt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputKeys = ['id','request','mode','subject','preset','preset_application_reason','reference_id','traits','expression','presentation','anchors'];
const expressionAxes = ['gaze','mouth_state'];
const presentationChannels = {makeup:'makeup',skin_finish:'makeup',lighting:'lighting',hair:'hair'};
const identityLayers = new Set(['structure','soft_tissue']);
const labels = {identity:'人物身份与面容',expression:'表情与眼神',makeup:'妆容与肌肤',lighting:'灯光',hair:'发型'};
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const catalog = () => JSON.parse(fs.readFileSync(path.join(root,'resources/face_design_catalog.json'),'utf8'));

function requiredText(value, label) {
  if (!nonempty(value)) throw new Error(`missing ${label}`);
  return value.trim();
}

function keys(value, allowed, label) {
  if (!plain(value)) throw new Error(`${label} must be an object`);
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  if (unknown.length) throw new Error(`unsupported ${label} fields: ${unknown.join(', ')}`);
}

function prose(value, label) {
  if (!nonempty(value) || /[【】]|\bTODO\b|待填写|逐项填写/.test(value)) throw new Error(`missing or unfinished visual prose: ${label}`);
  if (/\b(?:face[ _-]*mode|render[ _-]*mode|style[ _-]*workflow|identity[ _-]*weight|guidance[ _-]*scale|seed|preset|FD\d{2}|F\d{2})\s*[=:：＝]/i.test(value) ||
      /\b(?:beauty_first|humanized_real|stylized_beauty|BALANCED_ELEGANT|P9_FASHION_ASSET|FD\d{2})\b/i.test(value))
    throw new Error(`internal parameters must not enter visual prose: ${label}`);
  return value.trim();
}

function sourceInput(record) {
  return Object.fromEntries(inputKeys.filter(key => Object.hasOwn(record,key)).map(key => [key,structuredClone(record[key])]));
}

function isIdentity(axis, data) { return identityLayers.has(data.dimensions[axis]?.layer); }

// These are declarations written by the agent. No image interpretation happens here.
export function buildFaceDesign(input) {
  keys(input,inputKeys,'face design');
  const data = catalog();
  if (!nonempty(input.id) || !/^[A-Za-z0-9_-]+$/.test(input.id)) throw new Error('face design id must be a stable alphanumeric identifier');
  requiredText(input.request,'request');
  if (!['new_design','reference_match'].includes(input.mode)) throw new Error('mode must be new_design or reference_match');
  keys(input.subject,['description','seed_scope'],'subject');
  prose(input.subject.description,'subject.description');
  if (!['young_adult_female_reference_group','custom'].includes(input.subject.seed_scope)) throw new Error('declare subject.seed_scope');
  if (input.reference_id !== undefined && !nonempty(input.reference_id)) throw new Error('reference_id must be nonempty');
  if (input.mode === 'reference_match' && (!nonempty(input.reference_id) || input.preset !== undefined))
    throw new Error('reference_match requires an actual reference_id and forbids a preset');
  if (input.preset_application_reason !== undefined) requiredText(input.preset_application_reason,'preset_application_reason');
  const preset = input.preset === undefined ? null : data.presets[input.preset];
  if (input.preset !== undefined && !preset) throw new Error(`unknown face preset: ${input.preset}`);
  if (preset && input.subject.seed_scope !== preset.scope && !nonempty(input.preset_application_reason))
    throw new Error('out-of-scope preset use requires preset_application_reason; it cannot impose age or gender');
  if (!preset && input.preset_application_reason !== undefined) throw new Error('preset_application_reason needs a preset');
  keys(input.traits ?? {},Object.keys(data.dimensions).filter(axis => isIdentity(axis,data)),'traits');
  keys(input.expression ?? {},expressionAxes,'expression');
  keys(input.presentation ?? {},Object.keys(presentationChannels),'presentation');
  const traits = {};
  for (const [axis,value] of Object.entries(preset?.traits ?? {})) {
    if (!isIdentity(axis,data)) throw new Error(`preset has an unsupported identity dimension: ${axis}`);
    traits[axis] = {value,origin:'design',reason:input.preset_application_reason ?? `依据本轮角色选择${preset.label}的结构设计线索。`};
  }
  Object.assign(traits,structuredClone(input.traits ?? {}));
  const resolved = {};
  for (const [axis,trait] of Object.entries(traits)) {
    keys(trait,['value','origin','reason','reference_id','visibility'],`trait ${axis}`);
    const value = prose(trait.value,axis);
    if (!['design','observed'].includes(trait.origin)) throw new Error(`trait ${axis} needs origin design or observed`);
    if (trait.origin === 'design') {
      const reason = requiredText(trait.reason,`${axis}.reason`);
      if (trait.reference_id !== undefined || trait.visibility !== undefined) throw new Error(`design trait ${axis} cannot declare observed reference or visibility`);
      if (/(?:严格(?:保持|保留|复刻)|(?:保持|保留|复刻)(?:参考|原图|原有|原人物)|(?:与|和)(?:参考|原图)[^。]*一致)/.test(value))
        throw new Error(`design trait ${axis} cannot claim reference retention`);
      resolved[axis] = {value,origin:'design',reason};
    } else {
      const reference = trait.reference_id ?? input.reference_id;
      if (!nonempty(reference) || !['visible','partial','unknown','not_visible'].includes(trait.visibility))
        throw new Error(`observed trait ${axis} needs reference_id and declared visibility`);
      if (input.mode === 'reference_match' && reference !== input.reference_id) throw new Error(`observed trait ${axis} must use the declared identity reference`);
      if (trait.reason !== undefined) requiredText(trait.reason,`${axis}.reason`);
      resolved[axis] = {...trait,value,reference_id:reference};
    }
  }
  if (!Array.isArray(input.anchors) || input.anchors.length < 3 || new Set(input.anchors).size !== input.anchors.length)
    throw new Error('choose at least three unique identity anchors');
  for (const axis of input.anchors) {
    if (!isIdentity(axis,data)) throw new Error(`anchor ${axis} must be an identity dimension, not a variable layer`);
    const trait = resolved[axis];
    if (!trait || (trait.origin === 'observed' && trait.visibility !== 'visible'))
      throw new Error(`anchor ${axis} needs a designed or fully visible identity trait; partial and unknown are not strict anchors`);
    if (input.mode === 'reference_match' && trait.origin !== 'observed')
      throw new Error(`reference_match anchor ${axis} must be observed and fully visible; design extensions cannot establish reference identity`);
  }
  const expression = {...(preset?.expression ?? {}),...(input.expression ?? {})};
  keys(expression,expressionAxes,'resolved expression');
  const presentation = {...(input.presentation ?? {})};
  for (const [axis,value] of Object.entries({...expression,...presentation})) prose(value,axis);
  const known = Object.entries(resolved).filter(([,trait]) => trait.origin === 'design' || ['visible','partial'].includes(trait.visibility));
  const signature = {id:input.id,subject:input.subject.description,anchors:[...input.anchors].sort(),traits:Object.fromEntries(known.map(([axis,trait]) => [axis,trait.value]))};
  const identity_signature = {...signature,sha256:objectHash(signature)};
  const requirements = [], sections = [], acceptance = [];
  function project(axis, value, channel, trait) {
    const id = `FD:${input.id}:${axis}`, dimension = data.dimensions[axis];
    if (!dimension) throw new Error(`unknown face dimension: ${axis}`);
    const observed = trait?.origin === 'observed', partial = trait?.visibility === 'partial';
    const text = observed ? `${partial ? '依据参考可见部分描绘' : '保持参考可见的'}${dimension.label}：${value}` : `${dimension.label}：${value}`;
    requirements.push({id,channel,priority:'must',text});
    let section = sections.find(row => row.channel === channel);
    if (!section) { section = {label:labels[channel],channel,items:[]}; sections.push(section); }
    section.items.push({text,basis:[id],intent:observed?'retain':'design',
      ...(!observed?{reason:trait?.reason ?? '依据本轮人物用途选择协调的可见表现。'}:{})});
    acceptance.push({id:`${id}:check`,basis:id,critical:true,
      question:`${dimension.label}是否符合本轮目标“${value}”${partial?'，仅判断实际可见部分，不将遮挡区当成已确认事实':''}？`});
  }
  const subjectId = `FD:${input.id}:subject`, subjectText = `人物设定：${input.subject.description}`;
  requirements.push({id:subjectId,channel:'identity',priority:'must',text:subjectText});
  sections.push({label:labels.identity,channel:'identity',items:[{text:subjectText,basis:[subjectId],intent:'constraint'}]});
  acceptance.push({id:`${subjectId}:check`,basis:subjectId,critical:true,question:`人物年龄、角色与媒介是否符合本轮设定“${input.subject.description}”？`});
  for (const [axis,trait] of known) project(axis,trait.value,'identity',trait);
  for (const [axis,value] of Object.entries(expression)) project(axis,value,'expression');
  for (const [axis,value] of Object.entries(presentation)) project(axis,value,presentationChannels[axis]);
  return {...sourceInput(input),resolved_traits:resolved,identity_signature,
    prompt:sections.map(section => `【${section.label}】\n${section.items.map(item => item.text).join('\n')}`).join('\n\n'),
    requirements,sections,acceptance,
    provenance:{source:structuredClone(data.source),preset:input.preset??null,
      preset_scope:preset?.scope??null,preset_application_reason:input.preset_application_reason??null,
      seed_uncertainties:structuredClone(preset?.uncertain??[]),seed_distinctive_axes:structuredClone(preset?.distinctive_axes??[]),
      observations:Object.entries(resolved).filter(([,trait]) => trait.origin === 'observed').map(([axis,trait]) => ({axis,...trait})),
      omitted_identity_axes:Object.entries(resolved).filter(([,trait]) => trait.origin === 'observed' && !['visible','partial'].includes(trait.visibility)).map(([axis]) => axis),
      reference_links_verified:false,images_reviewed_by_compiler:false},
    visual_quality_verified:false};
}

export function applyFaceDesign(brief, inputOrBuiltRecord) {
  if (!plain(brief) || brief.subject_kind !== 'character') throw new Error('face design requires an authored character production brief');
  const face = buildFaceDesign(inputOrBuiltRecord?.resolved_traits ? sourceInput(inputOrBuiltRecord) : inputOrBuiltRecord);
  if ((brief.sections ?? []).some(section => section.channel === 'identity'))
    throw new Error('existing identity sections conflict with face design; the agent must merge or remove the old identity section before applying');
  const next = structuredClone(brief);
  const refs = new Map((next.references ?? []).map(reference => [reference.id,reference]));
  const observed = Object.entries(face.resolved_traits).filter(([,trait]) => trait.origin === 'observed');
  const validateReference = id => {
    const ref = refs.get(id);
    if (!ref || ref.inspected !== true || ref.generation_input !== true || !ref.authority?.includes('identity'))
      throw new Error(`face reference ${id} must exist, be inspected, have identity authority and be an actual generation_input`);
    return ref;
  };
  if (face.mode === 'reference_match') validateReference(face.reference_id);
  for (const [axis,trait] of observed) {
    const ref = validateReference(trait.reference_id);
    if (!['visible','partial'].includes(trait.visibility)) continue;
    const fact = ref.facts?.find(row => row.channel === 'identity' && row.text === trait.value && row.visibility === trait.visibility);
    if (!fact) throw new Error(`observed trait ${axis} must exactly match an existing identity fact text and visibility in reference ${ref.id}`);
    const id = `FD:${face.id}:${axis}`;
    face.sections.find(section => section.channel === 'identity').items.find(item => item.basis.includes(id)).basis.push(fact.id);
  }
  const existingIds = new Set([...(next.requirements ?? []),...(next.references ?? []).flatMap(ref => ref.facts ?? [])].map(row => row.id));
  if (face.requirements.some(row => existingIds.has(row.id))) throw new Error('face requirement id conflicts with existing production basis');
  const criterionIds = new Set((next.acceptance ?? []).map(row => row.id));
  if (face.acceptance.some(row => criterionIds.has(row.id))) throw new Error('face acceptance id conflicts with existing production criteria');
  next.requirements = [...(next.requirements ?? []),...face.requirements];
  next.acceptance = [...(next.acceptance ?? []),...face.acceptance];
  next.sections ??= [];
  for (const section of face.sections) {
    const old = next.sections.find(row => row.channel === section.channel && row.label === section.label);
    if (old) old.items.push(...section.items);
    else next.sections.push(section);
  }
  compileProductionPrompt(next);
  return next;
}

export function reviseFaceDesign(baselineInput, change) {
  const baseline = buildFaceDesign(baselineInput);
  keys(change,['request','allowed_changes','traits','expression','presentation','identity_change','new_id'],'face revision');
  requiredText(change.request,'revision request');
  const data = catalog();
  if (!Array.isArray(change.allowed_changes) || !change.allowed_changes.length || new Set(change.allowed_changes).size !== change.allowed_changes.length ||
      change.allowed_changes.some(axis => !Object.hasOwn(data.dimensions,axis))) throw new Error('revision needs unique known allowed_changes axes');
  if (change.identity_change !== undefined && typeof change.identity_change !== 'boolean') throw new Error('identity_change must be boolean');
  const next = sourceInput(baselineInput);
  const changed = [];
  for (const group of ['traits','expression','presentation']) {
    if (change[group] === undefined) continue;
    if (!plain(change[group])) throw new Error(`revision ${group} must be an object`);
    for (const [axis,value] of Object.entries(change[group])) {
      if (!change.allowed_changes.includes(axis)) throw new Error(`revision escaped allowed_changes: ${axis}`);
      const allowed = group === 'traits' ? isIdentity(axis,data) : group === 'expression' ? expressionAxes.includes(axis) : Object.hasOwn(presentationChannels,axis);
      if (!allowed) throw new Error(`revision dimension ${axis} does not belong to ${group}`);
      next[group] ??= {};
      // Expression may be inherited from a preset; writing that same effective
      // value into the input is not a visual revision. Keep trait declarations
      // intact here because origin, visibility and reference changes carry evidence.
      const prior = next[group][axis] ?? (group === 'expression' ? data.presets[next.preset]?.expression?.[axis] : undefined);
      const before = group === 'traits' ? prior ?? null : prior === undefined ? null : prose(prior,axis);
      const after = group === 'traits' ? value : prose(value,axis);
      if (objectHash(before) !== objectHash(after)) changed.push(axis);
      next[group][axis] = structuredClone(value);
    }
  }
  if (!changed.length) throw new Error('face revision needs an actual change');
  const identityValuesChanged = Object.entries(change.traits ?? {}).some(([axis,trait]) => {
    const before = baseline.resolved_traits[axis];
    const beforeKnown = Boolean(before && (before.origin === 'design' || ['visible','partial'].includes(before.visibility)));
    const afterKnown = trait?.origin === 'design' || ['visible','partial'].includes(trait?.visibility);
    return beforeKnown !== afterKnown || (afterKnown && before?.value !== (nonempty(trait?.value) ? trait.value.trim() : trait?.value));
  });
  if (identityValuesChanged) {
    if (change.identity_change !== true || !nonempty(change.new_id) || change.new_id === baselineInput.id)
      throw new Error('identity structure changes require identity_change true and a different new_id');
    // An authorized redesign can change a reference anchor. The resulting geometry
    // is a new design derived from that image, rather than a claim of exact matching.
    if (next.mode === 'reference_match') next.mode = 'new_design';
  } else if (change.new_id !== undefined || change.identity_change === true) {
    throw new Error('new_id and identity_change require an actual identity structure change');
  }
  // Compare resolved geometry, including preset-derived axes, rather than only raw input fields.
  const candidate = buildFaceDesign(next);
  const identityChanged = baseline.identity_signature.sha256 !== candidate.identity_signature.sha256;
  if (identityChanged) {
    if (change.identity_change !== true || !nonempty(change.new_id) || change.new_id === baselineInput.id)
      throw new Error('identity structure changes require identity_change true and a different new_id');
    next.id = change.new_id;
  } else if (change.new_id !== undefined || change.identity_change === true) {
    throw new Error('new_id and identity_change require an actual identity structure change');
  }
  next.request = identityChanged ? `从人物方案 ${baselineInput.id} 修改：${change.request}` : change.request;
  buildFaceDesign(next);
  return next;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2], options = {};
    for (let i=3;i<process.argv.length;i+=2) {
      const key = process.argv[i];
      if (!['--input','--out','--brief','--change'].includes(key) || !process.argv[i+1] || Object.hasOwn(options,key)) throw new Error('invalid face-design CLI options');
      options[key] = process.argv[i+1];
    }
    if (!['build','apply','revise'].includes(command) || !options['--input'] ||
        (command==='apply'&&!options['--brief']) || (command==='revise'&&!options['--change']) ||
        (command!=='apply'&&options['--brief']) || (command!=='revise'&&options['--change']))
      throw new Error('usage: face-design.mjs build --input face.json [--out record.json] | apply --input face.json --brief brief.json [--out brief.json] | revise --input face.json --change change.json [--out face.json]');
    const read = file => JSON.parse(fs.readFileSync(file,'utf8'));
    const input = read(options['--input']);
    const result = command === 'build' ? buildFaceDesign(input) : command === 'apply' ? applyFaceDesign(read(options['--brief']),input) : reviseFaceDesign(input,read(options['--change']));
    if (options['--out']) {
      const out = path.resolve(options['--out']);
      fs.mkdirSync(path.dirname(out),{recursive:true});
      fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    } else console.log(JSON.stringify(result,null,2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
