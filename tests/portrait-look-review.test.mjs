import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildPortraitLookPlan} from '../scripts/portrait-look-plan.mjs';
import {freezeProductionRun} from '../scripts/production-run.mjs';
import {promptHash} from '../scripts/production-prompt.mjs';
import {reviewPortraitLookSet} from '../scripts/portrait-look-review.mjs';

function setup(t,{action=false}={}){
 const parent=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'portrait-set-review-'));
 t.after(()=>{if(path.dirname(path.resolve(dir))!==parent)throw new Error('unsafe test cleanup');fs.rmSync(dir,{recursive:true,force:true});});
 const plan=JSON.parse(fs.readFileSync(new URL('../examples/portrait-look-diversity-plan.json',import.meta.url),'utf8'));
 plan.count=2;plan.looks=plan.looks.slice(0,2);plan.groups=[{id:'jk',label:'两套合成结构测试',count:2}];
 if(action){plan.variation_channels.push('action');plan.looks.forEach((look,index)=>{look.action={head:'头部端正。',torso:index?'躯干轻侧。':'躯干正面。',hands:index?'一手扶领。':'双臂自然垂落。',support:'上身挺拔，画外支撑不补造。'};});}
 const variants=buildPortraitLookPlan(plan).variants;
 const input={plan_id:plan.id,look_ids:plan.looks.map(l=>l.id),variation_channels:[...plan.variation_channels],runs:[],selection:[],comparisons:[],issues:[]};
 const snapshots=new Map();
 function add(index,version=1,{failed=false,parentRun,brief:override}={}){
  const variant=variants[index],id=`${variant.id}-v${version}`,brief=structuredClone(override??variant.brief);
  const options={run_id:id,case_id:variant.id,cohort:'synthetic-contract-only',base_dir:dir};
  if(parentRun)Object.assign(options,{kind:'revision',parent:snapshots.get(parentRun)});
  const snapshot=freezeProductionRun(brief,options);snapshots.set(id,snapshot);
  const file=`${id}.png`;
  // A one-pixel PNG with unique trailing test bytes tests file binding, never image quality.
  fs.writeFileSync(path.join(dir,file),Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64'),Buffer.from(id)]));
  const checks=snapshot.target.acceptance.map(a=>({id:a.id,verdict:failed&&a.id.endsWith('hair:fringe:check')?'fail':'pass',evidence:`合成记录 ${id} ${a.id}；不构成实图质量观察。`}));
  const receipt={status:'completed',snapshot_sha256:snapshot.snapshot_sha256,target_sha256:snapshot.target_sha256,prompt_sha256:snapshot.prompt_sha256,output_image:file,output_sha256:promptHash(fs.readFileSync(path.join(dir,file))),inspected:true,reviewer:'synthetic contract test',checks};
  fs.writeFileSync(path.join(dir,`${id}.snapshot.json`),JSON.stringify(snapshot));fs.writeFileSync(path.join(dir,`${id}.receipt.json`),JSON.stringify(receipt));
  input.runs.push({look_id:variant.id,snapshot:`${id}.snapshot.json`,receipt:`${id}.receipt.json`});
  return{id,snapshot,receipt,brief};
 }
 const select=(index,id,role='candidate')=>input.selection.push({look_id:variants[index].id,run_id:id,reason:'合成的候选选择依据。',role});
 const compare=()=>{input.comparisons=input.variation_channels.map(channel=>({channel,pair:input.selection.map(s=>s.run_id),verdict:'distinct',evidence:`合成的${channel}差异声明，不是视觉证据。`}));};
 return {dir,plan,variants,input,add,select,compare,review:()=>reviewPortraitLookSet(input,{base_dir:dir})};
}

test('distinct hair and makeup cannot substitute for missing or repeated pose comparisons',t=>{
 const s=setup(t,{action:true});const a=s.add(0),b=s.add(1);s.select(0,a.id);s.select(1,b.id);s.compare();
 assert.equal(s.review().status,'reviewer_qualified');
 const pose=s.input.comparisons.find(c=>c.channel==='action');pose.verdict='similar';assert.equal(s.review().status,'needs_revision');
 s.input.comparisons=s.input.comparisons.filter(c=>c.channel!=='action');
 assert.deepEqual(s.review().missing_comparisons,[{channel:'action',pair:[a.id,b.id]}]);
 assert.equal(s.review().status,'needs_review');
});

test('a newly requested variation channel cannot be certified against snapshots without its targets',t=>{
 const s=setup(t);const a=s.add(0),b=s.add(1);s.select(0,a.id);s.select(1,b.id);s.input.variation_channels.push('action');s.compare();
 assert.throws(s.review,/action needs a frozen per-look target/);
});

test('an unselected historical run can retain its earlier narrower target',t=>{
 const s=setup(t,{action:true}),earlier=structuredClone(s.variants[0].brief);
 const oldIds=new Set(earlier.requirements.filter(r=>r.channel==='action').map(r=>r.id));
 earlier.requirements=earlier.requirements.filter(r=>!oldIds.has(r.id));
 earlier.sections=earlier.sections.filter(section=>section.channel!=='action');
 earlier.acceptance=earlier.acceptance.filter(c=>!oldIds.has(c.basis));
 const old=s.add(0,1,{brief:earlier}),a=s.add(0,2,{parentRun:old.id}),b=s.add(1);
 s.select(0,a.id);s.select(1,b.id);s.compare();assert.equal(s.review().status,'reviewer_qualified');
 s.input.selection[0].run_id=old.id;assert.throws(s.review,/action needs a frozen per-look target/);
});

test('per-look qualification, visible diversity observations and user acceptance remain separate',t=>{
 const s=setup(t);const a=s.add(0,1,{failed:true}),b=s.add(1);s.select(0,a.id);s.select(1,b.id);s.compare();
 const report=s.review();assert.equal(report.status,'needs_revision');assert.equal(report.evidence.visual_diversity_verified,true);
 assert.equal(report.evidence.automatic_image_understanding,false);assert.equal(report.evidence.identity_preservation_verified,false);assert.equal(report.evidence.user_accepted,false);
 s.input.selection[0].role='deliverable';assert.throws(s.review,/unqualified/);
});

test('one good image or unreviewed channels cannot establish a complete set',t=>{
 const s=setup(t);const a=s.add(0),b=s.add(1);s.select(0,a.id);s.select(1,b.id);
 assert.equal(s.review().missing_comparisons.length,3);assert.equal(s.review().status,'needs_review');
 s.compare();s.input.comparisons[1].verdict='similar';assert.equal(s.review().status,'needs_revision');
 s.input.comparisons[1].verdict='uncertain';assert.equal(s.review().status,'needs_review');
 s.input.comparisons[1].verdict='distinct';assert.equal(s.review().status,'reviewer_qualified');
 s.input.selection.pop();s.input.comparisons=[];assert.deepEqual(s.review().missing_looks,['jk02']);assert.equal(s.review().evidence.visual_diversity_verified,false);
});

test('selection can retain an older candidate but its visual comparisons cannot follow a different output',t=>{
 const s=setup(t);const old=s.add(0),other=s.add(1),newer=s.add(0,2,{failed:true,parentRun:old.id});
 s.select(0,old.id);s.select(1,other.id);s.compare();assert.equal(s.review().status,'reviewer_qualified');
 s.input.selection[0].run_id=newer.id;assert.throws(s.review,/currently selected/);
});

test('image bytes, plan binding, duplicate comparisons and duplicate selected looks are verified',t=>{
 const s=setup(t);const a=s.add(0),b=s.add(1);s.select(0,a.id);s.select(1,b.id);s.compare();
 const before=structuredClone(s.input);s.input.plan_id='different-plan';assert.throws(s.review,/bound to this plan/);s.input.plan_id=before.plan_id;
 s.input.comparisons.push({...s.input.comparisons[0],pair:[b.id,a.id]});assert.throws(s.review,/duplicate visual/);s.input.comparisons=before.comparisons;
 s.input.selection.push({...s.input.selection[0]});assert.throws(s.review,/duplicate selected/);s.input.selection=before.selection;
 fs.appendFileSync(path.join(s.dir,`${a.id}.png`),'tampered');assert.throws(s.review,/output content changed/);
});

test('reusing identical bytes cannot be declared a distinct look',t=>{
 const s=setup(t);const a=s.add(0),b=s.add(1);s.select(0,a.id);s.select(1,b.id);s.compare();
 fs.copyFileSync(path.join(s.dir,`${a.id}.png`),path.join(s.dir,`${b.id}.png`));
 b.receipt.output_sha256=a.receipt.output_sha256;fs.writeFileSync(path.join(s.dir,`${b.id}.receipt.json`),JSON.stringify(b.receipt));
 assert.throws(s.review,/same output bytes/);
 s.input.comparisons.forEach(row=>{row.verdict='similar';});const report=s.review();assert.deepEqual(report.reused_outputs,[b.id]);assert.equal(report.evidence.visual_diversity_verified,false);
});

test('stable issue history stops unchanged repairs even when prompt and goal wording change',t=>{
 const s=setup(t);const a=s.add(0,1,{failed:true}),other=s.add(1);
 const changed=structuredClone(a.brief);changed.requirements.find(r=>r.channel==='hair').text+='本轮强调额前边界。';
 const b=s.add(0,2,{failed:true,parentRun:a.id,brief:changed}),c=s.add(0,3,{failed:true,parentRun:b.id,brief:changed});
 s.select(0,c.id);s.select(1,other.id);s.compare();
 const criterion=a.snapshot.target.acceptance.find(a=>a.id.endsWith('hair:fringe:check')).id;
 s.input.issues=[{look_id:'jk01',key:'fringe-below-brow',observations:[a,b,c].map((row,index)=>({run_id:row.id,criterion_ids:[criterion],progress:index?'unchanged':'initial',evidence:'合成复核中刘海仍覆盖眉毛。'}))}];
 const result=s.review();assert.equal(result.issues[0].no_improvement_streak,2);assert.deepEqual(result.stop_current_routes,[{look_id:'jk01',key:'fringe-below-brow'}]);
 s.input.issues[0].observations[2].progress='improved';assert.equal(s.review().stop_current_routes.length,0);
 s.input.issues[0].observations[2].criterion_ids=['invented'];assert.throws(s.review,/unknown frozen criterion/);
});

test('same-character set rejects a mixture of distinct identity sources',t=>{
 const s=setup(t);
 function brief(index){const b=structuredClone(s.variants[index].brief);const source=path.join(s.dir,`identity-${index}.png`);fs.writeFileSync(source,`synthetic reference ${index}`);b.references=[{id:'R1',source,inspected:true,generation_input:true,authority:['identity'],facts:[{id:'F1',channel:'identity',visibility:'visible',text:'合成身份观察。'}]}];return b;}
 const a=s.add(0,1,{brief:brief(0)}),b=s.add(1,1,{brief:brief(1)});s.select(0,a.id);s.select(1,b.id);s.compare();assert.throws(s.review,/different identity sources/);
});
