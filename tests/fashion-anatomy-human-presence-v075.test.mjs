import{test}from'node:test';
import assert from'node:assert/strict';
import{spawnSync}from'node:child_process';
import path from'node:path';
import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tool=path.join(root,'scripts/iteration-director.mjs');
function run(a){const r=spawnSync(process.execPath,[tool,...a],{cwd:root,encoding:'utf8'});return{...r,json:r.stdout?JSON.parse(r.stdout):null};}

test('v0.7.5 catalogs validate',()=>{const r=run(['validate']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.status,'pass');assert.equal(r.json.fashion_proportion_levels,4);assert.equal(r.json.human_presence_v21_levels,4);assert.ok(r.json.rounds>=15);});

test('P9 is the fashion default and excludes head ornaments from head unit',()=>{const r=run(['proportion-profile','--level','P9']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.label,'fashion');assert.deepEqual(r.json.visual_head_count_range,[9,9]);assert.equal(r.json.head_to_body_guard.include_hair_ornaments_in_ratio,false);});

test('P9 locks face identity while changing visual head share',()=>{const r=run(['proportion-plan','--level','P9']);assert.equal(r.status,0,r.stderr);assert.ok(r.json.round_plan.locked.includes('face_identity_geometry'));assert.ok(r.json.round_plan.editable.includes('head_visual_scale'));assert.ok(r.json.round_plan.forbidden.includes('face_reshape'));assert.ok(r.json.prompt_skeleton.some(x=>/面宽|脸型/.test(x)));});

test('P9 source and plan agree on exact target and conditional scale correction',()=>{
 const r=run(['proportion-plan','--level','P9']);assert.equal(r.status,0,r.stderr);
 assert.deepEqual(r.json.proportion.visual_head_count_range,[9,9]);
 assert.equal(r.json.proportion.neck_extension,'none');
 assert.equal(r.json.proportion.waistline_visual_raise,'none');
 const prose=r.json.prompt_skeleton.join(' ');
 assert.match(prose,/黄金九头身是硬性目标/);assert.doesNotMatch(prose,/约九头身|保持面宽、/);
 assert.match(prose,/五官间距比例/);assert.match(r.json.proportion.head_to_body_guard.guard_semantics,/局部修肤质、手部或衣料仍保持头身尺度/);
});

test('P9 preserves torso and balances thigh and calf',()=>{const r=run(['proportion-profile','--level','P9']);assert.equal(r.json.torso_preservation,'strong');assert.equal(r.json.leg_extension,'balanced_moderate');assert.match(r.json.leg_segmentation_guard.rules.join(' '),/不只拉长大腿或小腿中的一段/);});

test('P9 garment assist strengthens verticality instead of redesigning costume',()=>{const r=run(['proportion-profile','--level','P9']);assert.equal(r.json.garment_vertical_bias,'strong');assert.equal(r.json.garment_proportion_assist.sleeve_mass_control,'medium');assert.match(r.json.garment_proportion_assist.rules.join(' '),/不自动重设计服装/);});

test('proportion entry points preserve garment waist design instead of silently raising it',()=>{
 for(const command of ['proportion-profile','proportion-plan','fashion-human-plan','fashion-human-v3-plan','fashion-human-v31-plan']){
  const result=run([command]);assert.equal(result.status,0,result.stderr);
  const plan=result.json.stage_1??result.json,profile=plan.proportion??plan;
  assert.deepEqual(profile.visual_head_count_range,[9,9]);
  assert.equal(profile.waistline_visual_raise,'none');
  const assist=profile.garment_proportion_assist;
  assert.equal(assist.waist_sash_position,'preserve_confirmed_design');
  assert.equal(assist.skirt_start_bias,'preserve_confirmed_design');
  assert.doesNotMatch(JSON.stringify(profile),/slightly_higher_visual|high_waist_visual/);
  const prose=(plan.prompt_skeleton??assist.rules).join(' ');
  assert.match(prose,/高腰、自然腰或低腰时分别保留/);
  assert.match(prose,/没有衣带或裙片的造型不新增/);
  if(plan.round_plan){
   assert.ok(plan.round_plan.locked.includes('garment_structure'));
   assert.ok(plan.round_plan.locked.includes('garment_silhouette'));
   assert.ok(plan.round_plan.forbidden.includes('costume_redesign'));
  }
 }
});

test('non-nine-head legacy levels are rejected by production plans',()=>{for(const level of ['P7','P8','P9.5']){const r=run(['proportion-plan','--level',level]);assert.equal(r.status,1);assert.match(r.stderr,/黄金九头身/);}});

test('natural adult profile cannot bypass mandatory nine-head asset policy',()=>{const r=run(['fashion-asset-v082','--profile','NATURAL_ADULT']);assert.equal(r.status,1);assert.match(r.stderr,/黄金九头身/);});

test('human presence v2.1 H2 prioritizes soft structure eye hair and lens realism',()=>{const r=run(['human-presence-v21','--level','H2']);assert.equal(r.status,0,r.stderr);assert.ok(r.json.soft_structure_fidelity>=0.7);assert.ok(r.json.eye_anatomy_realism>=0.7);assert.ok(r.json.hair_irregularity>=0.6);assert.ok(r.json.lens_response_realism>=0.7);assert.equal(r.json.age_shift,'none');});

test('human refine locks identity and fashion proportion',()=>{const r=run(['human-refine-plan','--level','H2']);assert.equal(r.status,0,r.stderr);assert.ok(r.json.round_plan.locked.includes('face_identity_geometry'));assert.ok(r.json.round_plan.locked.includes('fashion_proportion'));assert.ok(r.json.round_plan.forbidden.includes('proportion_reopen'));});

test('human presence v2.1 rejects CG beauty through principle not aging',()=>{const r=run(['human-presence-v21','--level','H2']);assert.match(r.json.principle,/美感优先并减少塑料渲染感/);assert.match(r.json.prompt_translation.join(' '),/不主动改变左右高度、开合或稳定五官关系/);});

test('fashion-human plan is staged proportion then human presence',()=>{const r=run(['fashion-human-plan','--proportion','P9','--human','H2']);assert.equal(r.status,0,r.stderr);assert.deepEqual(r.json.order.slice(0,2),['fashion_proportion','human_presence_refine']);assert.equal(r.json.stage_1.proportion.level,'P9');assert.equal(r.json.stage_2.human_presence.level,'H2');});

test('head too large routes to fashion proportion round',()=>{const r=run(['next','--failures','head_visual_too_large']);assert.equal(r.json.recommended_round,'fashion_proportion');assert.ok(r.json.round_plan.editable.includes('head_visual_scale'));});

test('short torso routes to fashion proportion and forbids torso crush',()=>{const r=run(['next','--failures','torso_visually_short']);assert.equal(r.json.recommended_round,'fashion_proportion');assert.ok(r.json.round_plan.forbidden.includes('torso_crush'));});

test('skirt width suppressing height routes to fashion proportion',()=>{const r=run(['next','--failures','skirt_width_suppressing_height']);assert.equal(r.json.recommended_round,'fashion_proportion');assert.ok(r.json.round_plan.editable.includes('garment_width_control'));});

test('P9 proportion failure outranks later human presence issue',()=>{const r=run(['next','--failures','face_too_cg,head_visual_too_large']);assert.equal(r.json.first_focus,'head_visual_too_large');assert.equal(r.json.recommended_round,'fashion_proportion');});

test('CG face routes to refined human presence after proportion',()=>{const r=run(['next','--failures','face_too_cg']);assert.equal(r.json.recommended_round,'human_presence_optical_refine');assert.ok(r.json.round_plan.editable.includes('soft_structure_fidelity'));});

test('missing micro asymmetry routes to human presence refine',()=>{const r=run(['next','--failures','micro_asymmetry_missing']);assert.equal(r.json.recommended_round,'human_presence_optical_refine');assert.equal(r.json.failures[0].advisory,true);});

test('digital highlight rolloff routes to lens response refinement',()=>{const r=run(['next','--failures','highlight_rolloff_digital']);assert.equal(r.json.recommended_round,'human_presence_optical_refine');assert.ok(r.json.round_plan.editable.includes('highlight_rolloff'));});
