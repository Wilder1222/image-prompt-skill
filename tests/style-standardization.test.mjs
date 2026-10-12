import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyStyleStandardizationPlan,assertStyleStandardizationBindings,buildStyleStandardizationPlan,validateStyleStandardizationChecks} from '../scripts/style-standardization.mjs';
import {loadVisualPreferenceCatalog} from '../scripts/visual-preferences.mjs';
import {compileProductionPrompt,objectHash,promptHash} from '../scripts/production-prompt.mjs';
import {finishProductionRun,freezeProductionRun,summarizeProductionRuns,verifyFrozenRun} from '../scripts/production-run.mjs';
import {auditPromptQuality} from '../scripts/prompt-quality-audit.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function setup(t,id='VP-C01'){
  const parent=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'style-standardization-'));
  t.after(()=>{const relative=path.relative(parent,path.resolve(dir));if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('unsafe temporary cleanup');fs.rmSync(dir,{recursive:true,force:true});});
  const catalog=loadVisualPreferenceCatalog(),asset=structuredClone(catalog.assets.find(asset=>asset.id===id));
  const original=path.join(dir,'original.png'),candidate=path.join(dir,'candidate.png');
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
  fs.writeFileSync(original,bytes);fs.writeFileSync(candidate,Buffer.concat([bytes,Buffer.from('synthetic candidate differs from original; not a visual test')]));
  asset.source={...asset.source,sha256:promptHash(bytes),local_path:path.relative(root,original),availability:'local_verified'};
  asset.inspection={status:'actual_pixels'};catalog.assets=[asset];
  const requirements=[{id:'identity',channel:'identity',priority:'must',text:'保持当前原图人物的可见身份。'},
    {id:'proportion',channel:'proportion',priority:'must',text:'当前可见头颈肩及体态协调，不补写画外身体。'}];
  const brief={subject_kind:'character',request:'合成契约测试，保持当前原图任务风格并整理阅读质量；测试没有查看人物像素。',
    references:[{id:'ORIGINAL',source:original,inspected:true,generation_input:true,authority:['identity'],identity_role:'primary',facts:[{id:'source-visible',channel:'identity',text:'合成可见面容声明，不证明测试图里有人物。',visibility:'partial'}]}],unresolved:[],requirements,
    sections:requirements.map(requirement=>({label:requirement.channel==='identity'?'当前人物':'当前比例',channel:requirement.channel,items:[{text:requirement.text,basis:[requirement.id],intent:'constraint'}]})),
    acceptance:requirements.map(requirement=>({id:`${requirement.id}-check`,basis:requirement.id,critical:true,question:'当前原图可见范围是否保持？'})),metadata:{author:'synthetic declaration'}};
  return {catalog,asset,brief,original,candidate,input:{id:'style-source-v1',asset_id:id}};
}

test('compact scope reduces repeated delivery while retaining all detailed targets and checks',t=>{
  const {catalog,input,brief}=setup(t,'VP-C05');
  const detailed=buildStyleStandardizationPlan(input,{catalog});
  const compact=buildStyleStandardizationPlan({...input,scope_format:'compact'},{catalog});
  assert.deepEqual(compact.checks,detailed.checks);
  assert.deepEqual(compact.source,detailed.source);
  const a=applyStyleStandardizationPlan(brief,detailed,{catalog}),b=applyStyleStandardizationPlan(brief,compact,{catalog});
  assert.deepEqual(b.sections,a.sections);
  assert.deepEqual(b.acceptance,a.acceptance);
  assert.ok(compileProductionPrompt(b).prompt.length<compileProductionPrompt(a).prompt.length);
  assert.ok(auditPromptQuality(a).diagnostics.some(row=>row.code==='scope_repeats_clause'));
  assert.ok(!auditPromptQuality(b).diagnostics.some(row=>row.code==='scope_repeats_clause'));
  const parent=freezeProductionRun(brief,{run_id:'original',case_id:'lotus',cohort:'synthetic'});
  const snapshot=freezeProductionRun(b,{run_id:'compact',case_id:'lotus',cohort:'synthetic',kind:'edit',parent});
  assert.doesNotThrow(()=>verifyFrozenRun(snapshot));
  assert.throws(()=>buildStyleStandardizationPlan({...input,scope_format:'summarize-anything'},{catalog}),/scope_format/);
});

test('legacy detailed scope remains stable and compact face-only edits keep the narrow permission',t=>{
  const {catalog,input}=setup(t);
  const legacy=buildStyleStandardizationPlan(input,{catalog});
  assert.equal(legacy.input.scope_format,undefined);
  assert.deepEqual(legacy,buildStyleStandardizationPlan(legacy.input,{catalog}));
  const plan=buildStyleStandardizationPlan({...input,scope_format:'compact',standardization_goals:['tonal_hierarchy'],change_variant:'face_tonal_only'},{catalog});
  assert.equal(plan.changes.length,1);
  assert.match(plan.changes[0],/已见面部暗部/);
});

test('compact portrait comparison does not reinstate the old directional light or framing',t=>{
  const {catalog,input,brief}=setup(t);
  const comparison={...input,mode:'portrait_comparison',portrait_comparison_request:'明确独立肖像对照，允许改为中性正面柔光。',standardization_goals:['tonal_hierarchy','task_framing']};
  const detailed=buildStyleStandardizationPlan(comparison,{catalog});
  const compact=buildStyleStandardizationPlan({...comparison,scope_format:'compact'},{catalog});
  assert.deepEqual(compact.checks,detailed.checks);
  assert.doesNotMatch(compact.changes.join('\n'),/保持原光向/);
  assert.doesNotMatch(compact.preserve.join('\n'),/、光线|、构图|、环境/);
  assert.deepEqual(applyStyleStandardizationPlan(brief,compact,{catalog}).acceptance,applyStyleStandardizationPlan(brief,detailed,{catalog}).acceptance);
});

test('warm scene standardization preserves side-backlight, atmosphere, motion and mixed medium',t=>{
  const {catalog,input,brief}=setup(t),plan=buildStyleStandardizationPlan(input,{catalog});
  assert.equal(plan.mode,'task_style_preserve');assert.equal(plan.task_type,'scene_character');
  const projected=applyStyleStandardizationPlan(brief,plan,{catalog}),prompt=compileProductionPrompt(projected).prompt;
  assert.match(prompt,/原主光方向、冷暖关系、亮边/);assert.match(prompt,/不改成统一平光/);assert.match(prompt,/不退回灰底棚拍/);
  assert.match(prompt,/原面容、衣饰与环境各自的媒介完成方式/);assert.equal(plan.source_medium,'mixed');
  assert.equal(plan.evidence.image_generated,false);assert.equal(plan.evidence.visual_quality_verified,false);assert.deepEqual(plan.evidence.control_assets_used,[]);
  assert.ok(!plan.changes.some(text=>/中性背景|统一正面/.test(text)));
});

test('C02 macro remains an angled, intentionally cropped makeup close-up, without a full crown demand',t=>{
  const {catalog,input,brief}=setup(t,'VP-C02'),plan=buildStyleStandardizationPlan(input,{catalog}),prompt=compileProductionPrompt(applyStyleStandardizationPlan(brief,plan,{catalog})).prompt;
  assert.equal(plan.task_type,'macro_portrait');assert.match(prompt,/原妆肤极近特写和原头部角度/);assert.match(prompt,/保留有意的紧裁切/);assert.match(prompt,/不强补完整头顶、发冠或身体/);
  assert.ok(!plan.changes.some(text=>/正面|四分之一|上方1\/4|肩顶/.test(text)));
});

test('C03 explicit visible two-beast detail stays protected without inventing complete beast bodies',t=>{
  const {catalog,input,asset,brief}=setup(t,'VP-C03'),index=asset.observations.findIndex(observation=>observation.dimension==='creature');
  input.protected_observations=[{dimension:'creature',observation_index:index}];
  const plan=buildStyleStandardizationPlan(input,{catalog}),projected=applyStyleStandardizationPlan(brief,plan,{catalog}),prompt=compileProductionPrompt(projected).prompt;
  assert.equal(projected.subject_kind,'character');assert.match(prompt,/明确显示两只白狮/);assert.match(prompt,/原可见生物数量/);assert.match(prompt,/不删减既有场景主体/);
  assert.ok(plan.preserve.some(text=>text.includes('两只白狮')));assert.ok(!plan.changes.some(text=>/一只|新增生物|完整兽身/.test(text)));
  assert.ok(projected.acceptance.find(check=>check.id.includes(`detail:${index}`)).critical);
});

test('C05 lotus setting and seated support are protected rather than converted to standing grey-background portrait',t=>{
  const {catalog,input,asset,brief}=setup(t,'VP-C05');
  input.protected_observations=['scene','pose'].map(dimension=>({dimension,observation_index:asset.observations.findIndex(observation=>observation.dimension===dimension)}));
  const plan=buildStyleStandardizationPlan(input,{catalog}),prompt=compileProductionPrompt(applyStyleStandardizationPlan(brief,plan,{catalog})).prompt;
  assert.match(prompt,/坐于浅色石台边/);assert.match(prompt,/荷塘边的浅色石台/);assert.match(prompt,/原站坐状态/);assert.match(prompt,/不退回灰底棚拍/);
  assert.equal(plan.source_medium,'painterly');assert.ok(!plan.changes.some(text=>/站起|删除荷|灰底|照片/.test(text)));
});

test('C08 visible grip is retained while hidden pole endpoints and story identity remain unknown',t=>{
  const {catalog,input,asset,brief}=setup(t,'VP-C08'),index=asset.observations.findIndex(observation=>observation.dimension==='pose');
  input.protected_observations=[{dimension:'pose',observation_index:index}];
  const plan=buildStyleStandardizationPlan(input,{catalog}),prompt=compileProductionPrompt(applyStyleStandardizationPlan(brief,plan,{catalog})).prompt;
  assert.match(prompt,/握住一根深色细杆或长柄/);assert.match(prompt,/仅在原图实际可见部分/);assert.match(prompt,/手势、握持、接触及衣发动态/);
  assert.equal(plan.identity_preset_id,null);assert.equal(plan.checks.find(check=>check.observation_index===index).review_extent,'visible_portion_only');
});

test('raw observed dimensions stay an audit, specific observations require exact explicit selection',t=>{
  const {catalog,input,asset}=setup(t,'VP-C02'),plan=buildStyleStandardizationPlan(input,{catalog});
  assert.deepEqual(plan.observations.map(({observation_index,...observation})=>observation),asset.observations);
  assert.equal(plan.checks.filter(check=>check.id.includes(':detail:')).length,0);
  assert.ok(plan.checks.filter(check=>check.dimension&&check.kind==='preserve').every(check=>check.raw_observations_are_requirements===false));
  const unknown=asset.observations.findIndex(observation=>observation.visibility==='unknown');
  assert.throws(()=>buildStyleStandardizationPlan({...input,protected_observations:[{dimension:asset.observations[unknown].dimension,observation_index:unknown}]},{catalog}),/unknown source observations/);
  assert.throws(()=>buildStyleStandardizationPlan({...input,protected_observations:[{dimension:'face',observation_index:999}]},{catalog}),/unique exact/);
});

test('portrait comparison requires explicit separate authorization and keeps identity, makeup and original medium',t=>{
  const {catalog,input,brief}=setup(t,'VP-C02');
  assert.throws(()=>buildStyleStandardizationPlan({...input,mode:'portrait_comparison'},{catalog}),/explicit user request/);
  const comparison={...input,id:'comparison-v1',mode:'portrait_comparison',portrait_comparison_request:'用户明确要求另做统一正面、中性灰背景与中性柔光的肖像对照。'};
  const plan=buildStyleStandardizationPlan(comparison,{catalog}),applied=applyStyleStandardizationPlan(brief,plan,{catalog}),prompt=compileProductionPrompt(applied).prompt;
  assert.match(prompt,/统一正面视点、中性背景与中性柔光/);assert.match(prompt,/原媒介、基础肤色、妆色、发型衣饰/);assert.ok(plan.changes.some(text=>text.includes('统一正面')));
  assert.equal(plan.evidence.user_accepted,false);assert.equal(plan.authorization.user_request_authenticated,false);
  const locked={...comparison,protected_observations:[{dimension:'lighting',observation_index:catalog.assets[0].observations.findIndex(observation=>observation.dimension==='lighting')}]};
  assert.throws(()=>buildStyleStandardizationPlan(locked,{catalog}),/strongly lock a dimension/);
});

test('quality goals cannot contain arbitrary flat-light, uniform-sharpness or restyling instructions',t=>{
  const {catalog,input}=setup(t);
  for(const goals of [['flat_white_background'],['改成中性平光'],['uniform_sharpness'],[],['readability','readability']])assert.throws(()=>buildStyleStandardizationPlan({...input,standardization_goals:goals},{catalog}),/supported quality/);
  assert.throws(()=>buildStyleStandardizationPlan({...input,enable_pose_control:true},{catalog}),/unsupported/);
});

test('candidate bytes, wrong source and multiple actual inputs cannot replace the fixed original',t=>{
  const {catalog,input,brief,candidate}=setup(t),plan=buildStyleStandardizationPlan(input,{catalog});
  const wrong=structuredClone(brief);wrong.references[0].source=candidate;assert.throws(()=>applyStyleStandardizationPlan(wrong,plan,{catalog}),/exact original SHA/);
  const extra=structuredClone(brief);extra.references.push({id:'CANDIDATE',source:candidate,inspected:true,generation_input:true,authority:[],facts:[{id:'candidate-fact',channel:'composition',text:'合成候选。',visibility:'visible'}]});
  assert.throws(()=>applyStyleStandardizationPlan(extra,plan,{catalog}),/unique actual original/);
  const stale=structuredClone(catalog);stale.assets[0].source.local_path=path.relative(root,candidate);assert.throws(()=>buildStyleStandardizationPlan(input,{catalog:stale}),/source SHA changed/);
  const unread=structuredClone(brief);unread.references[0].inspected=false;assert.throws(()=>applyStyleStandardizationPlan(unread,plan,{catalog}),/inspected/);
});

test('style and source contract enters audited frozen target while original identity stays intact',t=>{
  const {catalog,input,brief,original}=setup(t),before=structuredClone(brief),plan=buildStyleStandardizationPlan(input,{catalog}),applied=applyStyleStandardizationPlan(brief,plan,{catalog});
  assert.deepEqual(brief,before);assert.deepEqual(applied.references,brief.references);assert.equal(applied.edit_scope.baseline_reference_id,'ORIGINAL');
  const parent=freezeProductionRun(brief,{run_id:'source',case_id:'synthetic',cohort:'style'}),snapshot=freezeProductionRun(applied,{run_id:'edit',case_id:'synthetic',cohort:'style',kind:'edit',parent});
  assert.deepEqual(verifyFrozenRun(snapshot).referenced_image_paths,[original]);
  const audited=snapshot.target.requirements.find(requirement=>requirement.style_standardization_plan).style_standardization_plan;
  assert.deepEqual(audited,plan);assertStyleStandardizationBindings(snapshot.references,snapshot.target.requirements);
  const changed=structuredClone(snapshot.references);changed[0].content_sha256='0'.repeat(64);assert.throws(()=>assertStyleStandardizationBindings(changed,snapshot.target.requirements),/exact original SHA/);
  const tampered=structuredClone(snapshot);tampered.target.requirements.find(requirement=>requirement.style_standardization_plan).style_standardization_plan.source_medium='photographic';
  assert.throws(()=>verifyFrozenRun(tampered),/frozen snapshot changed/);
});

test('new visual preferences cannot acquire unrelated RP ids and one person with creatures is still character',t=>{
  const {catalog,input,brief}=setup(t,'VP-C03'),wrong=structuredClone(brief);wrong.references[0].identity_target_id='RP-A01';
  assert.throws(()=>applyStyleStandardizationPlan(wrong,input,{catalog}),/unrelated RP/);
  const scene=structuredClone(brief);scene.subject_kind='scene';assert.throws(()=>applyStyleStandardizationPlan(scene,input,{catalog}),/person with creature remains character/);
  const multiple=structuredClone(catalog);multiple.assets[0].subjects.push('multi_person');assert.throws(()=>buildStyleStandardizationPlan(input,{catalog:multiple}),/multiple person identities/);
});

test('unknown source cannot become pass merely because the newly generated candidate is detailed',t=>{
  const {catalog,input}=setup(t,'VP-C02'),plan=buildStyleStandardizationPlan(input,{catalog}),checks=plan.checks.map(check=>({id:check.id,verdict:check.kind==='unavailable'?'not_assessable':'pass',evidence:'合成检查声明，不是实际视觉评审。'}));
  assert.ok(checks.some(check=>check.verdict==='not_assessable'));assert.equal(validateStyleStandardizationChecks(plan,{plan_sha256:plan.plan_sha256,checks}).visual_quality_verified,false);
  const upgraded=structuredClone(checks);upgraded.find(check=>check.verdict==='not_assessable').verdict='pass';assert.throws(()=>validateStyleStandardizationChecks(plan,{plan_sha256:plan.plan_sha256,checks:upgraded}),/cannot acquire a pass/);
  assert.throws(()=>validateStyleStandardizationChecks(plan,{plan_sha256:'0'.repeat(64),checks}),/exact plan/);
});

test('reapplication is rejected and a current plan does not retain old change authorization',t=>{
  const {catalog,input,brief}=setup(t);brief.edit_scope={baseline_reference_id:'ORIGINAL',changes:['把暖光改成平光。','站起并删除环境。'],preserve:['保留已有衣料。']};
  const plan=buildStyleStandardizationPlan(input,{catalog}),first=applyStyleStandardizationPlan(brief,plan,{catalog});
  assert.deepEqual(first.edit_scope.changes,plan.changes);assert.ok(first.edit_scope.preserve.includes('保留已有衣料。'));
  assert.throws(()=>applyStyleStandardizationPlan(first,{...input,id:'style-source-v2'},{catalog}),/already contains style standardization/);
  const changed=structuredClone(plan);changed.source_medium='photographic';assert.throws(()=>applyStyleStandardizationPlan(brief,changed,{catalog}),/plan hash changed/);
  const invented=structuredClone(plan);invented.changes.push('改为另一张脸。');const {plan_sha256,...body}=invented;invented.plan_sha256=objectHash(body);
  assert.throws(()=>applyStyleStandardizationPlan(brief,invented,{catalog}),/derived plan changed/);
});

test('historical records, missing originals and mismatched explicit task scope cannot dispatch',t=>{
  const {catalog,input}=setup(t);const historical=structuredClone(catalog);historical.assets[0].source.availability='historical_record';assert.throws(()=>buildStyleStandardizationPlan(input,{catalog:historical}),/unavailable and record-only sources/);
  assert.throws(()=>buildStyleStandardizationPlan({...input,task_type:'scene'},{catalog}),/conflicts with source/);
  assert.throws(()=>buildStyleStandardizationPlan({...input,task_type:'unspecified'},{catalog}),/conflicts with source/);
  const missing=structuredClone(catalog);missing.assets[0].source.local_path='missing-standardization-original.png';assert.throws(()=>buildStyleStandardizationPlan(input,{catalog:missing}),/ENOENT/);
});

test('a local verified historical-pixel source retains its observation period and needs the inspected original input',t=>{
  const {catalog,input,brief}=setup(t);catalog.assets[0].inspection.status='historical_pixels';const before=structuredClone(catalog);
  const plan=buildStyleStandardizationPlan(input,{catalog}),projected=applyStyleStandardizationPlan(brief,plan,{catalog});
  assert.deepEqual(plan.source_inspection,{status:'historical_pixels'});assert.equal(projected.references[0].inspected,true);assert.deepEqual(catalog,before);
  const unread=structuredClone(brief);unread.references[0].inspected=false;assert.throws(()=>applyStyleStandardizationPlan(unread,plan,{catalog}),/inspected/);
  const records=structuredClone(catalog);records.assets[0].inspection.status='record_only';assert.throws(()=>buildStyleStandardizationPlan(input,{catalog:records}),/record-only/);
  const unbound=structuredClone(catalog);unbound.assets[0].source={...unbound.assets[0].source,availability:'external_pointer',local_path:null,sha256:null};assert.throws(()=>buildStyleStandardizationPlan(input,{catalog:unbound}),/hash-bound original/);
});

test('default quality goals follow the original task and task overrides cannot demote macro or environmental scenes',t=>{
  for(const [id,task]of [['VP-C01','scene_character'],['VP-C02','macro_portrait'],['VP-C05','scene_character'],['VP-C06','character_portrait']]){
    const {catalog,input}=setup(t,id),plan=buildStyleStandardizationPlan(input,{catalog});assert.equal(plan.task_type,task);
    assert.equal(plan.input.standardization_goals.includes('task_framing'),task==='character_portrait');
    if(task!=='character_portrait')assert.throws(()=>buildStyleStandardizationPlan({...input,task_type:'character_portrait'},{catalog}),/override cannot replace known original/);
  }
  const {catalog,input}=setup(t,'VP-C02');assert.throws(()=>buildStyleStandardizationPlan({...input,task_type:'full_body_character'},{catalog}),/override cannot replace known original/);
  const explicit=buildStyleStandardizationPlan({...input,standardization_goals:['readability','task_framing']},{catalog});
  assert.ok(explicit.changes.some(text=>text.includes('微调画框')));assert.ok(explicit.preserve.some(text=>text.includes('原妆肤极近特写')));
  const ambiguous=structuredClone(catalog);ambiguous.assets[0].framing='unclassified_single_character_frame';
  assert.throws(()=>buildStyleStandardizationPlan(input,{catalog:ambiguous}),/ambiguous framing needs/);
  assert.equal(buildStyleStandardizationPlan({...input,task_type:'macro_portrait'},{catalog:ambiguous}).inferred_task_type,null);
});

test('production freeze rejects original bytes changed after applying the style plan',t=>{
  const {catalog,input,brief,original}=setup(t),plan=buildStyleStandardizationPlan(input,{catalog}),applied=applyStyleStandardizationPlan(brief,plan,{catalog});
  const parent=freezeProductionRun(brief,{run_id:'source',case_id:'synthetic',cohort:'style'});
  fs.appendFileSync(original,Buffer.from('changed after apply, before freeze'));
  assert.throws(()=>freezeProductionRun(applied,{run_id:'changed-edit',case_id:'synthetic',cohort:'style',kind:'edit',parent}),/exact original SHA/);
});

test('production verify rejects rehashed candidate bindings even when ordinary snapshot integrity is restored',t=>{
  const {catalog,input,brief,candidate}=setup(t),plan=buildStyleStandardizationPlan(input,{catalog}),applied=applyStyleStandardizationPlan(brief,plan,{catalog});
  const parent=freezeProductionRun(brief,{run_id:'source',case_id:'synthetic',cohort:'style'}),snapshot=freezeProductionRun(applied,{run_id:'edit',case_id:'synthetic',cohort:'style',kind:'edit',parent});
  const substituted=structuredClone(snapshot),newDigest=promptHash(fs.readFileSync(candidate));
  substituted.references[0].source=candidate;substituted.references[0].content_sha256=newDigest;
  substituted.actual_inputs[0].source=candidate;substituted.actual_inputs[0].content_sha256=newDigest;
  const {snapshot_sha256,...body}=substituted;substituted.snapshot_sha256=objectHash(body);
  assert.throws(()=>verifyFrozenRun(substituted),/exact original SHA/);
  assert.throws(()=>verifyFrozenRun(substituted,{verifyFiles:false}),/exact original SHA/);
});

test('production verify checks current original file bytes after a correctly frozen style edit',t=>{
  const {catalog,input,brief,original}=setup(t),plan=buildStyleStandardizationPlan(input,{catalog}),applied=applyStyleStandardizationPlan(brief,plan,{catalog});
  const parent=freezeProductionRun(brief,{run_id:'source',case_id:'synthetic',cohort:'style'}),snapshot=freezeProductionRun(applied,{run_id:'edit',case_id:'synthetic',cohort:'style',kind:'edit',parent});
  assert.deepEqual(verifyFrozenRun(snapshot).referenced_image_paths,[original]);fs.appendFileSync(original,Buffer.from('changed after the correct freeze'));
  assert.throws(()=>verifyFrozenRun(snapshot),/reference content changed/);
});

test('production freeze rejects deleted or weakened style protections despite otherwise compilable authored prose',t=>{
  const {catalog,input,brief}=setup(t),applied=applyStyleStandardizationPlan(brief,input,{catalog}),parent=freezeProductionRun(brief,{run_id:'source',case_id:'synthetic',cohort:'style'});
  const lighting=applied.requirements.find(requirement=>requirement.id.endsWith(':preserve:lighting')).id;
  const dropped=structuredClone(applied);dropped.requirements=dropped.requirements.filter(requirement=>requirement.id!==lighting);dropped.acceptance=dropped.acceptance.filter(criterion=>criterion.basis!==lighting);
  dropped.sections=dropped.sections.map(section=>({...section,items:section.items.filter(item=>!item.basis.includes(lighting))})).filter(section=>section.items.length);
  compileProductionPrompt(dropped);
  assert.throws(()=>freezeProductionRun(dropped,{run_id:'missing-protection',case_id:'synthetic',cohort:'style',kind:'edit',parent}),/every exact required protection/);
  const weakened=structuredClone(applied);weakened.requirements.find(requirement=>requirement.id===lighting).priority='prefer';weakened.acceptance.find(criterion=>criterion.basis===lighting).critical=false;
  compileProductionPrompt(weakened);assert.throws(()=>freezeProductionRun(weakened,{run_id:'weakened',case_id:'synthetic',cohort:'style',kind:'edit',parent}),/exact required protection/);
  const replaced=structuredClone(applied);replaced.requirements.find(requirement=>requirement.id===lighting).text='统一灰底和平光。';
  for(const section of replaced.sections)for(const item of section.items)if(item.basis.includes(lighting))item.text='统一灰底和平光。';
  compileProductionPrompt(replaced);assert.throws(()=>freezeProductionRun(replaced,{run_id:'replaced',case_id:'synthetic',cohort:'style',kind:'edit',parent}),/exact required protection/);
  const criterionChanged=structuredClone(applied);criterionChanged.acceptance.find(criterion=>criterion.basis===lighting).question='改为平光后是否清楚？';
  compileProductionPrompt(criterionChanged);assert.throws(()=>freezeProductionRun(criterionChanged,{run_id:'wrong-check',case_id:'synthetic',cohort:'style',kind:'edit',parent}),/exact critical acceptance/);
});

test('production freeze rejects unscoped revisions, shrinking protected lists and arbitrary expanded operations',t=>{
  const {catalog,input,brief}=setup(t),applied=applyStyleStandardizationPlan(brief,input,{catalog}),parent=freezeProductionRun(brief,{run_id:'source',case_id:'synthetic',cohort:'style'});
  for(const mutation of [next=>{next.edit_scope.changes=['统一灰底和平光。'];},next=>{next.edit_scope.changes.push('去掉环境并站起来。');},next=>{next.edit_scope.preserve=['保持衣服。'];},next=>{delete next.edit_scope;}]){
    const next=structuredClone(applied);mutation(next);compileProductionPrompt(next);
    assert.throws(()=>freezeProductionRun(next,{run_id:'unsafe',case_id:'synthetic',cohort:'style',kind:next.edit_scope?'edit':'revision',parent}),/style standardization (?:scope|change scope)/);
  }
});

test('the typed face tonal narrowing freezes exact authorized operations and rejects arbitrary rewriting',t=>{
  const {catalog,input,brief}=setup(t),narrow={...input,standardization_goals:['tonal_hierarchy'],change_variant:'face_tonal_only'},plan=buildStyleStandardizationPlan(narrow,{catalog});
  assert.match(plan.changes[0],/已经可见的面部暗部/);assert.equal(plan.changes.length,1);assert.ok(!plan.changes[0].includes('叶花'));
  const projected=applyStyleStandardizationPlan(brief,plan,{catalog}),parent=freezeProductionRun(brief,{run_id:'source',case_id:'synthetic',cohort:'style'}),snapshot=freezeProductionRun(projected,{run_id:'narrow-edit',case_id:'synthetic',cohort:'style',kind:'edit',parent});
  assert.equal(snapshot.style_standardization_contract,'style_standardization_projection_v1');verifyFrozenRun(snapshot);
  const expanded=structuredClone(projected);expanded.edit_scope.changes[0]+='同时换为中性平光和灰背景。';
  assert.throws(()=>freezeProductionRun(expanded,{run_id:'expanded',case_id:'synthetic',cohort:'style',kind:'edit',parent}),/cannot expand or arbitrarily rewrite/);
  assert.throws(()=>buildStyleStandardizationPlan({...input,standardization_goals:['edge_hierarchy'],change_variant:'face_tonal_only'},{catalog}),/typed narrowing/);
});

function receiptFor(snapshot,output){
  const unknown=new Set(snapshot.target.requirements.find(requirement=>requirement.style_standardization_plan).style_standardization_plan.checks.filter(check=>check.kind==='unavailable').map(check=>`${check.id}:check`));
  return {status:'completed',snapshot_sha256:snapshot.snapshot_sha256,target_sha256:snapshot.target_sha256,prompt_sha256:snapshot.prompt_sha256,output_image:output,output_sha256:promptHash(fs.readFileSync(output)),inspected:true,reviewer:'synthetic contract review, no pixel approval',
    checks:snapshot.target.acceptance.map(criterion=>({id:criterion.id,verdict:unknown.has(criterion.id)?'not_assessable':'pass',evidence:'Synthetic declaration check, not visual evidence.'})),
    scope_review:{verdict:'pass',change_evidence:'Synthetic allowed operation.',preservation_evidence:'Synthetic retained source scope.',preservation_checks:snapshot.edit_scope.preserve.map((text,index)=>({index,verdict:'pass',evidence:'Synthetic protected declaration.'}))}};
}

test('finish and portable summary cannot promote unknown C02 source observations to pass',t=>{
  const {catalog,input,brief,candidate}=setup(t,'VP-C02'),projected=applyStyleStandardizationPlan(brief,input,{catalog}),parent=freezeProductionRun(brief,{run_id:'source',case_id:'synthetic',cohort:'style'}),snapshot=freezeProductionRun(projected,{run_id:'macro-edit',case_id:'synthetic',cohort:'style',kind:'edit',parent});
  const receipt=receiptFor(snapshot,candidate),good=finishProductionRun(snapshot,receipt);assert.equal(good.status,'reviewer_qualified');
  const unknown=receipt.checks.find(check=>check.verdict==='not_assessable'),promoted=structuredClone(receipt);promoted.checks.find(check=>check.id===unknown.id).verdict='pass';
  assert.throws(()=>finishProductionRun(snapshot,promoted),/unknown original observations cannot acquire a pass/);
  const tampered=structuredClone(good);tampered.checks.find(check=>check.id===unknown.id).verdict='pass';
  assert.throws(()=>summarizeProductionRuns([{snapshot:parent},{snapshot,outcome:tampered}]),/unknown original observations cannot acquire a pass/);
  const summary=summarizeProductionRuns([{snapshot:parent},{snapshot,outcome:good}]);assert.equal(summary.cohorts.style.known_tool_calls,1);
});

test('new frozen contracts reject removal of the whole plan and scope even after all integrity hashes are recomputed',t=>{
  const {catalog,input,brief}=setup(t),projected=applyStyleStandardizationPlan(brief,input,{catalog}),parent=freezeProductionRun(brief,{run_id:'source',case_id:'synthetic',cohort:'style'}),snapshot=freezeProductionRun(projected,{run_id:'edit',case_id:'synthetic',cohort:'style',kind:'edit',parent});
  const stripped=structuredClone(snapshot);stripped.target.requirements=stripped.target.requirements.filter(requirement=>!requirement.id.startsWith('SS:'));stripped.target.acceptance=stripped.target.acceptance.filter(criterion=>!criterion.basis.startsWith('SS:'));
  delete stripped.edit_scope;delete stripped.scope_review_contract;stripped.kind='revision';stripped.target_sha256=objectHash(stripped.target);const {snapshot_sha256,...body}=stripped;stripped.snapshot_sha256=objectHash(body);
  assert.throws(()=>verifyFrozenRun(stripped,{verifyFiles:false}),/required style standardization contract cannot be removed/);
  const bare=structuredClone(brief);assert.throws(()=>freezeProductionRun(bare,{run_id:'drop-parent-contract',case_id:'synthetic',cohort:'style',kind:'revision',parent:snapshot}),/contract cannot be removed/);
});

test('frozen verification also rejects individually deleted protections and prompt text after rehashing',t=>{
  const {catalog,input,brief}=setup(t),projected=applyStyleStandardizationPlan(brief,input,{catalog}),parent=freezeProductionRun(brief,{run_id:'source',case_id:'synthetic',cohort:'style'}),snapshot=freezeProductionRun(projected,{run_id:'edit',case_id:'synthetic',cohort:'style',kind:'edit',parent});
  const check=snapshot.target.requirements.find(requirement=>requirement.id.endsWith(':preserve:lighting'));
  for(const mutate of [candidate=>{candidate.target.requirements=candidate.target.requirements.filter(requirement=>requirement.id!==check.id);candidate.target.acceptance=candidate.target.acceptance.filter(criterion=>criterion.basis!==check.id);},
    candidate=>{candidate.target.acceptance.find(criterion=>criterion.basis===check.id).critical=false;},
    candidate=>{candidate.prompt=candidate.prompt.replaceAll(check.text,'');candidate.prompt_sha256=promptHash(candidate.prompt);}]){
    const changed=structuredClone(snapshot);mutate(changed);changed.target_sha256=objectHash(changed.target);const {snapshot_sha256,...body}=changed;changed.snapshot_sha256=objectHash(body);
    assert.throws(()=>verifyFrozenRun(changed,{verifyFiles:false}),/style standardization (?:must retain|text projection)/);
  }
});

test('pre-contract exact tonal pilots remain historical records but cannot authorize a new dispatch',t=>{
  const {catalog,input,brief}=setup(t),plan=buildStyleStandardizationPlan({...input,standardization_goals:['tonal_hierarchy']},{catalog}),projected=applyStyleStandardizationPlan(brief,plan,{catalog}),parent=freezeProductionRun(brief,{run_id:'source',case_id:'synthetic',cohort:'style'}),snapshot=freezeProductionRun(projected,{run_id:'historical-tonal',case_id:'synthetic',cohort:'style',kind:'edit',parent});
  const legacyPlan=structuredClone(plan);delete legacyPlan.scope_contract;const {plan_sha256,...planBody}=legacyPlan;legacyPlan.plan_sha256=objectHash(planBody);
  const legacyBrief=structuredClone(projected);legacyBrief.requirements.find(requirement=>requirement.style_standardization_plan).style_standardization_plan=legacyPlan;
  legacyBrief.edit_scope.changes=['只在原图画布内，对已经可见的面部暗部做极轻微的亮度补偿，保持原对比、低饱和关系、雾化空气感和色温。衣料、金纹、发饰、叶花、石水与背景原样保留；原颗粒、粗细笔触和软边不去除、不锐化，不追加细金线、刺绣或微观纹理，不重画人物或场景。画幅横竖类别、长宽关系、取景和所有原动作保持。'];
  const legacy=structuredClone(snapshot);delete legacy.style_standardization_contract;legacy.target.requirements=legacyBrief.requirements;legacy.target_sha256=objectHash(legacy.target);legacy.edit_scope=legacyBrief.edit_scope;const compiled=compileProductionPrompt(legacyBrief);legacy.prompt=compiled.prompt;legacy.prompt_sha256=compiled.prompt_sha256;const {snapshot_sha256,...legacyBody}=legacy;legacy.snapshot_sha256=objectHash(legacyBody);
  const before=structuredClone(legacy);verifyFrozenRun(legacy);assert.deepEqual(legacy,before);assert.ok(!Object.hasOwn(legacy,'style_standardization_contract'));
  assert.throws(()=>freezeProductionRun(legacyBrief,{run_id:'new-legacy-dispatch',case_id:'synthetic',cohort:'style',kind:'edit',parent}),/legacy style plans are historical/);
  const unsafe=structuredClone(legacy);unsafe.edit_scope.changes.push('同时增加一个人并换成灰底。');const {snapshot_sha256:oldHash,...unsafeBody}=unsafe;unsafe.snapshot_sha256=objectHash(unsafeBody);
  assert.throws(()=>verifyFrozenRun(unsafe,{verifyFiles:false}),/cannot expand or arbitrarily rewrite/);
});

test('portrait and makeup consistency is explicit in frozen must prose, critical checks and protected scope',t=>{
  const {catalog,input,brief}=setup(t,'VP-C02'),plan=buildStyleStandardizationPlan(input,{catalog}),projected=applyStyleStandardizationPlan(brief,plan,{catalog}),parent=freezeProductionRun(brief,{run_id:'source',case_id:'synthetic',cohort:'style'}),snapshot=freezeProductionRun(projected,{run_id:'identity-makeup-edit',case_id:'synthetic',cohort:'style',kind:'edit',parent});
  const face=snapshot.target.requirements.find(requirement=>requirement.id.endsWith(':preserve:face')),makeup=snapshot.target.requirements.find(requirement=>requirement.id.endsWith(':preserve:makeup'));
  assert.equal(face.priority,'must');assert.equal(makeup.priority,'must');assert.match(face.text,/眉形、眼形与眼距、鼻唇、人中、下巴、自然不对称/);assert.match(face.text,/原可见眼色/);assert.match(face.text,/不借校准或可读性处理磨皮、瘦脸/);
  assert.match(face.text,/仅保持原图实际可见部分/);assert.match(makeup.text,/眉妆、眼线、眼影、睫毛、腮红、唇妆/);assert.match(makeup.text,/形状、位置与范围/);assert.match(makeup.text,/浓度与妆量、边缘过渡、光泽和肤感/);
  assert.ok(snapshot.edit_scope.preserve.includes(face.text));assert.ok(snapshot.edit_scope.preserve.includes(makeup.text));
  assert.match(snapshot.target.acceptance.find(criterion=>criterion.basis===face.id).question,/没有磨皮瘦脸/);assert.match(snapshot.target.acceptance.find(criterion=>criterion.basis===makeup.id).question,/没有换成统一妆容/);
  for(const kind of ['delete','downgrade']){
    const altered=structuredClone(projected);
    if(kind==='delete'){
      altered.requirements=altered.requirements.filter(requirement=>requirement.id!==makeup.id);altered.acceptance=altered.acceptance.filter(criterion=>criterion.basis!==makeup.id);
      altered.sections=altered.sections.map(section=>({...section,items:section.items.filter(item=>!item.basis.includes(makeup.id))})).filter(section=>section.items.length);
    }else{altered.requirements.find(requirement=>requirement.id===makeup.id).priority='prefer';altered.acceptance.find(criterion=>criterion.basis===makeup.id).critical=false;}
    compileProductionPrompt(altered);assert.throws(()=>freezeProductionRun(altered,{run_id:`bad-makeup-${kind}`,case_id:'synthetic',cohort:'style',kind:'edit',parent}),/every exact required protection/);
  }
});

test('explicit neutral portrait comparison still requires original makeup and cannot use its light change to omit it',t=>{
  const {catalog,input,brief}=setup(t,'VP-C02'),comparison={...input,mode:'portrait_comparison',portrait_comparison_request:'用户明确要求统一正面、中性背景及中性柔光用于肖像对照，但本人妆容保持原图。'},plan=buildStyleStandardizationPlan(comparison,{catalog}),projected=applyStyleStandardizationPlan(brief,plan,{catalog});
  const makeup=projected.requirements.find(requirement=>requirement.id.endsWith(':preserve:makeup')),compiled=compileProductionPrompt(projected);
  assert.match(compiled.prompt,/该对照不授权换妆、磨皮、瘦脸或更换眼色/);assert.match(makeup.text,/不以统一妆容覆盖本人原妆/);assert.ok(projected.edit_scope.preserve.includes(makeup.text));assert.ok(projected.acceptance.find(criterion=>criterion.basis===makeup.id).critical);
  const parent=freezeProductionRun(brief,{run_id:'source',case_id:'synthetic',cohort:'style'}),snapshot=freezeProductionRun(projected,{run_id:'portrait-makeup-locked',case_id:'synthetic',cohort:'style',kind:'edit',parent});verifyFrozenRun(snapshot);
  const omitted=structuredClone(snapshot);omitted.target.requirements=omitted.target.requirements.filter(requirement=>requirement.id!==makeup.id);omitted.target.acceptance=omitted.target.acceptance.filter(criterion=>criterion.basis!==makeup.id);omitted.target_sha256=objectHash(omitted.target);const {snapshot_sha256,...body}=omitted;omitted.snapshot_sha256=objectHash(body);
  assert.throws(()=>verifyFrozenRun(omitted,{verifyFiles:false}),/every exact required protection/);
});
