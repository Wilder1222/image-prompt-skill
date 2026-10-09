import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {compileAssetPrompt,createAssetPlan} from '../scripts/asset-master.mjs';
import {characterStyleIds} from '../scripts/character-style-render.mjs';
import {compileProductionPrompt,reviewProductionResult,reviseProductionInput} from '../scripts/production-prompt.mjs';
import {freezeProductionRun,verifyFrozenRun} from '../scripts/production-run.mjs';

const garden=()=>JSON.parse(fs.readFileSync(new URL('../examples/character-garden-brief.json',import.meta.url),'utf8'));

test('default body and full-body framing are consistent in all media and languages',()=>{
 for(const styleWorkflow of characterStyleIds){
  const plan=createAssetPlan({styleWorkflow});
  assert.equal(plan.configuration.proportion_profile,'BALANCED_ELEGANT');
  assert.equal(plan.stage_2.fashion_asset.visual_head_count_target,null);
  for(const language of ['zh-CN','en']){
   const result=compileAssetPrompt({styleWorkflow,language});
   assert.doesNotMatch(result.prompt,/九头|nine.head|BALANCED_ELEGANT|P9/);
   assert.match(result.prompt,language==='en'?/breathing room above, below and beside/:/头顶、脚下与左右/);
   assert.match(result.prompt,language==='en'?/rather than stretching anatomy/:/不为了填满画幅拉伸身体/);
  }
 }
});

test('explicit numeric preset is preserved without becoming a default',()=>{
 for(const language of ['zh-CN','en']){
  assert.match(compileAssetPrompt({proportionProfile:'P9_FASHION_ASSET',language}).prompt,language==='en'?/nine.head/:/九头身/);
  assert.doesNotMatch(compileAssetPrompt({referenceMode:'full_body_anchor',language}).prompt,/九头|nine.head/);
 }
});

test('qualitative and explicitly numeric production briefs compile without invented targets',()=>{
 const brief=garden(),result=compileProductionPrompt(brief);
 assert.doesNotMatch(result.prompt,/九头|target_head_count|BALANCED_ELEGANT/);
 assert.match(result.prompt,/比例协调、修长好看/);
 assert.match(result.prompt,/头顶和脚下留出空间/);
 assert.ok(result.acceptance.some(c=>c.basis==='space'&&c.critical&&/留白/.test(c.question)));
 for(const count of [8,9,9.5]){
  const b=garden(),r=b.requirements.find(r=>r.id==='body');
  r.target_head_count=count;r.text=`本轮明确以 ${count} 头身为设计目标，各段协调。`;
  b.sections.find(s=>s.channel==='proportion').items[0].text=r.text;
  b.acceptance.find(c=>c.basis==='body').question=`身体是否满足本轮明确的 ${count} 头身目标与各段协调要求？`;
  assert.ok(compileProductionPrompt(b).prompt.includes(`${count} 头身`));
 }
 for(const count of [0,-1,'9',null,Infinity,NaN]){
  const b=garden();b.requirements.find(r=>r.id==='body').target_head_count=count;
  assert.throws(()=>compileProductionPrompt(b),/finite positive/);
 }
});

test('narrow repairs preserve existing framing and do not introduce showcase occupancy',()=>{
 for(const language of ['zh-CN','en'])for(const options of [{stage:'face'},{stage:'structure',focus:'hands'},{stage:'material-light',focus:'materials'}]){
  const result=compileAssetPrompt({...options,language});
  assert.doesNotMatch(result.prompt,/八成|80 to 85|九头|nine.head/);
  assert.match(result.prompt,language==='en'?/framing|composition/:/取景|构图/);
 }
 for(const language of ['zh-CN','en']){
  const result=compileAssetPrompt({stage:'structure',focus:'framing',language});
  assert.match(result.prompt,language==='en'?/body proportions.*unchanged/:/保持身体比例/);
  assert.match(result.prompt,language==='en'?/breathing room/:/舒展空间/);
 }
});

test('legacy planning entry points also default to nonnumeric proportions',()=>{
 for(const command of ['proportion-profile','proportion-plan','fashion-human-plan','fashion-human-v3-plan','fashion-human-v31-plan','fashion-asset-v082','p9-persistence','p9-body-plan','fashion-persistence-pipeline']){
  const r=spawnSync(process.execPath,['scripts/iteration-director.mjs',command],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  assert.doesNotMatch(r.stdout,/九头身|nine.head|P9_locked|"source_level": "P9"/i,command);
 }
});

test('user-requested qualitative revision creates a new goal and preserves its numeric parent',()=>{
 const brief=garden(),original=structuredClone(brief);
 original.requirements.find(r=>r.id==='body').target_head_count=9;
 original.requirements.find(r=>r.id==='body').text='本轮明确九头身，各段协调。';
 original.sections.find(s=>s.channel==='proportion').items[0].text='本轮明确九头身，各段协调。';
 original.acceptance.find(a=>a.basis==='body').question='是否满足明确九头身且各段协调？';
 const options={case_id:'body-framing',cohort:'synthetic-no-image'},parent=freezeProductionRun(original,{...options,run_id:'numeric'});
 const before=JSON.stringify(parent);
 const revised=reviseProductionInput(original,{request:'不强制九头身，协调修长即可。',channels:['proportion'],
  sections:[{label:'身材比例',items:brief.sections.find(s=>s.channel==='proportion').items}],
  requirements:[brief.requirements.find(r=>r.id==='body')],acceptance:[brief.acceptance.find(a=>a.basis==='body')]});
 const child=freezeProductionRun(revised.input,{...options,run_id:'qualitative',kind:'revision',parent});
 assert.equal(child.goal_changed,true);assert.notEqual(child.target_sha256,parent.target_sha256);
 assert.equal(JSON.stringify(parent),before);verifyFrozenRun(parent,{verifyFiles:false});
 assert.equal(parent.target.requirements.find(r=>r.id==='body').target_head_count,9);
 assert.equal(child.target.requirements.find(r=>r.id==='body').target_head_count,undefined);
});

test('framing and body remain separately critical under qualitative acceptance',()=>{
 const c=compileProductionPrompt(garden());
 for(const id of ['space-check','body-check']){
  const r=reviewProductionResult(c,{prompt_sha256:c.prompt_sha256,output_image:'synthetic.png',output_sha256:'0'.repeat(64),inspected:true,reviewer:'Synthetic state test, not image evidence',checks:c.acceptance.map(a=>({id:a.id,verdict:a.id===id?'fail':'pass',evidence:'Synthetic decision only.'}))});
  assert.equal(r.status,'needs_revision');assert.deepEqual(r.critical_failures,[id]);
 }
});
