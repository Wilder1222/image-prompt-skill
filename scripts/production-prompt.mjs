import crypto from 'node:crypto';
import {adaptModelPrompt} from './model-adapter.mjs';
import {characterStyleIds} from './character-style-render.mjs';

// The host agent performs visual observation and design reasoning. This compiler only
// checks declared provenance, coverage and delivery integrity; it does not see images.
const channels = new Set(['identity','expression','action','makeup','hair','costume','material','composition','layout','proportion','hands_feet','background','lighting','style','task','output']);
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const referenceFields = new Set(['id','source','inspected','generation_input','authority','facts','identity_group','identity_role','identity_target_id']);
const inputFields = new Set(['subject_kind','request','references','requirements','unresolved','sections','acceptance','target','edit_scope','metadata']);
const internalStyle = new RegExp(`\\b(?:${characterStyleIds.join('|')})\\b`);
export const promptHash = text => crypto.createHash('sha256').update(text).digest('hex');

// Shared by revision classification and frozen records. Preserve array order.
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k,canonical(value[k])]));
  return value;
}
export const objectHash = value => promptHash(JSON.stringify(canonical(value)));

export function compileProductionPrompt(input) {
  const errors = [], basis = new Map(), references = new Map(), used = new Set();
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('production input must be an object');
  for (const key of Object.keys(input)) if (!inputFields.has(key)) errors.push(`unsupported production field ${key}; execution settings belong in target, notes belong in metadata`);
  if (input.metadata !== undefined && (!input.metadata || typeof input.metadata !== 'object' || Array.isArray(input.metadata))) errors.push('metadata must be an object and cannot configure execution');
  if (!['character','scene','product','other'].includes(input.subject_kind)) errors.push('declare subject_kind: character, scene, product or other; legacy briefs need explicit scope before new production');
  if (!nonempty(input.request)) errors.push('missing original user request');
  if (!Array.isArray(input.references)) errors.push('references must be an array; use [] for text-only requests');
  if (!Array.isArray(input.requirements) || !input.requirements.length) errors.push('missing request requirements');
  if (!Array.isArray(input.sections) || !input.sections.length) errors.push('missing reference-specific sections');
  if (!Array.isArray(input.unresolved) || input.unresolved.length) errors.push('resolve critical ambiguities and conflicts before delivery');
  if (errors.length) throw new Error(errors.join('\n'));
  function checkProse(text,label) {
    if (!nonempty(text) || /【|】|\bTODO\b|待填写|逐项填写|填写本套/.test(text)) errors.push(`unfinished clause in ${label}`);
    if (internalStyle.test(text ?? '')) errors.push(`replace internal style identifiers with concrete visual prose in ${label}`);
    if (/\b(?:render[ _-]+mode|style[ _-]+workflow|face[ _-]+mode|proportion[ _-]+mode|detail[ _-]+budget|highlight[ _-]+hierarchy|edge[ _-]+control)\s*[=:：＝]/i.test(text ?? '')) errors.push(`replace mode settings with concrete visual prose in ${label}`);
    if (/\b(?:style_asset|material_realistic_asset|dark_fantasy_asset|beauty_first|humanized_real|stylized_beauty|P9[ _]+Fashion|P9_FASHION_ASSET|BALANCED_ELEGANT|balanced_locked|NATURAL_ADULT|material_priority|concept_art_priority|focal_brightness|soft_realistic|painterly_selective)\b/i.test(text ?? '')) errors.push(`replace internal mode identifiers with concrete visual prose in ${label}`);
  }
  function add(row, type) {
    if (!nonempty(row?.id) || basis.has(row.id)) errors.push(`missing or duplicate basis id: ${row?.id}`);
    if (!nonempty(row?.text) || !channels.has(row?.channel)) errors.push(`invalid ${type}: ${row?.id}`);
    if (row?.id) basis.set(row.id, {...row, type});
  }
  for (const ref of input.references ?? []) {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
      errors.push('reference must be an object');
      continue;
    }
    for (const key of Object.keys(ref)) if (!referenceFields.has(key))
      errors.push(`unsupported reference field ${key}: ${ref.id ?? '(missing id)'}; reference roles do not enable weights, adapters or other execution controls`);
    if (!nonempty(ref?.id) || references.has(ref.id)) errors.push(`missing or duplicate reference: ${ref?.id}`);
    if (!nonempty(ref?.source) || ref?.inspected !== true) errors.push(`reference must actually be inspected: ${ref?.id}`);
    if (typeof ref?.generation_input !== 'boolean') errors.push(`declare generation_input: ${ref?.id}`);
    if (!Array.isArray(ref?.authority) || ref.authority.some(c => !channels.has(c))) errors.push(`invalid reference authority: ${ref?.id}`);
    if (!Array.isArray(ref?.facts) || !ref.facts.length) errors.push(`missing observed facts: ${ref?.id}`);
    references.set(ref?.id, ref);
    for (const fact of ref?.facts ?? []) {
      add({...fact, reference: ref.id}, 'observation');
      if (!['visible','partial','unknown','not_visible'].includes(fact.visibility)) errors.push(`invalid visibility: ${fact.id}`);
    }
  }
  const identitySources = [...references.values()].filter(r => r.authority?.includes('identity'));
  // Declared identity authority requires an actual input even when the authored
  // identity clause cites only a requirement rather than a particular fact.
  for (const ref of identitySources) {
    if (ref.generation_input !== true) errors.push(`identity reference ${ref.id} must be included in generation inputs`);
  }
  if (identitySources.length > 1) {
    const group=identitySources[0].identity_group;
    if(!nonempty(group)||identitySources.some(r=>r.identity_group!==group)||
      identitySources.filter(r=>r.identity_role==='primary').length!==1||
      identitySources.some(r=>!['primary','support'].includes(r.identity_role)||r.generation_input!==true))
      errors.push('conflicting identity authorities; current production supports one identity only: assign one primary identity reference and same-identity supporting views; separate people cannot be fused into one identity group');
  }
  for(const ref of references.values()){
    if(ref.identity_role!==undefined&&!['primary','support'].includes(ref.identity_role))
      errors.push(`invalid identity_role for ${ref.id}; use primary or support`);
    if(ref.identity_role==='support'&&!identitySources.some(r=>r.identity_role==='primary'&&nonempty(r.identity_group)&&r.identity_group===ref.identity_group))
      errors.push(`identity support needs its primary: ${ref.id}`);
    if(ref.identity_role&&!ref.authority?.includes('identity'))errors.push(`identity role requires identity authority: ${ref.id}`);
    if(ref.identity_target_id!==undefined && (!nonempty(ref.identity_target_id)||!ref.authority?.includes('identity'))) errors.push(`identity_target_id requires a nonempty stable identity target and identity authority: ${ref.id}`);
  }
  if(new Set(identitySources.map(r=>r.identity_target_id).filter(x=>x!==undefined)).size>1) errors.push('conflicting identity_target_id declarations for the same person');
  if(identitySources.some(r=>r.identity_target_id!==undefined) && !(identitySources.find(r=>r.identity_role==='primary')??identitySources[0])?.identity_target_id) errors.push('declare identity_target_id on the primary identity reference');
  for (const req of input.requirements ?? []) {
    add(req, 'requirement');
    if (!['must','prefer'].includes(req.priority)) errors.push(`invalid requirement priority: ${req.id}`);
  }
  // This is an authored scope declaration, not automatic subject recognition.
  // Keep numeric design intent out of the image approval decision itself.
  const proportions = input.requirements.filter(r => r.channel === 'proportion');
  const characterProportions = proportions.filter(r => r.priority === 'must');
  if (input.subject_kind === 'character') {
    if (!characterProportions.length) errors.push('character production requires a must proportion requirement');
    if (proportions.some(r => r.target_head_count !== undefined && (!Number.isFinite(r.target_head_count) || r.target_head_count <= 0))) errors.push('target_head_count must be a finite positive number when explicitly supplied');
    if (new Set(proportions.map(r => r.target_head_count).filter(n => n !== undefined)).size > 1) errors.push('conflicting target_head_count requirements');
  }
  const labels = new Set(), paragraphs = [];
  for (const section of input.sections ?? []) {
    if (!nonempty(section?.label) || /[【】\r\n]/.test(section.label) || labels.has(section.label)) errors.push(`invalid or duplicate section label: ${section?.label}`);
    labels.add(section?.label);
    if (/^\s*(?:\d+\s*[.．、:：)）]|[（(]?\d+[)）]|[一二三四五六七八九十百]+\s*[、.．:：)）]|[（(][一二三四五六七八九十百]+[)）]|P[012]\s)/.test(section?.label ?? '')) errors.push(`use an unnumbered semantic section label: ${section.label}`);
    if (!channels.has(section?.channel)) errors.push(`unknown section channel: ${section?.channel}`);
    if (!Array.isArray(section?.items) || !section.items.length) errors.push(`empty section: ${section?.label}`);
    const texts = [];
    for (const item of section?.items ?? []) {
      checkProse(item?.text,section.label);
      if (!['retain','design','remove','constraint'].includes(item?.intent)) errors.push(`invalid clause intent in ${section.label}`);
      if (item?.intent === 'design' && !nonempty(item.reason)) errors.push(`design extension needs a reason in ${section.label}`);
      if (!Array.isArray(item?.basis) || !item.basis.length) errors.push(`untraceable clause in ${section.label}`);
      const sourceRows = [];
      for (const id of item?.basis ?? []) {
        const row = basis.get(id);
        if (!row) { errors.push(`unknown clause basis: ${id}`); continue; }
        sourceRows.push(row); used.add(id);
        if (row.type !== 'observation') continue;
        const ref = references.get(row.reference);
        if (!ref?.authority?.includes(section.channel)) errors.push(`reference ${ref?.id} cannot control ${section.channel}`);
        if (item.intent === 'retain' && !['visible','partial'].includes(row.visibility)) errors.push(`cannot retain unseen fact as observed: ${id}`);
      }
      if (item?.intent === 'retain' && !sourceRows.some(r => r.type === 'observation')) errors.push(`retain needs an observed source in ${section.label}`);
      if (item?.intent === 'constraint' && !sourceRows.some(r => r.type === 'requirement')) errors.push(`constraint needs a user requirement in ${section.label}`);
      texts.push(item?.text?.trim() ?? '');
    }
    paragraphs.push(`【${section?.label}】\n${texts.join('\n')}`);
  }
  for (const req of input.requirements ?? []) if (req.priority === 'must' && !used.has(req.id)) errors.push(`uncovered required instruction: ${req.id}`);
  for (const req of input.subject_kind === 'character' ? characterProportions : []) {
    if (!input.sections.some(s => s.channel === 'proportion' && s.items?.some(i => i.basis?.includes(req.id)))) errors.push(`character proportion needs its own authored proportion clause: ${req.id}`);
  }
  if (!Array.isArray(input.acceptance) || !input.acceptance.length) errors.push('missing image acceptance criteria');
  const criterionIds = new Set();
  for (const criterion of input.acceptance ?? []) {
    if (!nonempty(criterion?.id) || criterionIds.has(criterion.id) || !nonempty(criterion?.question) || typeof criterion?.critical !== 'boolean') errors.push('invalid or duplicate image criterion');
    criterionIds.add(criterion?.id);
    if (!basis.has(criterion?.basis)) errors.push(`unknown acceptance basis: ${criterion?.basis}`);
  }
  for (const req of input.requirements) {
    if (req.priority === 'must' && !input.acceptance?.some(c => c.basis === req.id && c.critical === true)) errors.push(`missing critical image criterion for required instruction: ${req.id}`);
  }
  let editScope;
  if (input.edit_scope !== undefined) {
    const scope=input.edit_scope, baseline=references.get(scope?.baseline_reference_id);
    if (!scope || typeof scope !== 'object' || Array.isArray(scope) ||
        Object.keys(scope).some(k=>!['baseline_reference_id','changes','preserve'].includes(k)) ||
        !nonempty(scope.baseline_reference_id) || !baseline || baseline.generation_input!==true ||
        !Array.isArray(scope.changes) || !scope.changes.length || scope.changes.some(x=>!nonempty(x)) ||
        !Array.isArray(scope.preserve) || !scope.preserve.length || scope.preserve.some(x=>!nonempty(x))) {
      errors.push('edit_scope requires an actual input baseline_reference_id, nonempty changes and preserve lists');
    } else {
      if (labels.has('本次编辑范围') || criterionIds.has('__edit_scope__')) errors.push('reserved edit scope label or criterion');
      for(const text of [...scope.changes,...scope.preserve])checkProse(text,'本次编辑范围');
      editScope=structuredClone(scope);
      const scopeList=items=>items.map(text=>`- ${text.trim()}`).join('\n');
      paragraphs.push(`【本次编辑范围】\n允许修改：\n${scopeList(scope.changes)}\n\n必须保持：\n${scopeList(scope.preserve)}`);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const prompt = paragraphs.join('\n\n');
  const referenceInputs=input.references.filter(r=>r.generation_input).map(r=>({id:r.id,source:r.source}));
  const inputPositions=new Map(referenceInputs.map((r,index)=>[r.id,index+1]));
  // Trace authored clauses back to observations without interpreting the prose.
  // Positions follow filtered tool inputs, not the full observation list.
  const referenceUsage=input.references.map(ref=>{
    const factIds=new Set(ref.facts.map(f=>f.id));
    const clauseUses=input.sections.flatMap(section=>section.items.flatMap((item,index)=>{
      const facts=[...new Set(item.basis.filter(id=>factIds.has(id)))];
      return facts.length?[{section:section.label,channel:section.channel,item_index:index,facts}]:[];
    }));
    return {id:ref.id,delivery:ref.generation_input?'image_input':'observation_only',
      input_position:inputPositions.get(ref.id)??null,authority:[...ref.authority],
      used_facts:ref.facts.filter(f=>used.has(f.id)).map(f=>f.id),clause_uses:clauseUses};
  });
  const compiled = {
    status: 'prompt_ready', subject_kind: input.subject_kind, prompt, prompt_sha256: promptHash(prompt),
    ...(editScope?{edit_scope:editScope}:{}),
    reference_inputs: referenceInputs,
    acceptance: input.acceptance,
    audit: { coverage: input.requirements.map(r => ({id:r.id, covered:used.has(r.id)})), unused_observations:[...basis.values()].filter(r => r.type==='observation'&&!used.has(r.id)).map(r=>r.id), reference_usage:referenceUsage },
    evidence: { provenance_checked:true, semantic_quality_verified:false, image_generated:false, visual_quality_verified:false, user_accepted:false },
    note: 'The agent must review meaning against the actual images and request. Declared provenance and complete coverage do not prove good visual results.',
  };
  if (input.target !== undefined) compiled.model_execution = adaptModelPrompt(compiled, input.target);
  return compiled;
}

// Apply only the categories the current user change permits. The agent still reviews meaning.
export function reviseProductionInput(input, change) {
  compileProductionPrompt(input);
  if(!nonempty(change?.request)||!Array.isArray(change?.channels)||!change.channels.length||change.channels.some(c=>!channels.has(c)))throw new Error('revision needs a request and allowed channels');
  const unknownKeys=Object.keys(change).filter(k=>!['request','channels','sections','requirements','acceptance','edit_scope'].includes(k));
  if(unknownKeys.length)throw new Error(`unsupported revision fields: ${unknownKeys.join(', ')}; reference or model changes need a newly reviewed complete brief`);
  if(!Array.isArray(change.sections)||!change.sections.length)throw new Error('revision needs section changes');
  const next=structuredClone(input), changedLabels=new Set();
  if(input.edit_scope!==undefined&&change.edit_scope===undefined)throw new Error('refresh edit_scope for each scoped revision');
  if(change.edit_scope!==undefined)next.edit_scope=structuredClone(change.edit_scope);
  for(const update of change.sections){
    const section=next.sections.find(s=>s.label===update.label);
    if(!section||!change.channels.includes(section.channel)||changedLabels.has(update.label))throw new Error('section revision escaped allowed scope');
    if(Object.keys(update).some(k=>!['label','items'].includes(k)))throw new Error('section updates may only replace items');
    section.items=structuredClone(update.items);changedLabels.add(update.label);
  }
  for(const key of ['requirements','acceptance']){
    const seen=new Set();
    for(const update of change[key]??[]){
      const old=next[key].find(r=>r.id===update.id);
      const channel=key==='requirements'?old?.channel:input.requirements.find(r=>r.id===old?.basis)?.channel??input.references.flatMap(r=>r.facts).find(f=>f.id===old?.basis)?.channel;
      if(!old||!change.channels.includes(channel)||seen.has(update.id))throw new Error(`${key} revision escaped allowed scope`);
      if(key==='requirements'&&update.channel!==old.channel)throw new Error('cannot redirect requirement channel');
      if(key==='acceptance'&&update.basis!==old.basis)throw new Error('cannot redirect acceptance basis');
      next[key][next[key].findIndex(r=>r.id===update.id)]=structuredClone(update);seen.add(update.id);
    }
  }
  next.request+='\n本轮用户修改：'+change.request;
  const compiled=compileProductionPrompt(next);
  return {input:next,compiled,changed_sections:[...changedLabels],
    target_changed:objectHash({requirements:input.requirements,acceptance:input.acceptance})!==objectHash({requirements:next.requirements,acceptance:next.acceptance})};
}

export function reviewProductionResult(compiled, review) {
  if (compiled.model_execution && review?.execution_sha256 !== compiled.model_execution.execution_sha256) throw new Error('review must reference the exact model execution_sha256');
  if (!review || review.prompt_sha256 !== compiled.prompt_sha256) throw new Error('review must reference the exact submitted prompt');
  if (!nonempty(review.output_image) || !/^[a-f0-9]{64}$/.test(review.output_sha256 ?? '')) throw new Error('review needs an actual output image and its SHA-256');
  if (review.inspected !== true || !nonempty(review.reviewer)) throw new Error('output must be inspected by a named reviewer');
  if (!Array.isArray(review.checks)) throw new Error('review checks must be an array');
  const ids = review.checks.map(c => c.id);
  if (new Set(ids).size !== ids.length || ids.some(id => !compiled.acceptance.some(c => c.id===id))) throw new Error('unknown or duplicate review criterion');
  const results = compiled.acceptance.map(criterion => {
    const check = review.checks.find(c => c.id===criterion.id);
    if (!check || !['pass','fail','uncertain','not_assessable'].includes(check.verdict) || !nonempty(check.evidence)) throw new Error(`missing supported review: ${criterion.id}`);
    // Review evidence cannot rewrite the acceptance contract established before generation.
    return {...criterion, verdict:check.verdict, evidence:check.evidence};
  });
  const criticalFailures = results.filter(c => c.critical && c.verdict==='fail');
  const uncertain = results.filter(c => c.critical && ['uncertain','not_assessable'].includes(c.verdict));
  return {
    status: criticalFailures.length ? 'needs_revision' : uncertain.length ? 'needs_review' : 'reviewer_qualified',
    checks:results, critical_failures:criticalFailures.map(c=>c.id), unresolved:uncertain.map(c=>c.id),
    output_image:review.output_image, prompt_sha256:compiled.prompt_sha256,
    user_accepted:false,
    note:'Reviewer assessment applies to this output only; it is not automatic user acceptance or evidence of batch reliability.',
  };
}
