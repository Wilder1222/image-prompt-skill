import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {finishProductionRun,objectHash} from './production-run.mjs';
import {bodyRegions,assertBodyCriteria,bodyObservation,normalizeBodyEvidence} from './body-proportion-contract.mjs';

const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const verdicts=['pass','fail','uncertain','not_assessable'];
const unique=(rows,label)=>{if(new Set(rows).size!==rows.length)throw new Error(`duplicate ${label}`);};
const bodySignature=snapshot=>objectHash(Object.keys(bodyRegions).map(region=>{
  const check=snapshot.target.acceptance.find(c=>c.body_region===region);
  return [region,snapshot.target.requirements.find(r=>r.id===check.basis).text];
}));

// Binds authored regional and cross-image observations to actual frozen images.
// No semantic judging, anthropometric measurement or implicit user acceptance.
export function reviewBodyAssetSet(input,{base_dir=process.cwd()}={}){
  if(!input||!Array.isArray(input.expected_ids)||!input.expected_ids.length||input.expected_ids.some(id=>!nonempty(id))||
    !Array.isArray(input.members)||!Array.isArray(input.comparisons)||!Array.isArray(input.rejections??[]))throw new Error('body set needs expected_ids, members, comparisons and optional rejections');
  unique(input.expected_ids,'expected member');
  function load(row){
    if(!nonempty(row?.snapshot)||!nonempty(row?.receipt))throw new Error('body review needs snapshot and receipt paths');
    const snapshot=JSON.parse(fs.readFileSync(path.resolve(base_dir,row.snapshot),'utf8'));
    const receiptPath=path.resolve(base_dir,row.receipt),receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
    if(receipt.status!=='completed')throw new Error('body review needs an actual completed image');
    assertBodyCriteria(snapshot.target);
    if(!snapshot.target.acceptance.some(c=>c.body_region!==undefined))throw new Error('freeze regional body criteria before generation');
    return {snapshot,outcome:finishProductionRun(snapshot,receipt,path.dirname(receiptPath))};
  }
  const baseline=load(input.baseline),members=[];
  for(const row of input.members){
    if(!input.expected_ids.includes(row.id))throw new Error('unknown body member');
    const member=load(row),snap=member.snapshot;
    const isBaseline=snap.run_id===baseline.snapshot.run_id;
    if(isBaseline&&snap.snapshot_sha256!==baseline.snapshot.snapshot_sha256)throw new Error('baseline run id cannot identify a different snapshot');
    if(objectHash(snap.target.identity_targets??[])!==objectHash(baseline.snapshot.target.identity_targets??[]))throw new Error('body set has different identity targets');
    if(bodySignature(snap)!==bodySignature(baseline.snapshot))throw new Error('body scheme changed; establish a new baseline');
    const bodyInput=snap.actual_inputs.find(ref=>ref.content_sha256===baseline.outcome.output_sha256&&
      snap.references.some(r=>r.id===ref.id&&r.authority.includes('proportion')));
    if(!isBaseline&&!bodyInput)throw new Error('each variant must actually receive the common full-body baseline with proportion authority');
    members.push({id:row.id,...member});
  }
  unique(members.map(m=>m.id),'body member');unique(members.map(m=>m.snapshot.run_id),'body run');
  const all=[baseline,...members.filter(m=>m.snapshot.run_id!==baseline.snapshot.run_id)],known=new Map(all.map(m=>[m.snapshot.run_id,m]));
  const rejections=(input.rejections??[]).map(row=>{
    if(!known.has(row.run_id)||!nonempty(row.evidence))throw new Error('rejection must identify an actual run and user feedback');
    return {...row,output_sha256:known.get(row.run_id).outcome.output_sha256};
  });
  unique(rejections.map(r=>r.run_id),'user rejection');
  const rejected=new Set(rejections.map(r=>r.run_id));
  const comparisons=[];
  for(const row of input.comparisons){
    const member=members.find(m=>m.snapshot.run_id===row.run_id);
    if(!member||row.run_id===baseline.snapshot.run_id||!Array.isArray(row.regions))throw new Error('comparison must bind a selected variant, not the baseline itself');
    unique(row.regions.map(r=>r.region),'comparison region');
    for(const check of row.regions){
      if(!Object.hasOwn(bodyRegions,check.region)||!verdicts.includes(check.verdict)||!nonempty(check.evidence))throw new Error('invalid body comparison');
      comparisons.push({...check,body_observation:bodyObservation(check),run_id:row.run_id,
        baseline_sha256:baseline.outcome.output_sha256,output_sha256:member.outcome.output_sha256});
    }
  }
  unique(input.comparisons.map(c=>c.run_id),'body comparison run');
  const missing_members=input.expected_ids.filter(id=>!members.some(m=>m.id===id));
  const missing_comparisons=members.filter(m=>m.snapshot.run_id!==baseline.snapshot.run_id).flatMap(m=>Object.keys(bodyRegions).filter(region=>!comparisons.some(c=>c.run_id===m.snapshot.run_id&&c.region===region)).map(region=>({run_id:m.snapshot.run_id,region})));
  // Repeated observations are a review-quality diagnostic, not proof of a bad image.
  const seen=new Map(),reused_evidence=[];
  const observed=all.flatMap(m=>m.outcome.checks.filter(c=>c.body_region!==undefined).map(c=>({...c,region:c.body_region,run_id:m.snapshot.run_id,kind:'individual'})))
    .concat(comparisons.map(c=>({...c,kind:'comparison'})));
  for(const row of observed.filter(c=>c.verdict==='pass')){
    const key=normalizeBodyEvidence(row.body_observation.visible_relation+' '+row.body_observation.target_comparison);
    const binding={run_id:row.run_id,region:row.region,kind:row.kind};
    if(seen.has(key))reused_evidence.push({first:seen.get(key),repeated:binding});else seen.set(key,binding);
  }
  const reused_outputs=members.filter((m,i)=>(m.snapshot.run_id!==baseline.snapshot.run_id&&m.outcome.output_sha256===baseline.outcome.output_sha256)||members.slice(0,i).some(prior=>prior.outcome.output_sha256===m.outcome.output_sha256)).map(m=>m.id);
  const baseline_qualified=baseline.outcome.status==='reviewer_qualified'&&!rejected.has(baseline.snapshot.run_id);
  const failed=all.some(m=>m.outcome.status==='needs_revision')||rejections.length||reused_outputs.length||comparisons.some(c=>c.verdict==='fail');
  const pending=!baseline_qualified||missing_members.length||missing_comparisons.length||reused_evidence.length||
    members.some(m=>m.outcome.status!=='reviewer_qualified')||comparisons.some(c=>['uncertain','not_assessable'].includes(c.verdict));
  return {status:failed?'needs_revision':pending?'needs_review':'reviewer_qualified',
    baseline:{run_id:baseline.snapshot.run_id,output_sha256:baseline.outcome.output_sha256,reviewer_qualified:baseline_qualified,user_accepted:false},
    members:members.map(m=>({id:m.id,run_id:m.snapshot.run_id,output_sha256:m.outcome.output_sha256,status:rejected.has(m.snapshot.run_id)?'user_rejected':m.outcome.status})),
    missing_members,missing_comparisons,comparisons,reused_evidence,reused_outputs,rejections,
    evidence:{files_verified:true,authored_visual_observations:true,automatic_image_understanding:false,geometric_control_verified:false,user_accepted:false}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==4||process.argv[2]!=='--input')throw new Error('usage: body-set-review.mjs --input review.json');
    const file=path.resolve(process.argv[3]),report=reviewBodyAssetSet(JSON.parse(fs.readFileSync(file,'utf8')),{base_dir:path.dirname(file)});
    console.log(JSON.stringify(report,null,2));process.exitCode=report.status==='reviewer_qualified'?0:2;
  }catch(error){console.error(error.message);process.exitCode=1;}
}
