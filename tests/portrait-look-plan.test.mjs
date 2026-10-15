import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {buildPortraitLookPlan,renderPortraitLookPrompts} from '../scripts/portrait-look-plan.mjs';
import {compileProductionPrompt} from '../scripts/production-prompt.mjs';

const fixture = () => JSON.parse(fs.readFileSync(new URL('../examples/portrait-look-diversity-plan.json',import.meta.url),'utf8'));
const ids = report => report.diagnostics.map(row => row.code);

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
