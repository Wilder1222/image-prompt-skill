import{test}from'node:test';
import assert from'node:assert/strict';
import{spawnSync}from'node:child_process';
import path from'node:path';
import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tool=path.join(root,'scripts/iteration-director.mjs');
function run(a){const r=spawnSync(process.execPath,[tool,...a],{cwd:root,encoding:'utf8'});return{...r,json:r.stdout?JSON.parse(r.stdout):null};}

test('v0.7.4 catalogs validate',()=>{const r=run(['validate']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.status,'pass');assert.equal(r.json.completion_budget_levels,4);assert.equal(r.json.density_budget_profiles,3);assert.equal(r.json.wear_budget_levels,5);assert.equal(r.json.human_presence_v2_levels,4);assert.equal(r.json.extremity_levels,4);});

test('C1 completion budget blocks ornament growth and primary motifs',()=>{const r=run(['completion-budget','--level','C1']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.ornament_growth_pct_max,0);assert.equal(r.json.new_primary_motifs_max,0);assert.equal(r.json.new_material_families_max,0);assert.ok(r.json.structure_growth_pct_max<=10);});

test('density preserve blocks primary ornament mechanical and chain growth',()=>{const r=run(['density-budget','--profile','preserve']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.primary_ornament_growth_pct_max,0);assert.equal(r.json.mechanical_module_growth_pct_max,0);assert.equal(r.json.chain_tassel_growth_pct_max,0);assert.equal(r.json.new_zone_density_rule,'match_reference_mean_not_peak');});

test('W2 wear budget remains distressed without structural ruin',()=>{const r=run(['wear-budget','--level','W2']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.label,'distressed');assert.equal(r.json.large_tears_max,3);assert.match(r.json.metal_weathering,/no_structural_damage/);});

test('H2 v2 includes eye anatomy hair irregularity and camera response',()=>{const r=run(['human-presence-v2','--level','H2']);assert.equal(r.status,0,r.stderr);assert.ok(r.json.eye_anatomy>=0.7);assert.ok(r.json.hair_irregularity>=0.5);assert.ok(r.json.camera_response>=0.7);assert.equal(r.json.age_shift,'none');assert.ok(r.json.regions.eyelids);});

test('E2 asset integrity requires five digits per hand',()=>{const r=run(['extremity-guard','--level','E2']);assert.equal(r.status,0,r.stderr);assert.ok(r.json.hand_requirements.some(x=>x.includes('five digits')));assert.ok(r.json.foot_requirements.length>0);});

test('constraint plan combines all budgets without vendor parameter claim',()=>{const r=run(['constraint-plan','--completion','C1','--density','preserve','--wear','W2','--human','H2','--extremity','E2']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.completion.level,'C1');assert.equal(r.json.design_density.profile,'preserve');assert.equal(r.json.wear.level,'W2');assert.equal(r.json.human_presence.level,'H2');assert.equal(r.json.extremity.level,'E2');assert.match(r.json.note,/internal planning constraints/);});

test('style asset plan now includes constraint budget',()=>{const r=run(['style-asset-plan','--preset','cyber_asset_case','--completion','C1','--human','H2','--density','high','--wear','W2']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.constraint_budget.completion.level,'C1');assert.equal(r.json.constraint_budget.design_density.profile,'preserve');assert.equal(r.json.constraint_budget.extremity.level,'E2');});

test('digit count error routes to local extremity patch',()=>{const r=run(['next','--failures','hand_digit_count_error']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.recommended_round,'extremity_integrity');assert.ok(r.json.round_plan.locked.includes('face_identity_geometry'));assert.ok(r.json.round_plan.forbidden.includes('costume_redesign'));});

test('completion budget overrun routes before human realism issue',()=>{const r=run(['next','--failures','human_presence_undershoot,completion_budget_overrun']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.first_focus,'completion_budget_overrun');assert.equal(r.json.recommended_round,'constraint_budget');});

test('mechanical module growth routes to constraint budget',()=>{const r=run(['next','--failures','mechanical_module_growth_overrun']);assert.equal(r.json.recommended_round,'constraint_budget');});

test('wear budget overrun routes to constraint budget',()=>{const r=run(['next','--failures','wear_budget_overrun']);assert.equal(r.json.recommended_round,'constraint_budget');});

test('CG eye anatomy routes to human presence',()=>{const r=run(['next','--failures','eye_anatomy_cg']);assert.equal(r.json.recommended_round,'human_presence_optical_refine');assert.ok(r.json.round_plan.editable.includes('eye_optics_realism'));});

test('uniform CG hair routes to human presence',()=>{const r=run(['next','--failures','hair_uniform_cg']);assert.equal(r.json.recommended_round,'human_presence_optical_refine');assert.ok(r.json.round_plan.editable.includes('hair_frequency_variation'));});
