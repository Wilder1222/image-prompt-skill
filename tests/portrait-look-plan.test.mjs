import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {buildPortraitLookPlan,renderPortraitLookPrompts,revisePortraitLookPlan} from '../scripts/portrait-look-plan.mjs';
import {compileProductionPrompt,objectHash} from '../scripts/production-prompt.mjs';

const fixture = () => JSON.parse(fs.readFileSync(new URL('../examples/portrait-look-diversity-plan.json',import.meta.url),'utf8'));
const ids = report => report.diagnostics.map(row => row.code);
const actionFixture = () => {
  const input=fixture();input.count=2;input.groups=[];input.looks=input.looks.slice(0,2);
  input.variation_channels.push('action');
  input.looks.forEach((look,index)=>{delete look.group;look.action={
    head:'头部端正，视线平视，不左右歪头。',
    torso:index?'躯干微侧，肩线自然舒展。':'躯干正对镜头，双肩平稳。',
    hands:index?'一手轻扶领缘，另一臂放松下垂。':'两臂自然下垂，双手不入近景。',
    support:'上身自然挺拔，画外腿脚不补造。'
  };});return input;
};

test('an explicit new detail policy preserves essential targets and records discretionary design checks',()=>{
  const input=actionFixture();
  input.shared=[{channel:'action',text:'头部端正，保持本人的表观年龄。'}];
  for(const look of input.looks)look.detail_policy={critical:['hair:outline','expression','makeup','action:head','action:hands'],reason:'用户要求可见的妆造差异；自拟分缝和腿脚侧别作为设计偏好。'};
  const report=buildPortraitLookPlan(input),variant=report.variants[0];
  assert.equal(report.status,'text_plan_ready');
  for(const [suffix,priority]of [['hair:outline','must'],['hair:parting','prefer'],['action:hands','must'],['action:support','prefer']]){
    const req=variant.brief.requirements.find(r=>r.id.endsWith(':'+suffix));assert.equal(req.priority,priority);
    assert.equal(variant.brief.acceptance.find(c=>c.basis===req.id).critical,priority==='must');assert.ok(variant.prompt.includes(req.text));
  }
  assert.equal(variant.brief.requirements.find(r=>r.id.includes(':shared:')).priority,'must');
  assert.deepEqual(variant.brief.metadata.portrait_look.detail_policy,input.looks[0].detail_policy);
  const invalid=structuredClone(input);invalid.looks[0].detail_policy.critical=['hair:outline'];
  assert.throws(()=>buildPortraitLookPlan(invalid),/every variation channel/);
  invalid.looks[0].detail_policy.critical=['hair:made-up'];assert.throws(()=>buildPortraitLookPlan(invalid),/supported critical/);
});

test('pose differences become delivered prose and critical targets while upright heads may be shared',()=>{
  const input=actionFixture(),before=structuredClone(input),report=buildPortraitLookPlan(input);
  assert.equal(report.status,'text_plan_ready');assert.deepEqual(input,before);
  for(const variant of report.variants)for(const field of ['head','torso','hands','support']){
    const target=variant.brief.requirements.find(r=>r.id===`PL:${input.id}:${variant.id}:action:${field}`);
    assert.equal(target.channel,'action');assert.ok(variant.prompt.includes(target.text));
    assert.ok(variant.brief.acceptance.some(c=>c.basis===target.id&&c.critical));
  }
  input.looks[1].action={...input.looks[0].action,head:'仅改成向左歪头。'};
  assert.ok(ids(buildPortraitLookPlan(input)).includes('repeated_body_action'));
});

test('pose-only revision preserves the complete hair, makeup and expression and rejects partial poses',()=>{
  const input=actionFixture(),action={...input.looks[1].action,hands:'一手轻搭腰侧，另一手放松。'};
  const {plan,report}=revisePortraitLookPlan(input,{look_id:input.looks[1].id,channels:['action'],updates:{action},reason:'区分上身与手部表演。'});
  for(const key of ['hair','makeup','expression'])assert.deepEqual(plan.looks[1][key],input.looks[1][key]);
  assert.deepEqual(plan.base_brief,input.base_brief);assert.equal(report.status,'text_plan_ready');
  assert.match(report.variants[1].prompt,/一手轻搭腰侧/);
  delete input.looks[1].action.support;assert.throws(()=>buildPortraitLookPlan(input),/action support/);
});

test('fixed base action remains valid for hair trials but must be resolved when action varies',()=>{
  const input=fixture(),base=input.base_brief;
  base.requirements.push({id:'fixed-pose',channel:'action',priority:'must',text:'肩部正对镜头，手臂自然下垂。'});
  base.sections.push({label:'固定姿态',channel:'action',items:[{text:'肩部正对镜头，手臂自然下垂。',basis:['fixed-pose'],intent:'constraint'}]});
  base.acceptance.push({id:'fixed-pose-check',basis:'fixed-pose',critical:true,question:'肩部与手臂是否保持指定姿态？'});
  assert.equal(buildPortraitLookPlan(input).status,'text_plan_ready');
  const varying=actionFixture();varying.base_brief=base;
  assert.throws(()=>buildPortraitLookPlan(varying),/clean inherited/);
  assert.throws(()=>revisePortraitLookPlan(input,{look_id:input.looks[0].id,channels:['action'],updates:{action:varying.looks[0].action},reason:'未获准姿势变化。'}),/authorized variation/);
});

test('expression repair carries the complete current hairstyle, makeup and fixed costume without an extra focus summary',()=>{
  const input=fixture(),before=structuredClone(input),look=input.looks[1];
  const changed={...look.expression,mouth:'双唇形成清楚的小圆开口，嘴角不向两侧拉开。'};
  const result=revisePortraitLookPlan(input,{look_id:look.id,channels:['expression'],updates:{expression:changed},reason:'实图仍沿用原图露齿笑，修正口形。'});
  assert.deepEqual(input,before);
  assert.deepEqual(result.plan.looks[1].hair,look.hair);
  assert.deepEqual(result.plan.looks[1].makeup,look.makeup);
  assert.deepEqual(result.plan.base_brief,input.base_brief);
  assert.deepEqual(result.plan.looks[0],input.looks[0]);
  const variant=result.report.variants[1];
  for(const [field,prose] of Object.entries(look.hair.front))assert.ok(variant.prompt.includes(prose),field);
  assert.ok(variant.prompt.includes(changed.mouth));
  assert.ok(variant.brief.sections.findIndex(s=>s.channel==='expression')<variant.brief.sections.findIndex(s=>s.channel==='composition'));
  assert.equal(variant.brief.sections.filter(s=>s.channel==='hair').length,1);
  assert.equal(variant.brief.sections.filter(s=>s.channel==='expression').length,1);
  assert.deepEqual(variant.brief.references,input.base_brief.references);
  assert.notEqual(variant.prompt_sha256,buildPortraitLookPlan(input).variants[1].prompt_sha256);
});

test('common hair goals merge safely with a matching label and emphasis cannot add an unauthorized channel',()=>{
  const input=fixture();input.base_brief.sections.find(s=>s.channel==='hair').label='发型与头饰';
  input.looks[0].focus_channels=['hair','makeup'];
  const variant=buildPortraitLookPlan(input).variants[0];
  for(const common of input.base_brief.sections.find(s=>s.channel==='hair').items)assert.equal(variant.prompt.split(common.text).length-1,1);
  for(const focus of [['identity'],['hair','hair']]){const invalid=structuredClone(input);invalid.looks[0].focus_channels=focus;assert.throws(()=>buildPortraitLookPlan(invalid),/focus_channels/);}
  assert.throws(()=>revisePortraitLookPlan(input,{look_id:'jk01',channels:['expression'],updates:{expression:input.looks[0].expression,hair:input.looks[0].hair},reason:'范围外改发型。'}),/unsupported/);
  assert.throws(()=>revisePortraitLookPlan(input,{look_id:'jk01',channels:['hair'],updates:{hair:{front:{fringe:'只写刘海，丢掉其他发区。'}}},reason:'不完整发型。'}));
});

test('changing authored front hair changes delivered prose, its must target and frozen goal rather than only a signature',()=>{
  const first=fixture(),second=structuredClone(first);
  second.looks[0].hair.front.fringe='完整的眉上厚齐刘海，边缘有自然参差，双眉和眼睛清楚露出。';
  const a=buildPortraitLookPlan(first),b=buildPortraitLookPlan(second);
  assert.notEqual(a.variants[0].prompt_sha256,b.variants[0].prompt_sha256);
  assert.match(b.variants[0].prompt,/眉上厚齐刘海/);
  assert.notEqual(objectHash(a.variants[0].brief.requirements),objectHash(b.variants[0].brief.requirements));
  for(const variant of b.variants)for(const field of ['parting','fringe','temples','outline']){
    const row=variant.brief.requirements.find(r=>r.id.endsWith(`hair:${field}`));
    assert.ok(row&&variant.prompt.includes(row.text));assert.ok(variant.brief.acceptance.some(c=>c.basis===row.id&&c.critical));
  }
  const codes=fixture();codes.looks[0].hair.front.fringe='no_fringe';
  assert.throws(()=>buildPortraitLookPlan(codes),/visible Chinese prose/);
});

test('each authored look preserves the shared person, fixed view and body goals in a complete independent brief',()=>{
  const input=fixture(),before=structuredClone(input),report=buildPortraitLookPlan(input);
  assert.deepEqual(input,before); assert.equal(report.status,'text_plan_ready');
  assert.equal(report.count,10); assert.deepEqual(report.groups.map(row=>row.count),[5,5]);
  for(const variant of report.variants){
    assert.deepEqual(variant.brief.references,input.base_brief.references);
    for(const requirement of input.base_brief.requirements)
      assert.deepEqual(variant.brief.requirements.find(row=>row.id===requirement.id),requirement);
    assert.match(variant.prompt,/自然乌黑/); assert.match(variant.prompt,/不左右偏头/);
    assert.match(variant.prompt,/苗条/); assert.match(variant.prompt,/适当有肌肉/);
    assert.doesNotMatch(variant.prompt,/PL:|deep_side|text_plan_ready/);
    for(const requirement of variant.brief.requirements.filter(row=>row.id.startsWith('PL:'))){
      assert.equal(requirement.priority,'must');
      assert.ok(variant.brief.acceptance.some(row=>row.basis===requirement.id&&row.critical));
    }
    assert.equal(compileProductionPrompt(variant.brief).prompt_sha256,variant.prompt_sha256);
  }
  assert.equal(report.evidence.image_generated,false);
  assert.equal(report.evidence.semantic_fit_verified,false);
  assert.equal(report.evidence.visual_diversity_verified,false);
  assert.equal(report.evidence.identity_preservation_verified,false);
});

test('changing a name, group or rear decoration cannot disguise identical declared front hair',()=>{
  const input=fixture();
  input.looks[1].hair.front=structuredClone(input.looks[0].hair.front);
  input.looks[1].label='另一个地区名字与蝴蝶结';
  input.looks[1].hair.text+='后脑加一只发夹，前额分区与刘海仍沿用第一套。';
  const report=buildPortraitLookPlan(input);
  assert.equal(report.status,'needs_revision');
  assert.ok(report.diagnostics.some(row=>row.code==='repeated_front_hair'&&row.look_ids.includes('jk01')&&row.look_ids.includes('jk02')));
  assert.throws(()=>renderPortraitLookPrompts(report),/resolve repeated/);
});

test('different emotion names with the same visible performance remain a duplicate',()=>{
  const input=fixture();
  input.looks[1].expression={...input.looks[0].expression,emotion:'文字上改成非常活泼'};
  assert.ok(ids(buildPortraitLookPlan(input)).includes('repeated_expression_performance'));
});

test('declared front signatures and repeated prose normalize typography without claiming semantic understanding',()=>{
  const input=fixture();
  input.looks[1].hair.front=Object.fromEntries(Object.entries(input.looks[0].hair.front).map(([key,value])=>[key,' '+value.toUpperCase()+'  ']));
  input.looks[1].makeup='  '+input.looks[0].makeup+'  ';
  const report=buildPortraitLookPlan(input);
  assert.ok(ids(report).includes('repeated_front_hair'));
  assert.ok(ids(report).includes('repeated_makeup_prose'));
  assert.equal(report.evidence.semantic_fit_verified,false);
});

test('arbitrary counts and groupings work and a hair-only task keeps common makeup and expression fixed',()=>{
  const input=fixture(); input.count=3; input.looks=input.looks.slice(0,3);
  input.variation_channels=['hair'];
  input.groups=[{id:'a',label:'两个短发方向',count:2},{id:'b',label:'一个肩部方向',count:1}];
  input.looks.forEach((look,index)=>{look.group=index<2?'a':'b';delete look.expression;delete look.makeup;});
  input.shared.push({channel:'expression',text:'全部保持自然闭唇、目光看镜头与安静神态。'},{channel:'makeup',text:'全部保持同一套淡灰棕眼妆和自然玫瑰唇色。'});
  const report=buildPortraitLookPlan(input);
  assert.equal(report.status,'text_plan_ready'); assert.equal(report.count,3);
  assert.deepEqual(report.variation_channels,['hair']);
  for(const variant of report.variants){
    assert.match(variant.prompt,/全部保持自然闭唇/);assert.match(variant.prompt,/同一套淡灰棕眼妆/);
  }
});

test('old hair or presentation locks must be resolved before look projection',()=>{
  const input=fixture(),base=input.base_brief;
  base.requirements.push({id:'old-hair',channel:'hair',priority:'must',text:'所有额前刘海逐根保持原样。'});
  base.sections.push({label:'旧发型',channel:'hair',items:[{text:'所有额前刘海逐根保持原样。',basis:['old-hair'],intent:'constraint'}]});
  base.acceptance.push({id:'old-hair-check',basis:'old-hair',critical:true,question:'刘海是否逐根不变？'});
  assert.throws(()=>buildPortraitLookPlan(input),/clean inherited/);
  const narrow=fixture();narrow.base_brief.edit_scope={};
  assert.throws(()=>buildPortraitLookPlan(narrow),/narrow edit_scope/);
});

test('counts, groups, undeclared channels and separate identities cannot silently pass',()=>{
  for(const mutate of [
    input=>{input.count=9;},
    input=>{input.groups[0].count=4;},
    input=>{input.looks[0].group='missing';},
    input=>{input.looks[0].group='cn';},
    input=>{input.looks[0].id=input.looks[1].id;},
    input=>{input.variation_channels=['hair'];},
    input=>{input.identity_mode='independent_characters';},
    input=>{input.looks[0].hair.front.eye_shape='redesign';}
  ]){
    const input=fixture();mutate(input);assert.throws(()=>buildPortraitLookPlan(input));
  }
});

test('CLI renders complete per-look prompts and rejects unsupported formats',()=>{
  const args=['scripts/portrait-look-plan.mjs','--input','examples/portrait-look-diversity-plan.json'];
  const result=spawnSync(process.execPath,[...args,'--format','text'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.equal((result.stdout.match(/^## /gm)??[]).length,10);
  assert.equal((result.stdout.match(/【人物身份与面容】/g)??[]).length,10);
  assert.equal((result.stdout.match(/自然乌黑发色/g)??[]).length,10);
  assert.equal(spawnSync(process.execPath,[...args,'--format','yaml'],{encoding:'utf8'}).status,1);
});
