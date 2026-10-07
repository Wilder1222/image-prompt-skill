import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compileProductionPrompt, reviseProductionInput, reviewProductionResult, promptHash} from '../scripts/production-prompt.mjs';
import {compileAssetPrompt} from '../scripts/asset-master.mjs';

function fixture() {
  return {
    subject_kind:'character',
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
      {id:'P9',channel:'proportion',priority:'must',target_head_count:9,text:'人体直立高度为九个颅顶至下巴头长，不计发量与鞋跟。'},
    ],unresolved:[],
    sections:[
      {label:'人物',channel:'identity',items:[{text:'保持参考中柔和面颊、棕发低侧马尾和浅笑的同一成年女性。',basis:['face','U1'],intent:'retain'}]},
      {label:'服装',channel:'costume',items:[
        {text:'保留灰蓝针织开衫和奶油上衣，真实织纹、衣料厚度与纽扣连接清楚。',basis:['outfit'],intent:'retain'},
        {text:'补全为奶油长裙与白色帆布鞋，衣料垂落自然。',basis:['shoes','U2'],intent:'design',reason:'用户要求扩全身，未见部位按现代日常衣装补全。'},
      ]},
      {label:'构图',channel:'composition',items:[{text:'人物正对镜头、完整全身，纯白背景和轻微接地阴影。',basis:['U3'],intent:'constraint'}]},
      {label:'身材比例',channel:'proportion',items:[{text:'黄金九头身，人体直立高度为九个颅顶至下巴头长，不计发量与鞋跟，各段协调。',basis:['P9'],intent:'constraint'}]},
    ],
    acceptance:[
      {id:'identity',basis:'U1',question:'人物辨识度是否保留？',critical:true},
      {id:'costume',basis:'U2',question:'现代奶油长裙造型是否成立？',critical:true},
      {id:'frame',basis:'U3',question:'是否白底正面全身？',critical:true},
      {id:'proportion',basis:'P9',question:'排除发量与鞋跟，人体是否九头身且各段协调？',critical:true},
    ],
  };
}
function receipt(compiled, verdict='pass') {
  return {prompt_sha256:compiled.prompt_sha256,output_image:'actual-output.png',output_sha256:'a'.repeat(64),inspected:true,reviewer:'test reviewer',checks:compiled.acceptance.map(c=>({id:c.id,verdict,evidence:'Synthetic test evidence; no real image approval.'}))};
}

test('reference declarations reject unsupported controls instead of silently dropping them',()=>{
  for(const [key,value] of Object.entries({weight:0.9,subject_scale:0.9,adapter:'InstantCharacter',mask:'region.png',crop:{x:10,y:10},guidance:2,identity_weight:0.8,metadata:{subject_scale:0.9},generation_inputs:true})){
    const input=fixture();input.references[0][key]=value;
    const before=structuredClone(input);
    assert.throws(()=>compileProductionPrompt(input),new RegExp(`unsupported reference field ${key}`));
    assert.deepEqual(input,before);
  }
  const observer=fixture();
  observer.references.push({id:'judge',source:'judge.png',inspected:true,generation_input:false,authority:['style'],facts:[{id:'style-note',channel:'style',visibility:'visible',text:'Synthetic observation only.'}],weight:0});
  assert.throws(()=>compileProductionPrompt(observer),/unsupported reference field weight/);
});

test('supported identity roles preserve input order without inventing execution weights',()=>{
  const input=fixture();
  Object.assign(input.references[0],{identity_group:'same-person',identity_role:'primary'});
  input.references.push({id:'side',source:'side.png',inspected:true,generation_input:true,identity_group:'same-person',identity_role:'support',authority:['identity'],facts:[{id:'side-face',channel:'identity',visibility:'partial',text:'Synthetic supporting view.'}]});
  const compiled=compileProductionPrompt(input);
  assert.deepEqual(compiled.reference_inputs,[{id:'R1',source:'test-reference.jpg'},{id:'side',source:'side.png'}]);
  assert.equal(compiled.evidence.image_generated,false);
  for(const value of [null,[],42]){
    const broken=fixture();broken.references.push(value);
    assert.throws(()=>compileProductionPrompt(broken),/reference must be an object/);
  }
});

test('expression-only source supplies motion without acquiring identity or body authority',()=>{
  const brief=JSON.parse(fs.readFileSync(new URL('../examples/character-expression-brief.json',import.meta.url),'utf8'));
  brief.references.push({id:'motion',source:'synthetic-expression-fixture.png',inspected:true,generation_input:true,
    authority:['expression'],facts:[{id:'jaw-motion',channel:'expression',visibility:'visible',text:'Synthetic test observation: relaxed brows and open jaw.'}]});
  brief.sections.find(s=>s.channel==='expression').items.push({intent:'retain',basis:['jaw-motion'],text:'借用参考的放松眉眼与下颌张开动作。'});
  const compiled=compileProductionPrompt(brief);
  assert.deepEqual(compiled.reference_inputs,[{id:'motion',source:'synthetic-expression-fixture.png'}]);
  assert.equal(compiled.evidence.image_generated,false);
  for(const channel of ['identity','proportion','costume','style']){
    const bad=structuredClone(brief);
    bad.sections.find(s=>s.channel===channel).items.push({intent:'retain',basis:['jaw-motion'],text:'错误地借用此参考的其他设计。'});
    assert.throws(()=>compileProductionPrompt(bad),new RegExp(`cannot control ${channel}`));
  }
});

test('changing an expression target preserves identity and nine-head checks without approving an unseen body',()=>{
  const brief=JSON.parse(fs.readFileSync(new URL('../examples/character-expression-brief.json',import.meta.url),'utf8'));
  const original=structuredClone(brief),section=brief.sections.find(s=>s.channel==='expression');
  const req=brief.requirements.find(r=>r.id==='expression'),criterion=brief.acceptance.find(c=>c.basis==='expression');
  const change={request:'把张嘴对照改为闭嘴浅笑，其他目标保持。',channels:['expression'],
    sections:[{label:section.label,items:[{intent:'constraint',basis:['expression'],text:'全身和右上头像保持中性；右下头像嘴唇闭合、嘴角轻微上扬，眼睑随浅笑自然收窄。'}]}],
    requirements:[{...req,text:'全身与右上中性；右下闭嘴浅笑，保持同一人物。'}],
    acceptance:[{...criterion,question:'是否分别呈现中性与闭嘴浅笑，眼口动作自然？'}]};
  const next=reviseProductionInput(brief,change);
  assert.equal(next.target_changed,true);
  assert.deepEqual(brief,original);
  for(const key of ['requirements','sections'])assert.deepEqual(next.input[key].filter(r=>r.channel!=='expression'),brief[key].filter(r=>r.channel!=='expression'));
  assert.deepEqual(next.input.acceptance.filter(c=>c.basis!=='expression'),brief.acceptance.filter(c=>c.basis!=='expression'));
  for(const id of ['identity','body']){
    const escaped=structuredClone(change);escaped.requirements.push({...brief.requirements.find(r=>r.id===id),text:'错误地更改未授权目标。'});
    assert.throws(()=>reviseProductionInput(brief,escaped),/requirements revision escaped allowed scope/);
  }
  for(const verdict of ['fail','uncertain','not_assessable']){
    const review=receipt(next.compiled);review.checks.find(c=>c.id==='body-check').verdict=verdict;
    const result=reviewProductionResult(next.compiled,review);
    assert.equal(result.checks.find(c=>c.id==='expression-check').verdict,'pass');
    assert.equal(result.status,verdict==='fail'?'needs_revision':'needs_review');
    assert.equal(result.user_accepted,false);
  }
});

test('authored sheet example keeps layout, view and proportion independently reviewable',()=>{
 const brief=JSON.parse(fs.readFileSync(new URL('../examples/character-sheet-layout-brief.json',import.meta.url),'utf8'));
 const c=compileProductionPrompt(brief);
 assert.deepEqual(c.reference_inputs,[]);
 assert.equal(c.evidence.image_generated,false);
 for(const channel of ['layout','composition','proportion']){
  const requirement=brief.requirements.find(r=>r.channel===channel);
  assert.ok(requirement);
  assert.ok(brief.sections.some(s=>s.channel===channel&&s.items.some(i=>i.basis.includes(requirement.id))));
  assert.ok(c.acceptance.some(a=>a.basis===requirement.id&&a.critical));
 }
 const bad=structuredClone(brief);bad.sections.find(s=>s.channel==='proportion').channel='layout';
 assert.throws(()=>compileProductionPrompt(bad),/own authored proportion clause/);
});

test('character briefs cannot omit, soften or detach the nine-head production contract',()=>{
  for(const mutate of [
    p=>{delete p.subject_kind;},
    p=>{p.subject_kind='guess';},
    p=>{p.requirements=p.requirements.filter(r=>r.id!=='P9');p.sections.pop();p.acceptance.pop();},
    p=>{delete p.requirements.at(-1).target_head_count;},
    p=>{p.requirements.at(-1).target_head_count=8;},
    p=>{p.requirements.at(-1).target_head_count='9';},
    p=>{p.requirements.at(-1).priority='prefer';},
    p=>{p.acceptance.at(-1).critical=false;},
    p=>{p.sections.pop();p.sections[0].items[0].basis.push('P9');},
    p=>{p.requirements.push({id:'alternate',channel:'proportion',priority:'prefer',target_head_count:8,text:'八头身。'});},
  ]) {const p=fixture();mutate(p);assert.throws(()=>compileProductionPrompt(p));}
  const compiled=compileProductionPrompt(fixture());
  assert.equal(compiled.subject_kind,'character');
  for(const verdict of ['fail','uncertain','not_assessable']){
    const r=receipt(compiled);r.checks.find(c=>c.id==='proportion').verdict=verdict;
    assert.equal(reviewProductionResult(compiled,r).status,verdict==='fail'?'needs_revision':'needs_review');
  }
});

test('non-character scopes do not receive anatomy prose and missing scope fails at the CLI',t=>{
  const scene=JSON.parse(fs.readFileSync(new URL('../examples/text-to-image-brief.json',import.meta.url),'utf8'));
  for(const subject_kind of ['scene','product','other']){
    const p={...scene,subject_kind};
    const compiled=compileProductionPrompt(p);
    assert.equal(compiled.subject_kind,subject_kind);
    assert.doesNotMatch(compiled.prompt,/九头身|target_head_count|subject_kind/);
  }
  const parent=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'production-scope-'));
  t.after(()=>{if(path.dirname(path.resolve(dir))!==parent)throw new Error('unsafe cleanup');fs.rmSync(dir,{recursive:true,force:true});});
  const p=fixture();delete p.subject_kind;
  const file=path.join(dir,'missing-scope.json');fs.writeFileSync(file,JSON.stringify(p));
  const r=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/iteration-director.mjs',import.meta.url)),'prompt-build','--input',file],{encoding:'utf8'});
  assert.equal(r.status,1);assert.equal(r.stdout,'');assert.match(r.stderr,/subject_kind/);
});

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
  for (const label of ['1. 人物', '２．人物'.normalize('NFKC'), '一、人物', '（一）人物', '(1) 人物', 'P0 人物']) {
    const numbered=fixture(); numbered.sections[0].label=label;
    assert.throws(()=>compileProductionPrompt(numbered),/unnumbered semantic section label/);
  }
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

test('declared identity authority cannot become observation-only through requirement-only prose',()=>{
  const p=fixture();
  p.references[0].generation_input=false;
  p.sections[0].items=[{text:'保持原身份。',basis:['U1'],intent:'constraint'}];
  // This previously produced a ready prompt with zero actual image inputs.
  assert.throws(()=>compileProductionPrompt(p),/identity reference R1 must be included/);
  p.references[0].generation_input=true;
  assert.deepEqual(compileProductionPrompt(p).reference_inputs,[{id:'R1',source:'test-reference.jpg'}]);
  // A wardrobe observation can still be text-only when it has no identity authority.
  p.references[0].authority=['costume'];
  p.references[0].generation_input=false;
  p.request='参考服装观察，为新设计的成年人物生成全身图。';
  p.requirements[0].text='新设计一个成年人物。';
  p.sections[0].items[0].text='新设计一个成年人物。';
  p.acceptance[0].question='新人物是否符合身份设计？';
  assert.deepEqual(compileProductionPrompt(p).reference_inputs,[]);
});

test('single identity references use the same role vocabulary as grouped references',()=>{
  for(const role of ['secondary','',null,false]){
    const p=fixture();p.references[0].identity_role=role;
    assert.throws(()=>compileProductionPrompt(p),/invalid identity_role/);
  }
  const p=fixture();p.references[0].identity_role='primary';p.references[0].identity_group='person-a';
  assert.doesNotThrow(()=>compileProductionPrompt(p));
  const support=structuredClone(p.references[0]);
  support.id='R2';support.source='second-view.jpg';support.identity_role='support';
  support.facts=[{id:'second-face',channel:'identity',visibility:'partial',text:'同一人物的侧面可见轮廓。'}];
  p.references.push(support);
  assert.equal(compileProductionPrompt(p).reference_inputs.length,2);
  support.generation_input=false;
  assert.throws(()=>compileProductionPrompt(p),/identity reference R2 must be included/);
});

test('scoped revisions reject unsupported input mutations instead of silently ignoring them',()=>{
  const p=fixture(),before=structuredClone(p);
  const change={request:'只调整服装描述。',channels:['costume'],sections:[{label:'服装',items:p.sections[1].items}]};
  for(const patch of [{references:[]},{target:{model:'unrequested'}},{subject_kind:'scene'},{sectons:[]}]){
    assert.throws(()=>reviseProductionInput(p,{...change,...patch}),/unsupported revision fields/);
    assert.deepEqual(p,before);
  }
  const revised=reviseProductionInput(p,change);
  assert.deepEqual(revised.input.references,p.references);
  assert.deepEqual(revised.input.sections[0],p.sections[0]);
  assert.equal(revised.target_changed,false);
  assert.deepEqual(p,before);
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
