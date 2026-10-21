import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {compileProductionPrompt,promptHash,objectHash} from '../scripts/production-prompt.mjs';
import {auditPromptQuality} from '../scripts/prompt-quality-audit.mjs';
import {freezeProductionRun,finishProductionRun} from '../scripts/production-run.mjs';
import {imageDimensions,outputResolutionClause} from '../scripts/output-resolution.mjs';
import {pngFixture} from './helpers/image-fixture.mjs';

const fixture=()=>JSON.parse(fs.readFileSync(new URL('../examples/text-to-image-brief.json',import.meta.url),'utf8'));

test('delivery merges authored resolution, preserves language and parameters, and rejects conflicting output sizes',()=>{
  for(const language of ['zh-CN','en'])for(const authored of [false,true]){
    const input=fixture();input.language=language;input.target={profile:'gpt-image-1.5',settings:{size:'1024x1024'}};
    const [heading,text]=outputResolutionClause(language).split('\n');
    if(authored){
      input.requirements.push({id:'res',channel:'output',priority:'must',text});
      input.sections.push({label:heading.slice(1,-1),channel:'output',items:[{text,basis:['res'],intent:'constraint'}]});
      input.acceptance.push({id:'res-check',basis:'res',critical:true,question:'Does the delivered image satisfy the resolution requirement?'});
    }
    const before=structuredClone(input),result=compileProductionPrompt(input);
    assert.equal(result.prompt.split(text).length-1,1);assert.equal(result.prompt.split(heading).length-1,1);
    assert.equal(result.model_execution.request.prompt,result.prompt);assert.equal(result.model_execution.request.size,'1024x1024');
    assert.equal(result.model_execution.delivery_resolution.upscale_required,true);
    assert.equal(result.prompt_sha256,promptHash(result.prompt));assert.equal(auditPromptQuality(input).status,'diagnostics_clear');
    assert.deepEqual(input,before);
    if(authored){input.sections.at(-1).items[0].text='1024x1024';assert.throws(()=>compileProductionPrompt(input),/conflicts.*4K/);}
  }
  const english={subject_kind:'scene',language:'en',request:'An empty gallery. English prompt only.',references:[],unresolved:[],
    requirements:[{id:'s',channel:'background',priority:'must',text:'An empty white gallery.'}],
    sections:[{label:'Scene',channel:'background',items:[{text:'An empty white gallery in soft daylight.',basis:['s'],intent:'constraint'}]}],
    acceptance:[{id:'s-check',basis:'s',critical:true,question:'Is the gallery empty with coherent daylight?'}]};
  assert.doesNotMatch(compileProductionPrompt(english).prompt,/[\u3400-\u9fff]/);
  english.language='eng';assert.throws(()=>compileProductionPrompt(english),/language must/);
});

test('final pixel gate detects insufficient or unreadable files while historical runs retain their frozen standard',t=>{
  const parent=os.tmpdir(),dir=fs.mkdtempSync(path.join(parent,'resolution-contract-'));
  t.after(()=>{assert.equal(path.dirname(dir),parent);fs.rmSync(dir,{recursive:true,force:true});});
  const input=fixture();delete input.target;
  const snapshot=freezeProductionRun(input,{run_id:'pixels',case_id:'gallery',cohort:'synthetic'});
  const output=path.join(dir,'output.png');
  const receipt=s=>({status:'completed',snapshot_sha256:s.snapshot_sha256,target_sha256:s.target_sha256,prompt_sha256:s.prompt_sha256,
    output_image:output,output_sha256:promptHash(fs.readFileSync(output)),inspected:true,reviewer:'synthetic contract test; no visual approval',
    checks:s.target.acceptance.map(c=>({id:c.id,verdict:'pass',evidence:'Synthetic declaration only.'}))});
  for(const [bytes,status,verdict]of [[pngFixture(1,1),'needs_revision','fail'],[pngFixture(),'reviewer_qualified','pass'],[Buffer.from('not an image'),'needs_review','not_assessable']]){
    fs.writeFileSync(output,bytes);const outcome=finishProductionRun(snapshot,receipt(snapshot));
    assert.equal(outcome.status,status);assert.equal(outcome.resolution_review.verdict,verdict);assert.equal(outcome.user_accepted,false);
  }
  const legacy=structuredClone(snapshot);delete legacy.output_resolution;delete legacy.target.output_resolution;
  legacy.target_sha256=objectHash(legacy.target);
  const {snapshot_sha256,...body}=legacy;legacy.snapshot_sha256=objectHash(body);
  fs.writeFileSync(output,pngFixture(1,1));assert.equal(finishProductionRun(legacy,receipt(legacy)).status,'reviewer_qualified');
  const child=freezeProductionRun(input,{run_id:'new-policy',case_id:'gallery',cohort:'synthetic',kind:'revision',parent:legacy});
  assert.equal(child.goal_changed,true);
});

test('encoded image dimension readers handle supported headers and truncated input',()=>{
  assert.deepEqual(imageDimensions(pngFixture(3840,2160)),{width:3840,height:2160});
  assert.equal(imageDimensions(Buffer.alloc(0)),null);assert.equal(imageDimensions(pngFixture().subarray(0,20)),null);
  const gif=Buffer.alloc(10);gif.write('GIF89a');gif.writeUInt16LE(3840,6);gif.writeUInt16LE(2160,8);
  assert.deepEqual(imageDimensions(gif),{width:3840,height:2160});
  const jpeg=Buffer.from([0xff,0xd8,0xff,0xc0,0,7,8,8,112,15,0]);
  assert.deepEqual(imageDimensions(jpeg),{width:3840,height:2160});
  const webp=Buffer.alloc(30);webp.write('RIFF');webp.writeUInt32LE(22,4);webp.write('WEBPVP8X',8);webp.writeUInt32LE(10,16);
  webp.writeUIntLE(3839,24,3);webp.writeUIntLE(2159,27,3);
  assert.deepEqual(imageDimensions(webp),{width:3840,height:2160});assert.equal(imageDimensions(webp.subarray(0,29)),null);
});
