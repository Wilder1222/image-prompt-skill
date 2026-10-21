import {pngFixture} from './helpers/image-fixture.mjs';
import {withCharacterGoals} from '../scripts/character-goals.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {applyFaceReviewPlan,buildFaceReviewPlan,validateFaceReviewChecks} from '../scripts/face-review-plan.mjs';
import {compileProductionPrompt,objectHash} from '../scripts/production-prompt.mjs';
import {freezeProductionRun as freezeRun,verifyFrozenRun} from '../scripts/production-run.mjs';
import {auditPromptQuality} from '../scripts/prompt-quality-audit.mjs';

// These fixtures intentionally repeat exact protection prose in the detailed scope.
// Review that known diagnostic explicitly without weakening the production gate.
function freezeProductionRun(input,options){
  const reviewed=structuredClone(input),audit=auditPromptQuality(reviewed);
  assert.ok(audit.diagnostics.every(row=>row.code==='scope_repeats_clause'));
  if(audit.diagnostics.length)reviewed.quality_review={prompt_sha256:audit.prompt_sha256,diagnostics_sha256:audit.diagnostics_sha256,
    reviewer:'synthetic source-preservation test author; no visual approval',decisions:audit.diagnostics.map(row=>({diagnostic_sha256:objectHash(row),resolution:'retain',
      reason:'本合成夹具有意保留详细保护范围与正文的重复，以验证来源和编辑边界；不代表视觉质量通过。'}))};
  return freezeRun(reviewed,options);
}

function setup(t){
  const parent=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'face-review-plan-'));
  t.after(()=>{const relative=path.relative(parent,path.resolve(dir));if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('unsafe temporary cleanup');fs.rmSync(dir,{recursive:true,force:true});});
  const original=path.join(dir,'original.png'),candidate=path.join(dir,'candidate.png');
  const pixels=pngFixture();
  fs.writeFileSync(original,pixels);fs.writeFileSync(candidate,Buffer.concat([pixels,Buffer.from('synthetic candidate bytes, not a real portrait review')]));
  const fact=(id,channel,text,visibility='visible',extra={})=>({id,channel,text,visibility,...extra});
  const originalFacts=[fact('original-face','identity','合成整体面容声明，不是实际像素观察。'),
    fact('original-left-eye','identity','合成左眼型声明。','visible',{side:'left',view:'front'}),
    fact('original-right-eye','identity','合成左眼型声明。','visible',{side:'right',view:'front'}),
    fact('original-chin','identity','下巴可见部分圆钝。','partial',{view:'front'}),
    fact('original-nose-unknown','identity','原鼻梁不清楚，待审。','unknown',{view:'front'}),
    fact('original-profile-missing','identity','合成鼻尖前突声明，但当前原图没有侧面视角。','visible',{view:'profile'})];
  const baselineFacts=[fact('candidate-gloss','makeup','合成的额部过强光泽观察。','visible',{view:'front'})];
  const brief={subject_kind:'character',request:'合成生产契约，只检验原图身份与候选编辑基准的分工，不宣称测试图有人物。',
    references:[{id:'ORIGINAL',source:original,inspected:true,generation_input:true,authority:['identity'],identity_role:'primary',facts:originalFacts},
      {id:'BASELINE',source:candidate,inspected:true,generation_input:true,authority:[],facts:baselineFacts}],unresolved:[],
    requirements:[{id:'identity',channel:'identity',priority:'must',text:'保持原图本人。'},
      {id:'proportion',channel:'proportion',priority:'must',text:'仅检查可见头颈肩关系。'}],
    sections:[{label:'原人物',channel:'identity',items:[{text:'保留原图实际可见的整体面容关系。',basis:['identity','original-face'],intent:'retain'}]},
      {label:'可见比例',channel:'proportion',items:[{text:'可见头颈肩协调，不推定画外身体。',basis:['proportion'],intent:'constraint'}]}],
    acceptance:[{id:'identity-check',basis:'identity',question:'可见原身份是否保持？',critical:true},{id:'proportion-check',basis:'proportion',question:'可见头颈肩是否协调？',critical:true}]};
  const observation=(reference_id,fact)=>({reference_id,fact_id:fact.id,text:fact.text,visibility:fact.visibility,view:fact.view??'front'});
  const input={id:'standardization-v1',request:'只调整候选的过强肤光，保留原图可见身份，未知结构继续待审。',original_reference_id:'ORIGINAL',baseline_reference_id:'BASELINE',
    available_views:{ORIGINAL:['front'],BASELINE:['front']},axes:[
      {selector:'skin_gloss',role:'change',goal:'减少额部过强油亮，保持妆色与体积，不重画五官。',observation:observation('BASELINE',baselineFacts[0])},
      {selector:'eye_shape:left',role:'preserve',observation:observation('ORIGINAL',originalFacts[1])},
      {selector:'chin',role:'preserve',observation:observation('ORIGINAL',originalFacts[3])},
      {selector:'nose_bridge',role:'inspect',observation:observation('ORIGINAL',originalFacts[4])},
      {selector:'nose_tip_projection',role:'inspect',observation:observation('ORIGINAL',originalFacts[5])}]};
  return {brief:withCharacterGoals(brief,{bindings:{elongated:'proportion'}}),input,original,candidate};
}

test('review plans separate mutable changes, visible protection, unavailable structure and relationship review',t=>{
  const {input}=setup(t),plan=buildFaceReviewPlan(input);
  assert.deepEqual(plan.changed_axes,['skin_gloss']);assert.deepEqual(plan.changed_stable_axes,[]);
  assert.deepEqual(plan.protected_stable_axes,['eye_shape:left','chin']);
  assert.deepEqual(plan.unavailable_axes,['nose_bridge','nose_tip_projection']);
  assert.equal(plan.axis_checks.find(row=>row.selector==='chin').review_extent,'visible_portion_only');
  assert.ok(plan.relationship_checks.length);assert.ok(plan.relationship_checks.every(row=>row.automatic_change_authority===false&&row.critical===false));
  assert.ok(plan.axis_checks.every(row=>row.initial_verdict!=='pass'));assert.equal(plan.evidence.visual_quality_verified,false);
});

test('standardization does not authorize geometry redesign, unknown preservation or guessed mirror sides',t=>{
  const {input}=setup(t);
  const geometry=structuredClone(input);geometry.axes[1].role='change';geometry.axes[1].goal='把左眼重设计为另一种眼型。';assert.throws(()=>buildFaceReviewPlan(geometry),/cannot change stable identity/);
  const unknown=structuredClone(input);unknown.axes[3].role='preserve';assert.throws(()=>buildFaceReviewPlan(unknown),/unknown or unavailable-view/);
  const wrongSource=structuredClone(input);wrongSource.axes[1].observation.reference_id='BASELINE';assert.throws(()=>buildFaceReviewPlan(wrongSource),/stable review observations must use the original/);
  const invalidSide=structuredClone(input);invalidSide.axes[1].selector='chin:left';assert.throws(()=>buildFaceReviewPlan(invalidSide),/invalid face review selector/);
  const mixed=structuredClone(input);mixed.axes.push({...structuredClone(input.axes[1]),selector:'eye_shape',role:'inspect'});assert.throws(()=>buildFaceReviewPlan(mixed),/mix flat and sided/);
});

test('application preserves original identity authority and freezes both real tool inputs with the complete plan',t=>{
  const {brief,input,original,candidate}=setup(t),before=structuredClone(brief),plan=buildFaceReviewPlan(input),applied=applyFaceReviewPlan(brief,plan);
  assert.deepEqual(brief,before);assert.deepEqual(applied.references,before.references);
  assert.equal(applied.edit_scope.baseline_reference_id,'BASELINE');assert.equal(applied.references[1].authority.length,0);
  assert.match(compileProductionPrompt(applied).prompt,/编辑输入图2，输入图1是唯一人物身份来源/);
  const parentBrief=structuredClone(brief);parentBrief.references=parentBrief.references.filter(ref=>ref.id==='ORIGINAL');
  const parent=freezeProductionRun(parentBrief,{run_id:'original',case_id:'source',cohort:'synthetic'});
  const snapshot=freezeProductionRun(applied,{run_id:'edit',case_id:'source',cohort:'synthetic',kind:'edit',parent});
  assert.deepEqual(verifyFrozenRun(snapshot).referenced_image_paths,[original,candidate]);
  const frozen=snapshot.target.requirements.find(row=>row.face_review_plan)?.face_review_plan;
  assert.deepEqual(frozen,plan);assert.equal(frozen.plan_sha256,plan.plan_sha256);
  assert.ok(snapshot.target.acceptance.find(row=>row.id.includes('eye_shape:left')).critical);
  assert.equal(snapshot.target.acceptance.find(row=>row.id.includes('nose_bridge:check')).critical,false);
  assert.ok(snapshot.edit_scope.preserve.some(text=>/仅在实际可见部分保留原图的下巴/.test(text)));
});

test('candidate cannot acquire authority, identity declarations, or replace a required input',t=>{
  const {brief,input}=setup(t);
  for(const patch of [{authority:['style']},{authority:['identity']},{identity_target_id:'candidate-person'},{identity_role:'primary'},{identity_group:null},{generation_input:false}]){
    const next=structuredClone(brief);Object.assign(next.references[1],patch);assert.throws(()=>applyFaceReviewPlan(next,input));
  }
  const absent=structuredClone(brief);absent.references[1].generation_input=false;assert.throws(()=>applyFaceReviewPlan(absent,input),/candidate baseline/);
  const wrongScope=structuredClone(brief);wrongScope.edit_scope={baseline_reference_id:'ORIGINAL',changes:['合成变化。'],preserve:['合成保持。']};
  assert.throws(()=>applyFaceReviewPlan(wrongScope,input),/different baseline/);
});

test('RP original byte binding is rechecked at plan application without a registry override',t=>{
  const {brief,input}=setup(t);brief.references[0].identity_target_id='RP-A01';
  assert.throws(()=>applyFaceReviewPlan(brief,input),/exact original file bytes/);
  assert.throws(()=>applyFaceReviewPlan(brief,input,{catalog:{}}),/unsupported face review options/);
});

test('observation facts must match id, text, visibility, view and anatomical side exactly',t=>{
  const {brief,input}=setup(t);
  for(const patch of [{fact_id:'missing-fact'},{text:'未冻结的另一种眼形。'},{visibility:'partial'},{view:'three_quarter'}]){
    const next=structuredClone(input);Object.assign(next.axes[1].observation,patch);assert.throws(()=>applyFaceReviewPlan(brief,next),/exact fact|conflicts|unavailable-view/);
  }
  const swapped=structuredClone(input);swapped.axes[1].observation.fact_id='original-right-eye';assert.throws(()=>applyFaceReviewPlan(brief,swapped),/side conflicts/);
  const flat=structuredClone(input);flat.axes[1].selector='eye_shape';assert.throws(()=>applyFaceReviewPlan(brief,flat),/one-sided fact/);
});

test('change, preserve and inspect observations cannot borrow a fact from another production channel',t=>{
  const {brief,input}=setup(t);
  for(const row of [input.axes[0],input.axes[1],input.axes[3]]){
    const mismatch=structuredClone(brief),ref=mismatch.references.find(source=>source.id===row.observation.reference_id);
    ref.facts.find(fact=>fact.id===row.observation.fact_id).channel='costume';
    assert.throws(()=>applyFaceReviewPlan(mismatch,input),/fact channel must match the selected axis channel/);
  }
});

test('the current plan replaces stale change authorization while retaining earlier protection and authored musts',t=>{
  const {brief,input}=setup(t),oldChanges=['削尖下巴。','将双眼重画为统一大眼。'];
  brief.edit_scope={baseline_reference_id:'BASELINE',changes:oldChanges,preserve:['保持既有衣装与头饰。']};
  const before=structuredClone(brief),applied=applyFaceReviewPlan(brief,input);
  assert.deepEqual(brief,before);assert.equal(applied.edit_scope.changes.length,1);
  assert.ok(applied.edit_scope.changes[0].endsWith(input.axes[0].goal));
  assert.ok(oldChanges.every(text=>!applied.edit_scope.changes.includes(text)));
  assert.ok(applied.edit_scope.preserve.includes('保持既有衣装与头饰。'));
  for(const must of before.requirements)assert.deepEqual(applied.requirements.find(row=>row.id===must.id),must);
  assert.ok(!compileProductionPrompt(applied).prompt.includes('削尖下巴。'));
});

test('a second plan cannot stack contradictory FRP goals onto an already projected brief',t=>{
  const {brief,input}=setup(t),first=structuredClone(input);
  first.id='matte-first';first.axes[0].goal='使额部呈柔和哑光，减少高光。';
  const projected=applyFaceReviewPlan(brief,first),before=structuredClone(projected),second=structuredClone(input);
  second.id='gloss-second';second.axes[0].goal='保留额部清楚而克制的柔亮高光，不改为哑光。';
  assert.throws(()=>applyFaceReviewPlan(projected,second),/already contains a face review plan.*rebuild from the authored brief/);
  assert.deepEqual(projected,before);
  const rebuilt=applyFaceReviewPlan(brief,second),compiled=compileProductionPrompt(rebuilt);
  assert.ok(compiled.prompt.includes(second.axes[0].goal));assert.ok(!compiled.prompt.includes(first.axes[0].goal));
  assert.equal(rebuilt.requirements.filter(row=>Object.hasOwn(row,'face_review_plan')).length,1);
  for(const must of brief.requirements)assert.deepEqual(rebuilt.requirements.find(row=>row.id===must.id),must);
});

test('candidate geometry cannot become known original structure when original views are unavailable',t=>{
  const {brief,input}=setup(t),candidateFact={id:'candidate-chin',channel:'identity',text:'合成候选清楚可见的圆下巴。',visibility:'visible',view:'front'};
  brief.references[1].facts.push(candidateFact);
  input.available_views.ORIGINAL=[];
  input.axes=[input.axes[0],{selector:'chin',role:'inspect',observation:{reference_id:'BASELINE',fact_id:candidateFact.id,text:candidateFact.text,visibility:'visible',view:'front'}}];
  assert.throws(()=>buildFaceReviewPlan(input),/all stable review observations must use the original/);
  const originalUnknown=brief.references[0].facts.find(fact=>fact.id==='original-chin');
  originalUnknown.text='当前原图下巴不清楚，不能据候选补成原观察。';originalUnknown.visibility='unknown';originalUnknown.view='unknown';
  input.axes[1].observation={reference_id:'ORIGINAL',fact_id:originalUnknown.id,text:originalUnknown.text,visibility:'unknown',view:'unknown'};
  const plan=buildFaceReviewPlan(input);
  assert.equal(plan.axis_checks.find(row=>row.selector==='chin').review_extent,'unavailable');
  assert.throws(()=>validateFaceReviewChecks(plan,{plan_sha256:plan.plan_sha256,checks:[
    {selector:'skin_gloss',verdict:'pass',evidence:'合成的修订声明。'},
    {selector:'chin',verdict:'pass',evidence:'不能因为候选近景清楚就把原结构升级为通过。'}]}),/unavailable original structure cannot acquire a pass/);
});

test('plan hashes reject stale source declarations and derived plan fields cannot invent extra changes',t=>{
  const {brief,input}=setup(t),plan=buildFaceReviewPlan(input);
  const modified=structuredClone(plan);modified.axes[0].goal='另一种未冻结的肤光目标。';assert.throws(()=>applyFaceReviewPlan(brief,modified),/plan hash changed/);
  const invented=structuredClone(plan);invented.changed_stable_axes=['chin'];invented.axis_checks[1].role='change';
  assert.deepEqual(applyFaceReviewPlan(brief,invented),applyFaceReviewPlan(brief,input));
});

test('review declarations cannot upgrade unavailable original structure from a generated close-up',t=>{
  const {input}=setup(t),plan=buildFaceReviewPlan(input),checks=plan.axis_checks.map(row=>({selector:row.selector,verdict:row.review_extent==='unavailable'?'not_assessable':'pass',evidence:'合成的声明检验文本；不是实际图像验收。'}));
  const checked=validateFaceReviewChecks(plan,{plan_sha256:plan.plan_sha256,checks});
  assert.equal(checked.status,'review_declarations_checked');assert.equal(checked.visual_quality_verified,false);assert.equal(checked.user_accepted,false);
  const upgraded=structuredClone(checks);upgraded.find(row=>row.selector==='nose_bridge').verdict='pass';
  assert.throws(()=>validateFaceReviewChecks(plan,{plan_sha256:plan.plan_sha256,checks:upgraded}),/cannot acquire a pass/);
  assert.throws(()=>validateFaceReviewChecks(plan,{plan_sha256:'0'.repeat(64),checks}),/bind the exact plan/);
  assert.throws(()=>validateFaceReviewChecks(plan,{plan_sha256:plan.plan_sha256,checks:checks.slice(1)}),/cover every selected axis/);
});

test('inspection-only plans create review records and do not silently authorize a pixel edit',t=>{
  const {brief,input}=setup(t);input.axes=input.axes.filter(row=>row.role!=='change');
  const plan=buildFaceReviewPlan(input);assert.deepEqual(plan.changed_axes,[]);
  assert.throws(()=>applyFaceReviewPlan(brief,plan),/inspection-only plans/);
});

test('input positions follow actual image order and numeric controls do not enter revision goals',t=>{
  const {brief,input}=setup(t);brief.references.reverse();
  assert.match(compileProductionPrompt(applyFaceReviewPlan(brief,input)).prompt,/编辑输入图1，输入图2是唯一人物身份来源/);
  for(const goal of ['eye_shape : left = 0.4','skin_gloss设为0.8','slider_gloss=50']){
    const next=structuredClone(input);next.axes[0].goal=goal;assert.throws(()=>buildFaceReviewPlan(next),/numeric axis or slider/);
  }
});
