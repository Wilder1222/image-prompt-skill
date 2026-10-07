import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileAssetPrompt, createAssetPlan } from '../scripts/asset-master.mjs';
const cli = fileURLToPath(new URL('../scripts/iteration-director.mjs', import.meta.url));
const run = args => spawnSync(process.execPath, [cli, 'asset-prompt', ...args], { encoding: 'utf8' });

test('mode selections survive as visible prose without a settings block in either language',()=>{
  const settings=/\b(?:render mode|style workflow|face mode|proportion mode|detail budget|highlight hierarchy|edge control)\s*[=:]|【(?:本轮模式|Mode settings)】/i;
  for(const language of ['zh-CN','en']) for(const styleWorkflow of ['material_realistic_asset','dark_fantasy_asset']){
    const r=compileAssetPrompt({language,styleWorkflow});
    assert.equal(r.configuration.style_workflow,styleWorkflow);
    assert.doesNotMatch(r.prompt,settings);
    assert.doesNotMatch(r.prompt,/\b(?:P9[ _]+Fashion|beauty_first|style_asset|material_priority|concept_art_priority|focal_brightness|soft_realistic|painterly_selective)\b/);
    if(language==='zh-CN'){
      assert.match(r.prompt,/必须采用黄金九头身/);
      assert.match(r.prompt,/视觉亮度焦点/);
      assert.match(r.prompt,styleWorkflow==='dark_fantasy_asset'?/柔和笔触与选择性虚实/:/轮廓服从柔和棚光和真实材质/);
    }
  }
});

test('CLI and library deliver the same ten categorized Chinese sections by default', () => {
  const r = run(['--format', 'text']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), compileAssetPrompt().prompt);
  assert.ok(r.stdout.trim().split('\n\n').every(x => /^【[^】]+】\n/.test(x)));
  for (const label of ['人物身份与面容','妆容与肌肤','发型与头饰','服装设计','材质与服装真实感','构图与姿态','身材比例','手部与脚部完整性','背景与灯光','最终目标']) assert.ok(r.stdout.includes(`【${label}】`), label);
  assert.doesNotMatch(r.stdout, /【\s*\d+[.、．]/);
  assert.doesNotMatch(r.stdout, /【P[012] |Create a|Preserve the/);
  const en = run(['--language', 'en', '--format', 'text']);
  assert.equal(en.status, 0, en.stderr);
  assert.equal(en.stdout.trim(), compileAssetPrompt({ language: 'en' }).prompt);
  assert.ok(en.stdout.trim().split('\n\n').every(x => /^【[^】]+】/.test(x)));
  assert.doesNotMatch(en.stdout, /【\s*\d+[.、．]/);
  assert.equal(run(['--language','fr']).status, 1);
});

test('mandatory nine-head proportions cannot be replaced by natural proportions in either presentation', () => {
  for (const presentation of ['neutral_asset', 'costume_showcase']) {
    assert.equal(createAssetPlan({ presentation }).configuration.proportion_profile, 'P9_FASHION_ASSET');
    const fashion = compileAssetPrompt({ presentation }).prompt;
    assert.match(fashion, /必须采用黄金九头身/);
    assert.match(fashion, /不要极端缩头、纸片腰/);
    assert.doesNotMatch(fashion, /七至七点五/);
    assert.throws(() => compileAssetPrompt({ presentation, proportionProfile: 'NATURAL_ADULT' }), /黄金九头身/);
    assert.equal(createAssetPlan({ presentation }).stage_2.fashion_asset.visual_head_count_target, '9.0');
  }
  assert.equal(run(['--proportion-profile','typo']).status, 1);
});

test('two workflows change visible instructions and defaults, not just a mode header', () => {
  const a = compileAssetPrompt(), b = compileAssetPrompt({ styleWorkflow: 'dark_fantasy_asset' });
  assert.equal(a.configuration.detail_budget, 'material_priority');
  assert.equal(a.configuration.edge_control, 'soft_realistic');
  assert.equal(b.configuration.detail_budget, 'concept_art_priority');
  assert.equal(b.configuration.edge_control, 'painterly_selective');
  assert.match(a.prompt, /全身图不强行显示毛孔/);
  assert.match(b.prompt, /不要通过毛孔强化/);
  assert.match(b.prompt, /最高细节集中/);
  assert.match(b.prompt, /次要裙边保留柔和笔触/);
  assert.doesNotMatch(createAssetPlan({ styleWorkflow: 'dark_fantasy_asset' }).order.join(' '), /photographic_polish/);
  assert.deepEqual(a.evidence, { image_generated: false, visual_quality_verified: false });
  const r = run(['--style-workflow','dark_fantasy_asset','--format','text']);
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout.trim(), b.prompt);
});

test('detail and edge adjustments compile visible changes while unrelated categories stay fixed', () => {
  const options = { detailBudget: 'concept_art_priority', edgeControl: 'painterly_selective' };
  const a = compileAssetPrompt(), b = compileAssetPrompt(options);
  const sections = r => Object.fromEntries(r.prompt.split('\n\n').map(s => [s.slice(0,s.indexOf('\n')), s]));
  assert.equal(sections(a)['【人物身份与面容】'], sections(b)['【人物身份与面容】']);
  assert.equal(sections(a)['【身材比例】'], sections(b)['【身材比例】']);
  assert.notEqual(sections(a)['【材质与服装真实感】'], sections(b)['【材质与服装真实感】']);
  assert.match(b.prompt, /柔和笔触与选择性虚实/);
  const r = run(['--detail-budget','concept_art_priority','--edge-control','painterly_selective']);
  assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).prompt, b.prompt);
  for (const [flag, key] of [['style-workflow','styleWorkflow'], ['detail-budget','detailBudget'], ['edge-control','edgeControl'], ['highlight-hierarchy','highlightHierarchy']]) {
    assert.throws(() => compileAssetPrompt({ [key]: 'typo' }), /unknown/);
    assert.equal(run([`--${flag}`, 'typo']).status, 1);
    assert.throws(() => compileAssetPrompt({ referenceMode: 'full_body_anchor', [key]: 'typo' }), /conflicting/);
  }
  assert.throws(() => compileAssetPrompt({ styleWorkflow: 'dark_fantasy_asset', faceProfile: 'humanized_real_full' }), /preserves a painted face/);
});

test('anchors and focused repairs preserve accepted scope in both languages and workflows', () => {
  for (const language of ['zh-CN','en']) {
    const anchor = compileAssetPrompt({ referenceMode: 'full_body_anchor', language });
    assert.equal(anchor.configuration.proportion_profile, 'P9_FASHION_ASSET');
    assert.doesNotMatch(anchor.prompt, /P9 Fashion|七至七点五/);
  }
  assert.throws(() => compileAssetPrompt({ referenceMode:'full_body_anchor', proportionProfile:'NATURAL_ADULT' }), /conflicting/);
  for (const styleWorkflow of ['material_realistic_asset', 'dark_fantasy_asset']) {
    const hand = compileAssetPrompt({ stage:'structure', focus:'hands', passed:['fashion_asset_proportion'], styleWorkflow });
    assert.match(hand.prompt, /仅修手部/); assert.doesNotMatch(hand.prompt, /黄金九头身|七至七点五/);
    assert.throws(() => compileAssetPrompt({ stage:'structure', focus:'proportion', passed:['fashion_asset_proportion'], styleWorkflow }), /reopen passed/);
    const mat = compileAssetPrompt({ stage:'material-light', focus:'materials', styleWorkflow });
    assert.match(mat.prompt, /灯位、背景和地面阴影保持/); assert.doesNotMatch(mat.prompt, /大面积柔和主光/);
  }
});
