import{test}from'node:test';import assert from'node:assert/strict';import{spawnSync}from'node:child_process';import path from'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tool=path.join(root,'scripts/iteration-director.mjs');
function run(a){const r=spawnSync(process.execPath,[tool,...a],{cwd:root,encoding:'utf8'});return{...r,json:r.stdout?JSON.parse(r.stdout):null};}

test('v0.7.7 catalogs validate',()=>{const r=run(['validate']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.status,'pass');assert.equal(r.json.human_presence_v31_levels,4);assert.equal(r.json.skin_v2_regions,9);assert.equal(r.json.hair_v2_frequency_layers,3);assert.equal(r.json.focus_v2_profiles,3);assert.equal(r.json.realism_coherence_v2_channels,8);assert.ok(r.json.rounds>=18);});

test('H2.7 is photographic asset profile',()=>{const r=run(['human-presence-v31','--level','H2.7']);assert.equal(r.json.label,'photographic_asset');assert.deepEqual(r.json.rounds,['human_face_optical_refine','human_camera_hair_refine']);assert.equal(r.json.age_shift,'none');});

test('eye optics use off-white sclera and nonuniform iris',()=>{const r=run(['eye-optics-v2']);assert.equal(r.json.controls.sclera_tone,'natural_off_white');assert.equal(r.json.controls.iris_uniformity,'low');assert.equal(r.json.controls.eyelid_wrap,'high');assert.ok(r.json.forbidden.includes('jewel_like_iris'));});

test('skin optics has at least four distinct regions and forbids full-face pores',()=>{const r=run(['skin-optics-v2']);assert.ok(Object.keys(r.json.regions).length>=4);assert.ok(r.json.regions.nose_wing);assert.ok(r.json.regions.inner_cheek);assert.ok(r.json.regions.outer_cheek);assert.ok(r.json.regions.eye_area);assert.ok(r.json.forbidden.includes('full_face_pores'));});

test('young skin policy avoids age signals',()=>{const r=run(['skin-optics-v2']);assert.equal(r.json.age_policy,'young_clean_not_aged');assert.ok(r.json.forbidden.includes('aged_texture'));});

test('soft tissue preserves youthful cheek and jaw transition',()=>{const r=run(['soft-tissue-v2']);assert.equal(r.json.controls.cheek_volume,'subtle_young');assert.equal(r.json.controls.jaw_to_neck_transition,'natural');assert.ok(r.json.forbidden.includes('aging_shift'));});

test('makeup keeps skin response subtle beneath a refined finish',()=>{const r=run(['makeup-skin-v2']);assert.equal(r.json.controls.foundation_coverage,'light');assert.equal(r.json.controls.skin_visibility,'subtle_under_refined_makeup');assert.equal(r.json.controls.eyeliner_edge,'softened');});

test('hair uses exactly three frequency layers and fine strands are not primary',()=>{const r=run(['hair-frequency-v2']);assert.equal(r.json.frequency_layers.length,3);assert.deepEqual(r.json.frequency_layers,['primary_hair_mass','secondary_bundles','fine_strands']);assert.equal(r.json.controls.fine_strand_density,'low');assert.ok(r.json.forbidden.includes('fine_strands_as_primary'));});

test('asset-balanced focus prioritizes face over skirt and background',()=>{const r=run(['photographic-focus-v2','--profile','asset_balanced']);assert.ok(r.json.weights.face>r.json.weights.main_skirt);assert.ok(r.json.weights.main_skirt>r.json.weights.background);assert.ok(r.json.rules.includes('asset_mode_uses_moderate_depth_not_extreme_shallow_dof'));});

test('face optical round locks P9 hair design costume pose hands and light direction',()=>{const r=run(['human-face-plan','--level','H2.7']);for(const id of ['fashion_proportion','hairstyle_silhouette','garment_structure','pose','hand_integrity','lighting_direction'])assert.ok(r.json.round_plan.locked.includes(id),id);assert.ok(r.json.round_plan.forbidden.includes('proportion_reopen'));assert.ok(r.json.round_plan.forbidden.includes('hair_redesign'));});

test('face optical round edits only face optics/tissue/makeup group',()=>{const r=run(['human-face-plan','--level','H2.7']);for(const id of ['eye_optics_v2','skin_optics_v2','soft_tissue_v2','makeup_skin_v2'])assert.ok(r.json.round_plan.editable.includes(id),id);assert.equal(r.json.round_plan.editable.includes('hair_frequency_v2'),false);});

test('hair-camera round locks face eye skin and P9',()=>{const r=run(['human-camera-hair-plan','--level','H2.7']);for(const id of ['face_identity_geometry','eye_optics_result','skin_optics_result','fashion_proportion'])assert.ok(r.json.round_plan.locked.includes(id),id);assert.ok(r.json.round_plan.forbidden.includes('face_reopen'));assert.ok(r.json.round_plan.forbidden.includes('skin_reopen'));});

test('hair-camera round uses focus rolloff and coherence',()=>{const r=run(['human-camera-hair-plan','--level','H2.7']);assert.ok(r.json.round_plan.editable.includes('hair_frequency_v2'));assert.ok(r.json.round_plan.editable.includes('photographic_focus_v2'));assert.ok(r.json.round_plan.editable.includes('highlight_rolloff_v2'));assert.equal(r.json.focus.profile,'asset_balanced');assert.equal(r.json.coherence.channels.length,8);});

test('full v3.1 plan stages proportion then face then hair camera',()=>{const r=run(['fashion-human-v31-plan','--proportion','P9','--human','H2.7']);assert.deepEqual(r.json.order.slice(0,3),['fashion_proportion','human_face_optical_refine','human_camera_hair_refine']);assert.equal(r.json.stage_1.proportion.level,'P9');assert.equal(r.json.stage_2.human_presence.level,'H2.7');assert.equal(r.json.stage_3.human_presence.level,'H2.7');});

test('new sclera failure routes to face optical round',()=>{const r=run(['next','--failures','sclera_too_clean']);assert.equal(r.json.recommended_round,'human_face_optical_refine');assert.ok(r.json.round_plan.editable.includes('eye_optics_v2'));});

test('new skin region failure routes to face optical round',()=>{const r=run(['next','--failures','nasal_side_texture_missing']);assert.equal(r.json.recommended_round,'human_face_optical_refine');assert.ok(r.json.round_plan.editable.includes('skin_optics_v2'));});

test('new makeup failure routes to face optical round',()=>{const r=run(['next','--failures','foundation_too_opaque']);assert.equal(r.json.recommended_round,'human_face_optical_refine');assert.ok(r.json.round_plan.editable.includes('makeup_skin_v2'));});

test('new hair frequency failure routes to hair camera round',()=>{const r=run(['next','--failures','hairline_too_clean']);assert.equal(r.json.recommended_round,'human_camera_hair_refine');assert.ok(r.json.round_plan.editable.includes('hair_frequency_v2'));});

test('new focus failure routes to hair camera round',()=>{const r=run(['next','--failures','global_sharpness_too_high']);assert.equal(r.json.recommended_round,'human_camera_hair_refine');assert.ok(r.json.round_plan.editable.includes('photographic_focus_v2'));});

test('P9 error still outranks v0.7.7 human errors',()=>{const r=run(['next','--failures','sclera_too_clean,head_visual_too_large']);assert.equal(r.json.first_focus,'head_visual_too_large');assert.equal(r.json.recommended_round,'fashion_proportion');});

test('face optical failure outranks hair camera failure',()=>{const r=run(['next','--failures','hairline_too_clean,sclera_too_clean']);assert.equal(r.json.first_focus,'sclera_too_clean');assert.equal(r.json.recommended_round,'human_face_optical_refine');});
