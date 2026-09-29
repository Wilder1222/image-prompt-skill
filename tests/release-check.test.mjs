import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseFiles, validateProject } from '../scripts/release-check.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-prompt-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const file of [...releaseFiles(root), 'RELEASE-MANIFEST.json']) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(dir, file));
  }
  return dir;
}

test('missing skill entrypoint fails even when catalogs exist', t => {
  const dir = fixture(t);
  fs.unlinkSync(path.join(dir, 'SKILL.md'));
  assert.ok(validateProject(dir, { manifest: false }).errors.some(e => e.includes('missing required file: SKILL.md')));
});

test('broken maintained reference is detected', t => {
  const dir = fixture(t);
  fs.appendFileSync(path.join(dir, 'SKILL.md'), '\n[Missing](references/missing.md)\n');
  assert.ok(validateProject(dir, { manifest: false }).errors.some(e => e.includes('missing linked file')));
});

test('preset references must resolve to actual catalog entries', t => {
  const dir = fixture(t), file = path.join(dir, 'resources/asset_master_pipeline_v082_catalog.json');
  const data = JSON.parse(fs.readFileSync(file));
  data.presets.ancient_female_white_master.hand_mode = 'missing';
  fs.writeFileSync(file, JSON.stringify(data));
  assert.ok(validateProject(dir, { manifest: false }).errors.some(e => e.includes('unknown hand_mode')));
});

test('valid JSON content edits invalidate the release hash', t => {
  const dir = fixture(t);
  fs.appendFileSync(path.join(dir, 'resources/face_profile_v082_catalog.json'), '\n');
  assert.ok(validateProject(dir).errors.some(e => e === 'manifest hash mismatch: resources/face_profile_v082_catalog.json'));
});

test('unlisted files invalidate manifest inventory', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'resources/unlisted.json'), '{}');
  assert.ok(validateProject(dir).errors.some(e => e.includes('manifest files is stale')));
});

test('invalid presentation default is detected before release', t => {
  const dir = fixture(t), file = path.join(dir, 'resources/asset_presentation_v084_catalog.json');
  const data = JSON.parse(fs.readFileSync(file));
  data.default = 'missing';
  fs.writeFileSync(file, JSON.stringify(data));
  assert.ok(validateProject(dir, { manifest: false }).errors.includes('unknown default presentation profile'));
});

test('missing full-body preservation prompt fails release validation', t => {
  const dir = fixture(t), file = path.join(dir, 'resources/asset_presentation_v084_catalog.json');
  const data = JSON.parse(fs.readFileSync(file));
  data.reference_modes.full_body_anchor.prompt_translation = [];
  fs.writeFileSync(file, JSON.stringify(data));
  assert.ok(validateProject(dir, { manifest: false }).errors.includes('invalid full-body anchor prompts'));
});

test('missing generation material rules fail before publishing a runtime-broken compiler', t => {
  const dir = fixture(t), file = path.join(dir, 'resources/material_separation_v082_catalog.json');
  const data = JSON.parse(fs.readFileSync(file));
  delete data.profiles.ancient_asset_material_split.generation_prompt_translation;
  fs.writeFileSync(file, JSON.stringify(data));
  assert.ok(validateProject(dir, { manifest: false }).errors.includes('ancient_asset_material_split: invalid material generation_prompt_translation'));
});

test('missing moderate-design policy fails release validation', t => {
  const dir = fixture(t), file = path.join(dir, 'resources/asset_presentation_v084_catalog.json');
  const data = JSON.parse(fs.readFileSync(file));
  delete data.design_freedoms.moderate;
  fs.writeFileSync(file, JSON.stringify(data));
  assert.ok(validateProject(dir, { manifest: false }).errors.includes('invalid design freedom moderate'));
});
