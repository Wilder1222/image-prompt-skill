import{test}from'node:test';import assert from'node:assert/strict';import{spawnSync}from'node:child_process';import path from'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tool=path.join(root,'scripts/iteration-director.mjs');
function run(a){const r=spawnSync(process.execPath,[tool,...a],{cwd:root,encoding:'utf8'});return{...r,json:r.stdout?JSON.parse(r.stdout):null};}

test('v0.7.8 catalogs validate',()=>{const r=run(['validate']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.status,'pass');assert.equal(r.json.p9_persistence_profiles,3);assert.equal(r.json.body_presence_levels,3);assert.equal(r.json.photographic_fabric_profiles,1);assert.ok(r.json.rounds>=21);});

test('P9 persistence locks accepted fashion dimensions',()=>{const r=run(['p9-persistence','--profile','P9_locked']);assert.equal(r.json.source_level,'P9');for(const id of ['head_visual_scale','torso_length','waistline_visual','leg_read','garment_vertical_flow'])assert.ok(r.json.locks.includes(id),id);});

test('P9 persistence explicitly prevents rebound in prompt language',()=>{const r=run(['p9-persistence','--profile','P9_locked']);assert.match(r.json.prompt_translation.join(' '),/do not let later realism edits enlarge the head/i);assert.match(r.json.prompt_translation.join(' '),/lower the waistline/i);});

test('body presence BP2 extends realism beyond face without anatomy redesign',()=>{const r=run(['body-presence','--level','BP2']);assert.equal(r.json.label,'asset_body_presence');assert.equal(r.json.controls.neck_jaw_transition,'natural_soft');assert.equal(r.json.controls.hand_skin,'young_real');assert.ok(r.json.forbidden.includes('body_reshape'));});

test('body presence includes wrists hands ankles and ground contact',()=>{const r=run(['body-presence','--level','BP2']);for(const k of ['wrist_volume','hand_skin','ankle_volume','foot_ground_contact'])assert.ok(k in r.json.controls,k);});

test('p9 body plan locks face costume composition and lighting',()=>{const r=run(['p9-body-plan','--profile','P9_locked','--body','BP2']);for(const id of ['face_identity_geometry','garment_silhouette','composition','lighting_layout'])assert.ok(r.json.round_plan.locked.includes(id),id);assert.ok(r.json.round_plan.forbidden.includes('head_scale_rebound'));});

test('p9 regression routes to persistence round before photographic polish',()=>{const r=run(['next','--failures','p9_regression,white_on_white_separation_weak']);assert.equal(r.json.first_focus,'p9_regression');assert.equal(r.json.recommended_round,'p9_persistence_body_presence');});

test('plastic hands route to body presence persistence round',()=>{const r=run(['next','--failures','hand_too_plastic']);assert.equal(r.json.recommended_round,'p9_persistence_body_presence');assert.ok(r.json.round_plan.editable.includes('wrist_hand_presence'));});

test('photographic white profile forbids dark outline separation',()=>{const r=run(['photographic-fabric-white']);assert.equal(r.json.edge_outline,'forbidden');assert.match(r.json.prompt_translation.join(' '),/never through a dark outline/i);});

test('photographic white profile separates five material response types',()=>{const r=run(['photographic-fabric-white']);for(const k of ['silk','gauze','brocade','embroidery','metal'])assert.ok(r.json.materials[k],k);});

test('fabric plan locks identity P9 human presence and costume architecture',()=>{const r=run(['fabric-white-plan']);for(const id of ['face_identity_geometry','fashion_proportion','garment_silhouette','garment_structure'])assert.ok(r.json.round_plan.locked.includes(id),id);assert.ok(r.json.round_plan.forbidden.includes('costume_redesign'));});

test('white separation failure routes to fabric round',()=>{const r=run(['next','--failures','white_on_white_separation_weak']);assert.equal(r.json.recommended_round,'photographic_fabric_white_refine');assert.ok(r.json.round_plan.editable.includes('white_background_separation'));});

test('uniform fabric response routes to fabric round',()=>{const r=run(['next','--failures','fabric_response_too_uniform']);assert.equal(r.json.recommended_round,'photographic_fabric_white_refine');assert.ok(r.json.round_plan.editable.includes('material_response_separation'));});

test('drape symmetry routes to fabric round',()=>{const r=run(['next','--failures','drape_too_symmetric']);assert.equal(r.json.recommended_round,'photographic_fabric_white_refine');assert.ok(r.json.round_plan.editable.includes('drape_naturalness'));});

test('final photographic polish cannot reopen semantics',()=>{const r=run(['final-photographic-polish-plan']);assert.ok(r.json.round_plan.locked.includes('all_semantic_design_dimensions'));assert.ok(r.json.round_plan.forbidden.includes('semantic_redesign'));assert.ok(r.json.round_plan.forbidden.includes('global_sharpening'));});

test('fashion persistence pipeline orders body then fabric then final polish',()=>{const r=run(['fashion-persistence-pipeline']);assert.deepEqual(r.json.order.slice(0,3),['p9_persistence_body_presence','photographic_fabric_white_refine','final_photographic_polish']);assert.equal(r.json.stage_1.p9_persistence.profile,'P9_locked');assert.equal(r.json.stage_2.fabric_white.profile,'white_asset_photographic');});

test('human face optical failure still outranks body presence cosmetic issue',()=>{const r=run(['next','--failures','sclera_too_clean,hand_too_plastic']);assert.equal(r.json.first_focus,'sclera_too_clean');assert.equal(r.json.recommended_round,'human_face_optical_refine');});

test('P9 regression outranks face optical refinement',()=>{const r=run(['next','--failures','p9_regression,sclera_too_clean']);assert.equal(r.json.first_focus,'p9_regression');assert.equal(r.json.recommended_round,'p9_persistence_body_presence');});
