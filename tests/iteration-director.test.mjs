import{test}from'node:test';import assert from'node:assert/strict';import{spawnSync}from'node:child_process';import path from'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tool=path.join(root,'scripts/iteration-director.mjs');
function run(a){const r=spawnSync(process.execPath,[tool,...a],{cwd:root,encoding:'utf8'});return{...r,json:r.stdout?JSON.parse(r.stdout):null};}
test('templates validate',()=>{const r=run(['validate']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.status,'pass');assert.ok(r.json.maturity_levels>=6);});
test('A is identity source and B is trait only',()=>{const r=run(['roles']);assert.equal(r.json.identity_source,'A');const b=r.json.references.find(x=>x.role==='facial_trait');assert.ok(b.authority.includes('maturity_level'));assert.ok(b.forbidden_authority.includes('face_shape'));assert.ok(b.forbidden_authority.includes('background'));});
test('invisible lower body remains extension not strict lock',()=>{const r=run(['visibility']);assert.ok(r.json.extensions.includes('lower_skirt'));assert.equal(r.json.strict_locks.includes('lower_skirt'),false);});
test('identity round locks garment and body',()=>{const r=run(['round','--name','identity_skin']);assert.ok(r.json.editable.includes('face_identity_geometry'));assert.ok(r.json.locked.includes('garment_structure'));assert.ok(r.json.locked.includes('body_proportion'));});
test('trait calibration locks identity geometry',()=>{const r=run(['round','--name','trait_calibration']);assert.ok(r.json.editable.includes('facial_maturity'));assert.ok(r.json.locked.includes('face_identity_geometry'));assert.ok(r.json.forbidden.includes('copy_trait_reference_face_geometry'));});
test('material round locks face and maturity',()=>{const r=run(['round','--name','garment_material']);assert.ok(r.json.editable.includes('material_contrast'));assert.ok(r.json.locked.includes('face_identity_geometry'));assert.ok(r.json.locked.includes('facial_maturity'));});
test('studio polish locks semantic design',()=>{const r=run(['round','--name','studio_polish']);assert.ok(r.json.editable.includes('key_fill_ratio'));assert.ok(r.json.locked.includes('garment_silhouette'));});
test('identity drift routes before maturity issue',()=>{const r=run(['next','--failures','maturity_undershoot,identity_drift','--passed','composition,garment_structure']);assert.equal(r.json.first_focus,'identity_drift');assert.equal(r.json.recommended_round,'identity_skin');});
test('maturity undershoot routes to trait calibration',()=>{const r=run(['next','--failures','maturity_undershoot','--passed','face_identity_geometry']);assert.equal(r.json.recommended_round,'trait_calibration');assert.ok(r.json.round_plan.locked.includes('face_identity_geometry'));});

test('legacy round and diagnostic entry points cannot discard accepted dimensions',()=>{
  for(const args of [
    ['round','--name','fashion_proportion','--passed','body_proportion'],
    ['proportion-plan','--level','P9','--passed','fashion_asset_proportion'],
    ['next','--failures','head_visual_too_large','--passed','fashion_asset_proportion'],
    ['round','--name','asset_master_structure_refine','--passed','asset_master_structure_refine']
  ]){
    const r=run(args);assert.equal(r.status,1,JSON.stringify(args));assert.match(r.stderr,/reopen passed/);assert.equal(r.stdout.trim(),'');
  }
  const allowed=run(['round','--name','extremity_integrity','--passed','body_proportion']);
  assert.equal(allowed.status,0,allowed.stderr);assert.ok(allowed.json.locked.includes('fashion_asset_proportion'));
  const invalid=run(['round','--name','extremity_integrity','--passed','body_proportoin']);
  assert.equal(invalid.status,1);assert.match(invalid.stderr,/unknown passed dimension/);
});
test('4k misuse goes to upscale not generation',()=>{const r=run(['next','--failures','resolution_semantic_misuse']);assert.equal(r.json.recommended_round,'upscale');});
test('M2.5 profile is young and refined without aging cues',()=>{const r=run(['maturity','--level','M2.5']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.identity_geometry_policy,'locked');assert.equal(r.json.aging_cues,'none');assert.match(r.json.label,/light_mature/);});
test('trait plan explicitly blocks reference geometry borrowing',()=>{const r=run(['trait-plan','--level','M2.5']);assert.equal(r.status,0,r.stderr);assert.ok(r.json.round_plan.locked.includes('face_identity_geometry'));assert.ok(r.json.prompt_skeleton.some(x=>/不复制气质参考的脸型/.test(x)));});

test('trait plan follows each selected temperament instead of applying the same restraint patch',()=>{
 const expected={M0:/明亮活泼/,M1:/清新温和/,M2:/自然沉稳/,'M2.5':/从容精致/,M3:/冷静疏离/,M4:/坚定有主见/};
 const variants=[];
 for(const [level,signal] of Object.entries(expected)){
  const r=run(['trait-plan','--level',level]);assert.equal(r.status,0,r.stderr);
  const text=r.json.prompt_skeleton.join('\n'),patch=r.json.prompt_skeleton.find(x=>x.startsWith('【表情与妆容变化】'));
  assert.match(patch,signal);variants.push(patch);
  assert.doesNotMatch(text,/steadier gaze|cheek-softness reduction|less wide-eyed openness|\bM[0-4](?:\.5)?\b/);
  assert.match(text,/表观年龄/);assert.match(text,/不逐像素冻结表情位置/);assert.match(text,/协调身体比例/);
  assert.match(text,/原目标中未解决的比例问题仍单列未决/);
  assert.ok(r.json.round_plan.locked.includes('body_proportion'));assert.ok(r.json.round_plan.locked.includes('age_identity'));
 }
 assert.equal(new Set(variants).size,6);
 assert.match(variants[0],/眼睑自然打开/);assert.match(variants[1],/眼睑舒展/);
 assert.match(variants[5],/不加宽下颌、不削薄脸颊/);
});

test('trait scaffold does not invent observed references or let invalid levels and accepted locks through',()=>{
 const r=run(['trait-plan']);assert.equal(r.status,0,r.stderr);
 assert.equal(r.json.target_maturity.level,'M2.5');assert.equal(r.json.status,'scaffold_only');
 assert.deepEqual(r.json.evidence,{reference_images_inspected:false,image_generated:false,visual_quality_verified:false});
 assert.match(r.json.prompt_skeleton.join('\n'),/没有气质参考时/);
 assert.match(r.json.target_maturity.interpretation,/不授权删除既有皱褶/);
 for(const level of ['M5','toString','__proto__']){const bad=run(['trait-plan','--level',level]);assert.equal(bad.status,1);assert.match(bad.stderr,/unknown maturity level/);}
 const conflict=run(['trait-plan','--passed','expression_restraint']);assert.equal(conflict.status,1);assert.match(conflict.stderr,/reopen passed/);
});
test('stable geometry plus target trait change classifies as temperament shift',()=>{const r=run(['classify-face','--observations','face_geometry_stable,gaze_more_composed,cheek_softness_slightly_reduced']);assert.ok(r.json.classifications.includes('identity_stable'));assert.ok(r.json.classifications.includes('temperament_shift_target'));assert.equal(r.json.recommended_next,'reclassify_or_lock');});
test('geometry change is identity drift',()=>{const r=run(['classify-face','--observations','face_geometry_changed,gaze_more_composed']);assert.ok(r.json.classifications.includes('identity_drift'));assert.equal(r.json.recommended_next,'identity_skin');});
test('cold over-shift routes back to trait calibration',()=>{const r=run(['classify-face','--observations','face_geometry_stable,gaze_too_cold']);assert.ok(r.json.classifications.includes('temperament_shift_over'));assert.equal(r.json.recommended_next,'trait_calibration');});
test('trait reference geometry copy is detected',()=>{const r=run(['classify-face','--observations','face_geometry_stable,trait_reference_face_geometry_copied']);assert.ok(r.json.classifications.includes('trait_reference_overborrow'));assert.equal(r.json.recommended_next,'trait_calibration');});
test('aging cues are unwanted for light maturity',()=>{const r=run(['classify-face','--observations','face_geometry_stable,wrinkles_or_sagging_added']);assert.ok(r.json.classifications.includes('age_shift_unwanted'));assert.equal(r.json.recommended_next,'trait_calibration');});
