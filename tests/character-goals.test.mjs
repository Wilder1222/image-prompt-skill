import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withCharacterGoals,characterGoals} from '../scripts/character-goals.mjs';
import {compileProductionPrompt,objectHash} from '../scripts/production-prompt.mjs';
import {freezeProductionRun,verifyFrozenRun} from '../scripts/production-run.mjs';
import {applyFaceDesign} from '../scripts/face-design.mjs';
const read=file=>JSON.parse(fs.readFileSync(new URL(`../examples/${file}`,import.meta.url),'utf8'));
const freeze=input=>freezeProductionRun(input,{run_id:'goal-test',case_id:'portrait',cohort:'contract-test'});

function removeGoal(input,goal){
  const next=structuredClone(input),ids=new Set(next.requirements.filter(r=>r.character_goal===goal).map(r=>r.id));
  next.requirements=next.requirements.filter(r=>!ids.has(r.id));
  next.sections=next.sections.map(s=>({...s,items:s.items.filter(i=>!i.basis.some(id=>ids.has(id)))})).filter(s=>s.items.length);
  next.acceptance=next.acceptance.filter(c=>!ids.has(c.basis));return next;
}
test('each common dimension needs its own must target, authored clause and critical review',()=>{
  const brief=read('face-design-portrait-base.json');
  for(const goal of Object.keys(characterGoals)){
    assert.throws(()=>compileProductionPrompt(removeGoal(brief,goal)),new RegExp(`missing character goal: ${goal}`));
    const weak=structuredClone(brief),row=weak.requirements.find(r=>r.character_goal===goal);row.priority='prefer';
    assert.throws(()=>compileProductionPrompt(weak),/invalid character goal/);
    const noReview=structuredClone(brief),required=noReview.requirements.find(r=>r.character_goal===goal);
    noReview.acceptance.find(c=>c.basis===required.id).critical=false;
    assert.throws(()=>compileProductionPrompt(noReview),/critical image criterion/);
  }
});
test('the complete benchmark example now carries all five dimensions through actual frozen acceptance',()=>{
  const input=applyFaceDesign(read('blue-benchmark-distinct-faces-portrait-base.json'),read('blue-benchmark-distinct-faces-round.json'));
  const before=structuredClone(input),snapshot=freeze(input);
  assert.deepEqual(input,before);assert.equal(snapshot.character_goals_contract,'character_goals_v1');
  for(const goal of Object.keys(characterGoals)){
    const row=snapshot.target.requirements.find(r=>r.character_goal===goal);assert.ok(row);
    assert.ok(snapshot.target.acceptance.some(c=>c.basis===row.id&&c.critical));
  }
  assert.equal(verifyFrozenRun(snapshot).prompt,compileProductionPrompt(input).prompt);
});
test('construction preserves authored prose and rejects automatic scope expansion',()=>{
  const source=read('face-design-portrait-base.json'),before=structuredClone(source);
  assert.deepEqual(withCharacterGoals(source),source);assert.deepEqual(source,before);
  const narrow=removeGoal(source,'slender');
  narrow.edit_scope={baseline_reference_id:'source',changes:['只修肤质'],preserve:['身体与发型']};
  assert.throws(()=>withCharacterGoals(narrow),/cannot expand editing permission/);
  const scoped=withCharacterGoals(narrow,{exceptions:{slender:{source:'edit_scope',reason:'本轮明确只修肤质；身形独立待审，不宣称整体达标。'}}});
  assert.equal(scoped.requirements.some(r=>r.character_goal==='slender'),false);
  const bad=structuredClone(scoped);delete bad.edit_scope;
  assert.throws(()=>compileProductionPrompt(bad),/needs an actual edit_scope/);
});
test('declared user overrides and nonvisible views are explicit, scoped, and cannot hide missing goals in metadata',()=>{
  const source=read('character-adaptive-brief.json');
  assert.equal(compileProductionPrompt(source).status,'prompt_ready');
  for(const exception of Object.values(source.character_exceptions))assert.equal(exception.source,'user_request');
  const rear=removeGoal(read('face-design-portrait-base.json'),'face_readable');
  rear.character_exceptions={face_readable:{source:'not_visible',reason:'本轮为严格背面，面容不可观察，后发型仍需验收。'}};
  assert.equal(compileProductionPrompt(rear).status,'prompt_ready');
  rear.metadata={face_readable:'此字段不能补足目标'};delete rear.character_exceptions;
  assert.throws(()=>compileProductionPrompt(rear),/missing character goal: face_readable/);
  rear.character_exceptions={face_readable:{source:'guess',reason:'猜测'}};
  assert.throws(()=>compileProductionPrompt(rear),/invalid character exception/);
  const frozenA=freeze(source),variant=structuredClone(source);variant.character_exceptions.slender.reason+='本轮保留厚实腰背。';
  assert.notEqual(frozenA.target_sha256,freeze(variant).target_sha256);
});
test('scene and product construction never receives body or hair clauses',()=>{
  for(const file of ['product-perfume-brief.json','text-to-image-brief.json']){
    const brief=read(file);assert.deepEqual(withCharacterGoals(brief),brief);
  }
});

test('age-specific body design reaches delivered prose and frozen critical acceptance without inventing ratios',()=>{
  const ageCases={infant:'短而柔软的四肢',child:'尚未成熟的肩胸骨盆',adolescent:'自然生长感',adult:'完整胸廓、腰腹和骨盆',older:'不通过年轻化',unspecified:'年龄未明时'};
  const hashes=new Set();
  for(const [ageStage,visibleRelation]of Object.entries(ageCases)){
    // A fresh task: no pre-authored body plan or observed reference to overwrite.
    const brief={subject_kind:'character',request:'原创人物，按已确认表观年龄设计全身比例。',references:[],unresolved:[],requirements:[],sections:[],acceptance:[]};
    const designed=withCharacterGoals(brief,{ageStage}),snapshot=freeze(designed);
    const compiled=verifyFrozenRun(snapshot);
    assert.ok(compiled.prompt.includes(visibleRelation));
    for(const goal of ['elongated','slender','muscle']){
      const target=snapshot.target.requirements.find(r=>r.character_goal===goal);
      assert.equal(target.priority,'must');assert.equal(target.target_head_count,undefined);
      assert.ok(snapshot.target.acceptance.some(c=>c.basis===target.id&&c.critical&&c.question.includes('年龄适配')));
    }
    assert.equal(brief.requirements.length,0);
    hashes.add(snapshot.target_sha256);
  }
  assert.equal(hashes.size,Object.keys(ageCases).length);
});

test('explicit stocky body survives construction and freezing without default slimming or elongation',()=>{
  const specified=read('character-adaptive-brief.json');
  const result=withCharacterGoals(specified,{ageStage:'adult'});
  assert.deepEqual(result,specified);
  const snapshot=freeze(result),compiled=verifyFrozenRun(snapshot);
  assert.ok(compiled.prompt.includes('矮壮力量体型'));
  assert.equal(snapshot.target.character_exceptions.slender.source,'user_request');
  assert.equal(snapshot.target.character_exceptions.elongated.source,'user_request');
  assert.ok(snapshot.target.acceptance.some(c=>c.basis==='body'&&c.critical));
  assert.ok(!snapshot.target.requirements.some(r=>['slender','elongated'].includes(r.character_goal)));
  assert.ok(!compiled.prompt.includes(characterGoals.slender.text));
});

test('age options never rewrite existing plans, bypass scoped edits, or silently accept typos',()=>{
  const source=read('face-design-portrait-base.json');
  assert.deepEqual(withCharacterGoals(source,{ageStage:'older'}),source);
  assert.throws(()=>withCharacterGoals(source,{ageStage:'chlid'}),/unknown body age stage/);
  const narrow=removeGoal(source,'elongated');
  narrow.edit_scope={baseline_reference_id:'source',changes:['只修肤质'],preserve:['身体比例']};
  assert.throws(()=>withCharacterGoals(narrow,{ageStage:'child'}),/cannot expand editing permission/);
});
