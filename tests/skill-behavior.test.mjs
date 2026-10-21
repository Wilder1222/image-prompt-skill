import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compileProductionPrompt,productionFields} from '../scripts/production-prompt.mjs';
import {auditPromptQuality} from '../scripts/prompt-quality-audit.mjs';
import {bodyRegions} from '../scripts/body-proportion-contract.mjs';

const read=name=>JSON.parse(fs.readFileSync(new URL(`../examples/${name}`,import.meta.url),'utf8'));

test('representative production fixtures preserve task boundaries and complete per-view body coverage',()=>{
  for(const name of ['text-to-image-brief.json','product-perfume-brief.json','character-adaptive-brief.json','full-body-production-brief.json']){
    const input=read(name),before=structuredClone(input),compiled=compileProductionPrompt(input);
    assert.ok(Object.keys(input).every(key=>productionFields.includes(key)));
    assert.equal(auditPromptQuality(input).status,'diagnostics_clear');assert.deepEqual(input,before);
    assert.equal(compiled.evidence.visual_quality_verified,false);
    if(['scene','product'].includes(input.subject_kind))assert.ok(!input.requirements.some(r=>r.character_goal));
  }
  const complete=read('full-body-production-brief.json');
  assert.ok(complete.requirements.some(r=>r.channel==='makeup'&&r.priority==='must'));
  assert.ok(complete.requirements.some(r=>r.channel==='lighting'&&r.priority==='must'));
  assert.deepEqual(complete.body_plan.figures.map(f=>f.view),['front','side','back']);
  for(const figure of complete.body_plan.figures)for(const region of Object.keys(bodyRegions))
    assert.equal(complete.acceptance.filter(c=>c.figure_id===figure.id&&c.body_region===region&&c.critical).length,1);
});
