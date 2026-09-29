import crypto from 'node:crypto';

// The host agent performs visual observation and design reasoning. This compiler only
// checks declared provenance, coverage and delivery integrity; it does not see images.
const channels = new Set(['identity','expression','makeup','hair','costume','material','composition','proportion','hands_feet','background','lighting','style','task','output']);
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
export const promptHash = text => crypto.createHash('sha256').update(text).digest('hex');

export function compileProductionPrompt(input) {
  const errors = [], basis = new Map(), references = new Map(), used = new Set();
  if (!input || typeof input !== 'object') throw new Error('production input must be an object');
  if (!nonempty(input.request)) errors.push('missing original user request');
  if (!Array.isArray(input.references)) errors.push('references must be an array; use [] for text-only requests');
  if (!Array.isArray(input.requirements) || !input.requirements.length) errors.push('missing request requirements');
  if (!Array.isArray(input.sections) || !input.sections.length) errors.push('missing reference-specific sections');
  if (!Array.isArray(input.unresolved) || input.unresolved.length) errors.push('resolve critical ambiguities and conflicts before delivery');
  if (errors.length) throw new Error(errors.join('\n'));
  function add(row, type) {
    if (!nonempty(row?.id) || basis.has(row.id)) errors.push(`missing or duplicate basis id: ${row?.id}`);
    if (!nonempty(row?.text) || !channels.has(row?.channel)) errors.push(`invalid ${type}: ${row?.id}`);
    if (row?.id) basis.set(row.id, {...row, type});
  }
  for (const ref of input.references ?? []) {
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
  if (identitySources.length > 1) {
    const group=identitySources[0].identity_group;
    if(!nonempty(group)||identitySources.some(r=>r.identity_group!==group)||
      identitySources.filter(r=>r.identity_role==='primary').length!==1||
      identitySources.some(r=>!['primary','support'].includes(r.identity_role)||r.generation_input!==true))
      errors.push('conflicting identity authorities; assign one primary identity reference and same-identity supporting views');
  }
  for(const ref of input.references){
    if(ref.identity_role==='support'&&!identitySources.some(r=>r.identity_role==='primary'&&nonempty(r.identity_group)&&r.identity_group===ref.identity_group))
      errors.push(`identity support needs its primary: ${ref.id}`);
    if(ref.identity_role&&!ref.authority?.includes('identity'))errors.push(`identity role requires identity authority: ${ref.id}`);
  }
  for (const req of input.requirements ?? []) {
    add(req, 'requirement');
    if (!['must','prefer'].includes(req.priority)) errors.push(`invalid requirement priority: ${req.id}`);
  }
  const labels = new Set(), paragraphs = [];
  for (const section of input.sections ?? []) {
    if (!nonempty(section?.label) || /[【】\r\n]/.test(section.label) || labels.has(section.label)) errors.push(`invalid or duplicate section label: ${section?.label}`);
    labels.add(section?.label);
    if (!channels.has(section?.channel)) errors.push(`unknown section channel: ${section?.channel}`);
    if (!Array.isArray(section?.items) || !section.items.length) errors.push(`empty section: ${section?.label}`);
    const texts = [];
    for (const item of section?.items ?? []) {
      if (!nonempty(item?.text) || /【|】|\bTODO\b|待填写|逐项填写|填写本套/.test(item.text)) errors.push(`unfinished clause in ${section.label}`);
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
        if (section.channel === 'identity' && ref?.generation_input !== true) errors.push(`identity reference ${ref?.id} must be included in generation inputs`);
      }
      if (item?.intent === 'retain' && !sourceRows.some(r => r.type === 'observation')) errors.push(`retain needs an observed source in ${section.label}`);
      if (item?.intent === 'constraint' && !sourceRows.some(r => r.type === 'requirement')) errors.push(`constraint needs a user requirement in ${section.label}`);
      texts.push(item?.text?.trim() ?? '');
    }
    paragraphs.push(`【${section?.label}】\n${texts.join('\n')}`);
  }
  for (const req of input.requirements ?? []) if (req.priority === 'must' && !used.has(req.id)) errors.push(`uncovered required instruction: ${req.id}`);
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
  if (errors.length) throw new Error(errors.join('\n'));
  const prompt = paragraphs.join('\n\n');
  return {
    status: 'prompt_ready', prompt, prompt_sha256: promptHash(prompt),
    reference_inputs: input.references.filter(r => r.generation_input).map(r => ({id:r.id, source:r.source})),
    acceptance: input.acceptance,
    audit: { coverage: input.requirements.map(r => ({id:r.id, covered:used.has(r.id)})), unused_observations:[...basis.values()].filter(r => r.type==='observation'&&!used.has(r.id)).map(r=>r.id) },
    evidence: { provenance_checked:true, semantic_quality_verified:false, image_generated:false, visual_quality_verified:false, user_accepted:false },
    note: 'The agent must review meaning against the actual images and request. Declared provenance and complete coverage do not prove good visual results.',
  };
}

// Apply only the categories the current user change permits. The agent still reviews meaning.
export function reviseProductionInput(input, change) {
  compileProductionPrompt(input);
  if(!nonempty(change?.request)||!Array.isArray(change?.channels)||!change.channels.length||change.channels.some(c=>!channels.has(c)))throw new Error('revision needs a request and allowed channels');
  if(!Array.isArray(change.sections)||!change.sections.length)throw new Error('revision needs section changes');
  const next=structuredClone(input), changedLabels=new Set();
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
    target_changed:JSON.stringify(input.requirements)!==JSON.stringify(next.requirements)||JSON.stringify(input.acceptance)!==JSON.stringify(next.acceptance)};
}

export function reviewProductionResult(compiled, review) {
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
