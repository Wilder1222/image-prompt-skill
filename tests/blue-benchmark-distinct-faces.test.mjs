import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildFaceDesign,applyFaceDesign,reviseFaceDesign} from '../scripts/face-design.mjs';
import {compileProductionPrompt} from '../scripts/production-prompt.mjs';
import {freezeProductionRun,verifyFrozenRun} from '../scripts/production-run.mjs';
import {currentBlueBenchmarkDistinctFacesExamples} from '../scripts/build-examples.mjs';

// Declared structures and revision permissions are executable contracts. These
// tests cannot tell whether actual portraits are beautiful or visually distinct.
const read = name => JSON.parse(fs.readFileSync(new URL('../examples/'+name,import.meta.url),'utf8'));
const set = read('blue-benchmark-distinct-faces-set.json');
const faces = set.cases.map(row => read(row.file));
const base = () => read(set.portrait_base);
const groups = {
  outline:['face_shape','face_length','cheekbone','jaw','chin'],
  eyes:['eye_shape','eye_aperture','eyelid','eye_tail'],
  nose_lips:['nose_bridge','nose_tip','nose_wing','lip_shape','lip_balance'],
};
const freeze = (brief,id,extra={}) => freezeProductionRun(brief,{
  run_id:id,case_id:'distinct-faces-text-contract',cohort:'authored-text-design',...extra,
});
const identityRequirements = brief => brief.requirements.filter(row=>row.channel==='identity');

test('independent adult face structures differ across outline, eyes and nose/lips while presentation is shared',()=>{
  assert.equal(faces.length,3);
  const built=faces.map(buildFaceDesign);
  for(let n=0;n<faces.length;n++) {
    const face=faces[n];
    assert.equal(face.mode,'new_design');
    assert.equal(face.preset,undefined);
    assert.equal(face.subject.seed_scope,'custom');
    assert.deepEqual(face.expression,faces[0].expression);
    assert.deepEqual(face.presentation,faces[0].presentation);
    assert.ok(Object.values(face.traits).every(trait=>trait.origin==='design'));
    assert.ok(Object.values(groups).every(axes=>axes.some(axis=>face.anchors.includes(axis))));
    assert.ok(face.anchors.includes('cheek_volume'));
    assert.equal(built[n].subject.description,face.subject.description);
  }
  // Compare geometry alone; differing names, ages and ids cannot satisfy this check.
  for(let left=0;left<built.length;left++)for(let right=left+1;right<built.length;right++) {
    const a=built[left].identity_signature.traits,b=built[right].identity_signature.traits;
    for(const [group,axes]of Object.entries(groups)) {
      const differences=axes.filter(axis=>a[axis]!==b[axis]);
      assert.ok(differences.length>=2,`${left}/${right}: ${group} needs multiple independent declared differences`);
    }
    assert.notEqual(a.cheek_volume,b.cheek_volume);
  }
});

test('each face anchor survives build, apply, compile and frozen critical acceptance',()=>{
  for(const input of faces) {
    const before=structuredClone(input),briefBefore=base(),face=buildFaceDesign(input);
    const applied=applyFaceDesign(briefBefore,face),compiled=compileProductionPrompt(applied);
    const snapshot=freeze(applied,input.id);
    assert.deepEqual(input,before);
    assert.deepEqual(briefBefore,base());
    assert.deepEqual(applied.metadata,base().metadata);
    assert.deepEqual(applied.requirements.filter(row=>row.channel==='proportion'),base().requirements.filter(row=>row.channel==='proportion'));
    for(const axis of input.anchors) {
      const id=`FD:${input.id}:${axis}`,value=face.identity_signature.traits[axis];
      const requirement=face.requirements.find(row=>row.id===id);
      assert.equal(requirement.channel,'identity');
      assert.equal(requirement.priority,'must');
      assert.ok(compiled.prompt.includes(value));
      assert.ok(applied.sections.some(section=>section.channel==='identity'&&section.items.some(item=>item.basis.includes(id)&&item.text.includes(value))));
      assert.deepEqual(snapshot.target.requirements.find(row=>row.id===id),requirement);
      assert.ok(snapshot.target.acceptance.some(row=>row.basis===id&&row.critical===true&&row.question.includes(value)));
    }
    for(const axis of ['makeup','skin_finish','gaze','mouth_state']) {
      const id=`FD:${input.id}:${axis}`;
      assert.ok(snapshot.target.acceptance.some(row=>row.basis===id&&row.critical===true));
    }
    assert.equal(verifyFrozenRun(snapshot).prompt,snapshot.prompt);
    assert.equal(compiled.evidence.image_generated,false);
    assert.equal(compiled.evidence.visual_quality_verified,false);
    assert.equal(face.visual_quality_verified,false);
    assert.deepEqual(compiled.reference_inputs,[]);
  }
});

test('makeup/skin and expression revisions preserve each identity and its frozen structural checks',()=>{
  const changes=[
    read(set.presentation_change),
    {request:'仅将妆肤亮度稍收敛，保留原有结构与年龄。',allowed_changes:['makeup','skin_finish'],presentation:{
      makeup:'薄底妆贴肤，眉睫唇缘完整，唇色改为更淡的玫瑰色，妆面沿原有五官完成。',
      skin_finish:'额鼻小面积肤光稍收敛，面颊柔和受光，保持本人年龄纹理与软组织体积。',
    }},
    {request:'仅改为看向镜头右侧并轻轻微笑。',allowed_changes:['gaze','mouth_state'],expression:{
      gaze:'目光看向镜头右侧，双眼对焦一致，眼睑自然放松。',
      mouth_state:'双唇轻合，唇角轻微上提，面颊只有自然少量反应。',
    }},
  ];
  for(const input of faces) {
    const original=buildFaceDesign(input),initialBrief=applyFaceDesign(base(),original);
    const parent=freeze(initialBrief,input.id);
    for(let n=0;n<changes.length;n++) {
      const revised=reviseFaceDesign(input,changes[n]),face=buildFaceDesign(revised);
      assert.equal(revised.id,input.id);
      assert.deepEqual(revised.subject,input.subject);
      assert.deepEqual(revised.traits,input.traits);
      assert.deepEqual(revised.anchors,input.anchors);
      assert.deepEqual(face.identity_signature,original.identity_signature);
      const applied=applyFaceDesign(base(),face),snapshot=freeze(applied,`${input.id}-presentation-${n}`,{kind:'revision',parent});
      assert.notEqual(compileProductionPrompt(applied).prompt,compileProductionPrompt(initialBrief).prompt);
      assert.deepEqual(identityRequirements(applied),identityRequirements(initialBrief));
      const ids=new Set(identityRequirements(initialBrief).map(row=>row.id));
      assert.deepEqual(snapshot.target.acceptance.filter(row=>ids.has(row.basis)),parent.target.acceptance.filter(row=>ids.has(row.basis)));
      assert.equal(snapshot.goal_changed,true,'visible presentation goals changed even while identity remains stable');
      verifyFrozenRun(snapshot);
    }
  }
  const sharedRevisions=faces.map(face=>reviseFaceDesign(face,read(set.presentation_change)));
  for(const revised of sharedRevisions) {
    assert.deepEqual(revised.expression,sharedRevisions[0].expression);
    for(const axis of ['makeup','skin_finish'])assert.equal(revised.presentation[axis],sharedRevisions[0].presentation[axis]);
  }
});

test('the shared refinement changes an existing character presentation without replacing age, preset geometry or unrelated fields',()=>{
  const original=read('face-design-original.json'),before=structuredClone(original);
  const prior=buildFaceDesign(original),revised=reviseFaceDesign(original,read(set.presentation_change));
  assert.deepEqual(original,before);
  assert.deepEqual(buildFaceDesign(revised).identity_signature,prior.identity_signature);
  for(const key of ['id','subject','preset','traits','anchors'])assert.deepEqual(revised[key],original[key],key);
  assert.equal(revised.presentation.lighting,original.presentation.lighting);
  assert.equal(revised.presentation.hair,original.presentation.hair);
  const applied=applyFaceDesign(read('face-design-portrait-base.json'),revised);
  assert.ok(compileProductionPrompt(applied).prompt.includes(original.subject.description));
  for(const [axis,trait]of Object.entries(prior.resolved_traits)) {
    assert.ok(applied.requirements.some(row=>row.id===`FD:${original.id}:${axis}`&&row.text.includes(trait.value)));
  }
  // A mature character keeps its authored age and gender under the same skin-only operation.
  const senior=read('face-design-senior-custom.json');
  const seniorRevised=reviseFaceDesign(senior,{request:'仅调整柔亮肤光，保持本人的年龄与结构。',allowed_changes:['skin_finish'],presentation:{skin_finish:faces[0].presentation.skin_finish}});
  assert.deepEqual(seniorRevised.subject,senior.subject);
  assert.deepEqual(buildFaceDesign(seniorRevised).identity_signature,buildFaceDesign(senior).identity_signature);
});

test('common presentation cannot overwrite another face or authorize an unrequested structural change',()=>{
  for(let n=0;n<faces.length;n++) {
    const original=faces[n],other=faces[(n+1)%faces.length];
    const applied=applyFaceDesign(base(),original),before=structuredClone(applied);
    assert.throws(()=>applyFaceDesign(applied,other));
    assert.deepEqual(applied,before);
    const traitChange={request:'以其他人物的下颌替换当前结构。',allowed_changes:['makeup'],traits:{jaw:other.traits.jaw}};
    assert.throws(()=>reviseFaceDesign(original,traitChange));
    const structural={...traitChange,allowed_changes:['jaw']};
    assert.throws(()=>reviseFaceDesign(original,structural));
    const authorized=reviseFaceDesign(original,{...structural,identity_change:true,new_id:original.id+'-new-jaw'});
    assert.notEqual(buildFaceDesign(authorized).identity_signature.sha256,buildFaceDesign(original).identity_signature.sha256);
    assert.deepEqual(authorized.subject,original.subject);
    for(const axis of original.anchors.filter(axis=>axis!=='jaw'))assert.deepEqual(authorized.traits[axis],original.traits[axis]);
  }
});

test('aesthetic provenance and generated example output cannot establish observed identity or visual acceptance',()=>{
  assert.equal(set.kind,'authored_text_design_exercise');
  assert.equal(set.aesthetic_source.identity_transfer,false);
  assert.equal(set.aesthetic_source.costume_or_hair_transfer,false);
  for(const evidence of [set.evidence,base().metadata]) {
    assert.equal(evidence.new_images_generated,false);
    assert.equal(evidence.individual_user_acceptance,'not_established');
    assert.equal(evidence.visual_distinctness_verified,false);
    assert.equal(evidence.cross_model_evidence,'none');
  }
  const attempted=structuredClone(faces[0]);
  attempted.mode='reference_match';attempted.reference_id='blue-aesthetic-benchmark';
  assert.throws(()=>buildFaceDesign(attempted),'aesthetic source cannot turn designed anchors into observed reference identity');
  const markdown=currentBlueBenchmarkDistinctFacesExamples();
  for(const face of faces) {
    const prompt=compileProductionPrompt(applyFaceDesign(base(),face)).prompt;
    assert.ok(markdown.includes(prompt),'generated prose must contain the actual complete compiled prompt');
  }
});
