import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {planFigureDesign,withFigureDesign,waistHipDefinition,assertBodyBaseline} from '../scripts/figure-design.mjs';
import {withCharacterGoals} from '../scripts/character-goals.mjs';
import {compileProductionPrompt,objectHash} from '../scripts/production-prompt.mjs';
import {freezeProductionRun,verifyFrozenRun} from '../scripts/production-run.mjs';
import {buildPortraitLookPlan} from '../scripts/portrait-look-plan.mjs';
import {bodySignature} from '../scripts/body-set-review.mjs';
import {figureExamples} from '../scripts/build-figure-examples.mjs';
import {compileAssetPrompt} from '../scripts/asset-master.mjs';
const blank=()=>({subject_kind:'character',request:'原创成年女性，身份稳定，完整全身。',references:[],unresolved:[],requirements:[],sections:[],acceptance:[]});
const make=options=>withCharacterGoals(blank(),{ageStage:'adult',characterType:'female',framing:'full_body',...options});
const freeze=input=>freezeProductionRun(input,{run_id:'waist-hip-test',case_id:'adult',cohort:'offline-contract'});
const plan=options=>planFigureDesign({age_stage:'adult',character_type:'female',framing:'full_body',...options});

test('adult female design emits 8.5 and 0.70 as circumference design targets in actual manual MJ output',()=>{
  const input=make();input.target={profile:'midjourney-8.2',surface:'web'};
  const c=compileProductionPrompt(input),r=input.requirements.find(r=>r.id==='FIG:body');
  assert.equal(r.target_waist_hip_ratio,.70);assert.equal(r.waist_hip_definition,waistHipDefinition);
  assert.match(c.model_execution.request.submission_text,/8\.5 头身[\s\S]*0\.70[\s\S]*腰围÷臀围/);
  assert.match(c.prompt,/纤细且有力量感[\s\S]*圆润上提[\s\S]*适度肌肉张力/);
  assert.match(c.prompt,/不是正面像素宽度比[\s\S]*不是唯一科学黄金比例/);
  assert.equal(c.audit.figure_design.circumference_measurement_verified,false);
  const frozen=freeze(input);assert.equal(frozen.figure_design_contract,'figure_design_v2');
  assert.equal(verifyFrozenRun(frozen).dispatch_ready,false);
});

test('explicit circumference values remain unchanged, with warnings instead of clamping or inversion',()=>{
  for(const value of [.66,.75,1.1]){
    const input=make({waistHipRatio:value});const c=compileProductionPrompt(input);
    assert.equal(input.figure_design.target_waist_hip_ratio,value);
    assert.ok(c.audit.figure_design.warnings.length);assert.doesNotMatch(c.prompt,/\d+\s*(?:厘米|cm)/);
  }
  for(const value of [0,-1,NaN,Infinity,'0.70'])assert.throws(()=>make({waistHipRatio:value}));
  for(const definition of ['hip_circumference/waist_circumference','frontal_pixel_width','waist_width/hip_width'])assert.throws(()=>make({waistHipDefinition:definition}),/腰围÷臀围/);
});

test('adult female ratio default is not assigned to minors, unknown ages or other character types',()=>{
  for(const age_stage of ['child','adolescent','infant','unspecified']){
    assert.equal(plan({age_stage}).contract.target_waist_hip_ratio,undefined);
    assert.throws(()=>plan({age_stage,target_waist_hip_ratio:.7}));
  }
  for(const character_type of ['male','other','unspecified']){
    assert.equal(plan({character_type}).contract.target_waist_hip_ratio,undefined);
    assert.doesNotMatch(plan({character_type}).body,/腰身纤细且有力量感|臀部圆润上提/);
    assert.throws(()=>plan({character_type,target_waist_hip_ratio:.7}));
    assert.equal(plan({character_type,target_waist_hip_ratio:.8,target_head_count:8,proportion_mode:'user',reason:'明确用户设定'}).contract.target_waist_hip_ratio,.8);
  }
});

test('body locks and explicit custom shape take precedence over automatic female curves',()=>{
  const locked=plan({proportion_mode:'reference_locked',reason:'用户锁定参考身体'});
  assert.equal(locked.contract.target_waist_hip_ratio,undefined);assert.doesNotMatch(locked.body,/0\.70/);
  assert.throws(()=>plan({proportion_mode:'reference_locked',reason:'锁定',target_waist_hip_ratio:.7}));
  const custom=plan({proportion_mode:'user',reason:'用户指定壮实体型',target_head_count:8,body_shape:'腰腹壮实，骨盆与躯干协调'});
  assert.equal(custom.contract.target_waist_hip_ratio,undefined);assert.match(custom.body,/腰腹壮实/);
});

test('portrait inherits a supplied full-body baseline without displaying or measuring its hidden numbers',()=>{
  const baseline=make().figure_design.body_baseline;
  const input=make({framing:'portrait',bodyBaseline:baseline});const c=compileProductionPrompt(input);
  assert.deepEqual(c.audit.figure_design.body_baseline,baseline);
  assert.equal(c.audit.figure_design.waist_hip_ratio_target,null);
  assert.match(c.prompt,/仅继承[\s\S]*不声称腰臀围可见或已验证/);
  assert.doesNotMatch(c.prompt,/8\.5|0\.70/);
  assert.throws(()=>make({framing:'portrait',waistHipRatio:.7}));
  assert.match(compileProductionPrompt(make({framing:'portrait'})).prompt,/未提供全身身体基准/);
});

test('shared baseline rejects scalar, age, type and custom-shape drift',()=>{
  const bodyBaseline=make().figure_design.body_baseline;
  for(const update of [{headCount:9},{waistHipRatio:.75},{ageStage:'older'},{characterType:'male'},
    {proportionMode:'user',proportionReason:'新增体型',headCount:8.5,bodyShape:'腰腹壮实'}])assert.throws(()=>make({bodyBaseline,...update}),/基准/);
  assert.throws(()=>assertBodyBaseline({...bodyBaseline,waist_hip_definition:'frontal_width'}));
  assert.throws(()=>make({bodyBaseline:{...bodyBaseline,waist_cm:60}}));
});

test('same-character look variants retain an identical body baseline and identity through hair, makeup and expression changes',()=>{
  const input=JSON.parse(fs.readFileSync(new URL('../examples/portrait-look-diversity-plan.json',import.meta.url),'utf8'));
  input.base_brief=withFigureDesign(input.base_brief,{age_stage:'adult',character_type:'female',framing:'portrait',body_baseline:make().figure_design.body_baseline,garments:[{id:'top',part:'上衣',fabric:'silk'}]});
  const report=buildPortraitLookPlan(input),base=input.base_brief.figure_design;
  assert.deepEqual(report.body_baseline,base.body_baseline);
  for(const v of report.variants){assert.deepEqual(v.brief.figure_design,base);assert.doesNotMatch(v.prompt,/0\.70|8\.5/);}
  input.looks[0].waist_hip_ratio=.75;assert.throws(()=>buildPortraitLookPlan(input),/unsupported look fields/);
});

test('conflicting pre-authored ratio targets are visible rather than overwritten',()=>{
  const input=withCharacterGoals(blank());input.requirements.push({id:'explicit',channel:'proportion',priority:'must',text:'用户指定腰臀围比0.75',target_waist_hip_ratio:.75,waist_hip_definition:waistHipDefinition});
  const before=structuredClone(input);
  assert.throws(()=>withFigureDesign(input,{age_stage:'adult',character_type:'female',framing:'full_body'}),/冲突/);
  assert.deepEqual(input,before);
});

test('contract metadata, must rows and frozen design version cannot independently drop or alter the ratio',()=>{
  for(const change of [x=>delete x.figure_design.target_waist_hip_ratio,x=>delete x.figure_design.body_baseline,x=>delete x.figure_design.waist_hip_definition,
    x=>x.requirements.find(r=>r.id==='FIG:body').target_waist_hip_ratio=.75]){
    const input=make();change(input);assert.throws(()=>compileProductionPrompt(input));
  }
  const frozen=freeze(make());delete frozen.target.figure_design.design_version;
  const {snapshot_sha256,...body}=frozen;frozen.snapshot_sha256=objectHash(body);assert.throws(()=>verifyFrozenRun(frozen),/contract/);
});

test('body set signatures include body baseline while permitting a different garment material',()=>{
  const {input}=figureExamples();const snapshot=freeze(input);const figureId=snapshot.target.body_plan.figures[0].id;const signature=bodySignature(snapshot,figureId);
  const changed=structuredClone(snapshot);changed.target.figure_design.target_waist_hip_ratio=.75;assert.notEqual(bodySignature(changed,figureId),signature);
  changed.target.figure_design=structuredClone(snapshot.target.figure_design);changed.target.figure_design.garments[0].fabric='wool';assert.equal(bodySignature(changed,figureId),signature);
  changed.target.figure_design.body_baseline.identity_id='someone-else';assert.notEqual(bodySignature(changed,figureId),signature);
});

test('legacy v1 authored briefs remain compilable and frozen without invented circumference or baseline',()=>{
  const input=withFigureDesign(withCharacterGoals(blank()),{design_version:1,age_stage:'adult',framing:'full_body'});
  const c=compileProductionPrompt(input);assert.doesNotMatch(c.prompt,/0\.70/);
  assert.equal(freeze(input).figure_design_contract,'figure_design_v1');
  assert.equal(c.audit.figure_design.body_baseline,null);
  verifyFrozenRun(freeze(input));
});

test('asset CLI and English output carry circumference target while local repairs and anchored bodies reject it',()=>{
  const result=compileAssetPrompt({ageStage:'adult',characterType:'female',waistHipRatio:.72,language:'en',fabric:'denim'});
  assert.match(result.prompt,/0\.72[\s\S]*waist circumference divided by hip circumference/);
  assert.match(result.prompt,/slender yet strong waist[\s\S]*rounded lifted hips/);
  assert.equal(result.evidence.image_generated,false);
  for(const options of [{stage:'face'},{referenceMode:'full_body_anchor'}])assert.throws(()=>compileAssetPrompt({...options,waistHipRatio:.7}));
  const run=spawnSync(process.execPath,['scripts/iteration-director.mjs','asset-prompt','--age-stage','adult','--character-type','female','--waist-hip-ratio','0.72','--fabric','denim','--format','json'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(run.stdout).figure_design.target_waist_hip_ratio,.72);
});
