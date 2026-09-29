import{test}from'node:test';
import assert from'node:assert/strict';
import{spawnSync}from'node:child_process';
import path from'node:path';
import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tool=path.join(root,'scripts/iteration-director.mjs');
function run(a){const r=spawnSync(process.execPath,[tool,...a],{cwd:root,encoding:'utf8'});return{...r,json:r.stdout?JSON.parse(r.stdout):null};}

test('v0.7.3 catalogs validate',()=>{const r=run(['validate']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.status,'pass');assert.equal(r.json.render_modes,4);assert.equal(r.json.completion_levels,4);assert.equal(r.json.human_presence_levels,4);});
test('single reference asset ignores environment while locking identity costume',()=>{const r=run(['fidelity-plan','--preset','single_reference_asset']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.channels.identity.level,3);assert.equal(r.json.channels.costume.level,3);assert.equal(r.json.channels.environment.level,0);});
test('style asset preserves style but still ignores environment',()=>{const r=run(['fidelity-plan','--preset','single_reference_style_asset']);assert.equal(r.json.channels.style.level,2);assert.equal(r.json.channels.lighting.level,2);assert.equal(r.json.channels.environment.level,0);});
test('C1 completion forbids new major design',()=>{const r=run(['completion-level','--level','C1']);assert.equal(r.json.new_major_design,false);assert.equal(r.json.density_delta,0);});
test('H2 human presence adds soft tissue skin asymmetry and camera response',()=>{const r=run(['human-presence','--level','H2']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.soft_tissue,'moderate');assert.equal(r.json.regional_skin,'moderate');assert.equal(r.json.natural_asymmetry,'subtle');assert.equal(r.json.camera_response,'moderate');});
test('density plan preserves wear state',()=>{const r=run(['density-plan','--level','high','--wear','W2']);assert.equal(r.json.design_density,'high');assert.equal(r.json.wear_state.label,'distressed');assert.equal(r.json.rules.do_not_scale_decoration_count_with_canvas_area,true);});
test('style asset render mode keeps background neutral',()=>{const r=run(['render-mode','--name','style_asset']);assert.equal(r.json.mode,'style_asset');assert.equal(r.json.background_policy,'white_or_neutral');assert.equal(r.json.environment_copy,'forbidden');});
test('style asset plan combines fidelity completion human presence and density',()=>{const r=run(['style-asset-plan','--preset','cyber_asset_case','--completion','C1','--human','H2','--density','high','--wear','W2']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.render_mode.mode,'style_asset');assert.equal(r.json.reference_fidelity.channels.environment.level,0);assert.equal(r.json.completion.level,'C1');assert.equal(r.json.human_presence.level,'H2');assert.equal(r.json.density.wear_state.level,'W2');});
test('reference channel leak routes before human realism issue',()=>{const r=run(['next','--failures','human_presence_undershoot,reference_channel_leak']);assert.equal(r.json.first_focus,'reference_channel_leak');assert.equal(r.json.recommended_round,'reference_fidelity');});
test('completion overdesign routes to completion guard',()=>{const r=run(['next','--failures','completion_overdesign']);assert.equal(r.json.recommended_round,'completion_guard');assert.ok(r.json.round_plan.forbidden.includes('invent_major_design_without_authorization'));});
test('camera CG render routes to human presence',()=>{const r=run(['next','--failures','camera_cg_render']);assert.equal(r.json.recommended_round,'human_presence_optical_refine');assert.ok(r.json.round_plan.locked.includes('face_identity_geometry'));});
test('style asset environment leak routes to reference fidelity',()=>{const r=run(['next','--failures','style_asset_environment_leak']);assert.equal(r.json.recommended_round,'reference_fidelity');});
