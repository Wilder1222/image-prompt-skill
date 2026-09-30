import{test}from'node:test';import assert from'node:assert/strict';import{spawnSync}from'node:child_process';import path from'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const tool=path.join(root,'scripts/iteration-director.mjs');
function run(args){const r=spawnSync(process.execPath,[tool,...args],{cwd:root,encoding:'utf8'});return{...r,json:r.stdout?JSON.parse(r.stdout):null};}

test('v079 catalog validation passes',()=>{const r=run(['validate']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.status,'pass');assert.equal(r.json.face_modes,3);assert.equal(r.json.maturity_guard_profiles,3);assert.equal(r.json.realism_scope_modes,3);assert.equal(r.json.face_route_archetypes,4);});

test('beauty_first protects youthful beauty',()=>{const r=run(['face-mode','--mode','beauty_first']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.age_target,'18_22');assert.equal(r.json.preserve_beauty_priority,'high');assert.equal(r.json.face_realism,'low_medium');assert.ok(r.json.avoid.includes('无依据削空面颊'));});

test('humanized_real uses stronger face realism without age inflation',()=>{const r=run(['face-mode','--mode','humanized_real']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.face_realism,'medium_high');assert.equal(r.json.non_face_realism,'high');assert.ok(r.json.avoid.includes('未经授权重塑身份'));});

test('stylized_beauty keeps low facial realism',()=>{const r=run(['face-mode','--mode','stylized_beauty']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.face_realism,'low');assert.equal(r.json.preserve_beauty_priority,'very_high');});

test('silver ethereal route defaults to beauty_first',()=>{const r=run(['face-route','--archetype','ancient_ethereal_female']);assert.equal(r.status,0,r.stderr);assert.equal(r.json.resolved_mode,'beauty_first');assert.equal(r.json.maturity_guard,'youthful_18_22');});

test('warrior queen route defaults to humanized_real',()=>{const r=run(['face-route','--archetype','warrior_queen']);assert.equal(r.json.resolved_mode,'humanized_real');assert.equal(r.json.maturity_guard,'young_adult_20_26');});

test('cyber route defaults to humanized_real',()=>{const r=run(['face-route','--archetype','cyber_oriental_female']);assert.equal(r.json.resolved_mode,'humanized_real');});

test('explicit face mode overrides auto route',()=>{const r=run(['face-route','--archetype','ancient_ethereal_female','--mode','stylized_beauty']);assert.equal(r.json.resolved_mode,'stylized_beauty');assert.equal(r.json.override_applied,true);});

test('youthful maturity guard caps age at 22 and suppresses aging shortcuts',()=>{const r=run(['maturity-guard','--profile','youthful_18_22']);assert.equal(r.json.age_ceiling,22);assert.ok(r.json.suppress.includes('heavy_under_eye_shadow'));assert.ok(r.json.suppress.includes('sunken_cheeks'));});

test('beauty first realism split keeps high non-face realism',()=>{const r=run(['realism-split','--mode','beauty_first']);assert.equal(r.json.face_realism,'low_medium');assert.equal(r.json.non_face_realism,'high');assert.ok(r.json.non_face_channels.includes('costume_materials'));assert.ok(r.json.non_face_channels.includes('lighting'));});

test('face mode plan locks body costume and composition',()=>{const r=run(['face-mode-plan','--archetype','ancient_ethereal_female']);for(const id of ['face_identity_geometry','fashion_proportion','body_proportion','garment_silhouette','garment_structure','composition'])assert.ok(r.json.round_plan.locked.includes(id),id);assert.equal(r.json.face_mode.mode,'beauty_first');});

test('beauty first plan explicitly says not to infer higher face realism from non-face realism',()=>{const r=run(['face-mode-plan','--archetype','ancient_ethereal_female']);assert.match(r.json.prompt_skeleton.join(' '),/Do not infer that stronger hair, fabric, body or lighting realism requires a more mature or more photoreal face/);});

test('non-face realism round locks face mode identity and age',()=>{const r=run(['non-face-realism-plan','--mode','beauty_first']);for(const id of ['face_identity_geometry','face_mode','age_impression','maturity_guard'])assert.ok(r.json.round_plan.locked.includes(id),id);assert.ok(r.json.round_plan.editable.includes('costume_materials'));assert.ok(r.json.round_plan.editable.includes('lighting'));});

test('face and non-face plan orders face calibration before non-face realism',()=>{const r=run(['face-nonface-plan','--archetype','ancient_ethereal_female']);assert.deepEqual(r.json.order.slice(0,2),['face_mode_calibration','non_face_realism_refine']);assert.equal(r.json.stage_1.route.resolved_mode,'beauty_first');});

test('age too old routes to face mode calibration',()=>{const r=run(['next','--failures','age_impression_too_old']);assert.equal(r.json.recommended_round,'face_mode_calibration');assert.equal(r.json.first_focus,'age_impression_too_old');});

test('beauty loss after realism routes to face mode calibration',()=>{const r=run(['next','--failures','beauty_loss_after_realism']);assert.equal(r.json.recommended_round,'face_mode_calibration');});

test('non-face realism undershoot routes to non-face realism',()=>{const r=run(['next','--failures','non_face_realism_undershoot']);assert.equal(r.json.recommended_round,'non_face_realism_refine');});

test('face realism overdrive outranks non-face undershoot',()=>{const r=run(['next','--failures','non_face_realism_undershoot,face_realism_overdrive']);assert.equal(r.json.first_focus,'face_realism_overdrive');assert.equal(r.json.recommended_round,'face_mode_calibration');});

test('identity drift still outranks face-mode mismatch',()=>{const r=run(['next','--failures','face_mode_mismatch,identity_drift']);assert.equal(r.json.first_focus,'identity_drift');});

test('P9 regression still outranks non-face realism refinement',()=>{const r=run(['next','--failures','p9_regression,non_face_realism_undershoot']);assert.equal(r.json.first_focus,'p9_regression');assert.equal(r.json.recommended_round,'p9_persistence_body_presence');});

test('unknown face mode fails closed',()=>{const r=run(['face-mode','--mode','invented']);assert.equal(r.status,1);assert.match(r.stderr,/unknown face mode/);});

test('legacy face defaults carry their scope through a nested plan',()=>{const r=run(['face-mode-plan','--archetype','ancient_ethereal_female']);assert.equal(r.status,0,r.stderr);assert.match(r.json.face_mode.scope,/不是新人物默认设定/);assert.match(r.json.face_mode.scope,/当前参考年龄、脸型/);assert.match(r.json.route.rule,/不能覆盖新任务/);});
