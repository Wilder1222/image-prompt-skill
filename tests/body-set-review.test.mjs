import {pngFixture} from './helpers/image-fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {withCharacterGoals} from '../scripts/character-goals.mjs';
import {bodyRegions,withBodyRegionChecks} from '../scripts/body-proportion-contract.mjs';
import {compileProductionPrompt,promptHash,reviewProductionResult} from '../scripts/production-prompt.mjs';
import {freezeProductionRun,finishProductionRun,verifyFrozenRun} from '../scripts/production-run.mjs';
import {reviewBodyAssetSet} from '../scripts/body-set-review.mjs';

const targets={head_shoulders:'成人头部与肩带相称，颈部自然舒展，不缩小脸部。',torso_pelvis:'完整胸廓、腰腹与骨盆连续有厚度，腰身自然收束。',arms:'上臂前臂成组协调，肘腕及手掌尺度相称。',legs:'大腿小腿修长匀称，膝踝与足自然衔接，不单段拉伸。',support:'承重侧有柔和肌肉与软组织支撑，放松侧自然舒展。',silhouette:'成年人物整体轻盈挺拔，适度美化为修长仙侠身形，保持现代衣装。'};
function brief(options={}){return withBodyRegionChecks(withCharacterGoals({subject_kind:'character',request:'测试原创成年人物的共同全身体型，现代日常衣装。',references:[],unresolved:[],requirements:[],sections:[],acceptance:[]},{ageStage:'adult'}),{targets,...options});}
function observation(region,run,kind='individual'){return {visibility:'visible',visible_relation:`合成${run} ${kind} ${region}部位关系，用于测试结构而非实际视觉结论。`,target_comparison:`合成${run} ${kind} ${region}目标对照。`};}
function setup(t){
  const parent=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'body-review-'));
  t.after(()=>{if(path.dirname(path.resolve(dir))!==parent)throw new Error('unsafe cleanup');fs.rmSync(dir,{recursive:true,force:true});});
  const runs={};
  function add(id,input=brief(),options={}){
    const snapshot=freezeProductionRun(input,{run_id:id,case_id:id,cohort:'synthetic-contract-only',base_dir:dir,...options});
    const output=`${id}.png`;fs.writeFileSync(path.join(dir,output),Buffer.concat([pngFixture(),Buffer.from(id)]));
    const receipt={status:'completed',snapshot_sha256:snapshot.snapshot_sha256,target_sha256:snapshot.target_sha256,prompt_sha256:snapshot.prompt_sha256,output_image:output,output_sha256:promptHash(fs.readFileSync(path.join(dir,output))),inspected:true,reviewer:'synthetic test',checks:snapshot.target.acceptance.map(c=>({id:c.id,verdict:'pass',evidence:`合成${id} ${c.id}`, ...(c.body_region?{body_observation:observation(c.body_region,input.body_plan.figures.length>1?`${id}:${c.figure_id}`:id)}:{})}))};
    if(snapshot.edit_scope)receipt.scope_review={verdict:'pass',change_evidence:'合成局部发型修改。',preservation_evidence:'合成身体保持检查。',preservation_checks:snapshot.edit_scope.preserve.map((_,index)=>({index,verdict:'pass',evidence:'合成保护项检查，不是实际视觉证据。'}))};
    const row={snapshot:`${id}.snapshot.json`,receipt:`${id}.receipt.json`};
    const save=()=>{fs.writeFileSync(path.join(dir,row.snapshot),JSON.stringify(snapshot));fs.writeFileSync(path.join(dir,row.receipt),JSON.stringify(receipt));};save();
    return runs[id]={id,input,snapshot,receipt,row,save};
  }
  const baseline=add('baseline');
  const memberBrief=()=>{const b=brief();b.references=[{id:'body-base',source:'baseline.png',inspected:true,generation_input:true,authority:['proportion'],facts:[{id:'body-fact',channel:'proportion',visibility:'visible',text:'合成全身体型基准；不是实图质量证据。'}]}];return b;};
  const a=add('a',memberBrief()),b=add('b',memberBrief());
  const input={expected_ids:['a','b'],baseline:baseline.row,members:[{id:'a',...a.row},{id:'b',...b.row}],comparisons:[a,b].map(run=>({run_id:run.id,regions:Object.keys(bodyRegions).map(region=>({region,verdict:'pass',evidence:`合成${run.id}与基准的${region}对照`,body_observation:observation(region,run.id,'comparison')}))}))};
  return {dir,runs,input,add,memberBrief,review:()=>reviewBodyAssetSet(input,{base_dir:dir})};
}

test('body review binds a common full-body input and keeps reviewer qualification separate from geometry and user acceptance',t=>{
  const s=setup(t),report=s.review();assert.equal(report.status,'reviewer_qualified');
  assert.equal(report.baseline.output_sha256,s.runs.baseline.receipt.output_sha256);
  assert.equal(report.comparisons.length,12);assert.equal(report.evidence.geometric_control_verified,false);assert.equal(report.evidence.user_accepted,false);
  const outcome=finishProductionRun(s.runs.a.snapshot,s.runs.a.receipt,s.dir);
  assert.deepEqual(outcome.checks.find(c=>c.body_region==='legs').body_observation,observation('legs','a'));
});

test('no deformity prose alone and duplicated regional evidence cannot establish body quality',t=>{
  const s=setup(t),run=s.runs.a,compiled=compileProductionPrompt(run.input);
  const body=run.receipt.checks.filter(c=>c.body_observation);
  delete body[0].body_observation;assert.throws(()=>reviewProductionResult(compiled,run.receipt),/needs visibility/);
  body[0].body_observation=observation('head_shoulders','a');body[1].body_observation=body[0].body_observation;
  assert.throws(()=>reviewProductionResult(compiled,run.receipt),/copied all-pass prose/);
});

test('occluded regions remain pending and one failed proportion cannot be offset by other passes',t=>{
  const s=setup(t),run=s.runs.a,check=run.receipt.checks.find(c=>c.body_observation&&c.id.includes('legs'));
  check.body_observation.visibility='partial';run.save();assert.throws(s.review,/occluded body target/);
  check.verdict='not_assessable';run.save();assert.equal(s.review().status,'needs_review');
  check.body_observation.visibility='visible';check.verdict='fail';run.save();assert.equal(s.review().status,'needs_revision');
});

test('unreviewed comparisons, missing looks and repeated cross-image evidence prevent set qualification',t=>{
  const s=setup(t),original=structuredClone(s.input);
  s.input.comparisons[0].regions.pop();assert.equal(s.review().status,'needs_review');
  s.input.comparisons=original.comparisons;s.input.members.pop();s.input.comparisons.pop();assert.deepEqual(s.review().missing_members,['b']);
  Object.assign(s.input,original);
  const a=s.runs.a.receipt.checks.find(c=>c.body_observation),b=s.runs.b.receipt.checks.find(c=>c.body_observation);
  b.body_observation=structuredClone(a.body_observation);s.runs.b.save();
  assert.equal(s.review().status,'needs_review');assert.equal(s.review().reused_evidence.length,1);
});

test('a portrait-only input, an unqualified baseline or user rejection cannot become an approved body source',t=>{
  const s=setup(t),without=s.add('without',brief());s.input.members[0]={id:'a',...without.row};
  assert.throws(s.review,/actually receive/);s.input.members[0]={id:'a',...s.runs.a.row};
  const baseline=s.runs.baseline,check=baseline.receipt.checks.find(c=>c.body_observation);check.verdict='uncertain';baseline.save();
  assert.equal(s.review().baseline.reviewer_qualified,false);assert.equal(s.review().status,'needs_review');
  check.verdict='pass';baseline.save();s.input.rejections=[{run_id:'baseline',evidence:'用户认为比例不符合要求。'}];
  assert.equal(s.review().status,'needs_revision');assert.equal(s.review().baseline.reviewer_qualified,false);
  assert.equal(baseline.receipt.checks.find(c=>c.body_observation).verdict,'pass');
});

test('altered body targets, substituted image bytes and reused variants are detected',t=>{
  const s=setup(t),different=s.memberBrief();different.requirements.find(r=>r.id==='BODY:legs').text+='修改腿部比例。';
  const changed=s.add('changed',different);s.input.members[0]={id:'a',...changed.row};assert.throws(s.review,/scheme changed/);
  s.input.members[0]={id:'a',...s.runs.a.row};
  fs.copyFileSync(path.join(s.dir,'a.png'),path.join(s.dir,'b.png'));assert.throws(s.review,/output content changed/);
  s.runs.b.receipt.output_sha256=s.runs.a.receipt.output_sha256;s.runs.b.save();assert.deepEqual(s.review().reused_outputs,['b']);
});

test('body contract cannot silently omit regions or expand a narrow edit',()=>{
  const b=brief();b.acceptance=b.acceptance.filter(c=>c.body_region!=='legs');assert.throws(()=>compileProductionPrompt(b),/all six/);
  assert.throws(()=>withBodyRegionChecks({...brief(),edit_scope:{}},{targets}),/narrow edit/);
});

test('the first requested image may be the baseline without requiring an extra image or self-comparison',t=>{
  const s=setup(t);s.input.expected_ids=['first','b'];
  s.input.members[0]={id:'first',...s.runs.baseline.row};s.input.comparisons.shift();
  const report=s.review();assert.equal(report.status,'reviewer_qualified');assert.equal(report.members.length,2);
  assert.equal(report.comparisons.length,6);assert.deepEqual(report.reused_evidence,[]);assert.deepEqual(report.reused_outputs,[]);
});

function boardSetup(t){
  const s=setup(t),b=brief({figures:[{id:'left',view:'front',locator:'左侧正面全身'},{id:'right',view:'back',locator:'右侧背面全身'}]});
  b.references=s.memberBrief().references;b.body_plan.baseline_reference_id='body-base';
  const board=s.add('board',b);
  s.input.expected_ids=['front','back'];
  s.input.members=[{id:'front',figure_id:'left',...board.row},{id:'back',figure_id:'right',...board.row}];
  s.input.comparisons=['left','right'].map(figure_id=>({run_id:'board',figure_id,regions:Object.keys(bodyRegions).map(region=>({region,verdict:'pass',evidence:`合成${figure_id}对比`,body_observation:observation(region,figure_id,'comparison')}))}));
  return {...s,board};
}

test('one image may contain separately frozen and reviewed figures without being duplicate output',t=>{
  const s=boardSetup(t),report=s.review();
  assert.equal(report.status,'reviewer_qualified');assert.deepEqual(report.reused_outputs,[]);
  assert.deepEqual(report.members.map(m=>[m.figure_id,m.view]),[['left','front'],['right','back']]);
  assert.equal(s.board.snapshot.target.body_plan.baseline_reference_id,'body-base');
  assert.equal(report.comparisons.length,12);
});

test('declared figures cannot disappear by reducing expected_ids, comparisons or regional criteria',t=>{
  const s=boardSetup(t);s.input.members.pop();s.input.expected_ids.pop();s.input.comparisons.pop();
  assert.equal(s.review().status,'needs_review');assert.equal(s.review().missing_figures[0].figure_id,'right');
  s.input.members[0].figure_id=undefined;assert.throws(s.review,/select a declared figure_id/);
  const b=structuredClone(s.board.input);b.acceptance=b.acceptance.filter(c=>c.figure_id!=='right');
  assert.throws(()=>compileProductionPrompt(b),/all six/);
  b.acceptance=[];assert.throws(()=>compileProductionPrompt(b),/layout count/);
  const layout=structuredClone(s.board.input);layout.acceptance=layout.acceptance.filter(c=>c.basis!=='BODY:layout');
  assert.throws(()=>compileProductionPrompt(layout),/layout count/);
});

test('one failed figure fails the board while qualified siblings keep their per-figure result',t=>{
  const s=boardSetup(t),check=s.board.receipt.checks.find(c=>c.id==='BODY:legs:right:check');
  check.verdict='fail';s.board.save();const report=s.review();
  assert.equal(report.status,'needs_revision');assert.equal(report.members[0].status,'reviewer_qualified');assert.equal(report.members[1].status,'needs_revision');
  check.verdict='pass';s.board.save();s.input.rejections=[{run_id:'board',figure_id:'right',evidence:'用户否定右侧比例。'}];
  assert.equal(s.review().members[0].status,'reviewer_qualified');assert.equal(s.review().members[1].status,'user_rejected');
});

test('figure and comparison bindings cannot be ambiguous, duplicated or redirected',t=>{
  const s=boardSetup(t),original=structuredClone(s.input);
  delete s.input.comparisons[0].figure_id;assert.throws(s.review,/select a declared figure_id/);
  Object.assign(s.input,structuredClone(original));s.input.comparisons[1].figure_id='left';assert.throws(s.review,/duplicate body comparison figure/);
  Object.assign(s.input,structuredClone(original));s.input.members[1].figure_id='left';assert.throws(s.review,/duplicate body run figure/);
  const b=structuredClone(s.board.input);b.acceptance[0].figure_id='invented';assert.throws(()=>compileProductionPrompt(b),/unknown figure/);
  b.acceptance[0].figure_id='left';b.references[0].generation_input=false;assert.throws(()=>compileProductionPrompt(b),/actual proportion baseline/);
});

test('a board cannot be reused as a single body baseline or bind inconsistent receipts to one run',t=>{
  const s=boardSetup(t);s.input.baseline=s.board.row;assert.throws(s.review,/single-figure image/);
  s.input.baseline=s.runs.baseline.row;
  const alternate=structuredClone(s.board.receipt);alternate.checks[0].evidence+=' alternate';
  fs.writeFileSync(path.join(s.dir,'alternate.json'),JSON.stringify(alternate));s.input.members[1].receipt='alternate.json';
  assert.throws(s.review,/same frozen snapshot, image and review/);
});

test('declared body baseline must itself be the reviewed common image, not another proportion input',t=>{
  const s=setup(t),b=s.memberBrief();
  b.references.push({...structuredClone(b.references[0]),id:'other',source:'a.png',facts:[{id:'other:fact',channel:'proportion',visibility:'visible',text:'另一个合成比例来源。'}]});
  b.body_plan.baseline_reference_id='other';const run=s.add('wrong-baseline',b);
  s.input.members[0]={id:'a',...run.row};assert.throws(s.review,/actually receive/);
});

test('an approved body benchmark must be dispatched and retain its explicit full-body locator',t=>{
  const s=setup(t),input=withCharacterGoals({subject_kind:'character',request:'按用户认可的比例建立新身体。',references:[{id:'approved',source:'baseline.png',inspected:true,generation_input:true,authority:['proportion'],facts:[{id:'approved:body',channel:'proportion',visibility:'visible',text:'合成来源中的右侧正面全身，非实际审美证据。'}]}],unresolved:[],requirements:[],sections:[],acceptance:[]},{ageStage:'adult'});
  const b=withBodyRegionChecks(input,{targets,benchmark:{reference_id:'approved',locator:'图一右侧正面全身'}});
  const snap=freezeProductionRun(b,{run_id:'benchmark-bound',case_id:'approved-body',cohort:'synthetic-contract-only',base_dir:s.dir});
  assert.equal(snap.target.body_plan.benchmark.locator,'图一右侧正面全身');
  assert.deepEqual(verifyFrozenRun(snap).referenced_image_paths,[path.join(s.dir,'baseline.png')]);
  for(const change of [x=>{x.references[0].generation_input=false;},x=>{x.references[0].authority=['costume'];},x=>{x.body_plan.benchmark.locator='';},x=>{x.acceptance=x.acceptance.filter(c=>c.basis!=='BODY:benchmark');}]){
    const invalid=structuredClone(b);change(invalid);assert.throws(()=>compileProductionPrompt(invalid),/body benchmark/);
  }
  const altered=structuredClone(snap);altered.target.body_plan.benchmark.locator='左侧放大肖像';
  assert.throws(()=>verifyFrozenRun(altered),/snapshot changed/);
});

test('a current-only scoped edit may prove its body source through a fully reviewed parent chain',t=>{
  const s=setup(t),a=s.runs.a,b=structuredClone(a.input);
  b.references[0].source='a.png';b.body_plan.baseline_reference_id='body-base';
  b.edit_scope={baseline_reference_id:'body-base',changes:['只修前发'],preserve:['保持当前完整身体和衣装']};
  const edit=s.add('a-edit',b,{kind:'edit',parent:a.snapshot,case_id:a.snapshot.case_id});
  s.input.members[0]={id:'a',...edit.row};s.input.comparisons[0].run_id=edit.id;s.input.reviewed_parents=[a.row];
  let result=s.review();assert.equal(result.status,'reviewer_qualified');assert.equal(result.members[0].proportion_source.kind,'reviewed_parent');
  assert.equal(result.members[0].proportion_source.upstream.kind,'direct');
  const hairId=a.snapshot.target.acceptance.find(c=>a.snapshot.target.requirements.find(r=>r.id===c.basis)?.channel==='hair').id;
  a.receipt.checks.find(c=>c.id===hairId).verdict='fail';a.save();
  assert.equal(s.review().status,'reviewer_qualified','parent hair failure does not erase completed body evidence');
  s.input.rejections=[{run_id:a.id,evidence:'用户否定这个父图的身材。'}];assert.equal(s.review().status,'needs_revision');s.input.rejections=[];
  s.input.reviewed_parents=[];assert.throws(s.review,/verified reviewed parent/);
  s.input.reviewed_parents=[a.row];a.receipt.checks.find(c=>c.id==='BODY:legs:check').verdict='uncertain';a.save();
  assert.throws(s.review,/passing body/);
  a.receipt.checks.find(c=>c.id==='BODY:legs:check').verdict='pass';a.save();
  edit.receipt.scope_review.verdict='uncertain';edit.save();assert.throws(s.review,/scoped preservation/);
});
