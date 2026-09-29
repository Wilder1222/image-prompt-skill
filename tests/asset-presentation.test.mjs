import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileAssetPrompt, createAssetPlan } from '../scripts/asset-master.mjs';

test('showcase selection changes presentation, not face or material treatment', () => {
  const a = createAssetPlan(), b = createAssetPlan({ presentation: 'costume_showcase' });
  assert.deepEqual(a.stage_1, b.stage_1);
  assert.deepEqual(a.stage_3, b.stage_3);
  assert.equal(b.stage_2.fashion_asset.visual_head_count_target, 'reference_derived');
  assert.equal(a.configuration.presentation_profile, 'neutral_asset');
  const result = compileAssetPrompt({ presentation: 'costume_showcase' });
  assert.match(result.prompt, /A-line hem/);
  assert.doesNotMatch(result.prompt, /approximately nine-head|hem controlled rather than excessively spread/);
});

test('explicit hand request takes precedence over showcase composition', () => {
  const result = compileAssetPrompt({ presentation: 'costume_showcase', handMode: 'relaxed_down_safe' });
  assert.equal(result.configuration.hand_mode, 'relaxed_down_safe');
  assert.match(result.prompt, /hands relaxed beside the body/);
  assert.doesNotMatch(result.prompt, /right hand gently over|crossed hands/);
});

test('showcase does not leak ornament or layer additions into a local repair', () => {
  for (const [stage, focus] of [['structure', 'hands'], ['material-light', 'materials']]) {
    const a = compileAssetPrompt({ stage, focus });
    const b = compileAssetPrompt({ stage, focus, presentation: 'costume_showcase' });
    assert.equal(a.prompt, b.prompt);
    assert.deepEqual(a.round_plan, b.round_plan);
  }
});

test('full-body anchor bypasses generation defaults and does not claim approval', () => {
  const result = compileAssetPrompt({ referenceMode: 'full_body_anchor' });
  assert.equal(result.configuration.hand_mode, 'preserve_reference');
  assert.equal(result.configuration.proportion_profile, 'preserve_reference');
  assert.match(result.prompt, /Preserve its facial identity/);
  assert.doesNotMatch(result.prompt, /Place the right hand|Extend unseen|18.22|large soft key/);
  assert.deepEqual(result.evidence, { image_generated: false, visual_quality_verified: false });
});

test('full-body anchor rejects silently conflicting overrides', () => {
  for (const options of [{ handMode: 'relaxed_down_safe' }, { faceProfile: 'humanized_real_full' }, { maturityGuard: 'youthful_18_22' }, { presentation: 'costume_showcase' }]) {
    assert.throws(() => compileAssetPrompt({ referenceMode: 'full_body_anchor', ...options }), /conflicting profile overrides/);
  }
});

test('anchor generation cannot silently reopen passed repairs', () => {
  for (const options of [{ stage: 'structure' }, { focus: 'hands' }, { passed: ['asset_framing'] }]) {
    assert.throws(() => compileAssetPrompt({ referenceMode: 'full_body_anchor', ...options }), /preservation generation mode/);
  }
});

test('invalid presentation, reference mode and unknown anchor options fail', () => {
  for (const options of [{ presentation: 'typo' }, { referenceMode: 'typo' }, { referenceMode: 'full_body_anchor', faceProfil: 'typo' }]) {
    assert.throws(() => compileAssetPrompt(options));
  }
});

test('CLI dispatches presentation and full-body mode without dropping them', () => {
  const tool = fileURLToPath(new URL('../scripts/iteration-director.mjs', import.meta.url));
  for (const [args, options] of [
    [['--presentation', 'costume_showcase'], { presentation: 'costume_showcase' }],
    [['--reference-mode', 'full_body_anchor'], { referenceMode: 'full_body_anchor' }],
  ]) {
    const result = spawnSync(process.execPath, [tool, 'asset-prompt', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), compileAssetPrompt(options));
  }
});
