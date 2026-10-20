import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {finishProductionRun,objectHash} from './production-run.mjs';
import {bodyRegions,assertBodyCriteria,bodyObservation,normalizeBodyEvidence} from './body-proportion-contract.mjs';

const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const verdicts=['pass','fail','uncertain','not_assessable'];
const unique=(rows,label)=>{if(new Set(rows).size!==rows.length)throw new Error(`duplicate ${label}`);};
export const bodySignature=(snapshot,figureId)=>{const regions=Object.keys(bodyRegions).map(region=>{
  const check=snapshot.target.acceptance.find(c=>c.body_region===region&&c.figure_id===figureId);
  return [region,snapshot.target.requirements.find(r=>r.id===check.basis).text];
});const design=snapshot.target.figure_design;return objectHash(design?.design_version===2?{regions,body_baseline:design.body_baseline??null,character_type:design.character_type,target_head_count:design.target_head_count??null,target_waist_hip_ratio:design.target_waist_hip_ratio??null,waist_hip_definition:design.waist_hip_definition??null}:regions);};
const figureKey=(run,figure)=>JSON.stringify([run,figure??null]);
const figures=snapshot=>snapshot.target.body_plan?.figures??[{id:undefined,view:null,locator:null}];
function selectFigure(snapshot,id){
  const declared=figures(snapshot);
  if(id===undefined&&declared.length===1)return declared[0];
  const figure=declared.find(f=>f.id===id);
  if(!figure)throw new Error('select a declared figure_id for every multi-figure member');
  return figure;
}
function figureStatus(outcome,id){
  const checks=outcome.checks.filter(c=>c.figure_id===undefined||c.figure_id===id);
  if(checks.some(c=>c.critical&&c.verdict==='fail')||outcome.scope_review?.verdict==='fail')return 'needs_revision';
  if(checks.some(c=>c.critical&&['uncertain','not_assessable'].includes(c.verdict))||['uncertain','not_assessable'].includes(outcome.scope_review?.verdict))return 'needs_review';
  return 'reviewer_qualified';
}

// Binds authored regional and cross-image observations to actual frozen images.
// No semantic judging, anthropometric measurement or implicit user acceptance.
export function reviewBodyAssetSet(input,{base_dir=process.cwd()}={}){
  if(!input||!Array.isArray(input.expected_ids)||!input.expected_ids.length||input.expected_ids.some(id=>!nonempty(id))||
    !Array.isArray(input.members)||!Array.isArray(input.comparisons)||!Array.isArray(input.rejections??[])||!Array.isArray(input.reviewed_parents??[]))throw new Error('body set needs expected_ids, members, comparisons and optional rejections/reviewed_parents');
  unique(input.expected_ids,'expected member');
  function load(row){
    if(!nonempty(row?.snapshot)||!nonempty(row?.receipt))throw new Error('body review needs snapshot and receipt paths');
    const snapshot=JSON.parse(fs.readFileSync(path.resolve(base_dir,row.snapshot),'utf8'));
    const receiptPath=path.resolve(base_dir,row.receipt),receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
    if(receipt.status!=='completed')throw new Error('body review needs an actual completed image');
    assertBodyCriteria({...snapshot.target,references:snapshot.references});
    if(!snapshot.target.acceptance.some(c=>c.body_region!==undefined))throw new Error('freeze regional body criteria before generation');
    return {snapshot,outcome:finishProductionRun(snapshot,receipt,path.dirname(receiptPath))};
  }
  const baseline=load(input.baseline),members=[];
  if(figures(baseline.snapshot).length!==1)throw new Error('common body baseline must be a reviewed single-figure image');
  baseline.figure=selectFigure(baseline.snapshot,input.baseline.figure_id);
  const parents=new Map();
  for(const row of input.reviewed_parents??[]){
    const parent=load(row),id=parent.snapshot.run_id;
    if(parents.has(id)||id===baseline.snapshot.run_id)throw new Error('duplicate reviewed body parent');
    parents.set(id,parent);
  }
  const actualBodyInput=(snap,sha)=>snap.actual_inputs.find(ref=>(snap.target.body_plan?.baseline_reference_id===undefined||ref.id===snap.target.body_plan.baseline_reference_id)&&ref.content_sha256===sha&&snap.references.some(r=>r.id===ref.id&&r.authority.includes('proportion')));
  function bodySource(member,trail=new Set()){
    const snap=member.snapshot;
    const direct=actualBodyInput(snap,baseline.outcome.output_sha256);
    if(direct)return {kind:'direct',input_reference_id:direct.id,baseline_sha256:baseline.outcome.output_sha256};
    const parent=parents.get(snap.parent?.run_id);
    if(!parent)throw new Error('each variant must actually receive the common full-body baseline or a verified reviewed parent with proportion authority');
    if(trail.has(snap.run_id))throw new Error('cyclic body parent lineage');
    const nextTrail=new Set(trail).add(snap.run_id);
    if(snap.kind!=='edit'||snap.parent.snapshot_sha256!==parent.snapshot.snapshot_sha256||snap.case_id!==parent.snapshot.case_id||snap.cohort!==parent.snapshot.cohort||
       figures(snap).length!==1||figures(parent.snapshot).length!==1)throw new Error('body lineage requires a matching single-figure scoped edit parent');
    const parentInput=actualBodyInput(snap,parent.outcome.output_sha256);
    if(!parentInput||snap.edit_scope?.baseline_reference_id!==parentInput.id)throw new Error('body edit must actually receive its declared parent image');
    const parentFigure=selectFigure(parent.snapshot);
    if(objectHash(parent.snapshot.target.identity_targets??[])!==objectHash(baseline.snapshot.target.identity_targets??[])||bodySignature(parent.snapshot,parentFigure.id)!==bodySignature(baseline.snapshot,baseline.figure.id))throw new Error('reviewed parent has different identity or body targets');
    const bodyChecks=parent.outcome.checks.filter(c=>c.body_region!==undefined);
    const protectedChecks=parent.outcome.checks.filter(c=>c.critical&&['identity','proportion','composition'].includes(parent.snapshot.target.requirements.find(r=>r.id===c.basis)?.channel));
    if(bodyChecks.length!==Object.keys(bodyRegions).length||bodyChecks.some(c=>c.verdict!=='pass')||protectedChecks.some(c=>c.verdict!=='pass')||
       (parent.snapshot.edit_scope&&parent.outcome.scope_review?.verdict!=='pass')||member.outcome.scope_review?.verdict!=='pass')throw new Error('body parent and scoped preservation need completed passing body, identity and composition reviews');
    return {kind:'reviewed_parent',input_reference_id:parentInput.id,parent_run_id:parent.snapshot.run_id,parent_snapshot_sha256:parent.snapshot.snapshot_sha256,parent_output_sha256:parent.outcome.output_sha256,upstream:bodySource(parent,nextTrail)};
  }
  for(const row of input.members){
    if(!input.expected_ids.includes(row.id))throw new Error('unknown body member');
    const member=load(row),snap=member.snapshot,figure=selectFigure(snap,row.figure_id);
    const isBaseline=snap.run_id===baseline.snapshot.run_id;
    if(isBaseline&&snap.snapshot_sha256!==baseline.snapshot.snapshot_sha256)throw new Error('baseline run id cannot identify a different snapshot');
    if(objectHash(snap.target.identity_targets??[])!==objectHash(baseline.snapshot.target.identity_targets??[]))throw new Error('body set has different identity targets');
    if(bodySignature(snap,figure.id)!==bodySignature(baseline.snapshot,baseline.figure.id))throw new Error('body scheme changed; establish a new baseline');
    const proportion_source=isBaseline?{kind:'baseline',output_sha256:baseline.outcome.output_sha256}:bodySource(member);
    members.push({id:row.id,...member,figure,proportion_source,status:figureStatus(member.outcome,figure.id)});
  }
  unique(members.map(m=>m.id),'body member');unique(members.map(m=>figureKey(m.snapshot.run_id,m.figure.id)),'body run figure');
  const known=new Map([[baseline.snapshot.run_id,baseline]]);
  for(const member of members){
    const previous=known.get(member.snapshot.run_id);
    if(previous&&(previous.snapshot.snapshot_sha256!==member.snapshot.snapshot_sha256||objectHash(previous.outcome.checks)!==objectHash(member.outcome.checks)||previous.outcome.output_sha256!==member.outcome.output_sha256))throw new Error('one run must use the same frozen snapshot, image and review');
    known.set(member.snapshot.run_id,member);
  }
  const all=[...known.values()];
  for(const [id,parent]of parents){const selected=known.get(id);if(selected&&(selected.snapshot.snapshot_sha256!==parent.snapshot.snapshot_sha256||objectHash(selected.outcome.checks)!==objectHash(parent.outcome.checks)||selected.outcome.output_sha256!==parent.outcome.output_sha256))throw new Error('reviewed parent conflicts with selected run');}
  const rejectionRuns=new Map([...parents,...known]);
  const rejections=(input.rejections??[]).map(row=>{
    if(!rejectionRuns.has(row.run_id)||!nonempty(row.evidence))throw new Error('rejection must identify an actual run and user feedback');
    if(row.figure_id!==undefined)selectFigure(rejectionRuns.get(row.run_id).snapshot,row.figure_id);
    return {...row,output_sha256:rejectionRuns.get(row.run_id).outcome.output_sha256};
  });
  unique(rejections.map(r=>figureKey(r.run_id,r.figure_id)),'user rejection');
  const rejected=(run,figure)=>rejections.some(r=>r.run_id===run&&(r.figure_id===undefined||r.figure_id===figure));
  const comparisons=[],comparisonMembers=[];
  for(const row of input.comparisons){
    const selected=known.has(row.run_id)?selectFigure(known.get(row.run_id).snapshot,row.figure_id):null;
    const member=members.find(m=>m.snapshot.run_id===row.run_id&&m.figure.id===selected?.id);
    if(!member||row.run_id===baseline.snapshot.run_id||!Array.isArray(row.regions))throw new Error('comparison must bind a selected variant, not the baseline itself');
    comparisonMembers.push(figureKey(row.run_id,member.figure.id));
    unique(row.regions.map(r=>r.region),'comparison region');
    for(const check of row.regions){
      if(!Object.hasOwn(bodyRegions,check.region)||!verdicts.includes(check.verdict)||!nonempty(check.evidence))throw new Error('invalid body comparison');
      comparisons.push({...check,body_observation:bodyObservation(check),run_id:row.run_id,figure_id:member.figure.id,
        baseline_sha256:baseline.outcome.output_sha256,output_sha256:member.outcome.output_sha256});
    }
  }
  unique(comparisonMembers,'body comparison figure');
  const missing_members=input.expected_ids.filter(id=>!members.some(m=>m.id===id));
  const missing_figures=all.filter(m=>m.snapshot.run_id!==baseline.snapshot.run_id).flatMap(m=>figures(m.snapshot).filter(f=>!members.some(member=>member.snapshot.run_id===m.snapshot.run_id&&member.figure.id===f.id)).map(f=>({run_id:m.snapshot.run_id,figure_id:f.id,locator:f.locator})));
  const missing_comparisons=members.filter(m=>m.snapshot.run_id!==baseline.snapshot.run_id).flatMap(m=>Object.keys(bodyRegions).filter(region=>!comparisons.some(c=>c.run_id===m.snapshot.run_id&&c.figure_id===m.figure.id&&c.region===region)).map(region=>({run_id:m.snapshot.run_id,figure_id:m.figure.id,region})));
  // Repeated observations are a review-quality diagnostic, not proof of a bad image.
  const seen=new Map(),reused_evidence=[];
  const observed=all.flatMap(m=>m.outcome.checks.filter(c=>c.body_region!==undefined).map(c=>({...c,region:c.body_region,run_id:m.snapshot.run_id,kind:'individual'})))
    .concat(comparisons.map(c=>({...c,kind:'comparison'})));
  for(const row of observed.filter(c=>c.verdict==='pass')){
    const key=normalizeBodyEvidence(row.body_observation.visible_relation+' '+row.body_observation.target_comparison);
    const binding={run_id:row.run_id,figure_id:row.figure_id,region:row.region,kind:row.kind};
    if(seen.has(key))reused_evidence.push({first:seen.get(key),repeated:binding});else seen.set(key,binding);
  }
  const reused_outputs=members.filter((m,i)=>(m.snapshot.run_id!==baseline.snapshot.run_id&&m.outcome.output_sha256===baseline.outcome.output_sha256)||members.slice(0,i).some(prior=>prior.snapshot.run_id!==m.snapshot.run_id&&prior.outcome.output_sha256===m.outcome.output_sha256)).map(m=>m.id);
  const baseline_qualified=baseline.outcome.status==='reviewer_qualified'&&!rejected(baseline.snapshot.run_id,baseline.figure.id);
  const failed=all.some(m=>m.outcome.status==='needs_revision')||rejections.length||reused_outputs.length||comparisons.some(c=>c.verdict==='fail');
  const pending=!baseline_qualified||missing_members.length||missing_figures.length||missing_comparisons.length||reused_evidence.length||
    members.some(m=>m.outcome.status!=='reviewer_qualified')||comparisons.some(c=>['uncertain','not_assessable'].includes(c.verdict));
  return {status:failed?'needs_revision':pending?'needs_review':'reviewer_qualified',
    baseline:{run_id:baseline.snapshot.run_id,output_sha256:baseline.outcome.output_sha256,reviewer_qualified:baseline_qualified,user_accepted:false},
    members:members.map(m=>({id:m.id,run_id:m.snapshot.run_id,figure_id:m.figure.id,view:m.figure.view,locator:m.figure.locator,output_sha256:m.outcome.output_sha256,proportion_source:m.proportion_source,status:rejected(m.snapshot.run_id,m.figure.id)?'user_rejected':m.status})),
    missing_members,missing_figures,missing_comparisons,comparisons,reused_evidence,reused_outputs,rejections,
    evidence:{files_verified:true,authored_visual_observations:true,automatic_image_understanding:false,geometric_control_verified:false,user_accepted:false}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==4||process.argv[2]!=='--input')throw new Error('usage: body-set-review.mjs --input review.json');
    const file=path.resolve(process.argv[3]),report=reviewBodyAssetSet(JSON.parse(fs.readFileSync(file,'utf8')),{base_dir:path.dirname(file)});
    console.log(JSON.stringify(report,null,2));process.exitCode=report.status==='reviewer_qualified'?0:2;
  }catch(error){console.error(error.message);process.exitCode=1;}
}
