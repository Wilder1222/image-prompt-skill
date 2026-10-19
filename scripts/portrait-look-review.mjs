import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {finishProductionRun,objectHash} from './production-run.mjs';

const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const channels=['hair','makeup','expression','action'];
function fields(row,keys,label){if(!plain(row)||Object.keys(row).some(key=>!keys.includes(key)))throw new Error(`unsupported ${label} fields`);}
function text(value,label){if(!nonempty(value))throw new Error(`missing ${label}`);}
function unique(rows,label){if(new Set(rows).size!==rows.length)throw new Error(`duplicate ${label}`);}
const pairKey=(channel,pair)=>JSON.stringify([channel,...[...pair].sort()]);

// This validates authored observations against real frozen inputs and output bytes.
// It does not inspect pixels, recognize faces or infer semantic differences.
export function reviewPortraitLookSet(input,{base_dir=process.cwd()}={}){
  fields(input,['plan_id','look_ids','variation_channels','runs','selection','comparisons','issues'],'portrait look review');
  text(input.plan_id,'plan id');
  if(!Array.isArray(input.look_ids)||input.look_ids.length<2||input.look_ids.some(id=>!nonempty(id)))throw new Error('review needs at least two look ids');
  unique(input.look_ids,'look id');
  if(!Array.isArray(input.variation_channels)||!input.variation_channels.length||input.variation_channels.some(channel=>!channels.includes(channel)))throw new Error('invalid variation channels');
  unique(input.variation_channels,'variation channel');
  if(!Array.isArray(input.runs)||!input.runs.length||!Array.isArray(input.selection)||!Array.isArray(input.comparisons)||!Array.isArray(input.issues??[]))throw new Error('review needs runs, selection and comparisons arrays');
  const runs=new Map();
  for(const row of input.runs){
    fields(row,['look_id','snapshot','receipt'],'review run');
    if(!input.look_ids.includes(row.look_id))throw new Error('unknown run look');
    text(row.snapshot,'snapshot path');text(row.receipt,'receipt path');
    const snapshotPath=path.resolve(base_dir,row.snapshot),receiptPath=path.resolve(base_dir,row.receipt);
    const snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8')),receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
    if(receipt.status!=='completed')throw new Error('visual comparison needs a completed image receipt');
    const outcome=finishProductionRun(snapshot,receipt,path.dirname(receiptPath));
    if(!snapshot.target.requirements.some(requirement=>requirement.id.startsWith(`PL:${input.plan_id}:${row.look_id}:`)))throw new Error('snapshot is not bound to this plan and look');
    if(runs.has(snapshot.run_id))throw new Error('duplicate run id');
    runs.set(snapshot.run_id,{look_id:row.look_id,snapshot,outcome});
  }
  const selected=[];
  for(const row of input.selection){
    fields(row,['look_id','run_id','reason','role'],'selected look');text(row.reason,'selection reason');
    const run=runs.get(row.run_id);
    if(!run||run.look_id!==row.look_id)throw new Error('selection must bind the matching look and run');
    for(const channel of input.variation_channels){
      const prefix=`PL:${input.plan_id}:${row.look_id}:${channel}`;
      const targets=run.snapshot.target.requirements.filter(r=>r.channel===channel&&r.priority==='must'&&(r.id===prefix||r.id.startsWith(`${prefix}:`)));
      if(!targets.length||targets.some(r=>!run.snapshot.target.acceptance.some(c=>c.basis===r.id&&c.critical)))
        throw new Error(`requested variation channel ${channel} needs a frozen per-look target and critical check`);
    }
    if(!['candidate','deliverable'].includes(row.role))throw new Error('selection needs candidate or deliverable role');
    if(row.role==='deliverable'&&run.outcome.status!=='reviewer_qualified')throw new Error('unqualified image cannot be selected as a deliverable');
    selected.push({...row,status:run.outcome.status,output_sha256:run.outcome.output_sha256});
  }
  unique(selected.map(row=>row.look_id),'selected look');
  const selectedIds=new Set(selected.map(row=>row.run_id)),missingLooks=input.look_ids.filter(id=>!selected.some(row=>row.look_id===id));
  const identityTargets=selected.map(row=>objectHash(runs.get(row.run_id).snapshot.target.identity_targets??[]));
  if(new Set(identityTargets).size>1)throw new Error('same-character comparison has different identity sources');
  const comparisons=[],seen=new Set();
  for(const row of input.comparisons){
    fields(row,['channel','pair','verdict','evidence'],'visual comparison');
    if(!input.variation_channels.includes(row.channel)||!Array.isArray(row.pair)||row.pair.length!==2||row.pair[0]===row.pair[1]||row.pair.some(id=>!selectedIds.has(id)))throw new Error('comparison must bind two currently selected runs and a requested channel');
    if(!['distinct','similar','uncertain'].includes(row.verdict))throw new Error('invalid visual comparison verdict');
    text(row.evidence,'visible comparison evidence');
    const key=pairKey(row.channel,row.pair);if(seen.has(key))throw new Error('duplicate visual comparison');seen.add(key);
    const sameBytes=runs.get(row.pair[0]).outcome.output_sha256===runs.get(row.pair[1]).outcome.output_sha256;
    if(sameBytes&&row.verdict==='distinct')throw new Error('same output bytes cannot prove distinct looks');
    comparisons.push({...row,outputs:row.pair.map(id=>runs.get(id).outcome.output_sha256)});
  }
  const missingComparisons=[];
  for(let i=0;i<selected.length;i++)for(let j=i+1;j<selected.length;j++)for(const channel of input.variation_channels){
    const pair=[selected[i].run_id,selected[j].run_id];
    if(!seen.has(pairKey(channel,pair)))missingComparisons.push({channel,pair});
  }
  const issueKeys=new Set(),issues=[];
  for(const issue of input.issues??[]){
    fields(issue,['look_id','key','observations'],'issue history');text(issue.key,'stable issue key');
    if(!input.look_ids.includes(issue.look_id)||!Array.isArray(issue.observations)||!issue.observations.length)throw new Error('issue needs a known look and observations');
    const key=JSON.stringify([issue.look_id,issue.key]);if(issueKeys.has(key))throw new Error('duplicate stable issue');issueKeys.add(key);
    let streak=0,previous;const observed=new Set();
    for(const [index,row] of issue.observations.entries()){
      fields(row,['run_id','criterion_ids','progress','evidence'],'issue observation');
      const run=runs.get(row.run_id);
      if(!run||run.look_id!==issue.look_id||observed.has(row.run_id))throw new Error('issue observation must bind a unique matching run');observed.add(row.run_id);
      if(previous&&run.snapshot.parent?.run_id!==previous)throw new Error('issue history must follow consecutive frozen parent runs');
      if(!Array.isArray(row.criterion_ids)||!row.criterion_ids.length)throw new Error('issue needs frozen criterion ids');unique(row.criterion_ids,'issue criterion');
      const checks=row.criterion_ids.map(id=>run.outcome.checks.find(check=>check.id===id));
      if(checks.some(check=>!check))throw new Error('issue refers to an unknown frozen criterion');
      if(index===0?row.progress!=='initial':!['improved','unchanged','regressed'].includes(row.progress))throw new Error('issue progress needs initial then observed change');
      if(['unchanged','regressed'].includes(row.progress)&&checks.every(check=>check.verdict==='pass'))throw new Error('unresolved issue observation cannot claim all criteria pass');
      text(row.evidence,'issue progress evidence');
      streak=['unchanged','regressed'].includes(row.progress)?streak+1:0;previous=row.run_id;
    }
    issues.push({...issue,no_improvement_streak:streak,next_action:streak>=2?'stop_current_route':'review_next_change'});
  }
  const similar=comparisons.some(row=>row.verdict==='similar'),uncertain=comparisons.some(row=>row.verdict==='uncertain');
  const reused=selected.filter((row,index)=>selected.slice(0,index).some(prior=>prior.output_sha256===row.output_sha256)).map(row=>row.run_id);
  const failed=selected.some(row=>row.status==='needs_revision');
  const incomplete=missingLooks.length>0||missingComparisons.length>0||uncertain||selected.some(row=>row.status!=='reviewer_qualified');
  return {status:failed||similar||reused.length?'needs_revision':incomplete?'needs_review':'reviewer_qualified',plan_id:input.plan_id,selected,
    missing_looks:missingLooks,comparisons,missing_comparisons:missingComparisons,reused_outputs:reused,issues,
    completed_images:runs.size,selected_images:selected.length,stop_current_routes:issues.filter(row=>row.next_action==='stop_current_route').map(({look_id,key})=>({look_id,key})),
    evidence:{files_verified:true,authored_visual_observations:true,automatic_image_understanding:false,
      visual_diversity_verified:!missingLooks.length&&!missingComparisons.length&&!similar&&!uncertain&&!reused.length,
      identity_preservation_verified:false,user_accepted:false}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==4||process.argv[2]!=='--input')throw new Error('usage: portrait-look-review.mjs --input review.json');
    const file=path.resolve(process.argv[3]),report=reviewPortraitLookSet(JSON.parse(fs.readFileSync(file,'utf8')),{base_dir:path.dirname(file)});
    console.log(JSON.stringify(report,null,2));process.exitCode=report.status==='reviewer_qualified'?0:2;
  }catch(error){console.error(error.message);process.exitCode=1;}
}
