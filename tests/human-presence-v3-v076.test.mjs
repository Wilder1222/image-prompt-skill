import{test}from'node:test';
import assert from'node:assert/strict';
import{spawnSync}from'node:child_process';
import path from'node:path';
import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tool=path.join(root,'scripts/iteration-director.mjs');
function run(a){const r=spawnSync(process.execPath,[tool,...a],{cwd:root,encoding:'utf8'});return{...r,json:r.stdout?JSON.parse(r.stdout):null};}

test('v0.7.6 catalogs validate',()=>{const r=run(['validate']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.status,'pass');assert.equal(r.json.human_presence_v3_levels,5);assert.equal(r.json.realism_coherence_channels,8);assert.equal(r.json.focus_profiles,3);assert.ok(r.json.rounds>=16);});

test('H2.5 is the photographic-human default',()=>{const r=run(['human-presence-v3']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.level,'H2.5');assert.equal(r.json.label,'photographic_human');assert.ok(r.json.eye_optics_realism>=0.8);assert.ok(r.json.realism_coherence>=0.85);});

test('H2.5 locks age and does not use asymmetry as mandatory realism shortcut',()=>{const r=run(['human-presence-v3','--level','H2.5']);assert.equal(r.json.age_shift,'none');assert.equal(r.json.asymmetry_policy,'optional_natural');assert.ok(r.json.forbidden_shortcuts.includes('forced_face_asymmetry'));});

test('young skin policy rejects random mottling and pore stacking',()=>{const r=run(['human-presence-v3','--level','H2.5']);assert.ok(r.json.forbidden_shortcuts.includes('random_skin_mottling'));assert.ok(r.json.forbidden_shortcuts.includes('coarse_pore_stack'));assert.match(r.json.prompt_translation.join(' '),/young skin relatively even|region-dependent optical response/i);});

test('eye optics target natural sclera instead of super-white eyes',()=>{const r=run(['human-presence-v3','--level','H2.5']);assert.match(r.json.prompt_translation.join(' '),/off-white sclera/i);assert.ok(r.json.forbidden_shortcuts.includes('paper_white_sclera'));});

test('realism coherence tracks eye skin hair makeup and camera',()=>{const r=run(['realism-coherence']);assert.equal(r.status,0,r.stderr);for(const id of ['eyes','skin','hair','makeup','camera_response'])assert.ok(r.json.channels.includes(id),id);assert.match(r.json.rule,/within one internal tier/i);});

test('full body focus profile keeps costume readable while face is strongest',()=>{const r=run(['photographic-focus','--profile','full_body_asset']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.face_focus,'strongest');assert.equal(r.json.lower_costume,'clear_asset_readable');assert.equal(r.json.depth_policy,'moderate_depth_not_shallow_portrait_blur');});

test('optical refine round locks P9 identity costume and lighting layout',()=>{const r=run(['human-optical-plan','--level','H2.5']);assert.equal(r.status,0,r.stderr);for(const id of ['face_identity_geometry','fashion_proportion','garment_structure','lighting_design'])assert.ok(r.json.round_plan.locked.includes(id),id);assert.ok(r.json.round_plan.forbidden.includes('proportion_reopen'));assert.ok(r.json.round_plan.forbidden.includes('random_skin_mottling'));});

test('optical refine prompt prioritizes coherence not more detail everywhere',()=>{const r=run(['human-optical-plan','--level','H2.5']);const p=r.json.prompt_skeleton.join(' ');assert.match(p,/coherent realism level/i);assert.match(p,/Focus hierarchy/i);assert.match(p,/not random pigment noise/i);});

test('fashion-human-v3 keeps staged P9 then optical refinement',()=>{const r=run(['fashion-human-v3-plan','--proportion','P9','--human','H2.5']);assert.equal(r.status,0,r.stderr);assert.deepEqual(r.json.order.slice(0,2),['fashion_proportion','human_presence_optical_refine']);assert.equal(r.json.stage_1.proportion.level,'P9');assert.equal(r.json.stage_2.human_presence.level,'H2.5');});

test('CG face now routes to optical human refine',()=>{const r=run(['next','--failures','face_too_cg']);assert.equal(r.json.recommended_round,'human_presence_optical_refine');assert.ok(r.json.round_plan.editable.includes('eye_optics_realism'));assert.ok(r.json.round_plan.editable.includes('skin_optical_coherence'));});

test('paper-white sclera routes to optical human refine',()=>{const r=run(['next','--failures','eye_sclera_too_white']);assert.equal(r.json.recommended_round,'human_presence_optical_refine');assert.ok(r.json.round_plan.editable.includes('eye_optics_realism'));});

test('eye skin mismatch routes to coherence repair',()=>{const r=run(['next','--failures','realism_mismatch_eye_skin']);assert.equal(r.json.recommended_round,'human_presence_optical_refine');assert.ok(r.json.round_plan.editable.includes('realism_coherence'));});

test('skin pigment overvariation routes to optical repair not aging',()=>{const r=run(['next','--failures','skin_pigment_variation_overdone']);assert.equal(r.json.recommended_round,'human_presence_optical_refine');assert.ok(r.json.round_plan.forbidden.includes('aging_cues'));});

test('uniform focus CG routes to optical/camera hierarchy',()=>{const r=run(['next','--failures','focus_uniform_cg']);assert.equal(r.json.recommended_round,'human_presence_optical_refine');assert.ok(r.json.round_plan.editable.includes('focus_hierarchy'));});

test('overdone asymmetry is treated as a human-presence failure',()=>{const r=run(['next','--failures','micro_asymmetry_overdone']);assert.equal(r.json.recommended_round,'human_presence_optical_refine');assert.ok(r.json.round_plan.forbidden.includes('forced_face_asymmetry'));});

test('P9 proportion error still outranks human optical issue',()=>{const r=run(['next','--failures','eye_sclera_too_white,head_visual_too_large']);assert.equal(r.json.first_focus,'head_visual_too_large');assert.equal(r.json.recommended_round,'fashion_proportion');});
