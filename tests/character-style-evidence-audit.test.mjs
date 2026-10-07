import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditCharacterStyleEvidence } from '../scripts/character-style-evidence-audit.mjs';

test('九条人物风格均有编译支持且当前审计保留实图未合格边界', () => {
  const report = auditCharacterStyleEvidence();
  assert.equal(report.errors.length, 0);
  assert.equal(report.compiled_routes, 9);
  assert.equal(report.visual_routes_with_outputs, 9);
  assert.equal(report.reviewer_qualified_outputs, 0);
  assert.ok(report.routes.every((route) => route.compiled && route.actual_outputs > 0));
  assert.ok(report.routes.every((route) => route.visual_status === 'unresolved'));
});

test('媒介通过不能伪装成整项资产合格', () => {
  const report = auditCharacterStyleEvidence();
  const route = report.routes.find((item) => item.style_id === 'photographic_character');
  assert.ok(route.medium_pass_runs > 0);
  assert.equal(route.reviewer_qualified_runs, 0);
  assert.equal(route.visual_status, 'unresolved');
});

test('报告调用数漂移会被发现', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'character-style-audit-'));
  fs.mkdirSync(path.join(root, 'resources'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.copyFileSync('resources/asset_style_workflows.json', path.join(root, 'resources/asset_style_workflows.json'));
  fs.copyFileSync('resources/character_style_evidence_catalog.json', path.join(root, 'resources/character_style_evidence_catalog.json'));
  for (const name of fs.readdirSync('docs').filter((item) => item.startsWith('character-') && item.endsWith('-evidence.json'))) {
    fs.copyFileSync(path.join('docs', name), path.join(root, 'docs', name));
  }
  const reportPath = path.join(root, 'docs/character-style-evidence.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  report.known_completed_calls += 1;
  fs.writeFileSync(reportPath, JSON.stringify(report));
  const audited = auditCharacterStyleEvidence({ root });
  assert.ok(audited.errors.some((error) => error.includes('character-style-evidence.json')));
});
