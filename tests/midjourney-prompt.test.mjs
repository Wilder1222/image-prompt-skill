import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {adaptModelPrompt,verifyModelPlan,listModelProfiles} from '../scripts/model-adapter.mjs';
import {compileProductionPrompt,promptHash} from '../scripts/production-prompt.mjs';
import {freezeProductionRun,verifyFrozenRun,finishProductionRun} from '../scripts/production-run.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
// Syntax-only synthetic fixtures. These URLs are never fetched or offered as real references.
const image='https://cdn.discordapp.com/attachments/1/2/synthetic-test.png?ex=fixture&hm=a%2Bb';
const compiled=(refs=[])=>({prompt:'雨夜书店，招牌上写着"夜读"。',prompt_sha256:promptHash('雨夜书店，招牌上写着"夜读"。'),reference_inputs:refs});
const plan=(settings={},extra={},refs=[],profile='midjourney-8.2')=>adaptModelPrompt(compiled(refs),{profile,settings,...extra});
const binding=(role,extra={})=>({reference_id:'R',role,...extra});
const local=[{id:'R',source:'portrait.png'}];
const remote=[{id:'R',source:image}];
const fixture=()=>JSON.parse(fs.readFileSync(new URL('../examples/text-to-image-brief.json',import.meta.url),'utf8'));

test('explicit model choices pin versions and never migrate unsupported versions or Niji silently',()=>{
  for(const version of ['7','8.1','8.2'])assert.match(plan({}, {}, [],`midjourney-${version}`).request.parameters,new RegExp(`^--v ${version}`));
  assert.throws(()=>plan({}, {}, [],'midjourney-8.0'),/停用/);
  for(const version of ['midjourney','midjourney-8','midjourney-9','niji-7'])assert.throws(()=>plan({}, {}, [],version),/未知模型/);
  assert.equal(listModelProfiles().profiles['midjourney-8.2'].verified_on,'2026-10-19');
  assert.equal(listModelProfiles().profiles['gpt-image-1.5'].verified_on,undefined);
  assert.equal(plan().documentation_verified_on,'2026-10-19');
});

test('native text preserves Chinese visible lettering and adds no costly or account switches by default',()=>{
  const p=plan(),r=p.request;
  assert.equal(r.prompt,compiled().prompt);assert.equal(r.native_prompt,r.prompt);
  assert.equal(r.submission_text,`${r.prompt}\n--v 8.2`);
  assert.equal(r.ready_to_submit,true);assert.equal(r.surface,'web');
  assert.doesNotMatch(r.submission_text,/--(?:p|hd|repeat|draft|fast|turbo|stealth|public)\b|\/imagine/);
  assert.equal(p.evidence.image_generated,false);assert.ok(verifyModelPlan(p));
});

test('core ranges, integer seed, aspect ratios and aliases reject conflicts and injection',()=>{
  for(const [key,min,max] of [['s',0,1000],['c',0,100],['w',0,3000],['seed',0,4294967295],['exp',0,100]]){
    for(const value of [min,max])assert.doesNotThrow(()=>plan({[key]:value}));
    for(const value of [min-1,max+1,NaN,Infinity,'1',1.5])assert.throws(()=>plan({[key]:value}),/不受支持/);
  }
  assert.match(plan({s:100,c:5,w:0,ar:'100000:100000',raw:true}).request.parameters,/--ar 100000:100000/);
  for(const ar of ['0:1','1.5:1','15:1','1:15','16:9 --p','99999999999999999:99999999999999999'])assert.throws(()=>plan({ar}),/不受支持/);
  for(const settings of [{s:1,stylize:1},{hd:true,sd:true},{resolution:'hd',hd:true}])assert.throws(()=>plan(settings),/冲突/);
  for(const p of ['--v 7','ok --q 4','ok\n--v 7','<profile>'])assert.throws(()=>plan({p}),/不受支持/);
  assert.match(plan({p:true}).request.parameters,/--p$/);
  assert.match(plan({p:'pProvidedByUser'}).request.parameters,/--p pProvidedByUser$/);
  assert.throws(()=>plan({raw:'true'}),/不受支持/);
  for(const key of ['__proto__','constructor','toString'])assert.throws(()=>plan(JSON.parse(`{"${key}":1}`)),/不支持设置/);
});

test('V8 rejects legacy flags and unknown strengths; V7 quality is explicit without q3 cost upgrade',()=>{
  for(const key of ['q','ow','sv','iw','turbo','cref','cw','ew','v','niji','repeat','fast','relax','stealth','public'])assert.throws(()=>plan({[key]:1}),/不支持设置/);
  for(const q of [1,2,4])assert.match(plan({q},{},[],'midjourney-7').request.parameters,new RegExp(`--q ${q}`));
  assert.throws(()=>plan({q:3},{},[],'midjourney-7'),/不受支持/);
  assert.throws(()=>plan({hd:true},{},[],'midjourney-7'),/不支持设置/);
  for(const version of ['8.1','8.2']){
    assert.doesNotThrow(()=>plan({hd:true,ar:'4:1'},{},[],`midjourney-${version}`));
    assert.throws(()=>plan({hd:true,ar:'1:5'},{},[],`midjourney-${version}`),/HD 比例上限/);
    assert.doesNotThrow(()=>plan({sd:true,ar:'14:1'},{},[],`midjourney-${version}`));
  }
});

test('Draft conflict follows dedicated docs: V8 web only, opt-in and with warning',()=>{
  for(const version of ['8.1','8.2']){
    const r=plan({draft:true},{surface:'web'},[],`midjourney-${version}`).request;
    assert.match(r.parameters,/--draft/);assert.ok(r.warnings.some(w=>/24/.test(w)&&/冲突/.test(w)));
    assert.throws(()=>plan({draft:true},{surface:'discord'},[],`midjourney-${version}`),/仅网页/);
  }
  assert.match(plan({draft:true},{surface:'discord'},[],'midjourney-7').request.parameters,/--draft/);
  assert.throws(()=>plan({}, {surface:'browser'}),/surface/);
});

test('web attachments keep paths out of native text and remain pending until manually confirmed',()=>{
  const p=plan({}, {references:[binding('edit')]},local),r=p.request;
  assert.equal(p.status,'manual_input_required');assert.equal(r.ready_to_submit,false);
  assert.equal(r.reference_manifest[0].web_attachment,'Attach to prompt');
  assert.doesNotMatch(r.submission_text,/portrait\.png|--edit|https:/);
  assert.match(r.blockers.join(),/手动/);
  assert.equal(plan({}, {references:[binding('edit',{attachment_confirmed:true})]},local).request.ready_to_submit,true);
  assert.equal(plan({}, {references:[binding('edit',{url:image})]},local).request.ready_to_submit,false);
  assert.equal(plan({}, {references:[binding('edit',{attachment_confirmed:true})]},local).request.reference_manifest[0].url,null);
});

test('Discord role syntax keeps image URLs before prose and edit/sref after prose with signed query intact',()=>{
  const refs=[{id:'I',source:image},{id:'E',source:image.replace('test.png','edit.webp')},{id:'S',source:image.replace('test.png','style.jpg')}];
  const r=plan({sw:0},{surface:'discord',references:[{reference_id:'I',role:'image'},{reference_id:'E',role:'edit'},{reference_id:'S',role:'style',weight:2}]},refs).request;
  assert.equal(r.ready_to_submit,true);assert.ok(r.native_prompt.startsWith(image+'\n'));
  assert.ok(r.parameters.includes('--edit '+refs[1].source));
  assert.ok(r.parameters.includes('--sref '+refs[2].source+'::2'));
  assert.doesNotMatch(r.submission_text,/\/imagine/);assert.match(r.manual_instructions,/\/imagine/);
});

test('missing Discord URLs stay pending; malformed URLs, pages, local IDs and fabricated placeholders fail',()=>{
  const p=plan({}, {surface:'discord',references:[binding('edit')]},local);
  assert.equal(p.request.ready_to_submit,false);assert.equal(p.request.reference_manifest[0].url,null);
  assert.doesNotMatch(p.request.submission_text,/portrait\.png|--edit/);
  for(const url of ['C:\\portrait.png','sandbox:/a.png','Library:123','file:///a.png','https://example.com/a.png','https://a.invalid/a.png','https://host.test/a.png','https://localhost/a.png','https://10.0.0.1/a.png','https://host.com/page','https://host.com/a.png --v 7','https://user:pass@host.com/a.png','https://host.com/a.png#fragment','https://host.com/a.png?x={a,b}'])
    assert.throws(()=>plan({}, {surface:'discord',references:[binding('edit',{url})]},local),/URL/);
  assert.equal(plan({}, {surface:'discord',references:[binding('edit',{url:image})]},local).request.reference_manifest[0].url,image);
  for(const url of ['https://[::1]/a.png','https://[fd00::1]/a.png'])assert.throws(()=>plan({}, {surface:'discord',references:[binding('edit',{url})]},local),/URL/);
  const punctuationUrl='https://10.images.org/a.png?signature=a::b&x=a%2Bb';
  assert.equal(plan({}, {surface:'discord',references:[binding('edit',{url:punctuationUrl})]},local).request.reference_manifest[0].url,punctuationUrl);
});

test('references are exhaustive, role checked, and cannot turn observation-only or absent sources into inputs',()=>{
  assert.throws(()=>plan({}, {},local),/缺少明确平台角色/);
  for(const refs of [[binding('edit'),binding('edit')],[binding('unknown')],[{reference_id:'absent',role:'style'}]])
    assert.throws(()=>plan({}, {references:refs},local),/参考缺失/);
  assert.throws(()=>plan({}, {references:[binding('style')]},[]),/参考缺失/);
  const c=compiled(local);c.audit={reference_usage:[{id:'R',authority:['identity']}]};
  assert.throws(()=>adaptModelPrompt(c,{profile:'midjourney-8.2',references:[binding('style')]}),/身份参考/);
  assert.throws(()=>plan({}, {references:[binding('omni')]},local),/仅支持显式 V7/);
  assert.throws(()=>plan({}, {references:[binding('edit')]},local,'midjourney-7'),/仅支持 V8/);
});

test('Edit max four and tile conflict; implicit HD reference ratio requires manual resolution',()=>{
  const refs=Array.from({length:5},(_,i)=>({id:`R${i}`,source:`input${i}.png`}));
  const bindings=refs.map(r=>({reference_id:r.id,role:'edit',attachment_confirmed:true}));
  assert.throws(()=>plan({}, {references:bindings},refs),/最多四张/);
  assert.equal(plan({}, {references:bindings.slice(0,4)},refs.slice(0,4)).request.ready_to_submit,true);
  assert.throws(()=>plan({tile:true},{references:[binding('edit')]},local),/不兼容 tile/);
  assert.equal(plan({hd:true},{references:[binding('edit',{attachment_confirmed:true})]},local).request.ready_to_submit,false);
  assert.equal(plan({hd:true,ar:'3:4'},{references:[binding('edit',{attachment_confirmed:true})]},local).request.ready_to_submit,true);
});

test('V7 Omni is one image with bounded weight and blocks quality4/draft',()=>{
  const extra={surface:'discord',references:[binding('omni')]};
  assert.match(plan({ow:100},extra,remote,'midjourney-7').request.parameters,/--oref/);
  for(const ow of [1,1000])assert.doesNotThrow(()=>plan({ow},extra,remote,'midjourney-7'));
  for(const ow of [0,1001])assert.throws(()=>plan({ow},extra,remote,'midjourney-7'),/不受支持/);
  for(const settings of [{q:4},{draft:true}])assert.throws(()=>plan(settings,extra,remote,'midjourney-7'),/Omni Reference 不兼容/);
  assert.throws(()=>plan({}, {references:[binding('omni'),{reference_id:'R2',role:'omni'}]},[...local,{id:'R2',source:'two.png'}],'midjourney-7'),/只接受一张/);
  assert.throws(()=>plan({ow:100},{},[],'midjourney-7'),/需要 V7 omni/);
});

test('image/style weights require matching refs; style codes do not enable text multi-prompts',()=>{
  for(const version of ['7','8.1']){
    for(const iw of [0,3])assert.doesNotThrow(()=>plan({iw},{references:[binding('image')]},local,`midjourney-${version}`));
    for(const iw of [-1,3.1])assert.throws(()=>plan({iw},{references:[binding('image')]},local,`midjourney-${version}`),/不受支持/);
    assert.throws(()=>plan({iw:1},{},[],`midjourney-${version}`),/需要 image/);
  }
  assert.throws(()=>plan({sw:100}),/需要 style/);
  for(const sw of [0,1000])assert.doesNotThrow(()=>plan({sw,sref:['123','random']}));
  assert.throws(()=>plan({sw:1001,sref:['123']}),/不受支持/);
  assert.throws(()=>plan({sref:[image]}),/不受支持/);
  for(const sv of [1,2,3,5])assert.throws(()=>plan({sv,sref:['123']},{},[],'midjourney-7'),/只支持 sv 4 或 6/);
  for(const sv of [4,6])assert.doesNotThrow(()=>plan({sv,sref:['random']},{},[],'midjourney-7'));
  assert.throws(()=>plan({}, {references:[binding('style',{weight:2})]},local),/仅支持 Discord/);
  for(const weight of [0,-1,NaN,Infinity,'2'])assert.throws(()=>plan({}, {surface:'discord',references:[binding('style',{weight})]},remote),/有限正数/);
  const c=compiled();c.prompt+=' mountains::2';c.prompt_sha256=promptHash(c.prompt);
  assert.throws(()=>adaptModelPrompt(c,{profile:'midjourney-8.2'}),/须与正文分开/);
  assert.match(plan({}, {negative_prompt:'文字, 水印'}).request.parameters,/--no 文字, 水印$/);
});

test('surface and references are bound to plan hashes and do not leak into other providers',()=>{
  const a=plan(),b=plan({}, {surface:'discord'});
  assert.notEqual(a.execution_sha256,b.execution_sha256);
  for(const key of ['surface','references'])assert.throws(()=>adaptModelPrompt(compiled(),{profile:'host',[key]:key==='surface'?'web':[]}),/仅用于 Midjourney/);
  const tampered=structuredClone(a);tampered.request.ready_to_submit=false;assert.throws(()=>verifyModelPlan(tampered),/已变化/);
});

test('freeze and inspect preserve manual readiness without allowing automatic dispatch',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mj-manual-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'reference.png'),'Synthetic fixture only, not a generated or inspected image.');
  const input=fixture();input.references=[{id:'R',source:'reference.png',inspected:true,generation_input:true,authority:['background'],facts:[{id:'F',channel:'background',visibility:'visible',text:'合成测试声明，无实图证据。'}]}];
  input.target={profile:'midjourney-8.2',references:[binding('edit')]};
  const freeze=()=>freezeProductionRun(input,{run_id:'test',case_id:'test',cohort:'synthetic',base_dir:dir});
  const frozen=freeze(),check=verifyFrozenRun(frozen);
  assert.equal(check.dispatch_ready,false);assert.equal(check.manual_submission_required,true);assert.equal(check.ready_to_submit,false);
  assert.equal(check.request.reference_manifest[0].source,path.join(dir,'reference.png'));
  assert.throws(()=>finishProductionRun(frozen,{status:'completed',snapshot_sha256:frozen.snapshot_sha256}),/尚未就绪/);
  input.target.references[0].attachment_confirmed=true;
  const ready=freeze();assert.notEqual(frozen.model_execution.execution_sha256,ready.model_execution.execution_sha256);
  assert.equal(verifyFrozenRun(ready).ready_to_submit,true);assert.equal(verifyFrozenRun(ready).dispatch_ready,false);
});

test('native CLI yields complete copyable MJ text only when manual inputs are ready',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mj-cli-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'brief.json'),input=fixture();input.target={profile:'midjourney-8.2',settings:{ar:'3:4'}};
  fs.writeFileSync(file,JSON.stringify(input));
  const run=format=>spawnSync(process.execPath,['scripts/iteration-director.mjs','prompt-build','--input',file,'--format',format],{cwd:root,encoding:'utf8'});
  const native=run('native');assert.equal(native.status,0,native.stderr);
  assert.equal(native.stdout.trim(),compileProductionPrompt(input).model_execution.request.submission_text);
  assert.equal(run('text').stdout.trim(),compileProductionPrompt(input).prompt);
  input.target={profile:'host'};fs.writeFileSync(file,JSON.stringify(input));assert.notEqual(run('native').status,0);
  input.references=[{id:'R',source:'reference.png',inspected:true,generation_input:true,authority:['background'],facts:[{id:'F',channel:'background',visibility:'visible',text:'测试声明。'}]}];
  input.target={profile:'midjourney-8.2',references:[binding('edit')]};fs.writeFileSync(file,JSON.stringify(input));
  assert.notEqual(run('native').status,0);assert.equal(run('json').status,0);
});
