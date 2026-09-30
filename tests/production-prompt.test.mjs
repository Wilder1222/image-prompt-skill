import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compileProductionPrompt, reviewProductionResult, promptHash} from '../scripts/production-prompt.mjs';
import {compileAssetPrompt} from '../scripts/asset-master.mjs';

function fixture() {
  return {
    request:'依据参考保留灰蓝针织开衫、奶油色长裙的成年女性，生成白底正面全身照片。',
    references:[{id:'R1',source:'test-reference.jpg',inspected:true,generation_input:true,authority:['identity','costume'],facts:[
      {id:'face',channel:'identity',visibility:'visible',text:'柔和面颊，棕发低侧马尾，浅笑。'},
      {id:'outfit',channel:'costume',visibility:'partial',text:'灰蓝针织开衫，奶油色上衣。'},
      {id:'shoes',channel:'costume',visibility:'not_visible',text:'鞋履未显示。'},
    ]}],
    requirements:[
      {id:'U1',channel:'identity',priority:'must',text:'保持原身份。'},
      {id:'U2',channel:'costume',priority:'must',text:'奶油长裙，保持现代服装语言。'},
      {id:'U3',channel:'composition',priority:'must',text:'完整全身正面白底照片。'},
    ],unresolved:[],
    sections:[
      {label:'人物',channel:'identity',items:[{text:'保持参考中柔和面颊、棕发低侧马尾和浅笑的同一成年女性。',basis:['face','U1'],intent:'retain'}]},
      {label:'服装',channel:'costume',items:[
        {text:'保留灰蓝针织开衫和奶油上衣，真实织纹、衣料厚度与纽扣连接清楚。',basis:['outfit'],intent:'retain'},
        {text:'补全为奶油长裙与白色帆布鞋，衣料垂落自然。',basis:['shoes','U2'],intent:'design',reason:'用户要求扩全身，未见部位按现代日常衣装补全。'},
      ]},
      {label:'构图',channel:'composition',items:[{text:'人物正对镜头、完整全身，纯白背景和轻微接地阴影。',basis:['U3'],intent:'constraint'}]},
    ],
    acceptance:[
      {id:'identity',basis:'U1',question:'人物辨识度是否保留？',critical:true},
      {id:'costume',basis:'U2',question:'现代奶油长裙造型是否成立？',critical:true},
      {id:'frame',basis:'U3',question:'是否白底正面全身？',critical:true},
    ],
  };
}
function receipt(compiled, verdict='pass') {
  return {prompt_sha256:compiled.prompt_sha256,output_image:'actual-output.png',output_sha256:'a'.repeat(64),inspected:true,reviewer:'test reviewer',checks:compiled.acceptance.map(c=>({id:c.id,verdict,evidence:'Synthetic test evidence; no real image approval.'}))};
}

test('authored delivery rejects mode assignments and bare mode identifiers but keeps request provenance',()=>{
  for(const text of ['render mode = style_asset','Face_Mode：beauty_first','detail-budget = material_priority','edge control: soft_realistic','采用 P9 Fashion，人物修长。','本轮使用 beauty_first。']){
    const p=fixture();p.sections[0].items[0].text=text;
    assert.throws(()=>compileProductionPrompt(p),/replace .* with concrete visual prose/);
  }
  const p=fixture();p.request+=' 原始要求：face mode = beauty_first';
  p.sections[0].items[0].text='保持参考的同一成年女性，精致妆面完整，皮肤有柔和体积，避免粗糙锐化和塑料磨皮。';
  const result=compileProductionPrompt(p);
  assert.match(result.prompt,/精致妆面完整/);
  assert.doesNotMatch(result.prompt,/face mode|beauty_first/);
});

test('production text comes only from observed facts and authored decisions, with no costume preset leakage',()=>{
  const result=compileProductionPrompt(fixture());
  assert.equal(result.status,'prompt_ready');
  assert.match(result.prompt,/灰蓝针织开衫/);
  assert.doesNotMatch(result.prompt,/P9|冠饰|金纹|汉服|鹅蛋脸/);
  assert.deepEqual(result.reference_inputs,[{id:'R1',source:'test-reference.jpg'}]);
  assert.equal(result.prompt_sha256,promptHash(result.prompt));
  assert.ok(result.audit.coverage.every(c=>c.covered));
  assert.equal(result.evidence.semantic_quality_verified,false);
  assert.equal(result.evidence.visual_quality_verified,false);
  const second=fixture(); second.sections[1].items[0].text='保留深蓝牛仔夹克，接缝和袖口清楚。';
  assert.notEqual(compileProductionPrompt(second).prompt_sha256,result.prompt_sha256);
});

test('a preset without actual reference analysis is explicitly a scaffold',()=>{
  assert.equal(compileAssetPrompt().status,'scaffold_only');
  assert.equal(compileAssetPrompt().requires_reference_analysis,true);
});

test('missing observation, uncovered requirements and unresolved conflicts block delivery',()=>{
  for(const mutate of [
    p=>{p.references[0].inspected=false;},
    p=>{p.sections.pop();},
    p=>{p.unresolved=['two incompatible identity sources'];},
    p=>{p.sections[0].items[0].basis=['missing'];},
    p=>{p.requirements.push({...p.requirements[0]});},
    p=>{p.acceptance.pop();},
    p=>{p.sections[0].items[0].text='待填写脸型';},
  ]) {const p=fixture();mutate(p);assert.throws(()=>compileProductionPrompt(p));}
});

test('unseen lower body can be a reasoned extension but cannot be falsely locked as observed',()=>{
  assert.doesNotThrow(()=>compileProductionPrompt(fixture()));
  const p=fixture();p.sections[1].items[1].intent='retain';
  assert.throws(()=>compileProductionPrompt(p),/cannot retain unseen/);
  p.sections[1].items[1].intent='design';delete p.sections[1].items[1].reason;
  assert.throws(()=>compileProductionPrompt(p),/needs a reason/);
});

test('a wardrobe or evaluation reference cannot silently supply a different identity',()=>{
  const p=fixture();p.references[0].authority=['costume'];
  assert.throws(()=>compileProductionPrompt(p),/cannot control identity/);
  p.references[0].authority.push('identity');p.references[0].generation_input=false;
  assert.throws(()=>compileProductionPrompt(p),/must be included/);
  p.references[0].generation_input=true;
  p.references.push({...structuredClone(p.references[0]),id:'R2',facts:[{id:'otherface',channel:'identity',visibility:'visible',text:'另一个人物。'}]});
  assert.throws(()=>compileProductionPrompt(p),/conflicting identity authorities/);
});

test('text-only work is supported without pretending an image was observed',()=>{
  const p=fixture();p.references=[];p.sections=p.requirements.map(r=>({label:r.id,channel:r.channel,items:[{text:r.text,basis:[r.id],intent:'constraint'}]}));
  const result=compileProductionPrompt(p);assert.deepEqual(result.reference_inputs,[]);
});

test('image approval needs the exact submitted prompt and supported checks for every criterion',()=>{
  const compiled=compileProductionPrompt(fixture());
  for(const mutate of [
    r=>{r.prompt_sha256='b'.repeat(64);},r=>{r.output_image='';},r=>{r.output_sha256='';},
    r=>{r.inspected=false;},r=>{r.checks.pop();},r=>{r.checks[0].evidence='';},r=>{r.checks.push(r.checks[0]);},
  ]) {const r=receipt(compiled);mutate(r);assert.throws(()=>reviewProductionResult(compiled,r));}
});

test('uncertainty is not a pass, and a reviewer cannot automatically give user acceptance',()=>{
  const compiled=compileProductionPrompt(fixture());
  assert.equal(reviewProductionResult(compiled,receipt(compiled,'fail')).status,'needs_revision');
  for(const verdict of ['uncertain','not_assessable']) assert.equal(reviewProductionResult(compiled,receipt(compiled,verdict)).status,'needs_review');
  const pass=reviewProductionResult(compiled,receipt(compiled));assert.equal(pass.status,'reviewer_qualified');assert.equal(pass.user_accepted,false);
  const downgraded=receipt(compiled);Object.assign(downgraded.checks[0],{verdict:'fail',critical:false,basis:'other',question:'replaced target'});
  const enforced=reviewProductionResult(compiled,downgraded);
  assert.equal(enforced.status,'needs_revision');assert.equal(enforced.checks[0].critical,true);
  assert.equal(enforced.checks[0].basis,compiled.acceptance[0].basis);assert.equal(enforced.checks[0].question,compiled.acceptance[0].question);
});

test('production CLI emits the exact checked text and rejects unknown options',t=>{
  const parent=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'production-prompt-test-'));
  t.after(()=>{if(path.dirname(path.resolve(dir))!==parent)throw new Error('cleanup escaped temporary parent');fs.rmSync(dir,{recursive:true,force:true});});
  const input=path.join(dir,'input.json');fs.writeFileSync(input,JSON.stringify(fixture()));
  const cli=fileURLToPath(new URL('../scripts/iteration-director.mjs',import.meta.url));
  const run=args=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
  const r=run(['prompt-build','--input',input,'--format','text']);assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),compileProductionPrompt(fixture()).prompt);
  for(const args of [['--input'],['--input',input,'--unknown','x'],['--input',input,'--format','xml']]){const bad=run(['prompt-build',...args]);assert.equal(bad.status,1);assert.equal(bad.stdout,'');}
  const output=path.join(dir,'output.png');
  fs.writeFileSync(output,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64'));
  const reviewed=receipt(compileProductionPrompt(fixture()));reviewed.output_image='output.png';reviewed.output_sha256=promptHash(fs.readFileSync(output));
  const reviewFile=path.join(dir,'review.json');fs.writeFileSync(reviewFile,JSON.stringify(reviewed));
  const checked=run(['prompt-review','--input',input,'--review',reviewFile]);assert.equal(checked.status,0,checked.stderr);assert.equal(JSON.parse(checked.stdout).user_accepted,false);
  fs.appendFileSync(output,'changed');
  const changed=run(['prompt-review','--input',input,'--review',reviewFile]);assert.equal(changed.status,1);assert.match(changed.stderr,/does not match its recorded SHA-256/);
});
