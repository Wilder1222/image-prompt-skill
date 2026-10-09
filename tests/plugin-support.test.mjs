import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { pluginEntry, syncPlugin, validatePluginSupport } from '../scripts/plugin-support.mjs';
import { buildPlugin } from '../scripts/build-plugin.mjs';
import { releaseFiles, validateProject } from '../scripts/release-check.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
function fixture(t) {
  const parent = path.resolve(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(parent, 'image-prompt-plugin-test-'));
  t.after(() => {
    if (path.dirname(path.resolve(dir)) !== parent) throw new Error('test cleanup escaped its temporary parent');
    fs.rmSync(dir, { recursive: true, force: true });
  });
  for (const file of [...releaseFiles(root), 'RELEASE-MANIFEST.json']) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(dir, file));
  }
  return dir;
}

test('plugin has one standard skill entry that loads the canonical workflow', () => {
  assert.equal(validatePluginSupport(root).status, 'pass');
  assert.deepEqual(fs.readdirSync(path.join(root, 'skills')), ['image-prompt-skill']);
  const entry = fs.readFileSync(path.join(root, 'skills/image-prompt-skill/SKILL.md'), 'utf8');
  assert.equal(entry, pluginEntry(root));
  assert.match(entry, /\]\(\.\.\/\.\.\/SKILL\.md\)/);
});

test('changed canonical skill metadata is detected and sync repairs only derived entries', t => {
  const dir = fixture(t), main = path.join(dir, 'SKILL.md');
  const modified = fs.readFileSync(main, 'utf8').replace('description: ', 'description: 测试元数据同步；');
  fs.writeFileSync(main, modified);
  assert.ok(validatePluginSupport(dir).errors.some(e => e.includes('entry is stale')));
  assert.equal(syncPlugin(dir).status, 'pass');
  assert.equal(fs.readFileSync(main, 'utf8'), modified);
});

test('plugin version and skills discovery path cannot silently drift', t => {
  const dir = fixture(t), file = path.join(dir, '.codex-plugin/plugin.json');
  const manifest = JSON.parse(fs.readFileSync(file));
  manifest.version = '0.0.1';
  manifest.skills = './missing/';
  fs.writeFileSync(file, JSON.stringify(manifest));
  const result = validatePluginSupport(dir);
  assert.ok(result.errors.some(e => e.includes('version mismatch')));
  assert.ok(result.errors.some(e => e.includes('skills must point')));
});

test('sync preserves a matching official Codex cachebuster suffix', t => {
  const dir = fixture(t), file = path.join(dir, '.codex-plugin/plugin.json');
  const manifest = JSON.parse(fs.readFileSync(file)), pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json')));
  manifest.version = `${pkg.version}+codex.20260929000000`;
  fs.writeFileSync(file, JSON.stringify(manifest));
  assert.equal(syncPlugin(dir).status, 'pass');
  assert.equal(JSON.parse(fs.readFileSync(file)).version, manifest.version);
});

test('built plugin runs independently of the original repository and rebuilds cleanly', t => {
  const dir = fixture(t);
  const first = buildPlugin(dir);
  assert.equal(validateProject(first.plugin_path).status, 'pass');
  const run = spawnSync(process.execPath, [path.join(first.plugin_path, 'scripts/iteration-director.mjs'), 'asset-prompt', '--reference-mode', 'full_body_anchor'], { cwd: os.tmpdir(), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).configuration.hand_mode, 'preserve_reference');
  const cli = path.join(first.plugin_path, 'scripts/iteration-director.mjs');
  const briefPath = path.join(first.plugin_path, 'examples/character-cg-text-brief.json');
  const compile = input => spawnSync(process.execPath, [cli, 'prompt-build', '--input', input], { cwd: os.tmpdir(), encoding: 'utf8' });
  // This historical example checks compiler portability, not the current aesthetic benchmark.
  const compiled = compile(briefPath);
  assert.equal(compiled.status, 0, compiled.stderr);
  const result = JSON.parse(compiled.stdout);
  assert.equal(result.status, 'prompt_ready');
  assert.equal(result.subject_kind, 'character');
  assert.deepEqual(result.reference_inputs, []);
  assert.match(result.prompt, /【身材比例】/);
  assert.match(result.prompt, /黄金九头身/);
  assert.equal(result.evidence.image_generated, false);
  assert.equal(result.evidence.visual_quality_verified, false);
  assert.equal(result.evidence.user_accepted, false);
  const invalid = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
  invalid.requirements.find(requirement => requirement.id === 'body').target_head_count = 0;
  // Keep the invalid input outside the owned build so its rebuild check stays meaningful.
  const invalidPath = path.join(dir, 'dist/invalid-character-brief.json');
  fs.writeFileSync(invalidPath, JSON.stringify(invalid));
  const rejected = compile(invalidPath);
  assert.equal(rejected.status, 1);
  assert.equal(rejected.stdout, '');
  assert.match(JSON.parse(rejected.stderr).error, /target_head_count.*positive/);
  assert.deepEqual(buildPlugin(dir), first);
});

test('build refuses stale source content', t => {
  const dir = fixture(t);
  fs.appendFileSync(path.join(dir, 'SKILL.md'), '\n');
  assert.throws(() => buildPlugin(dir), /source validation failed/);
});

test('build preserves edited output and foreign files even in normally ignored directories', t => {
  const dir = fixture(t), built = buildPlugin(dir), file = path.join(built.plugin_path, 'README.md');
  const original = fs.readFileSync(file);
  fs.appendFileSync(file, '\nUser edit\n');
  assert.throws(() => buildPlugin(dir), /output was edited/);
  assert.match(fs.readFileSync(file, 'utf8'), /User edit/);
  fs.writeFileSync(file, original);
  const local = path.join(built.plugin_path, 'dist/user-file.txt');
  fs.mkdirSync(path.dirname(local));
  fs.writeFileSync(local, 'retain me');
  assert.throws(() => buildPlugin(dir), /unrecognized directory/);
  assert.equal(fs.readFileSync(local, 'utf8'), 'retain me');
});

test('release inventory excludes generated files and local credentials', t => {
  const dir = fixture(t);
  for (const name of ['.env', '.env.local', 'debug.log', 'dist/test-image.png', '.codex/session.json', 'coverage/result.json']) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), 'local-only-fixture');
    assert.ok(!releaseFiles(dir).includes(name), name);
  }
  fs.writeFileSync(path.join(dir, '.env.example'), '# example only\n');
  assert.ok(releaseFiles(dir).includes('.env.example'));
});
