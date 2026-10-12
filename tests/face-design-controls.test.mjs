import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {applyFaceDesign,buildFaceDesign,faceControlCatalog,reviseFaceDesign} from '../scripts/face-design.mjs';
import {compileProductionPrompt} from '../scripts/production-prompt.mjs';
import {freezeProductionRun} from '../scripts/production-run.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const designed=value=>({value,origin:'design',reason:'依据本轮角色选择的定性设计；本测试不代表已生成或检查人物像素。'});

function flatFace(){
  return {id:'controls-face-v1',request:'原创人物文本设计，按本轮选择建立面容。',mode:'new_design',
    subject:{description:'原创成年人物的文本面容设计，等待实际图像验收',seed_scope:'custom'},
    traits:{face_shape:designed('柔和椭圆轮廓，颊颌衔接自然。'),eye_shape:designed('横向舒展的杏眼。'),chin:designed('圆钝而有适度宽度的下巴。')},
    expression:{gaze:'自然平静地看向镜头。',mouth_state:'双唇自然闭合。'},
    anchors:['face_shape','eye_shape','chin']};
}

function sideFace(){
  const face=flatFace();
  face.traits.eye_shape={sides:{left:designed('较修长的杏眼，外眼角平缓。'),right:designed('较圆的杏眼，外眼角柔和。')}};
  face.anchors=['face_shape','eye_shape:left','chin'];
  return face;
}

function baseBrief(){
  return {subject_kind:'character',request:'合成生产契约测试，肩部以上肖像，未知画外结构不声明通过。',references:[],unresolved:[],
    requirements:[{id:'visible-head-shoulder',channel:'proportion',priority:'must',text:'仅设计可见头颈肩的协调关系。'}],
    sections:[{label:'可见比例',channel:'proportion',items:[{text:'头颈肩协调自然，不推断画外身体。',basis:['visible-head-shoulder'],intent:'constraint'}]}],
    acceptance:[{id:'visible-head-shoulder-check',basis:'visible-head-shoulder',critical:true,question:'可见头颈肩是否协调？'}]};
}

function observedCase(t){
  const parent=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'face-controls-'));
  t.after(()=>{const relative=path.relative(parent,path.resolve(dir));if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('unsafe temporary cleanup');fs.rmSync(dir,{recursive:true,force:true});});
  const source=path.join(dir,'synthetic.png');
  fs.writeFileSync(source,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC1lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64'));
  const input=sideFace(),brief=baseBrief(),observed=(value,fact_id)=>({value,origin:'observed',reference_id:'R1',visibility:'visible',fact_id});
  input.mode='reference_match';input.reference_id='R1';
  input.traits.face_shape=observed('合成的椭圆轮廓观察。','face-fact');
  input.traits.chin=observed('合成的圆钝下巴观察。','chin-fact');
  input.traits.eye_shape={sides:{left:observed('合成的相同眼型文案。','left-eye-fact'),right:observed('合成的相同眼型文案。','right-eye-fact')}};
  brief.references=[{id:'R1',source,inspected:true,generation_input:true,identity_role:'primary',authority:['identity'],facts:[
    {id:'face-fact',channel:'identity',visibility:'visible',text:input.traits.face_shape.value},
    {id:'chin-fact',channel:'identity',visibility:'visible',text:input.traits.chin.value},
    {id:'left-eye-fact',channel:'identity',visibility:'visible',side:'left',text:input.traits.eye_shape.sides.left.value},
    {id:'right-eye-fact',channel:'identity',visibility:'visible',side:'right',text:input.traits.eye_shape.sides.right.value}]}];
  return {input,brief};
}

test('every registered control uses its declared layer and production channel without a fixed axis count',()=>{
  const catalog=faceControlCatalog(),baseline=flatFace(),baselineSignature=buildFaceDesign(baseline).identity_signature;
  assert.ok(catalog.groups.philtrum);assert.ok(catalog.groups.brows);assert.ok(catalog.dimensions.philtrum_length);
  assert.equal(catalog.native_3d_slider_precision,false);
  for(const [axis,dimension] of Object.entries(catalog.dimensions)){
    const input=structuredClone(baseline),value=`合成的${dimension.label}定性目标，按当前角色协调呈现。`;
    if(['structure','soft_tissue','surface_identity'].includes(dimension.layer))input.traits[axis]=designed(value);
    else if(dimension.layer==='expression')input.expression[axis]=value;
    else {assert.equal(dimension.layer,'presentation');input.presentation??={};input.presentation[axis]=value;}
    const face=buildFaceDesign(input),id=`FD:${input.id}:${axis}`;
    assert.equal(face.requirements.find(row=>row.id===id)?.channel,dimension.channel);
    assert.ok(face.acceptance.some(row=>row.basis===id&&row.critical));
    if(['expression','presentation'].includes(dimension.layer))assert.deepEqual(face.identity_signature,baselineSignature);
    assert.equal(compileProductionPrompt(applyFaceDesign(baseBrief(),input)).status,'prompt_ready');
  }
});

test('surface identity belongs to the signature while new expression and presentation axes stay mutable',()=>{
  const baseline=flatFace();baseline.traits.iris_color=designed('双眼虹膜为柔和深棕色。');
  const original=buildFaceDesign(baseline),next=reviseFaceDesign(baseline,{request:'仅调整表情和妆肤呈现。',
    allowed_changes:['brow_motion','jaw_motion','eyeliner','lip_makeup','hair_parting','lighting_softness'],
    expression:{brow_motion:'眉部轻微舒展。',jaw_motion:'下颌随说话自然轻降。'},
    presentation:{eyeliner:'细而克制的眼线。',lip_makeup:'低光泽暖玫瑰唇色。',hair_parting:'自然偏分。',lighting_softness:'宽大柔和主光。'}});
  assert.ok(original.identity_signature.traits.iris_color);
  assert.deepEqual(buildFaceDesign(next).identity_signature,original.identity_signature);
  assert.throws(()=>buildFaceDesign({...baseline,expression:{philtrum_length:'不应通过表情渠道重设人中。'}}),/unsupported expression fields/);
  assert.throws(()=>buildFaceDesign({...baseline,presentation:{skin_base_color:'不应通过妆面渠道改变身份肤色基底。'}}),/unsupported presentation fields/);
});

test('legacy flat design keeps its prior signature despite richer catalog metadata',()=>{
  const original=read('examples/face-design-original.json');
  assert.equal(buildFaceDesign(original).identity_signature.sha256,'a5e9da839155847a612f5402fec4942979c0144d309de9474fae7c04bfb51423');
});

test('bilateral controls have anatomical side prose, separate targets and side-sensitive signatures',()=>{
  const input=sideFace(),face=buildFaceDesign(input);
  assert.equal(face.resolved_traits['eye_shape:left'].side,'left');assert.equal(face.resolved_traits['eye_shape:right'].side,'right');
  assert.ok(!face.resolved_traits.eye_shape);assert.match(face.prompt,/人物自身左侧的眼睛形状/);assert.match(face.prompt,/人物自身右侧的眼睛形状/);
  const swapped=structuredClone(input);[swapped.traits.eye_shape.sides.left,swapped.traits.eye_shape.sides.right]=[swapped.traits.eye_shape.sides.right,swapped.traits.eye_shape.sides.left];
  assert.notEqual(buildFaceDesign(swapped).identity_signature.sha256,face.identity_signature.sha256);
  for(const selector of ['eye_shape:left','eye_shape:right'])assert.ok(face.acceptance.some(row=>row.basis===`FD:${input.id}:${selector}`&&row.critical));
});

test('wrappers cannot mix flat values, invent sides or bilateralize a midline dimension',()=>{
  for(const patch of [{value:'不允许混合整体值。',sides:{left:designed('左侧。')}},{sides:{front:designed('错误的侧别。')}},{sides:{}}]){
    const input=sideFace();input.traits.eye_shape=patch;assert.throws(()=>buildFaceDesign(input));
  }
  const midline=flatFace();midline.traits.philtrum_length={sides:{left:designed('不应有左右人中长度。')}};
  assert.throws(()=>buildFaceDesign(midline),/does not support bilateral sides/);
  const malformed=sideFace();malformed.anchors=['face_shape','eye_shape:viewer_left','chin'];assert.throws(()=>buildFaceDesign(malformed),/unsupported face selector/);
});

test('a left-side edit keeps right-side traits, chin, subject and all other design declarations',()=>{
  const baseline=sideFace(),before=structuredClone(baseline),left=designed('左眼横向稍舒展，仍保持柔和眼角。');
  const change={request:'获准仅重新设计左眼形状。',allowed_changes:['eye_shape:left'],traits:{eye_shape:{sides:{left}}},identity_change:true,new_id:'controls-face-v2'};
  const next=reviseFaceDesign(baseline,change);
  assert.deepEqual(next.traits.eye_shape.sides.right,baseline.traits.eye_shape.sides.right);
  assert.deepEqual(next.traits.chin,baseline.traits.chin);assert.deepEqual(next.subject,baseline.subject);assert.deepEqual(baseline,before);
  assert.notEqual(buildFaceDesign(next).identity_signature.sha256,buildFaceDesign(baseline).identity_signature.sha256);
  assert.throws(()=>reviseFaceDesign(baseline,{...change,traits:{eye_shape:{sides:{right:designed('不应修改的右眼。')}}}}),/escaped allowed_changes/);
  assert.throws(()=>reviseFaceDesign(baseline,{...change,traits:{chin:designed('不应修改的下巴。')}}),/escaped allowed_changes/);
  assert.throws(()=>reviseFaceDesign(flatFace(),change),/whole-axis allowed_changes/);
});

test('whole-axis authorization can explicitly revise both sides without automatic mirroring',()=>{
  const baseline=sideFace(),left=designed('左眼稍修长。'),right=designed('右眼更圆润。');
  const next=reviseFaceDesign(baseline,{request:'获准分别设计双侧眼形。',allowed_changes:['eye_shape'],traits:{eye_shape:{sides:{left,right}}},identity_change:true,new_id:'controls-both-v2'});
  assert.deepEqual(next.traits.eye_shape.sides,{left,right});assert.notEqual(left.value,right.value);
});

test('an explicitly authorized flat anchor can migrate to a sided anchor during a structural revision',()=>{
  const baseline=flatFace(),before=structuredClone(baseline),left=designed('左眼稍修长，内外眼角自然衔接。'),right=designed('右眼保持较圆的舒展形状。');
  const change={request:'获准将整体眼形设定细化为分别设计的双侧，明确迁移眼形锚点。',allowed_changes:['eye_shape'],
    traits:{eye_shape:{sides:{left,right}}},anchors:['face_shape','eye_shape:left','chin'],identity_change:true,new_id:'controls-flat-to-sided-v2'};
  const next=reviseFaceDesign(baseline,change),face=buildFaceDesign(next);
  assert.deepEqual(next.anchors,change.anchors);assert.deepEqual(next.traits.eye_shape.sides,{left,right});
  assert.deepEqual(next.traits.face_shape,baseline.traits.face_shape);assert.deepEqual(next.traits.chin,baseline.traits.chin);
  assert.deepEqual(next.subject,baseline.subject);assert.deepEqual(next.expression,baseline.expression);assert.deepEqual(baseline,before);
  assert.ok(face.identity_signature.traits['eye_shape:left']);assert.ok(!face.identity_signature.traits.eye_shape);
  assert.equal(compileProductionPrompt(applyFaceDesign(baseBrief(),next)).status,'prompt_ready');
  assert.throws(()=>reviseFaceDesign(baseline,{...change,identity_change:false}),/identity structure changes require/);
  assert.throws(()=>reviseFaceDesign(baseline,{...change,new_id:baseline.id}),/different new_id/);
});

test('anchor migration cannot escape whole-axis authorization or fabricate a structural change',()=>{
  const baseline=sideFace();baseline.traits.nose_tip=designed('自然圆润的鼻尖。');
  const left=designed('获准调整的左眼稍修长。');
  const change={request:'只重新设计左眼，明确迁移其锚点。',allowed_changes:['eye_shape'],traits:{eye_shape:{sides:{left}}},
    anchors:['face_shape','eye_shape:right','chin'],identity_change:true,new_id:'controls-anchor-v2'};
  assert.throws(()=>reviseFaceDesign(baseline,{...change,allowed_changes:['eye_shape:left']}),/anchor migration escaped whole-axis/);
  assert.throws(()=>reviseFaceDesign(baseline,{...change,anchors:['face_shape','eye_shape:right','nose_tip']}),/anchor migration escaped whole-axis.*chin|anchor migration escaped whole-axis.*nose_tip/);
  const metadataOnly={...change,traits:{eye_shape:{sides:{left:{...baseline.traits.eye_shape.sides.left,reason:'仅改设计依据，结构值相同。'}}}}};
  assert.throws(()=>reviseFaceDesign(baseline,metadataOnly),/anchor migration requires an actual identity structure change/);
  assert.throws(()=>reviseFaceDesign(baseline,{...change,anchors:['face_shape','eye_shape:right','eye_shape:right']}),/unique identity anchors/);
});

test('philtrum structure changes require a new identity version and do not auto-adjust neighboring axes',()=>{
  const baseline=flatFace();baseline.traits.philtrum_length=designed('人中长度均衡，与鼻基底及上唇自然衔接。');baseline.traits.lip_shape=designed('唇峰平缓。');
  const change={request:'仅把人中设计得稍短。',allowed_changes:['philtrum_length'],traits:{philtrum_length:designed('人中略短，保留自然上唇连接。')}};
  assert.throws(()=>reviseFaceDesign(baseline,change),/identity structure changes require/);
  const next=reviseFaceDesign(baseline,{...change,identity_change:true,new_id:'controls-philtrum-v2'});
  assert.deepEqual(next.traits.lip_shape,baseline.traits.lip_shape);assert.deepEqual(next.traits.chin,baseline.traits.chin);
  const first=freezeProductionRun(applyFaceDesign(baseBrief(),baseline),{run_id:'first',case_id:'philtrum',cohort:'synthetic'});
  const second=freezeProductionRun(applyFaceDesign(baseBrief(),next),{run_id:'next',case_id:'philtrum',cohort:'synthetic',kind:'revision',parent:first});
  assert.equal(second.goal_changed,true);
});

test('side observations bind explicit unique facts even when left and right have identical prose',t=>{
  const {input,brief}=observedCase(t),applied=applyFaceDesign(brief,input),items=applied.sections.find(row=>row.channel==='identity').items;
  assert.ok(items.find(row=>row.basis.includes(`FD:${input.id}:eye_shape:left`)).basis.includes('left-eye-fact'));
  assert.ok(items.find(row=>row.basis.includes(`FD:${input.id}:eye_shape:right`)).basis.includes('right-eye-fact'));
  const missing=structuredClone(input);delete missing.traits.eye_shape.sides.left.fact_id;assert.throws(()=>buildFaceDesign(missing),/explicit fact_id/);
  const duplicate=structuredClone(input),noSideFacts=structuredClone(brief);duplicate.traits.eye_shape.sides.right.fact_id='left-eye-fact';
  for(const fact of noSideFacts.references[0].facts)delete fact.side;
  assert.throws(()=>applyFaceDesign(noSideFacts,duplicate),/cannot reuse the same fact_id/);
  const swapped=structuredClone(input);swapped.traits.eye_shape.sides.left.fact_id='right-eye-fact';assert.throws(()=>applyFaceDesign(brief,swapped),/conflicts with its fact side/);
});

test('a flat observed anchor cannot promote a one-sided fact to an overall feature',t=>{
  const {input,brief}=observedCase(t);
  input.traits.eye_shape=structuredClone(input.traits.eye_shape.sides.left);
  input.anchors=['face_shape','eye_shape','chin'];
  assert.doesNotThrow(()=>buildFaceDesign(input));
  assert.throws(()=>applyFaceDesign(brief,input),/flat observed trait eye_shape cannot use a one-sided fact/);
  const compatible=structuredClone(brief);
  compatible.references[0].facts.push({id:'legacy-overall-eye-fact',channel:'identity',visibility:'visible',text:input.traits.eye_shape.value});
  input.traits.eye_shape.fact_id='legacy-overall-eye-fact';
  assert.equal(compileProductionPrompt(applyFaceDesign(compatible,input)).status,'prompt_ready');
});

test('unknown or partially visible far-side traits cannot be promoted to strict identity anchors',t=>{
  const {input,brief}=observedCase(t),right=input.traits.eye_shape.sides.right,fact=brief.references[0].facts.find(row=>row.id===right.fact_id);
  right.value='合成的不可见远侧眼型，仅记录未知。';right.visibility='unknown';fact.text=right.value;fact.visibility='unknown';
  const face=buildFaceDesign(input);assert.ok(face.resolved_traits['eye_shape:right']);assert.ok(!face.identity_signature.traits['eye_shape:right']);assert.ok(!face.prompt.includes(right.value));
  assert.equal(compileProductionPrompt(applyFaceDesign(brief,input)).status,'prompt_ready');
  assert.throws(()=>buildFaceDesign({...input,anchors:['face_shape','chin','eye_shape:right']}),/partial and unknown are not strict anchors/);
  const inflated=structuredClone(input);inflated.traits.eye_shape.sides.right.visibility='visible';assert.throws(()=>applyFaceDesign(brief,inflated),/fact id, text and visibility/);
});

test('registered numeric assignments and slider setting strings cannot enter prompts while human unit descriptions remain usable',()=>{
  for(const value of ['eye_spacing=0.8','philtrum_length:0.45','slider_eye_height=55','EyeHeightSlider: 0.5','滑杆眼高设置为0.6',
    '"eye_spacing":0.8','eye_spacing="0.8"','eye_shape:left=0.4','philtrum_length=0.4;philtrum_length=0.8',
    'eye_shape : left = 0.4','eye_shape . right 设置为0.5','eye_spacing设为0.8','eye_spacing设置为0.8','eye_spacing为0.8']){
    const input=flatFace();input.traits.eye_shape=designed(value);assert.throws(()=>buildFaceDesign(input),/numeric axis or slider controls/);
  }
  const human=flatFace();human.traits.philtrum_length=designed('本轮明确人中可见长度约12毫米；眼距约为单眼宽度的1.1倍，仍以实际图像验收。');
  assert.match(buildFaceDesign(human).prompt,/12毫米/);
  assert.throws(()=>buildFaceDesign({...flatFace(),game_face_code:'unsupported native-game-code'}),/unsupported face design fields/);
});

test('JSON round trips preserve sided declarations and rebuilt records cannot inject a different side',()=>{
  const input=sideFace(),roundTrip=JSON.parse(JSON.stringify(input)),face=buildFaceDesign(input),built=JSON.parse(JSON.stringify(face));
  assert.deepEqual(buildFaceDesign(roundTrip).identity_signature,face.identity_signature);
  built.resolved_traits['eye_shape:left'].value='不应进入生产的篡改值。';built.resolved_traits['eye_shape:left'].side='right';
  assert.deepEqual(applyFaceDesign(baseBrief(),built),applyFaceDesign(baseBrief(),input));
});

test('catalog command exposes real grouped metadata and explicitly reports qualitative rather than native slider controls',()=>{
  const output=spawnSync(process.execPath,[path.join(root,'scripts/face-design.mjs'),'catalog','--group','philtrum'],{cwd:root,encoding:'utf8'});
  assert.equal(output.status,0,output.stderr);const data=JSON.parse(output.stdout);
  assert.deepEqual(Object.keys(data.groups),['philtrum']);assert.ok(Object.values(data.dimensions).every(row=>row.group==='philtrum'));
  assert.equal(data.control_kind,'qualitative_design_axes');assert.equal(data.native_3d_slider_precision,false);
  assert.throws(()=>faceControlCatalog('unregistered-group'),/unknown face control group/);
});
