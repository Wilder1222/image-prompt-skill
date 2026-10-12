import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compileProductionPrompt} from '../scripts/production-prompt.mjs';
import {auditPromptQuality} from '../scripts/prompt-quality-audit.mjs';
import {applyFaceDesign} from '../scripts/face-design.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'));

test('the audit CLI supports portable positional arguments and explicit input without rewriting files', () => {
  const script = fileURLToPath(new URL('../scripts/prompt-quality-audit.mjs', import.meta.url));
  const file = fileURLToPath(new URL('../examples/product-perfume-brief.json', import.meta.url));
  const before = fs.readFileSync(file), results = [];
  for (const args of [[file], ['--input', file]]) {
    const result = spawnSync(process.execPath, [script, ...args], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    results.push(JSON.parse(result.stdout));
  }
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(fs.readFileSync(file), before);
});
function editableBrief() {
  const brief = read('character-asset-front-brief.json');
  brief.references.push({id: 'baseline', source: 'synthetic-test-only.png', inspected: true, generation_input: true, authority: [],
    facts: [{id: 'test-only-fact', channel: 'lighting', visibility: 'visible', text: '合成测试声明，不代表实际像素观察。'}]});
  return brief;
}

test('a must target cannot acquire coverage from an unrelated channel', () => {
  const brief = read('product-perfume-brief.json'), requirement = brief.requirements.find(row => row.priority === 'must' && row.channel === 'lighting');
  const section = brief.sections.find(row => row.channel === requirement.channel);
  brief.sections = brief.sections.filter(row => row !== section);
  brief.sections.find(row => row.channel !== requirement.channel).items.push(...section.items);
  assert.throws(() => compileProductionPrompt(brief), /required instruction needs its own authored lighting clause/);
});

test('all task-specific must targets remain compiled without rewriting', () => {
  for (const name of ['product-perfume-brief.json','background-garden-brief.json','character-walk-brief.json','character-cg-text-brief.json']) {
    const brief = read(name), before = structuredClone(brief), compiled = compileProductionPrompt(brief);
    const result = auditPromptQuality(brief);
    assert.equal(result.prompt_sha256, compiled.prompt_sha256);
    assert.deepEqual(brief, before);
    assert.equal(result.evidence.visual_quality_verified, false);
    assert.equal(result.evidence.semantic_quality_verified, false);
  }
});

test('edit scope rejects literal conflicting permissions while separate regions are valid', () => {
  const brief = editableBrief(), baseline = brief.references.find(row => row.generation_input);
  brief.edit_scope = {baseline_reference_id: baseline.id, changes: ['调整脸部受光。'], preserve: [' 调整脸部受光。 ']};
  assert.throws(() => compileProductionPrompt(brief), /cannot be both a change and a preservation/);
  brief.edit_scope.preserve = ['保持衣装和身体比例。'];
  assert.doesNotThrow(() => compileProductionPrompt(brief));
});

test('scope repetition is reviewable without dropping frozen delivery or claiming failure', () => {
  const brief = editableBrief(), baseline = brief.references.find(row => row.generation_input);
  brief.edit_scope = {baseline_reference_id: baseline.id, changes: [brief.sections[0].items[0].text], preserve: ['保持原图可见身体比例。']};
  const compiled = compileProductionPrompt(brief), result = auditPromptQuality(brief);
  assert.equal(result.status, 'needs_review');
  assert.ok(result.diagnostics.some(row => row.code === 'scope_repeats_clause' && row.scope.list === 'changes'));
  assert.equal(result.prompt_sha256, compiled.prompt_sha256);
});

test('exact repeated prose keeps source locations for an author to reconcile', () => {
  const brief = read('text-to-image-brief.json');
  brief.sections[0].items.push(structuredClone(brief.sections[0].items[0]));
  const result = auditPromptQuality(brief), repeated = result.diagnostics.find(row => row.code === 'repeated_clause');
  assert.equal(repeated.locations.length, 2);
  assert.notEqual(repeated.locations[0].item_index, repeated.locations[1].item_index);
});

test('face presentation layered on existing composition requests human semantic reconciliation', () => {
  const face = read('face-design-original.json'), brief = read('face-design-portrait-base.json');
  face.presentation ??= {};
  face.presentation.camera_angle = '从人物自身左侧的三分之四视角取景，保留双眼可见。';
  const applied = applyFaceDesign(brief, face), result = auditPromptQuality(applied);
  assert.equal(applied.sections[0].channel, 'identity');
  assert.deepEqual(applied.sections.filter(row => brief.sections.some(prior => prior.label === row.label)), brief.sections);
  assert.ok(result.diagnostics.some(row => row.code === 'face_layer_overlap' && row.channel === 'composition'));
  assert.equal(result.evidence.semantic_quality_verified, false);
});
