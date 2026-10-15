import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {objectHash} from '../scripts/production-prompt.mjs';
import {auditPromptQuality} from '../scripts/prompt-quality-audit.mjs';
import {freezeProductionRun,verifyFrozenRun} from '../scripts/production-run.mjs';
const fixture=()=>JSON.parse(fs.readFileSync(new URL('../examples/product-perfume-brief.json',import.meta.url),'utf8'));
const freeze=input=>freezeProductionRun(input,{run_id:'quality-test',case_id:'perfume',cohort:'text-only'});
function repeated(){const input=fixture();input.sections[0].items.push(structuredClone(input.sections[0].items[0]));return input;}
function record(input){const audit=auditPromptQuality(input);return {prompt_sha256:audit.prompt_sha256,diagnostics_sha256:audit.diagnostics_sha256,reviewer:'test author; no image review',
 decisions:audit.diagnostics.map(d=>({diagnostic_sha256:objectHash(d),resolution:'retain',reason:'合成测试中有意保留重复，用于核对人工处理记录的绑定。'}))};}
test('remaining quality diagnostics block freeze and the standard text CLI until explicitly reviewed',t=>{
  const input=repeated();assert.equal(auditPromptQuality(input).status,'needs_review');
  assert.throws(()=>freeze(input),/quality_review/);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'image-quality-gate-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'brief.json');fs.writeFileSync(file,JSON.stringify(input));
  const args=['scripts/iteration-director.mjs','prompt-build','--input',file,'--format','text'];
  assert.equal(spawnSync(process.execPath,args,{encoding:'utf8'}).status,1);
  input.quality_review=record(input);fs.writeFileSync(file,JSON.stringify(input));
  const result=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/【产品与构造】/);
});
test('the frozen audit and review bind to the exact text and remaining diagnostics',()=>{
  const input=repeated();input.quality_review=record(input);
  const snapshot=freeze(input);assert.equal(verifyFrozenRun(snapshot).prompt,snapshot.prompt);
  assert.equal(snapshot.quality_audit.evidence.semantic_quality_verified,false);
  const changed=structuredClone(input);changed.sections[0].items[0].text+='产品底座保持水平。';
  assert.throws(()=>freeze(changed),/current quality_review/);
  const missing=structuredClone(input);missing.quality_review.decisions=[];assert.throws(()=>freeze(missing),/cover every/);
  const unsupported=structuredClone(input);unsupported.quality_review.decisions[0].resolution='fixed';assert.throws(()=>freeze(unsupported),/supported retain/);
});
test('fixing the actual duplicate clears diagnostics without inventing a reviewer decision',()=>{
  const input=repeated();input.sections[0].items.pop();
  assert.equal(auditPromptQuality(input).status,'diagnostics_clear');
  assert.equal(freeze(input).quality_review,null);
});
