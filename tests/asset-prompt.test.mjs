import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { compileAssetPrompt as compile, createAssetPlan } from '../scripts/asset-master.mjs';
// These legacy semantic assertions exercise the explicitly requested English renderer.
const compileAssetPrompt = options => compile({ language: 'en', ...options });
import { currentExamples } from '../scripts/build-examples.mjs';

const tool = fileURLToPath(new URL('../scripts/iteration-director.mjs', import.meta.url));
const run = args => spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8' });

test('published current examples and plan match the compiler', () => {
  assert.equal(fs.readFileSync(new URL('../examples/ancient-white-asset-current-prompts.md', import.meta.url), 'utf8'), currentExamples());
  assert.deepEqual(JSON.parse(fs.readFileSync(new URL('../docs/current-asset-plan.json', import.meta.url), 'utf8')), createAssetPlan({ presentation: 'costume_showcase', maturityGuard: 'none' }));
});

test('A/B changes facial rendering while non-face stages and age stay fixed', () => {
  const a = createAssetPlan();
  const b = createAssetPlan({ faceProfile: 'humanized_real_light' });
  assert.notDeepEqual(a.stage_1.prompt_skeleton, b.stage_1.prompt_skeleton);
  assert.deepEqual(a.stage_2, b.stage_2);
  assert.deepEqual(a.stage_3, b.stage_3);
  assert.equal(b.configuration.legacy_face_mode, 'humanized_real');
  assert.equal(a.configuration.maturity_guard, b.configuration.maturity_guard);
  assert.equal(a.stage_1.face_profile.age_range, b.stage_1.face_profile.age_range);
});

test('age override is independent and none preserves reference age', () => {
  const plan = createAssetPlan({ maturityGuard: 'none' });
  assert.equal(plan.stage_1.face_profile.age_range, 'preserve_reference');
  assert.doesNotMatch(compileAssetPrompt({ maturityGuard: 'none' }).prompt, /18.22|20.26/);
});

test('hand override changes structure only', () => {
  const a = createAssetPlan(), b = createAssetPlan({ handMode: 'relaxed_down_safe' });
  assert.deepEqual(a.stage_1, b.stage_1);
  assert.deepEqual(a.stage_3, b.stage_3);
  assert.notDeepEqual(a.stage_2.prompt_skeleton, b.stage_2.prompt_skeleton);
});

test('generation exposes requested mode labels but has no edit-only locks', () => {
  const result = compileAssetPrompt();
  assert.doesNotMatch(result.prompt, /only direct edit target|Change only|youthful_18_22/);
  assert.match(result.prompt, /proportion mode = P9 Fashion/);
  assert.equal(result.status, 'prompt_ready');
  assert.deepEqual(result.evidence, { image_generated: false, visual_quality_verified: false });
});

test('new generation permits explicit completion while material repair cannot add layers', () => {
  const generated = compileAssetPrompt({ presentation: 'costume_showcase', maturityGuard: 'none' });
  assert.match(generated.prompt, /only when the brief specifies it/);
  assert.match(generated.prompt, /plain in the brief unpatterned, including tone-on-tone jacquard/);
  assert.doesNotMatch(generated.prompt, /Do not add missing gauze/);
  for (const focus of [undefined, 'materials']) {
    const edited = compileAssetPrompt({ stage: 'material-light', focus });
    assert.match(edited.prompt, /Do not add missing gauze, gold motifs or accessories/);
    assert.doesNotMatch(edited.prompt, /only when the brief specifies it|plain in the brief unpatterned/);
  }
  const anchored = compileAssetPrompt({ referenceMode: 'full_body_anchor' });
  assert.doesNotMatch(anchored.prompt, /completion brief|plain in the brief unpatterned/);
});

test('authorized moderate redesign keeps identity while releasing costume construction', () => {
  const options = { presentation: 'costume_showcase', maturityGuard: 'none' };
  const before = compileAssetPrompt(options);
  const after = compileAssetPrompt({ ...options, designFreedom: 'moderate' });
  assert.equal(after.configuration.design_freedom, 'moderate');
  assert.match(after.prompt, /moderate redesign is authorized/);
  assert.match(after.prompt, /recognizable facial features, apparent age and characteristic expression/);
  assert.doesNotMatch(after.prompt, /Preserve the observed facial identity, apparent age, hairstyle, accessories, visible costume construction and palette/);
  assert.match(before.prompt, /visible costume construction and palette/);
  const oldPlan=createAssetPlan(options), newPlan=createAssetPlan({ ...options, designFreedom: 'moderate' });
  for(const stage of ['stage_1','stage_2','stage_3']) assert.deepEqual(oldPlan[stage],newPlan[stage]);
  for(const options of [{stage:'material-light',designFreedom:'moderate'}, {referenceMode:'full_body_anchor',designFreedom:'moderate'}, {designFreedom:'typo'}]) assert.throws(()=>compileAssetPrompt(options));
  const cli=run(['asset-prompt','--design-freedom','moderate','--presentation','costume_showcase','--maturity-guard','none']);
  assert.equal(cli.status,0,cli.stderr);
  assert.equal(JSON.parse(cli.stdout).prompt,compileAssetPrompt({...options,designFreedom:'moderate',language:'zh-CN'}).prompt);
});

test('each edit includes its locks and exposes disjoint editable dimensions', () => {
  for (const stage of ['face', 'structure', 'material-light']) {
    const result = compileAssetPrompt({ stage });
    assert.match(result.prompt, /Preserve/);
    assert.match(result.prompt, /only direct edit target/);
    assert.equal(result.round_plan.editable.some(x => result.round_plan.locked.includes(x)), false);
  }
});

test('hand repair preserves accepted proportion and does not restage the pose', () => {
  const result = compileAssetPrompt({ stage: 'structure', focus: 'hands', passed: ['fashion_asset_proportion', 'asset_framing'] });
  assert.deepEqual(result.round_plan.editable, ['hand_pose_integrity']);
  assert.ok(result.round_plan.locked.includes('fashion_asset_proportion'));
  assert.doesNotMatch(result.prompt, /Place the right hand|Maintain a clear|Compose the character/);
});

test('material-only patch does not include light setup or face edits', () => {
  const result = compileAssetPrompt({ stage: 'material-light', focus: 'materials' });
  assert.ok(result.round_plan.locked.includes('studio_light_separation'));
  assert.match(result.round_plan.prompt_strategy, /light positions, background and floor shadow unchanged/);
  assert.doesNotMatch(result.prompt, /large soft key|Add only restrained regional skin|naturally elevated waist/);
});

test('lighting-only patch does not replace materials', () => {
  const result = compileAssetPrompt({ stage: 'material-light', focus: 'lighting' });
  assert.ok(result.round_plan.locked.includes('material_separation'));
  assert.doesNotMatch(result.prompt, /Separate the garment materials/);
});

test('passed edit dimensions cannot silently be reopened', () => {
  assert.throws(() => compileAssetPrompt({ stage: 'structure', passed: ['fashion_asset_proportion'] }), /reopen passed/);
  assert.throws(() => compileAssetPrompt({ stage: 'face', passed: ['asset_master_face_refine'] }), /reopen passed/);
  const plan = createAssetPlan({ passed: ['fashion_asset_proportion'] });
  assert.equal(plan.stage_2.status, 'blocked_by_locks');
  assert.deepEqual(plan.stage_2.prompt_skeleton, []);
});

test('invalid focus and configuration fail without prompt output', () => {
  for (const options of [{ stage: 'face', focus: 'materials' }, { faceProfile: 'typo' }, { handMode: 'typo' }, { maturityGuard: 'typo' }, { stage: 'typo' }, { focus: 'hands' }, { passed: ['typo'] }]) {
    assert.throws(() => compileAssetPrompt(options));
  }
});

test('all profiles can compile and plans never claim image approval', () => {
  for (const faceProfile of ['beauty_first_clean', 'beauty_first_character', 'humanized_real_light', 'humanized_real_full', 'stylized_beauty']) {
    assert.equal(compileAssetPrompt({ faceProfile }).configuration.face_profile, faceProfile);
    const plan = createAssetPlan({ faceProfile });
    for (const stage of [plan.stage_1, plan.stage_2, plan.stage_3]) assert.equal(stage.status, 'planned');
  }
});

test('CLI text output is copyable and JSON output is structured', () => {
  const text = run(['asset-prompt', '--format', 'text']);
  assert.equal(text.status, 0, text.stderr);
  assert.equal(text.stdout.trim(), compileAssetPrompt({ language:'zh-CN' }).prompt);
  const json = run(['asset-prompt']);
  assert.equal(json.status, 0, json.stderr);
  assert.equal(JSON.parse(json.stdout).prompt, text.stdout.trim());
});

test('legacy commands honor profile overrides', () => {
  for (const command of ['asset-master-plan-v082', 'ancient-white-asset-plan-v082']) {
    const result = run([command, '--face-profile', 'humanized_real_light']);
    assert.equal(result.status, 0, result.stderr);
    const json = JSON.parse(result.stdout);
    assert.equal((json.plan ?? json).configuration.face_profile, 'humanized_real_light');
  }
});

test('CLI rejects unknown flags, missing values and invalid formats', () => {
  for (const args of [['--face-profil', 'humanized_real_light'], ['--face-profile'], ['--format', 'xml'], ['--stage', 'unknown'], ['unexpected']]) {
    const result = run(['asset-prompt', ...args]);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(JSON.parse(result.stderr).status, 'fail');
  }
});
