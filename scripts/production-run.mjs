import fs from 'node:fs';
import {adaptModelPrompt,verifyModelPlan,verifyRuntimeValidation} from './model-adapter.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileProductionPrompt, reviewProductionResult, promptHash, objectHash} from './production-prompt.mjs';
export {canonical,objectHash} from './production-prompt.mjs';
const fileHash = file => promptHash(fs.readFileSync(file));
const read = file => JSON.parse(fs.readFileSync(file,'utf8'));
const preservationContract = 'preservation_items_v1';
const targetContract = 'identity_sources_v1';
export function writeNew(file,value) { fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true}); fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'}); }

function identityTargets(refs, parent) {
  const identities=refs.filter(r=>r.authority.includes('identity'));
  if(!identities.length)return [];
  const primary=identities.find(r=>r.identity_role==='primary')??identities[0];
  const group=primary.identity_group??null, id=primary.identity_target_id??null;
  // A stable, explicitly declared identity target survives a new view or edit baseline.
  // Without that declaration, a different primary source creates a new goal.
  const prior=id&&parent?.target_contract===targetContract
    ? parent.target.identity_targets.find(t=>t.identity_target_id===id&&t.identity_group===group) : null;
  return [{identity_group:group,identity_target_id:id,origin:prior?.origin??{
    reference_id:primary.id,content_sha256:primary.content_sha256
  }}];
}

export function freezeProductionRun(input, options={}) {
  const compiled=compileProductionPrompt(input);
  for(const key of ['run_id','case_id','cohort']) if(typeof options[key]!=='string'||!options[key].trim()) throw new Error(`missing ${key}`);
  const kind=options.kind??'initial';
  if(!['initial','revision','edit'].includes(kind))throw new Error('invalid run kind');
  if(kind!=='initial'&&!options.parent)throw new Error('a revision needs its frozen parent');
  if(kind==='initial'&&options.parent)throw new Error('initial run cannot have a parent');
  if(kind==='edit'&&!compiled.edit_scope)throw new Error('new edit runs require edit_scope in the brief');
  if(kind==='initial'&&compiled.edit_scope)throw new Error('edit_scope needs an edit or revision with a parent');
  if(options.parent)verifyFrozenRun(options.parent,{verifyFiles:false});
  const refs=input.references.map(r=>({...r,source:path.resolve(options.base_dir??process.cwd(),r.source),content_sha256:fileHash(path.resolve(options.base_dir??process.cwd(),r.source))}));
  const target={subject_kind:input.subject_kind,requirements:input.requirements,acceptance:compiled.acceptance,
    identity_targets:identityTargets(refs,options.parent)};
  const targetHash=objectHash(target);
  if(compiled.model_execution)compiled.model_execution=adaptModelPrompt({...compiled,reference_inputs:refs.filter(r=>r.generation_input).map(r=>({id:r.id,source:r.source}))},input.target);
  if(options.parent&&(options.parent.case_id!==options.case_id||options.parent.cohort!==options.cohort))throw new Error('revision case and cohort must match parent');
  const record={schema_version:1,target_contract:targetContract,run_id:options.run_id,case_id:options.case_id,cohort:options.cohort,kind,
    created_at:new Date().toISOString(),tool:compiled.model_execution?.transport??'built-in image_gen',
    tool_parameters:compiled.model_execution?{model:compiled.model_execution.model,...compiled.model_execution.settings}:{model:null,seed:null},
    ...(compiled.model_execution?{model_execution:compiled.model_execution}:{}),
    ...(compiled.edit_scope?{edit_scope:compiled.edit_scope,scope_review_contract:preservationContract}:{}),
    parent:options.parent?{run_id:options.parent.run_id,snapshot_sha256:options.parent.snapshot_sha256}:null,
    goal_changed:options.parent?options.parent.target_sha256!==targetHash:false,
    request:input.request,target,target_sha256:targetHash,references:refs,
    prompt:compiled.prompt,prompt_sha256:compiled.prompt_sha256,
    actual_inputs:refs.filter(r=>r.generation_input).map(r=>({id:r.id,source:r.source,content_sha256:r.content_sha256}))};
  const frozenRecord=structuredClone(record);
  return {...frozenRecord,snapshot_sha256:objectHash(frozenRecord)};
}

export function verifyFrozenRun(snapshot,{verifyFiles=true,runtimeValidation}={}) {
  if(snapshot?.schema_version!==1)throw new Error('unsupported run snapshot');
  const {snapshot_sha256,...body}=snapshot;
  if(objectHash(body)!==snapshot_sha256)throw new Error('frozen snapshot changed');
  if(Object.hasOwn(snapshot,'scope_review_contract') &&
      (snapshot.scope_review_contract!==preservationContract || !snapshot.edit_scope))
    throw new Error('unsupported scope review contract');
  if(Object.hasOwn(snapshot,'target_contract') && (snapshot.target_contract!==targetContract || !Array.isArray(snapshot.target?.identity_targets))) throw new Error('unsupported identity target contract');
  if(promptHash(snapshot.prompt)!==snapshot.prompt_sha256||objectHash(snapshot.target)!==snapshot.target_sha256)throw new Error('frozen prompt or target changed');
  const inputs=snapshot.references.filter(r=>r.generation_input).map(r=>({id:r.id,source:r.source,content_sha256:r.content_sha256}));
  if(objectHash(inputs)!==objectHash(snapshot.actual_inputs))throw new Error('actual input order or roles changed');
  if(verifyFiles)for(const ref of snapshot.references)if(fileHash(ref.source)!==ref.content_sha256)throw new Error(`reference content changed: ${ref.id}`);
  if(snapshot.model_execution){
    verifyModelPlan(snapshot.model_execution);
    if(snapshot.model_execution.prompt_sha256!==snapshot.prompt_sha256)throw new Error('模型执行计划与正文不一致');
    const required=snapshot.model_execution.runtime_validation_required;
    if(runtimeValidation!==undefined)verifyRuntimeValidation(snapshot.model_execution,runtimeValidation);
    return {transport:snapshot.model_execution.transport,model:snapshot.model_execution.model,
      request:snapshot.model_execution.request,runtime:snapshot.model_execution.runtime,
      ...(required?{dispatch_ready:runtimeValidation!==undefined,runtime_validation_required:required}:{}),
      execution_sha256:snapshot.model_execution.execution_sha256};
  }
  return {prompt:snapshot.prompt,...(inputs.length?{referenced_image_paths:inputs.map(r=>r.source)}:{})};
}

// Recompute review meaning from the frozen contract without accessing image files.
function evaluateCompletedReview(snapshot, receipt) {
  if(snapshot.model_execution && receipt.execution_sha256!==snapshot.model_execution.execution_sha256)throw new Error('回执必须绑定实际模型、参数与完整请求的 execution_sha256');
  if(snapshot.model_execution?.runtime_validation_required)verifyRuntimeValidation(snapshot.model_execution,receipt.runtime_validation);
  if(receipt.target_sha256!==snapshot.target_sha256)throw new Error('review target changed');
  const verdict=reviewProductionResult({prompt_sha256:snapshot.prompt_sha256,acceptance:snapshot.target.acceptance},receipt);
  let scopeReview;
  if(snapshot.edit_scope){
    const scope=receipt.scope_review;
    if(!scope || !['pass','fail','uncertain','not_assessable'].includes(scope.verdict) ||
       typeof scope.change_evidence!=='string'||!scope.change_evidence.trim() ||
       typeof scope.preservation_evidence!=='string'||!scope.preservation_evidence.trim())
      throw new Error('scoped edit needs scope_review with change_evidence and preservation_evidence');
    scopeReview={verdict:scope.verdict,change_evidence:scope.change_evidence,preservation_evidence:scope.preservation_evidence};
    if(snapshot.scope_review_contract===preservationContract){
      const protectedItems=snapshot.edit_scope.preserve,checks=scope.preservation_checks;
      const rank={pass:0,uncertain:1,not_assessable:1,fail:2};
      if(!Array.isArray(checks) || checks.length!==protectedItems.length ||
          checks.some(c=>!c || !Number.isSafeInteger(c.index) || c.index<0 || c.index>=protectedItems.length ||
            !Object.hasOwn(rank,c.verdict) || typeof c.evidence!=='string' || !c.evidence.trim()) ||
          new Set(checks.map(c=>c.index)).size!==protectedItems.length)
        throw new Error('preservation_checks must cover every frozen protected item exactly once with its index, verdict and evidence');
      scopeReview.declared_verdict=scope.verdict;
      scopeReview.preservation_checks=[...checks].sort((a,b)=>a.index-b.index).map(c=>({
        index:c.index,requirement:protectedItems[c.index],verdict:c.verdict,evidence:c.evidence
      }));
      for(const check of checks)if(rank[check.verdict]>rank[scopeReview.verdict])scopeReview.verdict=check.verdict;
    }else if(scope.preservation_checks!==undefined)throw new Error('per-item scope review contract was not frozen for this historical run');
    if(scopeReview.verdict==='fail')verdict.critical_failures.push('__edit_scope__');
    if(['uncertain','not_assessable'].includes(scopeReview.verdict))verdict.unresolved.push('__edit_scope__');
    verdict.status=verdict.critical_failures.length?'needs_revision':verdict.unresolved.length?'needs_review':'reviewer_qualified';
  }else if(receipt.scope_review!==undefined)throw new Error('scope_review cannot claim an unfrozen edit scope');
  return {verdict,scopeReview};
}

export function finishProductionRun(snapshot, receipt, baseDir=process.cwd()) {
  verifyFrozenRun(snapshot);
  if(receipt.snapshot_sha256!==snapshot.snapshot_sha256)throw new Error('receipt must bind the frozen run');
  if(receipt.status==='tool_error'){
    if(typeof receipt.error!=='string'||!receipt.error.trim()||receipt.output_image)throw new Error('tool error needs a reason and no output');
    return {run_id:snapshot.run_id,snapshot_sha256:snapshot.snapshot_sha256,status:'tool_error',error:receipt.error,recorded_at:new Date().toISOString()};
  }
  if(receipt.status==='interrupted'){
    if(typeof receipt.reason!=='string'||!receipt.reason.trim()||receipt.output_image||!['not_started','started','unknown'].includes(receipt.dispatch_state))throw new Error('interruption needs a reason, dispatch state and no claimed output');
    return {run_id:snapshot.run_id,snapshot_sha256:snapshot.snapshot_sha256,status:'interrupted',reason:receipt.reason,dispatch_state:receipt.dispatch_state,recorded_at:new Date().toISOString()};
  }
  if(receipt.status!=='completed')throw new Error('receipt status must be completed, tool_error or interrupted');
  const {verdict,scopeReview}=evaluateCompletedReview(snapshot,receipt);
  const output=path.resolve(baseDir,receipt.output_image??'');
  if(fileHash(output)!==receipt.output_sha256)throw new Error('output content changed');
  return {...verdict,run_id:snapshot.run_id,snapshot_sha256:snapshot.snapshot_sha256,target_sha256:snapshot.target_sha256,
    ...(scopeReview?{edit_scope:structuredClone(snapshot.edit_scope),scope_review:scopeReview}:{}),
    ...(snapshot.model_execution?{execution_sha256:receipt.execution_sha256}:{}),
    ...(snapshot.model_execution?.runtime_validation_required?{runtime_validation:structuredClone(receipt.runtime_validation)}:{}),
    output_image:output,output_sha256:receipt.output_sha256,execution_status:'completed',inspected:true,reviewer:receipt.reviewer,recorded_at:new Date().toISOString()};
}

function verifyOutcomeReview(snapshot, outcome) {
  if(['tool_error','interrupted'].includes(outcome.status)) {
    const reason=outcome.status==='tool_error'?outcome.error:outcome.reason;
    if(typeof reason!=='string'||!reason.trim()||outcome.output_image||outcome.output_sha256||
        outcome.execution_status!==undefined||outcome.checks!==undefined||
        (outcome.status==='interrupted'&&!['not_started','started','unknown'].includes(outcome.dispatch_state)))
      throw new Error('noncompleted outcome needs a reason and cannot claim output or completed review');
    return;
  }
  if(outcome.execution_status!=='completed')throw new Error('reviewed outcome must have completed execution');
  const receipt={...outcome};
  // Restore the original aggregate observation, then combine it with protected items.
  if(snapshot.scope_review_contract===preservationContract && outcome.scope_review)
    receipt.scope_review={...outcome.scope_review,verdict:outcome.scope_review.declared_verdict};
  const {verdict,scopeReview}=evaluateCompletedReview(snapshot,receipt);
  for(const key of ['status','checks','critical_failures','unresolved'])
    if(objectHash(outcome[key]??null)!==objectHash(verdict[key]))throw new Error(`outcome ${key} conflicts with frozen review`);
  if(objectHash(outcome.edit_scope??null)!==objectHash(snapshot.edit_scope??null)||
      objectHash(outcome.scope_review??null)!==objectHash(scopeReview??null))
    throw new Error('outcome edit scope conflicts with frozen review');
}

export function summarizeProductionRuns(entries,{userFeedback=[]}={}) {
  const byId=new Map(), outputs=new Map(), reused=new Set(), conflicts=new Set();
  for(const {snapshot:s,outcome:o}of entries){
    verifyFrozenRun(s,{verifyFiles:false});
    if(byId.has(s.run_id))throw new Error('duplicate run id');
    if(o&&(o.run_id!==s.run_id||o.snapshot_sha256!==s.snapshot_sha256))throw new Error('outcome belongs to another snapshot');
    if(o)verifyOutcomeReview(s,o);
    byId.set(s.run_id,{snapshot:s,outcome:o});
    if(o?.output_sha256){const group=outputs.get(o.output_sha256)??[];group.push({snapshot:s,outcome:o});outputs.set(o.output_sha256,group);}
  }
  if(!Array.isArray(userFeedback))throw new Error('user feedback must be an array');
  const userRejected=new Set();
  for(const note of userFeedback){
    const row=byId.get(note?.run_id);
    if(!note||typeof note!=='object'||Array.isArray(note)||Object.keys(note).some(k=>!['run_id','snapshot_sha256','output_sha256','verdict','message','score','source'].includes(k))||
        !row?.outcome?.output_sha256||note.snapshot_sha256!==row.snapshot.snapshot_sha256||note.output_sha256!==row.outcome.output_sha256||
        note.verdict!=='rejected'||note.source!=='direct_user_message'||typeof note.message!=='string'||!note.message.trim()||
        (note.score!==undefined&&(!Number.isFinite(note.score)||note.score<0))||userRejected.has(note.run_id))throw new Error('user rejection must uniquely bind the original run, snapshot and output with a direct message');
    userRejected.add(note.run_id);
  }
  for(const group of outputs.values()){
    // Freeze time and run id provide a stable fallback when dispatch order is unknown.
    group.sort((a,b)=>(a.snapshot.created_at??'').localeCompare(b.snapshot.created_at??'')||a.snapshot.run_id.localeCompare(b.snapshot.run_id));
    for(const entry of group.slice(1))reused.add(entry.snapshot.run_id);
    for(const target of new Set(group.map(e=>e.snapshot.target_sha256))){
      const reviews=group.filter(e=>e.snapshot.target_sha256===target);
      const decisions=new Set(reviews.map(e=>objectHash(e.outcome.checks.map(c=>({id:c.id,verdict:c.verdict})).sort((a,b)=>a.id.localeCompare(b.id)))));
      if(decisions.size>1)for(const e of reviews)conflicts.add(e.snapshot.run_id);
    }
  }
  for(const {snapshot:s}of entries)if(s.parent){
    const p=byId.get(s.parent.run_id)?.snapshot;
    if(!p||p.snapshot_sha256!==s.parent.snapshot_sha256||p.cohort!==s.cohort||p.case_id!==s.case_id)throw new Error('missing or mismatched run parent');
    if(s.goal_changed!==(s.target_sha256!==p.target_sha256))throw new Error('incorrect target-change classification');
    const visited=new Set([s.run_id]);let cursor=p;
    while(cursor){if(visited.has(cursor.run_id))throw new Error('cyclic run lineage');visited.add(cursor.run_id);cursor=cursor.parent?byId.get(cursor.parent.run_id)?.snapshot:null;}
  }
  const cohorts={};
  for(const cohort of new Set(entries.map(e=>e.snapshot.cohort))){
    const rows=entries.filter(e=>e.snapshot.cohort===cohort),initial=rows.filter(e=>e.snapshot.kind==='initial');
    const completed=initial.filter(e=>e.outcome?.execution_status==='completed'&&!reused.has(e.snapshot.run_id));
    const descendants=(root)=>{
      const found=new Set([root.run_id]);let changed=true;
      while(changed){changed=false;for(const {snapshot:s}of rows)if(s.parent&&found.has(s.parent.run_id)&&!s.goal_changed&&!found.has(s.run_id)){found.add(s.run_id);changed=true;}}
      return rows.filter(e=>found.has(e.snapshot.run_id)&&!reused.has(e.snapshot.run_id));
    };
    const originalPasses=e=>e.outcome?.status==='reviewer_qualified'&&!conflicts.has(e.snapshot.run_id);
    const passes=e=>originalPasses(e)&&!userRejected.has(e.snapshot.run_id);
    cohorts[cohort]={runs_planned:rows.length,known_tool_calls:rows.filter(e=>e.outcome?.execution_status==='completed'||e.outcome?.status==='tool_error'||e.outcome?.dispatch_state==='started').length,initial_planned:initial.length,initial_completed:completed.length,
      initial_passed:completed.filter(passes).length,
      resolved_without_goal_change:completed.filter(e=>descendants(e.snapshot).some(passes)).length,
      unresolved_reviews:rows.filter(e=>e.outcome?.status==='needs_review').length,
      failures:rows.filter(e=>e.outcome?.status==='needs_revision').length,
      tool_errors:rows.filter(e=>e.outcome?.status==='tool_error').length,pending:rows.filter(e=>!e.outcome).length,
      interrupted:rows.filter(e=>e.outcome?.status==='interrupted').length,dispatch_unknown:rows.filter(e=>e.outcome?.status==='interrupted'&&e.outcome.dispatch_state==='unknown').length,
      reused_outputs:rows.filter(e=>reused.has(e.snapshot.run_id)).length,
      review_conflicts:new Set(rows.filter(e=>conflicts.has(e.snapshot.run_id)).map(e=>`${e.outcome.output_sha256}:${e.snapshot.target_sha256}`)).size,
      ...(userFeedback.length?{original_initial_passed:completed.filter(originalPasses).length,
        original_resolved_without_goal_change:completed.filter(e=>descendants(e.snapshot).some(originalPasses)).length,
        user_rejected:rows.filter(e=>userRejected.has(e.snapshot.run_id)).length}:{}),
      goal_changes:rows.filter(e=>e.snapshot.goal_changed).length};
  }
  return {cohorts,user_acceptance:'not_inferred',...(userFeedback.length?{user_feedback:structuredClone(userFeedback)}:{}),deduplication_order:'snapshot_created_at_then_run_id_not_verified_dispatch_order',note:'Counts recheck declared reviews against frozen criteria; no image files, dispatch logs or visual evidence are re-inspected. Reused outputs, conflicting reviews, explicit user rejections and changed targets do not create successes. Feedback preserves original reviews and does not imply user approval or authenticate its source.'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const [command,...args]=process.argv.slice(2),opts={};
    for(let i=0;i<args.length;i+=2){if(!args[i]?.startsWith('--')||!args[i+1]||args[i+1].startsWith('--'))throw new Error('options require values');opts[args[i].slice(2)]=args[i+1];}
    let result;
    if(command==='prepare')result=freezeProductionRun(read(opts.input),{run_id:opts.id,case_id:opts.case,cohort:opts.cohort,kind:opts.kind,parent:opts.parent?read(opts.parent):null,base_dir:path.dirname(path.resolve(opts.input))});
    else if(command==='inspect')result=verifyFrozenRun(read(opts.snapshot),{runtimeValidation:opts['runtime-check']?read(opts['runtime-check']):undefined});
    else if(command==='review')result=finishProductionRun(read(opts.snapshot),read(opts.receipt),path.dirname(path.resolve(opts.receipt)));
    else if(command==='report')result=summarizeProductionRuns(read(opts.input).map(e=>({snapshot:read(e.snapshot),outcome:e.outcome?read(e.outcome):null})),{userFeedback:opts['user-feedback']?read(opts['user-feedback']):[]});
    else throw new Error('commands: prepare --input brief.json --id ID --case CASE --cohort GROUP --out snapshot.json | inspect --snapshot snapshot.json | review --snapshot snapshot.json --receipt receipt.json --out outcome.json | report --input entries.json');
    if(opts.out)writeNew(opts.out,result);console.log(JSON.stringify(result,null,2));
  }catch(error){console.error(JSON.stringify({status:'fail',error:error.message}));process.exitCode=1;}
}
