import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {planFigureDesign,withFigureDesign} from '../scripts/figure-design.mjs';
import {withCharacterGoals} from '../scripts/character-goals.mjs';
import {compileProductionPrompt,objectHash,promptHash} from '../scripts/production-prompt.mjs';
import {freezeProductionRun,verifyFrozenRun} from '../scripts/production-run.mjs';
import {compileAssetPrompt} from '../scripts/asset-master.mjs';
const blank=()=>({subject_kind:'character',request:'原创人物，按本轮明确年龄与可见取景设计协调的身体与真实服装面料；仅设计文本，不生成图像。',references:[],unresolved:[],requirements:[],sections:[],acceptance:[]});
const garments=[{id:'coat',part:'外套',fabric:'denim'},{id:'top',part:'内搭',fabric:'knit'},{id:'scarf',part:'围巾',fabric:'silk'}];
const make=options=>withCharacterGoals(blank(),{ageStage:'adult',framing:'full_body',garments,...options});

test('adult full-body production emits a concrete 8.5-head target, waist, hips and distinct real fabrics',()=>{
  const authored=make(),compiled=compileProductionPrompt(authored);
  assert.equal(authored.figure_design.target_head_count,8.5);assert.equal(authored.requirements.find(r=>r.id==='FIG:body').target_head_count,8.5);
  assert.match(compiled.prompt,/8\.5 头身/);assert.match(compiled.prompt,/细腰自然收束/);assert.match(compiled.prompt,/臀部曲线自然饱满/);
  assert.match(compiled.prompt,/保持脸型与五官内部关系/);assert.doesNotMatch(compiled.prompt,/\d+\s*(?:厘米|cm)|精确实现|已测得/);
  for(const text of ['棉质牛仔布，中厚、较重','羊毛针织，中等厚度、中等重量','真丝素绉缎，薄、轻','较宽的折线','圆缓褶皱','细软流动褶皱'])assert.ok(compiled.prompt.includes(text),text);
  assert.equal(compiled.audit.figure_design.measurement_verified,false);
});

test('default endpoints 8 and 9 are valid; out-of-range, nonfinite and malformed values cannot silently clamp',()=>{
  for(const headCount of [8,8.5,9])assert.equal(make({headCount}).figure_design.target_head_count,headCount);
  for(const headCount of [7.5,9.5,NaN,Infinity,-1,0,'8.5'])assert.throws(()=>make({headCount}));
  assert.throws(()=>planFigureDesign({age_stage:'adult',framing:'full_body',proportion_mode:'user',reason:'用户选择'}),/需要具体数值/);
  assert.throws(()=>planFigureDesign({age_stgae:'adult'}),/unknown/);
});

test('explicit user proportions remain visible with override warnings and no invented default or measurements',()=>{
  const input=make({headCount:7.5,proportionMode:'user',proportionReason:'用户本轮明确要求 7.5 头身'}),compiled=compileProductionPrompt(input);
  assert.match(compiled.prompt,/7\.5 头身/);assert.doesNotMatch(compiled.prompt,/8\.5/);
  assert.match(compiled.audit.figure_design.warnings.join(),/超出.*8–9/);
  assert.throws(()=>make({headCount:7.5,proportionMode:'user'}),/需要明确用户来源/);
});

test('reference body locks never fabricate a ratio or introduce new waist and hip shaping',()=>{
  const input=make({proportionMode:'reference_locked',proportionReason:'用户明确锁定参考身体'});
  const output=compileProductionPrompt(input);
  assert.equal(input.figure_design.target_head_count,undefined);
  assert.match(output.prompt,/保持参考中当前可见的身体比例/);
  assert.doesNotMatch(output.prompt,/造型目标为 8\.5|臀部曲线自然饱满/);
  assert.match(output.audit.figure_design.warnings.join(),/8\.5 头身及成人曲线默认未应用/);
  assert.throws(()=>make({headCount:8.5,proportionMode:'reference_locked',proportionReason:'身体锁定'}),/冲突/);
});

test('pre-authored numeric targets cannot be overwritten by default construction',()=>{
  const authored=withCharacterGoals(blank());
  authored.requirements.push({id:'user-number',channel:'proportion',priority:'must',text:'本次明确为9头身。',target_head_count:9});
  const before=structuredClone(authored);
  assert.throws(()=>withFigureDesign(authored,{age_stage:'adult',framing:'full_body'}),/已有明确头身数值.*冲突/);
  assert.deepEqual(authored,before);
});

test('specified stocky body type is retained as an explicit alternative rather than receiving a thin waist',()=>{
  const output=compileProductionPrompt(make({headCount:8,proportionMode:'user',proportionReason:'用户指定矮壮力量体型与8头身',bodyShape:'保留矮壮力量体型与厚实腰背，骨盆和四肢有实在体积'}));
  assert.match(output.prompt,/保留矮壮力量体型与厚实腰背/);
  assert.doesNotMatch(output.prompt,/细腰自然收束，臀部曲线自然饱满/);
  assert.match(output.audit.figure_design.warnings.join(),/指定体型优先/);
});

test('portrait production stays within visible head-neck-shoulders without adult full-body numbers',()=>{
  const output=compileProductionPrompt(make({framing:'portrait'}));
  assert.doesNotMatch(output.prompt,/8\.5|臀部曲线自然饱满|细腰自然收束/);
  assert.match(output.prompt,/本画幅实际可见的头颈肩/);
  assert.equal(output.audit.figure_design.head_count_target,null);
  assert.throws(()=>make({framing:'portrait',headCount:8.5}),/肖像/);
});

test('minors and unknown ages keep natural proportions; older adults retain age-specific volume',()=>{
  for(const ageStage of ['infant','child','adolescent','unspecified']){
    const input=make({ageStage}),out=compileProductionPrompt(input);
    assert.equal(input.figure_design.target_head_count,undefined);
    assert.doesNotMatch(out.prompt,/8\.5|细腰自然收束|臀部曲线自然饱满/);
    assert.match(out.prompt,/自然|生长阶段/);
    assert.throws(()=>make({ageStage,headCount:8.5}),/未成年或年龄未知/);
  }
  const older=compileProductionPrompt(make({ageStage:'older'}));
  assert.match(older.prompt,/8\.5 头身/);assert.match(older.prompt,/保留年长者的骨架与软组织特征/);
});

test('clothing requires a concrete panel and supported real material, not generic realism or made-up dimensions',()=>{
  const input=withCharacterGoals(blank());input.sections.push({label:'衣装',channel:'costume',items:[{text:'外套',basis:['coat'],intent:'constraint'}]});
  assert.throws(()=>withFigureDesign(input,{age_stage:'adult',framing:'full_body'}),/必须具体选择面料/);
  for(const bad of [[{id:'a',part:'外套',fabric:'高级真实材质'}],[{id:'a',part:'',fabric:'denim'}],[garments[0],garments[0]],[{...garments[0],waist_cm:60}]])
    assert.throws(()=>planFigureDesign({garments:bad}),/服装须有唯一/);
});

test('text, numeric metadata, clothing and critical acceptance cannot be independently weakened',()=>{
  for(const tamper of [x=>delete x.figure_design,x=>x.figure_design.target_head_count=9,x=>x.figure_design.garments[0].fabric='silk',x=>x.sections.find(s=>s.label==='本轮明确身体造型').items[0].text='黄金比例完美身材',x=>x.acceptance.find(c=>c.basis==='FIG:fabric:coat').critical=false]){
    const x=make();tamper(x);assert.throws(()=>compileProductionPrompt(x),/figure|正文/);
  }
});

test('local repairs do not receive a new full-body target or material choice from construction defaults',()=>{
  const input=withCharacterGoals(blank());input.edit_scope={baseline_reference_id:'R',changes:['只修手指'],preserve:['身体比例与衣装']};
  assert.throws(()=>withFigureDesign(input,{age_stage:'adult',framing:'full_body'}),/cannot expand/);
  assert.throws(()=>compileAssetPrompt({stage:'material-light',fabric:'denim'}),/不能扩大局部编辑范围/);
  assert.throws(()=>compileAssetPrompt({referenceMode:'full_body_anchor',headCount:8.5}),/锁定.*冲突/);
  const local=compileAssetPrompt({stage:'structure',focus:'hands'});
  assert.doesNotMatch(local.prompt,/造型目标为 8\.5|臀部曲线自然饱满/);
});

test('asset generation emits adult numeric defaults; unknown age remains natural and explicit profile conflicts fail',()=>{
  const a=compileAssetPrompt({ageStage:'adult',fabric:'denim'});assert.equal(a.figure_design.target_head_count,8.5);assert.match(a.prompt,/8\.5 头身/);assert.match(a.prompt,/棉质牛仔布/);
  const unknown=compileAssetPrompt({maturityGuard:'none'});assert.equal(unknown.figure_design.age_stage,'unspecified');assert.doesNotMatch(unknown.prompt,/8\.5 头身/);assert.equal(unknown.fabric_design_required,true);
  const ordinary=compileAssetPrompt();assert.equal(ordinary.figure_design.age_stage,'unspecified');assert.doesNotMatch(ordinary.prompt,/8\.5 头身|18[–-]22/);
  const p9=compileAssetPrompt({ageStage:'adult',proportionProfile:'P9_FASHION_ASSET'});assert.equal(p9.figure_design.target_head_count,9);
  assert.throws(()=>compileAssetPrompt({proportionProfile:'P9_FASHION_ASSET',headCount:8.5}),/档案.*冲突/);
  assert.throws(()=>compileAssetPrompt({maturityGuard:'none',proportionProfile:'P9_FASHION_ASSET'}),/年龄未知/);
  assert.equal(compileAssetPrompt({ageStage:'child'}).figure_design.age_stage,'child');
  assert.throws(()=>compileAssetPrompt({ageStage:'child',maturityGuard:'youthful_18_22'}),/年龄声明.*冲突/);
});

test('freeze binds body and fabric goals; MJ keeps the same text and manual dispatch boundary',()=>{
  const input=make();input.target={profile:'midjourney-8.2',surface:'discord'};
  const frozen=freezeProductionRun(input,{run_id:'body-fabric',case_id:'adult',cohort:'offline-contract'}),inspected=verifyFrozenRun(frozen);
  assert.equal(frozen.target.figure_design.target_head_count,8.5);assert.equal(inspected.figure_design.measurement_verified,false);
  assert.equal(inspected.dispatch_ready,false);assert.equal(inspected.manual_submission_required,true);
  assert.match(inspected.request.submission_text,/8\.5 头身/);assert.match(inspected.request.submission_text,/棉质牛仔布/);
  const changed=structuredClone(frozen);changed.target.figure_design.target_head_count=9;changed.target_sha256=objectHash(changed.target);
  const {snapshot_sha256,...body}=changed;changed.snapshot_sha256=objectHash(body);
  assert.throws(()=>verifyFrozenRun(changed),/figure design/);
  const removed=structuredClone(frozen);delete removed.target.figure_design;
  assert.throws(()=>verifyFrozenRun(removed),/contract was removed/);
  assert.equal(frozen.model_execution.evidence.image_generated,false);
});

test('CLI passes explicit age, numeric target and fabric into the actual asset output',()=>{
  const tool=fileURLToPath(new URL('../scripts/iteration-director.mjs',import.meta.url));
  const run=more=>spawnSync(process.execPath,[tool,'asset-prompt','--age-stage','adult','--head-count','8.7','--fabric','silk',...more],{encoding:'utf8'});
  const r=run([]);assert.equal(r.status,0,r.stderr);const out=JSON.parse(r.stdout);
  assert.match(out.prompt,/8\.7 头身/);assert.match(out.prompt,/真丝素绉缎，薄、轻/);
  assert.equal(out.figure_design.target_head_count,8.7);
  assert.notEqual(run(['--head-count','8.5 --v 7']).status,0);
  assert.notEqual(run(['--head-count','7.5']).status,0);
});
