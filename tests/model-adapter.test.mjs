import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {listModelProfiles,adaptModelPrompt,verifyModelPlan} from '../scripts/model-adapter.mjs';
import {compileProductionPrompt,reviewProductionResult,promptHash} from '../scripts/production-prompt.mjs';
import {freezeProductionRun,verifyFrozenRun,finishProductionRun,summarizeProductionRuns} from '../scripts/production-run.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=()=>JSON.parse(fs.readFileSync(new URL('../examples/text-to-image-brief.json',import.meta.url),'utf8'));
const build=(profile,settings={},negative)=>{
  const input=fixture();input.target={profile,settings,...(negative===undefined?{}:{negative_prompt:negative})};
  return compileProductionPrompt(input);
};
const freeze=input=>freezeProductionRun(input,{run_id:'model-test',case_id:'bookshop',cohort:'unit-fixtures'});

test('every active profile compiles text-only without altering Chinese text or claiming images',()=>{
  const plain=fixture();delete plain.target;const original=compileProductionPrompt(plain);
  const catalog=listModelProfiles();
  assert.equal(new Set(Object.values(catalog.profiles).filter(p=>!p.retired_on&&p.family!=='host').map(p=>p.family)).size,7);
  for(const [id,p] of Object.entries(catalog.profiles)){
    if(p.retired_on){assert.throws(()=>build(id),/停用/);continue;}
    const result=build(id),plan=result.model_execution;
    assert.equal(result.prompt,original.prompt,id);
    assert.deepEqual(result.acceptance,original.acceptance);
    assert.deepEqual(result.reference_inputs,[]);
    assert.equal(plan.prompt_sha256,original.prompt_sha256);
    assert.equal(plan.request.prompt??plan.request.input,original.prompt);
    assert.ok(verifyModelPlan(plan));
    assert.equal(plan.evidence.api_called,false);
    assert.equal(plan.evidence.visual_quality_verified,false);
    assert.equal(result.evidence.image_generated,false);
    if(id!=='host')assert.ok(p.sources.length);
  }
  assert.equal(original.model_execution,undefined);
});

test('native request shapes keep settings out of prose and use the selected version',()=>{
  const openai=build('gpt-image-2.5-sunburst',{size:'1536x1024',quality:'xhigh'}).model_execution;
  assert.equal(openai.request.model,'gpt-image-2.5-sunburst');assert.equal(openai.request.quality,'xhigh');
  assert.throws(()=>build('gpt-image-1.5',{quality:'xhigh'}),/不受支持/);
  const gemini=build('gemini-3.1-flash-image',{aspect_ratio:'3:4',image_size:'2K'}).model_execution;
  assert.deepEqual(gemini.request.response_format,{type:'image',aspect_ratio:'3:4',image_size:'2K'});
  assert.equal(gemini.request.config,undefined);
  const bfl=build('flux-2-pro',{width:1088,height:1920}).model_execution;
  assert.equal(bfl.request.model,undefined);assert.equal(bfl.request.width,1088);
  const ark=build('seedream-4.5',{size:'4K'}).model_execution;
  assert.equal(ark.request.model,'doubao-seedream-4-5-251128');assert.equal(ark.request.sequential_image_generation,'disabled');
  const sd=build('sdxl-1.0',{width:1024,height:1536,num_inference_steps:30,guidance_scale:6,seed:0},'杂乱背景').model_execution;
  assert.equal(sd.request.seed,undefined);assert.equal(sd.runtime.generator_seed,0);assert.equal(sd.request.negative_prompt,'杂乱背景');
  const qwen=build('qwen-image',{true_cfg_scale:4,seed:42},'乱码').model_execution;
  assert.equal(qwen.request.true_cfg_scale,4);assert.equal(qwen.request.guidance_scale,undefined);assert.equal(qwen.runtime.generator_seed,42);
});

test('Midjourney renders a complete native command separately and blocks parameter injection',()=>{
  for(const version of ['7','8.2']){
    const result=build(`midjourney-${version}`,{aspect_ratio:'3:4',seed:0,stylize:100,raw:true},'人物');
    const r=result.model_execution.request;
    assert.equal(r.parameter_suffix,`--v ${version} --ar 3:4 --seed 0 --stylize 100 --raw --no 人物`);
    assert.equal(r.submission_text,`${result.prompt}\n${r.parameter_suffix}`);
    assert.doesNotMatch(result.prompt,/--v|--ar/);
    assert.throws(()=>build(`midjourney-${version}`,{},'人物 --v 6'),/须与正文分开/);
    assert.throws(()=>build(`midjourney-${version}`,{aspect_ratio:'3:4 --seed 2'}),/不受支持/);
    assert.throws(()=>build(`midjourney-${version}`,{aspect_ratio:'15:1'}),/不受支持/);
    const injected=fixture();injected.target={profile:`midjourney-${version}`};injected.sections[0].items[0].text+=' --oref other.png';
    assert.throws(()=>compileProductionPrompt(injected),/须与正文分开/);
  }
});

test('unsupported fields, malformed settings, retired models and unknown versions fail without fallback',()=>{
  for(const target of [null,[],{profile:'FLUX'},{profile:'constructor'},{profile:'host',model:'fake'},{profile:'host',settings:[]},{profile:'host',settings:null},
    {profile:'host',settings:{control_image:'pose.png'}},{profile:'host',settings:{mask_image:'mask.png'}},
    {profile:'sdxl-1.0',settings:{controlnet_conditioning_scale:1}},{profile:'qwen-image',control_image:'pose.png'},
    {profile:'gpt-image-1.5',settings:{seed:1}},{profile:'gemini-3.1-flash-image',settings:{imageConfig:{}}},
    {profile:'qwen-image',settings:{guidance_scale:4}},{profile:'sd-3.5-large',settings:{sampler:'Euler'}},
    {profile:'midjourney-8.2',settings:{oref:'other.png'}},{profile:'seedream-4.5',settings:{size:'1K'}},
    {profile:'imagen-4-gemini-legacy'}]){
    const input=fixture();input.target=target;assert.throws(()=>compileProductionPrompt(input),JSON.stringify(target));
  }
  const unknown=fixture();unknown.target={profile:'gpt-image-future'};
  assert.throws(()=>compileProductionPrompt(unknown),/未知模型/);
  const catalog=listModelProfiles();catalog.profiles.host.model='mutated';assert.equal(listModelProfiles().profiles.host.model,null);
});

test('dimension and output constraints reject silent resize and incompatible formats',()=>{
  for(const size of ['1000x1000','3840x3840','4000x1024','1024x256','512x512','0x1024','1024X1024'])assert.throws(()=>build('gpt-image-2',{size}),/不受支持/);
  assert.doesNotThrow(()=>build('gpt-image-2',{size:'3840x2160'}));
  assert.throws(()=>build('gpt-image-1.5',{background:'transparent',output_format:'jpeg'}),/JPEG/);
  assert.throws(()=>build('flux-2-pro',{width:2048}),/一起指定/);
  assert.throws(()=>build('flux-2-pro',{width:4096,height:4096}),/总像素/);
  assert.throws(()=>build('flux-2-pro',{width:1000,height:1000}),/不受支持/);
  for(const seed of [-1,4294967296,0.5,'42',NaN])assert.throws(()=>build('sdxl-1.0',{seed}),/不受支持/);
  assert.throws(()=>build('sdxl-1.0',{num_inference_steps:0}),/不受支持/);
});

test('negative conditions are never silently dropped or sent to unsupported native fields',()=>{
  for(const id of ['host','gpt-image-1.5','gpt-image-2','gemini-3.1-flash-image','flux-2-pro','seedream-4.5'])assert.throws(()=>build(id,{},'模糊'),/正向目标/);
  for(const id of ['sdxl-1.0','sd-3.5-large','qwen-image'])assert.throws(()=>build(id,{},'模糊'),/引导强度/);
  assert.throws(()=>build('qwen-image',{true_cfg_scale:4}),/negative_prompt/);
  assert.equal(build('qwen-image',{true_cfg_scale:4},' ').model_execution.request.negative_prompt,' ');
  assert.throws(()=>build('midjourney-7',{},42),/非空字符串/);
  assert.throws(()=>build('sdxl-1.0',{guidance_scale:7},''),/非空字符串/);
});

test('generation references are rejected for text-only routes but host paths resolve against brief directory',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'model-host-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'reference.png'),'synthetic fixture, not visual evidence');
  const input=fixture();input.references=[{id:'R1',source:'reference.png',inspected:true,generation_input:true,authority:['background'],facts:[{id:'observed',channel:'background',visibility:'visible',text:'书店门口。'}]}];
  assert.throws(()=>compileProductionPrompt(input),/不能丢弃参考图/);
  input.target={profile:'host'};
  const snapshot=freezeProductionRun(input,{run_id:'host',case_id:'case',cohort:'fixture',base_dir:dir});
  assert.deepEqual(verifyFrozenRun(snapshot).request.referenced_image_paths,[path.join(dir,'reference.png')]);
});

test('model, settings, negative prompt and native suffix are bound independently of unchanged prose',()=>{
  const a=build('midjourney-7',{seed:0},'人物'),b=build('midjourney-8.2',{seed:0},'人物'),c=build('midjourney-7',{seed:1},'人物'),d=build('midjourney-7',{seed:0},'汽车');
  assert.equal(new Set([a,b,c,d].map(x=>x.prompt_sha256)).size,1);
  assert.equal(new Set([a,b,c,d].map(x=>x.model_execution.execution_sha256)).size,4);
  const tampered=structuredClone(a.model_execution);tampered.request.submission_text+=' --seed 42';assert.throws(()=>verifyModelPlan(tampered),/已变化/);
  assert.throws(()=>adaptModelPrompt({...a,prompt:'替换正文'},{profile:'host'}),/摘要不一致/);
  assert.throws(()=>reviewProductionResult(a,{prompt_sha256:a.prompt_sha256,execution_sha256:b.model_execution.execution_sha256}),/execution_sha256/);
});

test('freeze, inspect and receipt preserve an external target without pretending it is image_gen',t=>{
  const input=fixture(),snapshot=freeze(input),dispatch=verifyFrozenRun(snapshot);
  assert.equal(snapshot.tool,'gemini-interactions');assert.equal(dispatch.request.model,'gemini-3.1-flash-image');
  assert.equal(dispatch.request.input,snapshot.prompt);assert.equal(dispatch.runtime,null);
  const missing={status:'completed',snapshot_sha256:snapshot.snapshot_sha256};
  assert.throws(()=>finishProductionRun(snapshot,missing),/execution_sha256/);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'model-receipt-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'synthetic-output.bin');fs.writeFileSync(file,'unit-test fixture only');
  const receipt={...missing,execution_sha256:dispatch.execution_sha256,target_sha256:snapshot.target_sha256,prompt_sha256:snapshot.prompt_sha256,
    output_image:file,output_sha256:promptHash(fs.readFileSync(file)),inspected:true,reviewer:'synthetic unit fixture',
    checks:snapshot.target.acceptance.map(c=>({id:c.id,verdict:'uncertain',evidence:'Synthetic fixture; no actual model image was generated.'}))};
  const result=finishProductionRun(snapshot,receipt);
  assert.equal(result.status,'needs_review');
  assert.equal(result.execution_sha256,dispatch.execution_sha256);
  assert.doesNotThrow(()=>summarizeProductionRuns([{snapshot,outcome:result}]));
  for(const execution_sha256 of [undefined,'a'.repeat(64)])
    assert.throws(()=>summarizeProductionRuns([{snapshot,outcome:{...result,execution_sha256}}]),/execution_sha256/);
});

test('public CLI lists profiles, compiles full requests and returns clean copyable text',()=>{
  const run=(...args)=>spawnSync(process.execPath,['scripts/iteration-director.mjs',...args],{cwd:root,encoding:'utf8'});
  const list=run('model-list');assert.equal(list.status,0,list.stderr);assert.ok(JSON.parse(list.stdout).profiles['seedream-4.5']);
  assert.notEqual(run('model-list','--unknown','x').status,0);
  const json=run('prompt-build','--input','examples/text-to-image-brief.json');assert.equal(json.status,0,json.stderr);
  const text=run('prompt-build','--input','examples/text-to-image-brief.json','--format','text');assert.equal(text.status,0,text.stderr);
  const compiled=JSON.parse(json.stdout);assert.equal(text.stdout.trim(),compiled.prompt);
  assert.equal(compiled.model_execution.request.input,compiled.prompt);
});
