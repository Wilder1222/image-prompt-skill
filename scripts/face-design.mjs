import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileProductionPrompt, objectHash} from './production-prompt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputKeys = ['id','request','mode','subject','preset','preset_application_reason','reference_id','traits','expression','presentation','anchors'];
const legacyPresentationChannels = {makeup:'makeup',skin_finish:'makeup',lighting:'lighting',hair:'hair'};
const identityLayers = new Set(['structure','soft_tissue','surface_identity']);
const labels = {identity:'人物身份与面容',expression:'表情与眼神',makeup:'妆容与肌肤',lighting:'灯光',hair:'发型',style:'面容表现',composition:'面部视角与构图'};
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

function prose(value, label, data = catalog()) {
  if (!nonempty(value) || /[【】]|\bTODO\b|待填写|逐项填写/.test(value)) throw new Error(`missing or unfinished visual prose: ${label}`);
  if (/\b(?:face[ _-]*mode|render[ _-]*mode|style[ _-]*workflow|identity[ _-]*weight|guidance[ _-]*scale|seed|preset|FD\d{2}|F\d{2})\s*[=:：＝]/i.test(value) ||
      /\b(?:beauty_first|humanized_real|stylized_beauty|BALANCED_ELEGANT|P9_FASHION_ASSET|FD\d{2})\b/i.test(value))
    throw new Error(`internal parameters must not enter visual prose: ${label}`);
  const axes = Object.keys(data.dimensions).map(axis => axis.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  const numeric = `["']?\\s*[-+]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)`;
  const assignment = '(?:[=:：＝]|设置\\s*为|设\\s*为|为)';
  if (new RegExp(`\\b(?:${axes})(?:\\s*[.:]\\s*(?:left|right))?["']?\\s*${assignment}\\s*${numeric}`,'i').test(value) ||
      new RegExp(`\\b(?:[a-z_][a-z0-9_]*slider[a-z0-9_]*|slider[a-z0-9_]*)["']?\\s*${assignment}\\s*${numeric}`,'i').test(value) ||
      new RegExp(`(?:滑杆|滑块)[^，。;；\\n]*?${assignment}\\s*${numeric}`,'i').test(value))
    throw new Error(`numeric axis or slider controls must not enter visual prose: ${label}`);
  return value.trim();
}

function sourceInput(record) {
  return Object.fromEntries(inputKeys.filter(key => Object.hasOwn(record,key)).map(key => [key,structuredClone(record[key])]));
}

function isIdentity(axis, data) { return identityLayers.has(data.dimensions[axis]?.layer); }

function channelFor(axis, data) {
  const dimension = data.dimensions[axis];
  if (!dimension) throw new Error(`unknown face dimension: ${axis}`);
  const channel = dimension.channel ?? (isIdentity(axis,data) ? 'identity' : dimension.layer === 'expression' ? 'expression' : legacyPresentationChannels[axis]);
  if (!Object.hasOwn(labels,channel) || (isIdentity(axis,data) && channel !== 'identity') || (dimension.layer === 'expression' && channel !== 'expression'))
    throw new Error(`unsupported layer or channel for face dimension: ${axis}`);
  return channel;
}

function groupAxes(data, group) {
  return Object.keys(data.dimensions).filter(axis => group === 'traits' ? isIdentity(axis,data) : data.dimensions[axis].layer === group);
}

function selectorInfo(selector, data) {
  if (typeof selector !== 'string') throw new Error('face selector must be a dimension name');
  const [axis,side,...rest] = selector.split(':');
  if (!Object.hasOwn(data.dimensions,axis) || rest.length || (side !== undefined && (!['left','right'].includes(side) || data.dimensions[axis].laterality !== 'bilateral')))
    throw new Error(`unknown or unsupported face selector: ${selector}`);
  return {axis,side};
}

function sided(trait) { return plain(trait) && Object.hasOwn(trait,'sides'); }

function sideRows(axis, value, data) {
  if (!sided(value)) return [[axis,{axis,trait:value}]];
  keys(value,['sides'],`bilateral wrapper ${axis}`);
  if (data.dimensions[axis]?.laterality !== 'bilateral') throw new Error(`dimension ${axis} does not support bilateral sides`);
  keys(value.sides,['left','right'],`sides ${axis}`);
  if (!Object.keys(value.sides).length) throw new Error(`bilateral wrapper ${axis} needs at least one side`);
  return ['left','right'].filter(side => Object.hasOwn(value.sides,side)).map(side => [`${axis}:${side}`,{axis,side,trait:value.sides[side]}]);
}

function resolveTraits(input, data) {
  const preset = input.preset === undefined ? null : data.presets[input.preset], traits = {};
  keys(input.traits ?? {},groupAxes(data,'traits'),'traits');
  for (const [axis,value] of Object.entries(preset?.traits ?? {})) {
    if (!isIdentity(axis,data)) throw new Error(`preset has an unsupported identity dimension: ${axis}`);
    traits[axis] = {value,origin:'design',reason:input.preset_application_reason ?? `依据本轮角色选择${preset.label}的结构设计线索。`};
  }
  Object.assign(traits,structuredClone(input.traits ?? {}));
  const resolved = {};
  for (const [axis,entry] of Object.entries(traits)) for (const [selector,{trait,side}] of sideRows(axis,entry,data)) {
    channelFor(axis,data);
    keys(trait,['value','origin','reason','reference_id','visibility','fact_id'],`trait ${selector}`);
    const value = prose(trait.value,selector,data);
    if (!['design','observed'].includes(trait.origin)) throw new Error(`trait ${selector} needs origin design or observed`);
    if (trait.origin === 'design') {
      const reason = requiredText(trait.reason,`${selector}.reason`);
      if (trait.reference_id !== undefined || trait.visibility !== undefined || trait.fact_id !== undefined)
        throw new Error(`design trait ${selector} cannot declare observed reference, fact_id or visibility`);
      if (/(?:严格(?:保持|保留|复刻)|(?:保持|保留|复刻)(?:参考|原图|原有|原人物)|(?:与|和)(?:参考|原图)[^。]*一致)/.test(value))
        throw new Error(`design trait ${selector} cannot claim reference retention`);
      resolved[selector] = {value,origin:'design',reason,...(side?{side}:{})};
    } else {
      const reference = trait.reference_id ?? input.reference_id;
      if (!nonempty(reference) || !['visible','partial','unknown','not_visible'].includes(trait.visibility))
        throw new Error(`observed trait ${selector} needs reference_id and declared visibility`);
      if ((side || trait.fact_id !== undefined) && !nonempty(trait.fact_id)) throw new Error(`observed side ${selector} requires an explicit fact_id`);
      if (input.mode === 'reference_match' && reference !== input.reference_id) throw new Error(`observed trait ${selector} must use the declared identity reference`);
      if (trait.reason !== undefined) requiredText(trait.reason,`${selector}.reason`);
      resolved[selector] = {...trait,value,reference_id:reference,...(side?{side}:{})};
    }
  }
  return resolved;
}

function knownTraits(resolved) { return Object.entries(resolved).filter(([,trait]) => trait.origin === 'design' || ['visible','partial'].includes(trait.visibility)); }

export function faceControlCatalog(group) {
  const data = catalog();
  if (group !== undefined && !Object.hasOwn(data.groups ?? {},group)) throw new Error(`unknown face control group: ${group}`);
  return {...structuredClone(data),control_kind:'qualitative_design_axes',native_3d_slider_precision:false,
    group_order:group === undefined ? structuredClone(data.group_order ?? Object.keys(data.groups ?? {})) : [group],
    groups:structuredClone(group === undefined ? data.groups ?? {} : {[group]:data.groups[group]}),
    dimensions:structuredClone(Object.fromEntries(Object.entries(data.dimensions).filter(([,dimension]) => group === undefined || dimension.group === group))),
    relationship_checks:structuredClone(data.relationship_checks ?? [])};
}

// These are declarations written by the agent. No image interpretation happens here.
export function buildFaceDesign(input) {
  keys(input,inputKeys,'face design');
  const data = catalog();
  if (!nonempty(input.id) || !/^[A-Za-z0-9_-]+$/.test(input.id)) throw new Error('face design id must be a stable alphanumeric identifier');
  requiredText(input.request,'request');
  if (!['new_design','reference_match'].includes(input.mode)) throw new Error('mode must be new_design or reference_match');
  keys(input.subject,['description','seed_scope'],'subject');
  prose(input.subject.description,'subject.description',data);
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
  keys(input.expression ?? {},groupAxes(data,'expression'),'expression');
  keys(input.presentation ?? {},groupAxes(data,'presentation'),'presentation');
  const resolved = resolveTraits(input,data);
  if (!Array.isArray(input.anchors) || input.anchors.length < 3 || new Set(input.anchors).size !== input.anchors.length)
    throw new Error('choose at least three unique identity anchors');
  for (const selector of input.anchors) {
    const {axis} = selectorInfo(selector,data);
    if (!isIdentity(axis,data)) throw new Error(`anchor ${selector} must be an identity dimension, not a variable layer`);
    const trait = resolved[selector];
    if (!trait || (trait.origin === 'observed' && trait.visibility !== 'visible'))
      throw new Error(`anchor ${selector} needs a designed or fully visible identity trait; partial and unknown are not strict anchors`);
    if (input.mode === 'reference_match' && trait.origin !== 'observed')
      throw new Error(`reference_match anchor ${selector} must be observed and fully visible; design extensions cannot establish reference identity`);
  }
  const expression = {...(preset?.expression ?? {}),...(input.expression ?? {})};
  keys(expression,groupAxes(data,'expression'),'resolved expression');
  const presentation = {...(input.presentation ?? {})};
  for (const [axis,value] of Object.entries({...expression,...presentation})) { prose(value,axis,data); channelFor(axis,data); }
  const known = knownTraits(resolved);
  const signature = {id:input.id,subject:input.subject.description,anchors:[...input.anchors].sort(),traits:Object.fromEntries(known.map(([axis,trait]) => [axis,trait.value]))};
  const identity_signature = {...signature,sha256:objectHash(signature)};
  const requirements = [], sections = [], acceptance = [];
  function project(selector, value, channel, trait) {
    const {axis,side} = selectorInfo(selector,data);
    const id = `FD:${input.id}:${selector}`, dimension = data.dimensions[axis];
    const label = side ? `人物自身${side==='left'?'左':'右'}侧的${dimension.label}` : dimension.label;
    const observed = trait?.origin === 'observed', partial = trait?.visibility === 'partial';
    const text = observed ? `${partial ? '依据参考可见部分描绘' : '保持参考可见的'}${label}：${value}` : `${label}：${value}`;
    requirements.push({id,channel,priority:'must',text});
    let section = sections.find(row => row.channel === channel);
    if (!section) { section = {label:labels[channel],channel,items:[]}; sections.push(section); }
    section.items.push({text,basis:[id],intent:observed?'retain':'design',
      ...(!observed?{reason:trait?.reason ?? '依据本轮人物用途选择协调的可见表现。'}:{})});
    acceptance.push({id:`${id}:check`,basis:id,critical:true,
      question:`${label}是否符合本轮目标“${value}”${partial?'，仅判断实际可见部分，不将遮挡区当成已确认事实':''}？`});
  }
  const subjectId = `FD:${input.id}:subject`, subjectText = `人物设定：${input.subject.description}`;
  requirements.push({id:subjectId,channel:'identity',priority:'must',text:subjectText});
  sections.push({label:labels.identity,channel:'identity',items:[{text:subjectText,basis:[subjectId],intent:'constraint'}]});
  acceptance.push({id:`${subjectId}:check`,basis:subjectId,critical:true,question:`人物年龄、角色与媒介是否符合本轮设定“${input.subject.description}”？`});
  for (const [selector,trait] of known) project(selector,trait.value,'identity',trait);
  for (const [axis,value] of Object.entries(expression)) project(axis,value,channelFor(axis,data));
  for (const [axis,value] of Object.entries(presentation)) project(axis,value,channelFor(axis,data));
  return {...sourceInput(input),resolved_traits:resolved,identity_signature,
    prompt:sections.map(section => `【${section.label}】\n${section.items.map(item => item.text).join('\n')}`).join('\n\n'),
    requirements,sections,acceptance,
    provenance:{source:structuredClone(data.source),preset:input.preset??null,
      side_convention:'character_anatomical_left_right',
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
  const sideFacts = new Map();
  const validateReference = id => {
    const ref = refs.get(id);
    if (!ref || ref.inspected !== true || ref.generation_input !== true || !ref.authority?.includes('identity'))
      throw new Error(`face reference ${id} must exist, be inspected, have identity authority and be an actual generation_input`);
    return ref;
  };
  if (face.mode === 'reference_match') validateReference(face.reference_id);
  for (const [selector,trait] of observed) {
    const ref = validateReference(trait.reference_id);
    const known = ['visible','partial'].includes(trait.visibility);
    if (!known && trait.fact_id === undefined) continue;
    const fact = trait.fact_id === undefined
      ? ref.facts?.find(row => row.channel === 'identity' && row.text === trait.value && row.visibility === trait.visibility)
      : ref.facts?.find(row => row.id === trait.fact_id);
    if (!fact || fact.channel !== 'identity' || fact.text !== trait.value || fact.visibility !== trait.visibility)
      throw new Error(`observed trait ${selector} must exactly match an existing identity fact id, text and visibility in reference ${ref.id}`);
    if (!trait.side && ['left','right'].includes(fact.side))
      throw new Error(`flat observed trait ${selector} cannot use a one-sided fact; use the corresponding sided selector`);
    if (trait.side) {
      if (fact.side !== undefined && fact.side !== trait.side) throw new Error(`observed trait ${selector} conflicts with its fact side`);
      const key = `${ref.id}:${fact.id}`, priorSide = sideFacts.get(key);
      if (priorSide !== undefined && priorSide !== trait.side) throw new Error('left and right observed traits cannot reuse the same fact_id');
      sideFacts.set(key,trait.side);
    }
    if (!known) continue;
    const id = `FD:${face.id}:${selector}`;
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
    else if (section.channel === 'identity') next.sections.unshift(section);
    else next.sections.push(section);
  }
  compileProductionPrompt(next);
  return next;
}

export function reviseFaceDesign(baselineInput, change) {
  const baseline = buildFaceDesign(baselineInput);
  keys(change,['request','allowed_changes','traits','expression','presentation','identity_change','new_id','anchors'],'face revision');
  requiredText(change.request,'revision request');
  const data = catalog();
  if (!Array.isArray(change.allowed_changes) || !change.allowed_changes.length || new Set(change.allowed_changes).size !== change.allowed_changes.length)
    throw new Error('revision needs unique known allowed_changes axes');
  for (const selector of change.allowed_changes) {
    const {axis,side} = selectorInfo(selector,data);
    if (side && !isIdentity(axis,data)) throw new Error(`side-specific revision needs an identity trait: ${selector}`);
  }
  if (change.identity_change !== undefined && typeof change.identity_change !== 'boolean') throw new Error('identity_change must be boolean');
  if (change.anchors !== undefined) {
    if (!Array.isArray(change.anchors) || change.anchors.length < 3 || new Set(change.anchors).size !== change.anchors.length)
      throw new Error('anchor migration needs at least three unique identity anchors');
    const oldAnchors = new Set(baselineInput.anchors), newAnchors = new Set(change.anchors);
    for (const selector of [...oldAnchors].filter(anchor => !newAnchors.has(anchor)).concat([...newAnchors].filter(anchor => !oldAnchors.has(anchor)))) {
      const {axis} = selectorInfo(selector,data);
      if (!change.allowed_changes.includes(axis)) throw new Error(`anchor migration escaped whole-axis allowed_changes: ${axis}`);
    }
  }
  const next = sourceInput(baselineInput);
  const changed = [];
  for (const group of ['traits','expression','presentation']) {
    if (change[group] === undefined) continue;
    keys(change[group],groupAxes(data,group),`revision ${group}`);
    for (const [axis,value] of Object.entries(change[group])) {
      next[group] ??= {};
      if (group === 'traits' && sided(value)) {
        const rows = sideRows(axis,value,data), prior = next.traits[axis] ?? baseline.resolved_traits[axis];
        if (prior !== undefined && !sided(prior)) {
          if (!change.allowed_changes.includes(axis)) throw new Error(`flat-to-sided conversion requires whole-axis allowed_changes: ${axis}`);
          if (objectHash(prior) !== objectHash(value)) changed.push(axis);
          next.traits[axis] = structuredClone(value);
        } else {
          next.traits[axis] ??= {sides:{}};
          for (const [selector,{side,trait}] of rows) {
            if (!change.allowed_changes.includes(axis) && !change.allowed_changes.includes(selector)) throw new Error(`revision escaped allowed_changes: ${selector}`);
            if (objectHash(next.traits[axis].sides[side]??null) !== objectHash(trait)) changed.push(selector);
            next.traits[axis].sides[side] = structuredClone(trait);
          }
        }
        continue;
      }
      if (!change.allowed_changes.includes(axis)) throw new Error(`revision escaped allowed_changes: ${axis}`);
      // Expression may be inherited from a preset; writing that same effective
      // value into the input is not a visual revision. Keep trait declarations
      // intact here because origin, visibility and reference changes carry evidence.
      const prior = next[group][axis] ?? (group === 'expression' ? data.presets[next.preset]?.expression?.[axis] : undefined);
      const before = group === 'traits' ? prior ?? null : prior === undefined ? null : prose(prior,axis,data);
      const after = group === 'traits' ? value : prose(value,axis,data);
      if (objectHash(before) !== objectHash(after)) changed.push(axis);
      next[group][axis] = structuredClone(value);
    }
  }
  if (!changed.length) throw new Error('face revision needs an actual change');
  const nextValues = Object.fromEntries(knownTraits(resolveTraits(next,data)).map(([selector,trait]) => [selector,trait.value]));
  const identityValuesChanged = objectHash(baseline.identity_signature.traits) !== objectHash(nextValues);
  if (change.anchors !== undefined && !identityValuesChanged) throw new Error('anchor migration requires an actual identity structure change');
  if (identityValuesChanged) {
    if (change.identity_change !== true || !nonempty(change.new_id) || change.new_id === baselineInput.id)
      throw new Error('identity structure changes require identity_change true and a different new_id');
    // An authorized redesign can change a reference anchor. The resulting geometry
    // is a new design derived from that image, rather than a claim of exact matching.
    if (next.mode === 'reference_match') next.mode = 'new_design';
    if (change.anchors !== undefined) next.anchors = structuredClone(change.anchors);
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
      if (!['--input','--out','--brief','--change','--group'].includes(key) || !process.argv[i+1] || Object.hasOwn(options,key)) throw new Error('invalid face-design CLI options');
      options[key] = process.argv[i+1];
    }
    if (!['build','apply','revise','catalog'].includes(command) || (command !== 'catalog' && !options['--input']) ||
        (command==='catalog' && (options['--input'] || options['--brief'] || options['--change'])) ||
        (command!=='catalog' && options['--group']) ||
        (command==='apply'&&!options['--brief']) || (command==='revise'&&!options['--change']) ||
        (command!=='apply'&&options['--brief']) || (command!=='revise'&&options['--change']))
      throw new Error('usage: face-design.mjs catalog [--group philtrum] | build --input face.json [--out record.json] | apply --input face.json --brief brief.json [--out brief.json] | revise --input face.json --change change.json [--out face.json]');
    const read = file => JSON.parse(fs.readFileSync(file,'utf8'));
    const input = options['--input'] ? read(options['--input']) : undefined;
    const result = command === 'catalog' ? faceControlCatalog(options['--group']) : command === 'build' ? buildFaceDesign(input) : command === 'apply' ? applyFaceDesign(read(options['--brief']),input) : reviseFaceDesign(input,read(options['--change']));
    if (options['--out']) {
      const out = path.resolve(options['--out']);
      fs.mkdirSync(path.dirname(out),{recursive:true});
      fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    } else console.log(JSON.stringify(result,null,2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
