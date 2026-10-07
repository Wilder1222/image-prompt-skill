import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {compileAssetPrompt, createAssetPlan} from '../scripts/asset-master.mjs';
import {compileProductionPrompt} from '../scripts/production-prompt.mjs';
import {inspectText} from '../scripts/audit-language.mjs';

const catalog = JSON.parse(fs.readFileSync(new URL('../resources/asset_style_workflows.json', import.meta.url), 'utf8'));
const profiles = Object.entries(catalog.profiles).filter(([, value]) => value.appearance);
const sections = prompt => Object.fromEntries(prompt.split('\n\n').map(s => {const m=s.match(/^【([^】]+)】\n([\s\S]*)$/); return m ? [m[1],m[2]] : ['',s];}));

test('all character media preserve identity scope and mandatory anatomy while changing each rendering channel', () => {
  assert.equal(profiles.length, 9);
  const anatomy = compileAssetPrompt().prompt.split('【身材比例】\n')[1].split('\n\n')[0];
  const fields=['人物身份与面容','妆容与肌肤','发型与头饰','材质与服装真实感','背景与灯光','最终目标'];
  const seen = Object.fromEntries(fields.map(f=>[f,new Set()]));
  for (const [styleWorkflow, profile] of profiles) {
    const plan=createAssetPlan({styleWorkflow});
    assert.equal(plan.configuration.proportion_profile,'P9_FASHION_ASSET');
    assert.equal(plan.stage_2.fashion_asset.visual_head_count_target,'9.0');
    assert.equal(plan.configuration.maturity_guard,'none');
    assert.deepEqual(inspectText('plan.json',JSON.stringify(plan)),[]);
    const result=compileAssetPrompt({styleWorkflow});
    const parts=sections(result.prompt);
    assert.equal(parts['身材比例'],anatomy);
    assert.equal(result.evidence.visual_quality_verified,false);
    for (const field of fields) {assert.ok(parts[field],field);seen[field].add(parts[field]);}
    assert.doesNotMatch(result.prompt,/东方幻想概念原画审美|以本次参考图中的人物.*古风/);
    if (profile.family !== 'photographic') assert.ok(!plan.order.includes('final_photographic_polish'));
    assert.throws(()=>compileAssetPrompt({styleWorkflow,proportionProfile:'NATURAL_ADULT'}),/黄金九头身/);
  }
  for (const field of fields) assert.equal(seen[field].size,9,field);
});

test('all media compile in both languages for generation and every scoped edit without leaking identifiers',()=>{
  for (const [styleWorkflow] of profiles) for (const language of ['zh-CN','en']) {
    for(const edit of [{},{stage:'face'},{stage:'structure',focus:'hands'},{stage:'structure',focus:'proportion'},{stage:'material-light',focus:'materials'},{stage:'material-light',focus:'lighting'}]) {
      const r=compileAssetPrompt({styleWorkflow,language,...edit});
      assert.ok(r.prompt.length>100);
      assert.ok(!r.prompt.includes(styleWorkflow));
      assert.doesNotMatch(r.prompt,/undefined|\[object Object\]/);
      if(language==='en')assert.doesNotMatch(r.prompt,/[\u3400-\u9fff]/);
      if(edit.stage)assert.match(r.prompt,language==='en'?/local repair changes only/:/局部修复只改变指定区域/);
    }
  }
});

test('2D medium replaces photographic skin hair material and edge requirements instead of appending a label',()=>{
  const r=compileAssetPrompt({styleWorkflow:'anime_2d_character'});
  const parts=sections(r.prompt);
  assert.match(parts['妆容与肌肤'],/皮肤平涂/);
  assert.match(parts['发型与头饰'],/分组线条/);
  assert.match(parts['背景与灯光'],/轮廓线粗细受控/);
  assert.doesNotMatch(r.prompt,/轮廓服从柔和棚光和真实材质|底妆细腻贴肤|角膜反光|真丝、织锦、纱|每寸表面照片化/);
  for(const options of [{faceProfile:'humanized_real_full'},{edgeControl:'soft_realistic'},{detailBudget:'material_priority'},{highlightHierarchy:'focal_brightness'}]) {
    assert.throws(()=>compileAssetPrompt({styleWorkflow:'anime_2d_character',...options}),/conflicts/);
  }
});

test('style selection respects explicit age and does not restyle a preservation anchor',()=>{
  for(const language of ['zh-CN','en']) {
    const r=compileAssetPrompt({styleWorkflow:'stylized_3d_character',maturityGuard:'youthful_18_22',language});
    assert.match(r.prompt, /18–22|18.22/);
  }
  for(const [styleWorkflow] of profiles)assert.throws(()=>compileAssetPrompt({styleWorkflow,referenceMode:'full_body_anchor'}),/conflicting/);
});

test('a focused material repair does not repeat whole-image skin or lighting conversion',()=>{
  for(const [styleWorkflow] of profiles){
    const r=compileAssetPrompt({styleWorkflow,stage:'material-light',focus:'materials'});
    const p=sections(r.prompt);
    assert.ok(p['既有材料']);assert.ok(!p['妆容与肌肤']);assert.ok(!p['棚拍光线']);
    assert.match(r.prompt,/灯位、背景和地面阴影保持/);
    const hands=compileAssetPrompt({styleWorkflow,stage:'structure',focus:'hands'});
    assert.ok(!sections(hands.prompt)['身材比例']);
    assert.match(hands.prompt,/只修可见手指/);
  }
});

test('CG face repair keeps the current medium instead of inheriting generation conversion instructions',()=>{
  const styleWorkflow='cinematic_cg_character';
  const plan=createAssetPlan({styleWorkflow});
  assert.doesNotMatch(plan.stage_1.prompt_skeleton.join('\n'),/按新媒介重建/);
  for(const language of ['zh-CN','en']){
    const generation=compileAssetPrompt({styleWorkflow,language});
    const conversion=language==='en'?/rebuilding surfaces for the new medium/:/按新媒介重建/;
    assert.match(generation.prompt,conversion);
    for(const edit of [{stage:'face'},{stage:'structure',focus:'hands'},{stage:'material-light',focus:'materials'},{stage:'material-light',focus:'lighting'}]){
      const repair=compileAssetPrompt({styleWorkflow,language,...edit});
      assert.doesNotMatch(repair.prompt,conversion);
      assert.match(repair.prompt,language==='en'?/Retain the current image medium/:/保留当前图像媒介/);
      assert.equal(repair.status,'scaffold_only');
    }
    const face=compileAssetPrompt({styleWorkflow,stage:'face',language});
    assert.match(face.prompt,language==='en'?/continuous refined facial surfaces/:/连续精细曲面/);
    assert.match(face.prompt,language==='en'?/subsurface skin transmission/:/次表面透光/);
    assert.deepEqual(face.round_plan.editable,plan.stage_1.round_plan.editable);
    assert.throws(()=>compileAssetPrompt({styleWorkflow,stage:'face',language,passed:['asset_master_face_refine']}),/reopen passed/);
  }
});

test('new style CLI output matches the library and production delivery rejects internal style handles',()=>{
  const styleWorkflow='cinematic_cg_character';
  const r=spawnSync(process.execPath,[new URL('../scripts/iteration-director.mjs',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),'asset-prompt','--style-workflow',styleWorkflow,'--format','text'],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),compileAssetPrompt({styleWorkflow}).prompt);
  const brief=JSON.parse(fs.readFileSync(new URL('../examples/character-asset-front-brief.json',import.meta.url),'utf8'));
  for(const [id] of profiles){
    const copy=structuredClone(brief);copy.sections[0].items[0].text+=' '+id;
    assert.throws(()=>compileProductionPrompt(copy),/replace internal style identifiers/);
  }
  assert.equal(compileProductionPrompt(brief).status,'prompt_ready');
});
