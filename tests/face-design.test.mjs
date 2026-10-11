import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildFaceDesign,reviseFaceDesign,applyFaceDesign} from '../scripts/face-design.mjs';
import {compileProductionPrompt} from '../scripts/production-prompt.mjs';
import {freezeProductionRun,verifyFrozenRun} from '../scripts/production-run.mjs';

// These fixtures check declared design and evidence contracts. No fixture is a
// generated portrait or evidence that a face will look good in an actual image.
const designed=value=>({value,origin:'design',reason:'合成角色选择，用于行为验证。'});
const catalog=JSON.parse(fs.readFileSync(new URL('../resources/face_design_catalog.json',import.meta.url),'utf8'));
function customFace(overrides={}) {
  return {
    id:'senior-fixture-v1',request:'设计一位64岁男性木匠的方阔面容，使用水彩插画。',mode:'new_design',
    subject:{description:'64岁男性木匠，方阔面容，以水彩插画表现',seed_scope:'custom'},
    traits:{
      face_shape:designed('额部与下颌宽度相近的方阔脸型。'),
      eye_shape:designed('眼型横向舒展，上眼睑自然覆盖。'),
      chin:designed('下巴较宽，末端圆钝。'),
      jaw:designed('下颌转折清楚，保留自然软组织。'),
    },
    anchors:['face_shape','eye_shape','chin'],
    ...overrides,
  };
}
function productionBrief() {
  return {
    subject_kind:'character',request:'按独立面容设计绘制一张角色肖像。',references:[],unresolved:[],
    requirements:[
      {id:'body-ratio',channel:'proportion',priority:'must',text:'保留角色自己的头颈肩比例，颈部不过度拉长。'},
      {id:'frame',channel:'composition',priority:'must',text:'单人肩部以上肖像，脸部与发型完整入画。'},
      {id:'medium',channel:'style',priority:'must',text:'水彩插画，以透明色层表现面部体积。'},
    ],
    sections:[
      {label:'可见比例',channel:'proportion',items:[{text:'保留角色自己的头颈肩比例，颈部不过度拉长。',intent:'constraint',basis:['body-ratio']}]},
      {label:'肖像构图',channel:'composition',items:[{text:'单人肩部以上肖像，脸部与发型完整入画。',intent:'constraint',basis:['frame']}]},
      {label:'水彩表现',channel:'style',items:[{text:'水彩插画，以透明色层表现面部体积。',intent:'constraint',basis:['medium']}]},
    ],
    acceptance:[
      {id:'ratio-check',basis:'body-ratio',critical:true,question:'可见头颈肩是否保持角色自己的比例？'},
      {id:'frame-check',basis:'frame',critical:true,question:'是否单人肖像且脸部与发型完整？'},
      {id:'medium-check',basis:'medium',critical:true,question:'透明水彩色层与体积是否成立？'},
    ],
    target:{profile:'host',settings:{}},
    metadata:{fixture:'Synthetic behavior checks; no visual approval.'},
  };
}
const visibleFactValues={
  face_shape:'合成身份观察：脸部轮廓较方阔。',
  eye_shape:'合成身份观察：横向舒展的眼型。',
  chin:'合成身份观察：宽而圆钝的下巴。',
};
function observedFace() {
  return customFace({
    id:'observed-fixture-v1',request:'保留合成身份参考中的面容结构。',mode:'reference_match',reference_id:'R1',
    traits:Object.fromEntries(Object.entries(visibleFactValues).map(([axis,value])=>[axis,{value,origin:'observed',reference_id:'R1',visibility:'visible'}])),
  });
}
function observedBrief(t) {
  const parent=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'face-design-behavior-'));
  t.after(()=>{if(path.dirname(path.resolve(dir))!==parent)throw new Error('unsafe fixture cleanup');fs.rmSync(dir,{recursive:true,force:true});});
  const ref=path.join(dir,'synthetic-reference.png');
  fs.writeFileSync(ref,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64'));
  const brief=productionBrief();
  brief.references=[{id:'R1',source:ref,inspected:true,generation_input:true,authority:['identity'],
    facts:Object.entries(visibleFactValues).map(([axis,text])=>({id:'fact-'+axis,channel:'identity',visibility:'visible',text}))}];
  return brief;
}
const freeze=(input,extra={})=>freezeProductionRun(input,{run_id:'face-base',case_id:'face-fixture',cohort:'synthetic-behavior',...extra});

test('all ten seeds become traceable production constraints without replacing the authored subject',()=>{
  const signatures=new Set();
  for(let n=1;n<=10;n++) {
    const input={id:'seed-fixture-'+n,request:'设计一位成年女性的水彩面容，使用所选面容种子。',mode:'new_design',
      subject:{description:'一位26岁成年女性，以透明水彩色层表现面容',seed_scope:'young_adult_female_reference_group'},
      preset:'FD'+String(n).padStart(2,'0'),traits:{}};
    input.anchors=catalog.presets[input.preset].distinctive_axes.slice(0,3);
    const before=structuredClone(input),face=buildFaceDesign(input),brief=applyFaceDesign(productionBrief(),face),compiled=compileProductionPrompt(brief);
    assert.deepEqual(input,before);assert.deepEqual(face.subject,input.subject);
    assert.ok(compiled.prompt.includes(input.subject.description));
    assert.equal(face.visual_quality_verified,false);assert.equal(compiled.evidence.image_generated,false);
    assert.equal(compiled.evidence.visual_quality_verified,false);
    assert.equal(face.provenance.source.evidence_kind,'analysis_import');
    assert.equal(face.provenance.source.images_reviewed_this_run,false);
    assert.ok(face.requirements.length>=3);
    for(const requirement of face.requirements) {
      assert.equal(requirement.priority,'must');
      assert.ok(face.acceptance.some(check=>check.basis===requirement.id&&check.critical===true));
    }
    signatures.add(JSON.stringify(face.identity_signature.traits));
  }
  assert.equal(signatures.size,10,'each seed must retain its own authored structural choices');
});

test('custom senior and chibi faces retain their own age, gender, medium and omitted dimensions',()=>{
  const faces=[customFace(),customFace({id:'chibi-fixture-v1',request:'设计一位Q版男性机器人角色的几何面容，使用平面矢量风格。',
    subject:{description:'Q版男性机器人，几何面容，以平面矢量风格表现',seed_scope:'custom'},
    traits:{face_shape:designed('面部外轮廓为横向圆角方形。'),eye_shape:designed('双眼为短横向圆角灯片。'),chin:designed('下巴为宽而平的几何边缘。')}})];
  for(const input of faces) {
    const face=buildFaceDesign(input);
    assert.deepEqual(face.subject,input.subject);
    assert.ok(face.prompt.includes(input.subject.description));
    for(const trait of Object.values(input.traits))assert.ok(face.prompt.includes(trait.value));
    assert.doesNotMatch(face.prompt,/18[_至~～-]22|年轻女性|少女|18岁|22岁/);
    const omitted=face.resolved_traits.nose_tip;
    assert.ok(!omitted?.value,'an omitted nose must stay undecided');
    assert.ok(!face.identity_signature.traits.nose_tip,'undecided dimensions do not become identity targets');
  }
});

test('cross-type seed application requires an explicit adaptation reason',()=>{
  const input=customFace({preset:'FD01'});
  assert.throws(()=>buildFaceDesign(input));
  input.preset_application_reason='只采用轮廓关系，按64岁男性木匠与水彩媒介重新解释。';
  const face=buildFaceDesign(input);
  assert.deepEqual(face.subject,input.subject);
  for(const [axis,trait]of Object.entries(input.traits))assert.equal(face.resolved_traits[axis].value,trait.value);
});

test('gaze, mouth, makeup, skin, light and hair revisions preserve the identity signature',()=>{
  const baseline=customFace(),before=structuredClone(baseline),base=buildFaceDesign(baseline);
  const revised=reviseFaceDesign(baseline,{request:'同一人物改变表情与面部表现。',
    allowed_changes:['gaze','mouth_state','makeup','skin_finish','lighting','hair'],
    expression:{gaze:'目光转向画面左侧，眼睑自然放松。',mouth_state:'双唇轻合，嘴角略微上扬。'},
    presentation:{makeup:'薄而自然的肤色修饰。',skin_finish:'水彩保留64岁人物的年龄纹理。',lighting:'柔和侧光，保留面部体积。',hair:'灰白短发向后梳理。'}});
  const face=buildFaceDesign(revised);
  assert.deepEqual(baseline,before);assert.equal(revised.id,baseline.id);
  assert.deepEqual(face.identity_signature,base.identity_signature);
  assert.notEqual(face.prompt,base.prompt);
  assert.deepEqual(revised.traits,baseline.traits);assert.deepEqual(revised.anchors,baseline.anchors);
});

test('same effective preset expression and presentation values cannot create a revision',()=>{
  const preset=catalog.presets.FD01;
  const baseline={
    id:'seed-noop-fixture-v1',request:'设计一位成年女性的原创水彩面容。',mode:'new_design',
    subject:{description:'成年女性，水彩肖像',seed_scope:preset.scope},
    preset:'FD01',traits:{},anchors:preset.distinctive_axes.slice(0,3),
    presentation:{skin_finish:'细腻柔亮肌肤，保留当前人物的面部体积。'},
  };
  const before=structuredClone(baseline),face=buildFaceDesign(baseline);
  for(const [group,axis,value]of [
    ['expression','mouth_state',preset.expression.mouth_state],
    ['expression','gaze',preset.expression.gaze],
    ['presentation','skin_finish',baseline.presentation.skin_finish],
  ]) {
    for(const candidate of [value,' '+value+' ']) {
      assert.throws(()=>reviseFaceDesign(baseline,{request:'保持相同的生效表现。',allowed_changes:[axis],
        [group]:{[axis]:candidate}}),/face revision needs an actual change/);
    }
  }
  const revised=reviseFaceDesign(baseline,{request:'仅改为自然微笑。',allowed_changes:['mouth_state'],
    expression:{mouth_state:'双唇轻合，嘴角略微上扬，面颊自然响应。'}});
  assert.deepEqual(baseline,before);
  assert.equal(revised.id,baseline.id);
  assert.deepEqual(buildFaceDesign(revised).identity_signature,face.identity_signature);
  assert.notEqual(buildFaceDesign(revised).prompt,face.prompt);
});

test('identity signatures bind the authored subject while local revisions cannot replace that subject',()=>{
  const baseline=customFace(),base=buildFaceDesign(baseline);
  const changed=customFace({subject:{description:'70岁女性雕刻师，方阔面容，以油画表现',seed_scope:'custom'}});
  assert.notEqual(buildFaceDesign(changed).identity_signature.sha256,base.identity_signature.sha256);
  assert.throws(()=>reviseFaceDesign(baseline,{request:'修改眼神时同时替换年龄与角色。',allowed_changes:['gaze'],
    expression:{gaze:'注视画面左侧。'},subject:changed.subject}));
});

test('revision scope rejects unlisted expression, presentation and structural changes',()=>{
  const baseline=customFace();
  const changes=[
    {allowed_changes:['gaze'],expression:{mouth_state:'双唇张开。'}},
    {allowed_changes:['makeup'],presentation:{lighting:'改成硬侧光。'}},
    {allowed_changes:['gaze'],traits:{chin:designed('尖而窄的下巴。')},identity_change:true,new_id:'other-v2'},
    {allowed_changes:['invented_axis'],expression:{gaze:'看向左侧。'}},
  ];
  for(const change of changes)assert.throws(()=>reviseFaceDesign(baseline,{request:'合成局部修改。',...change}));
});

test('structural revision creates a new identity only with explicit permission and a different id',()=>{
  const baseline=customFace(),before=structuredClone(baseline),change={request:'将下巴改成略窄的圆钝形。',allowed_changes:['chin'],traits:{chin:designed('下巴略窄，末端仍圆钝。')}};
  for(const extra of [{},{identity_change:true},{new_id:'senior-fixture-v2'},{identity_change:true,new_id:baseline.id}])
    assert.throws(()=>reviseFaceDesign(baseline,{...change,...extra}));
  const revised=reviseFaceDesign(baseline,{...change,identity_change:true,new_id:'senior-fixture-v2'});
  assert.deepEqual(baseline,before);assert.equal(revised.id,'senior-fixture-v2');
  assert.notEqual(buildFaceDesign(revised).identity_signature.sha256,buildFaceDesign(baseline).identity_signature.sha256);
  assert.equal(revised.traits.face_shape.value,baseline.traits.face_shape.value);
  assert.throws(()=>reviseFaceDesign(baseline,{request:'仅改眼神。',allowed_changes:['gaze'],expression:{gaze:'目光看向左侧。'},identity_change:true,new_id:'unearned-identity'}));
});

test('unknown dimensions and insufficient or partial identity anchors fail closed',()=>{
  const input=customFace();
  assert.throws(()=>buildFaceDesign({...input,traits:{...input.traits,unregistered_geometry:designed('合成未注册结构。')}}));
  assert.throws(()=>buildFaceDesign({...input,anchors:['face_shape','chin']}));
  assert.throws(()=>buildFaceDesign({...input,anchors:['face_shape','eye_shape','unregistered_geometry']}));
  const observed=observedFace();
  for(const visibility of ['partial','unknown','not_visible']) {
    const bad=structuredClone(observed);bad.traits.chin.visibility=visibility;
    assert.throws(()=>buildFaceDesign(bad),visibility+' cannot become a strict identity anchor');
  }
});

test('unknown and invisible observations remain audit data and never become retained prompt clauses',()=>{
  for(const visibility of ['unknown','not_visible']) {
    const input=observedFace(),value='合成未知下颌记录'+visibility+'。';
    input.traits.jaw={value,origin:'observed',reference_id:'R1',visibility};
    const face=buildFaceDesign(input);
    assert.equal(face.resolved_traits.jaw.visibility,visibility);
    assert.ok(!face.prompt.includes(value));
    assert.ok(!JSON.stringify(face.requirements).includes(value));
    assert.ok(!JSON.stringify(face.sections).includes(value));
    assert.ok(!face.identity_signature.traits.jaw);
  }
});

test('internal controls are rejected in visible facial traits and presentation prose',()=>{
  for(const value of ['face_mode=beauty_first','BALANCED_ELEGANT','style_workflow=anime_3d_character','【待填内容】']) {
    const input=customFace();input.traits.chin=designed(value);
    assert.throws(()=>buildFaceDesign(input));
    const skin=customFace({presentation:{skin_finish:value}});
    assert.throws(()=>buildFaceDesign(skin));
  }
});

test('reference matching requires an inspected actual identity input and exact identity facts',t=>{
  const input=observedFace(),brief=observedBrief(t),before=structuredClone(brief),applied=applyFaceDesign(brief,input),compiled=compileProductionPrompt(applied);
  assert.deepEqual(brief,before);
  assert.deepEqual(compiled.reference_inputs.map(ref=>ref.id),['R1']);
  for(const [axis,value]of Object.entries(visibleFactValues)) {
    const items=applied.sections.filter(section=>section.channel==='identity').flatMap(section=>section.items);
    assert.ok(items.some(item=>item.text.includes(value)&&item.basis.includes('fact-'+axis)&&item.intent==='retain'));
  }
  assert.equal(buildFaceDesign(input).visual_quality_verified,false);
  for(const patch of [{inspected:false},{generation_input:false},{authority:['costume']}]) {
    const bad=structuredClone(brief);Object.assign(bad.references[0],patch);
    assert.throws(()=>applyFaceDesign(bad,input));
  }
  assert.throws(()=>applyFaceDesign(productionBrief(),input));
  const mismatch=structuredClone(input);mismatch.traits.chin.value='原参考没有提供的另一种下巴。';
  assert.throws(()=>applyFaceDesign(brief,mismatch));
  const costumeFact=structuredClone(brief);costumeFact.references[0].facts.find(f=>f.id==='fact-chin').channel='costume';
  assert.throws(()=>applyFaceDesign(costumeFact,input));
});

test('reference identity anchors cannot be invented from design extensions or an analysis seed',()=>{
  const designedAnchors=customFace({mode:'reference_match',reference_id:'R1'});
  assert.throws(()=>buildFaceDesign(designedAnchors));
  const mixed=observedFace();mixed.traits.chin=designed(visibleFactValues.chin);
  assert.throws(()=>buildFaceDesign(mixed));
  const seeded=observedFace();seeded.preset='FD01';
  assert.throws(()=>buildFaceDesign(seeded));
  const absentReference=observedFace();delete absentReference.reference_id;
  assert.throws(()=>buildFaceDesign(absentReference));
});

test('reference-based local structure edits create a new design while retaining the other observed identity facts',t=>{
  const baseline=observedFace(),brief=observedBrief(t),observedNose='合成身份观察：鼻尖小而收敛。';
  baseline.traits.nose_tip={value:observedNose,origin:'observed',reference_id:'R1',visibility:'visible'};
  baseline.anchors.push('nose_tip');
  brief.references[0].facts.push({id:'fact-nose-tip',channel:'identity',visibility:'visible',text:observedNose});
  const before=structuredClone(baseline),originalFace=buildFaceDesign(baseline);
  const nose=designed('鼻尖略宽而圆润，与鼻翼自然连接。');
  const change={request:'授权仅重新设计鼻尖，其余已观察面容与角色设定保持。',allowed_changes:['nose_tip'],traits:{nose_tip:nose}};
  for(const extra of [{},{identity_change:true},{new_id:'observed-fixture-v2'},{identity_change:true,new_id:baseline.id}])
    assert.throws(()=>reviseFaceDesign(baseline,{...change,...extra}));
  const revised=reviseFaceDesign(baseline,{...change,identity_change:true,new_id:'observed-fixture-v2'});
  const face=buildFaceDesign(revised),applied=applyFaceDesign(brief,face);
  assert.deepEqual(baseline,before);
  assert.equal(revised.mode,'new_design');assert.equal(revised.id,'observed-fixture-v2');
  assert.deepEqual(revised.anchors,baseline.anchors);
  assert.notEqual(face.identity_signature.sha256,originalFace.identity_signature.sha256);
  assert.deepEqual(revised.traits.nose_tip,nose);
  const identityItems=applied.sections.filter(section=>section.channel==='identity').flatMap(section=>section.items);
  const noseItem=identityItems.find(item=>item.basis.includes('FD:'+revised.id+':nose_tip'));
  assert.equal(noseItem.intent,'design');assert.equal(noseItem.reason,nose.reason);
  assert.ok(noseItem.text.includes(nose.value));assert.ok(!noseItem.basis.includes('fact-nose-tip'));
  for(const [axis,value]of Object.entries(visibleFactValues)) {
    assert.deepEqual(revised.traits[axis],baseline.traits[axis]);
    assert.ok(identityItems.some(item=>item.text.includes(value)&&item.intent==='retain'&&item.basis.includes('fact-'+axis)));
  }
  const originalRun=freeze(applyFaceDesign(brief,baseline));
  const changedRun=freeze(applied,{run_id:'reference-face-change',kind:'revision',parent:originalRun});
  assert.equal(changedRun.goal_changed,true);assert.notEqual(changedRun.target_sha256,originalRun.target_sha256);
  const expressionOnly=reviseFaceDesign(baseline,{request:'同一参考人物只改变眼神。',allowed_changes:['gaze'],expression:{gaze:'目光看向画面左侧，眼睑自然放松。'}});
  assert.equal(expressionOnly.mode,'reference_match');
  assert.deepEqual(buildFaceDesign(expressionOnly).identity_signature,originalFace.identity_signature);
});

test('a partial observed feature may be described but cannot silently acquire complete visibility',t=>{
  const input=observedFace(),brief=observedBrief(t),value='合成侧面观察：下颌转折仅局部可见。';
  input.traits.jaw={value,origin:'observed',reference_id:'R1',visibility:'partial'};
  brief.references[0].facts.push({id:'fact-jaw',channel:'identity',visibility:'partial',text:value});
  const face=buildFaceDesign(input),applied=applyFaceDesign(brief,face);
  assert.equal(face.resolved_traits.jaw.visibility,'partial');
  assert.ok(applied.sections.flatMap(section=>section.items).some(item=>item.text.includes(value)&&item.basis.includes('fact-jaw')));
  const inflated=structuredClone(input);inflated.traits.jaw.visibility='visible';
  assert.throws(()=>applyFaceDesign(brief,inflated));
});

test('applying a face preserves authored proportion, target and all unrelated production fields',()=>{
  const brief=productionBrief(),before=structuredClone(brief),face=customFace(),applied=applyFaceDesign(brief,face);
  assert.deepEqual(brief,before);
  for(const key of ['subject_kind','request','references','unresolved','target','metadata'])assert.deepEqual(applied[key],before[key],key);
  assert.deepEqual(applied.requirements.filter(row=>before.requirements.some(prior=>prior.id===row.id)),before.requirements);
  assert.deepEqual(applied.sections.filter(row=>row.channel!=='identity'&&row.channel!=='expression'&&row.channel!=='makeup'&&row.channel!=='hair'&&row.channel!=='lighting'),before.sections);
  assert.deepEqual(applied.acceptance.filter(row=>before.acceptance.some(prior=>prior.id===row.id)),before.acceptance);
  assert.ok(!applied.requirements.find(row=>row.id==='body-ratio').target_head_count);
  const compiled=compileProductionPrompt(applied);
  assert.equal(compiled.model_execution.profile,'host');
  assert.equal(compiled.evidence.visual_quality_verified,false);
});

test('a new face does not overwrite an existing authored identity section',()=>{
  const brief=productionBrief();
  brief.requirements.push({id:'existing-person',channel:'identity',priority:'must',text:'原有身份设计。'});
  brief.sections.push({label:'已有面容',channel:'identity',items:[{text:'原有身份设计。',basis:['existing-person'],intent:'constraint'}]});
  brief.acceptance.push({id:'existing-check',basis:'existing-person',critical:true,question:'原有身份是否保持？'});
  const before=structuredClone(brief);
  assert.throws(()=>applyFaceDesign(brief,customFace()));
  assert.deepEqual(brief,before);
});

test('derived face records are rebuilt before application so tampering cannot inject new constraints',()=>{
  const face=customFace(),built=buildFaceDesign(face),sentinel='合成篡改值：一张不同人物的脸。';
  const expected=applyFaceDesign(productionBrief(),face);
  built.sections[0].items[1].text=sentinel;
  built.requirements[1].text=sentinel;
  built.acceptance[1].question=sentinel;
  built.acceptance[1].critical=false;
  built.resolved_traits.chin.value=sentinel;
  built.identity_signature.sha256='0'.repeat(64);
  built.prompt=sentinel;
  const applied=applyFaceDesign(productionBrief(),built);
  assert.deepEqual(applied,expected);
  assert.ok(!compileProductionPrompt(applied).prompt.includes(sentinel));
});

test('authored original and smile examples preserve the portrait proportion scope and face identity',()=>{
  const read=name=>JSON.parse(fs.readFileSync(new URL('../examples/'+name,import.meta.url),'utf8'));
  const base=read('face-design-portrait-base.json'),original=read('face-design-original.json'),change=read('face-design-expression-change.json');
  const initial=buildFaceDesign(original),revised=buildFaceDesign(reviseFaceDesign(original,change));
  assert.deepEqual(revised.identity_signature,initial.identity_signature);
  for(const face of [initial,revised]) {
    const applied=applyFaceDesign(base,face),compiled=compileProductionPrompt(applied);
    assert.deepEqual(applied.requirements.filter(row=>row.channel==='proportion'),base.requirements.filter(row=>row.channel==='proportion'));
    assert.deepEqual(applied.sections.filter(row=>row.channel==='proportion'),base.sections.filter(row=>row.channel==='proportion'));
    assert.ok(!applied.requirements.some(row=>row.target_head_count!==undefined));
    assert.doesNotMatch(compiled.prompt,/黄金九头身|人体直立高度为九个/);
    assert.equal(face.visual_quality_verified,false);assert.equal(compiled.evidence.visual_quality_verified,false);
  }
  const senior=buildFaceDesign(read('face-design-senior-custom.json'));
  assert.ok(senior.prompt.includes(senior.subject.description));
  assert.equal(senior.provenance.preset,null);
  assert.doesNotMatch(senior.prompt,/年轻女性|少女|18[_至~～-]22/);
});

test('facial musts and critical checks reach the frozen target and structural changes change its hash',()=>{
  const baseline=customFace(),face=buildFaceDesign(baseline),applied=applyFaceDesign(productionBrief(),face),snapshot=freeze(applied);
  for(const row of face.requirements) {
    assert.deepEqual(snapshot.target.requirements.find(requirement=>requirement.id===row.id),row);
    assert.ok(snapshot.target.acceptance.some(check=>check.basis===row.id&&check.critical===true));
  }
  assert.equal(compileProductionPrompt(applied).evidence.visual_quality_verified,false);
  assert.equal(verifyFrozenRun(snapshot).request.prompt,snapshot.prompt);
  const revised=reviseFaceDesign(baseline,{request:'重新设计下巴。',allowed_changes:['chin'],traits:{chin:designed('较窄而微向前伸的圆钝下巴。')},identity_change:true,new_id:'senior-fixture-v2'});
  const child=freeze(applyFaceDesign(productionBrief(),revised),{run_id:'face-revision',kind:'revision',parent:snapshot});
  assert.notEqual(child.target_sha256,snapshot.target_sha256);assert.equal(child.goal_changed,true);
  const saved=structuredClone(snapshot);applied.requirements.at(-1).text='冻结后的原稿修改。';
  assert.deepEqual(snapshot,saved);verifyFrozenRun(snapshot);
});
