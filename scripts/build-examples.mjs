import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileAssetPrompt, createAssetPlan } from './asset-master.mjs';
import { applyFaceDesign, reviseFaceDesign } from './face-design.mjs';
import { compileProductionPrompt } from './production-prompt.mjs';
import { buildPortraitLookPlan, renderPortraitLookPrompts } from './portrait-look-plan.mjs';

export function currentExamples() {
  const cases = [
    ['A：角色感优先的全身白底生成', {}],
    ['东方幻想原画资产：保留厚涂面容与选择性边缘', { styleWorkflow: 'dark_fantasy_asset', maturityGuard: 'none' }],
    ['B：轻度真人感；其余条件与 A 相同', { faceProfile: 'humanized_real_light' }],
    ['服装定妆展示：有层次的长袍与袖摆', { presentation: 'costume_showcase', maturityGuard: 'none' }],
    ['适度优化服装与造型：保留人物辨识度，按方案再设计', { presentation: 'costume_showcase', maturityGuard: 'none', designFreedom: 'moderate' }],
    ['已有全身参考：保留身份、造型与已认可体型比例', { referenceMode: 'full_body_anchor' }],
    ['只修手部，锁定已通过的比例与构图', { stage: 'structure', focus: 'hands', passed: ['fashion_asset_proportion', 'asset_framing'] }],
    ['只修材质，保持脸、姿态与灯光', { stage: 'material-light', focus: 'materials' }],
    ['只修灯光与白纱边缘分离', { stage: 'material-light', focus: 'lighting' }],
  ];
  return '# 当前白底角色资产测试提示词\n\n'
    + '由 `npm run examples:build` 自动生成。A/B 使用同一张参考图、相同画幅与模型设置，只改变面部渲染方向；不要将 A 的输出作为 B 的输入。局部编辑使用最新已接受母图。\n\n'
    + '以下是通用编译示例，仍需填写本套服装的具体构造和参考权限。展示型仅适合用户需要的流动长袍；全身母图模式保留自身造型。这些示例本身没有对应生成图，实际回归另存输入输出回执。\n\n'
    + cases.map(([title, options]) => `## ${title}\n\n\`\`\`text\n${compileAssetPrompt({...options, language:'zh-CN'}).prompt}\n\`\`\`\n`).join('\n');
}

export function currentCharacterStyleExamples() {
  const workflows=JSON.parse(fs.readFileSync(new URL('../resources/asset_style_workflows.json',import.meta.url),'utf8'));
  return '# 当前人物风格编译示例\n\n由 `npm run examples:build` 从风格目录生成。以下为兼容编译素材，不是已观察具体人物后完成的生产提示词，也没有对应的逐风格实图验收。实际人物、衣装、动作和背景按当前任务编写；所有人物任务共同按苗条、修长舒展、适当有肌肉美化黄金身材比例，覆盖各题材、媒介和生成编辑流程；已达标体型保持连续，未达标另建美化版本，明确限定的局部操作仍保持本步骤边界；按构图保留适当留白。\n\n'
    + Object.entries(workflows.profiles).filter(([,p])=>p.appearance).map(([styleWorkflow,p])=>`## ${p.label}\n\n\`\`\`text\n${compileAssetPrompt({styleWorkflow}).prompt}\n\`\`\`\n`).join('\n');
}

export function currentFaceDesignExamples() {
  const read = name => JSON.parse(fs.readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'));
  const original = read('face-design-original.json');
  const smile = reviseFaceDesign(original, read('face-design-expression-change.json'));
  return '# 人物捏脸系统完整提示词示例\n\n'
    + '由 `npm run examples:build` 从独立面容方案与肖像 brief 生成。两例共用同一套面容结构，只修改神态；它们是原创文字设计，尚未生成图像，不能据此判断身份保持或美感。\n\n'
    + [['原创药师：安静专注', original], ['同一面容：轻轻微笑', smile]].map(([title, face]) => {
      const brief = applyFaceDesign(read('face-design-portrait-base.json'), face);
      const compiled = compileProductionPrompt(brief);
      return `## ${title}\n\n\`\`\`text\n${compiled.prompt}\n\`\`\`\n`;
    }).join('\n');
}

export function currentBlueBenchmarkDistinctFacesExamples() {
  const read = name => JSON.parse(fs.readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'));
  const set = read('blue-benchmark-distinct-faces-set.json');
  const cases = set.cases.map(row => [row.label, read(row.file), read(set.portrait_base)]);
  const original = read('face-design-original.json');
  const revised = reviseFaceDesign(original, read(set.presentation_change));
  cases.push(['既有药师：保留原来结构与年龄，仅提升妆肤和神态', revised, read('face-design-portrait-base.json')]);
  return '# 共用审美完成度与不同面容的完整提示词\n\n'
    + '由 `npm run examples:build` 从独立面容方案编译。蓝衣长发肖像是审美示例之一，迁移妆肤与神态的完成度；这些人物的脸型、骨相和眉眼鼻唇关系为原创设计，不复制示例的脸、蓝衣或长发。前三例共用妆肤、神态、发型、衣装和照明，结构区别须由各自面容承担。\n\n'
    + '这是文字设计演练，没有新出图、逐人用户接受或跨模型证据；编译与冻结检查不证明图像中的美感、身份保持或人物区分。最后一例在既有药师面容上只修订妆肤和神态。\n\n'
    + cases.map(([title, face, base]) => {
      const brief = applyFaceDesign(base, face);
      const compiled = compileProductionPrompt(brief);
      return `## ${title}\n\n\`\`\`text\n${compiled.prompt}\n\`\`\`\n`;
    }).join('\n');
}

export function currentFaceControlExamples() {
  const read = name => JSON.parse(fs.readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'));
  const sided = read('face-design-sided-original.json');
  const changed = reviseFaceDesign(sided, read('face-design-left-eye-change.json'));
  return '# 全面细部与左右局部设计示例\n\n由 `npm run examples:build` 生成。目录有205项可选因素，正文只使用本例选定的因素；以下是未生成像素的原创设计，不是游戏滑杆执行、参考复刻或人物质量证据。三十五岁女性、衣领与灰底均属于具体示例，不是系统默认。\n\n'
    + [['细部文士：人中、眉眼与鼻唇连接',read('face-design-full-detail.json')],['左右独立：自然轻微差异',sided],['授权变体：仅修改人物自身左眼',changed]].map(([title,face]) => {
      const brief = applyFaceDesign(read('face-design-portrait-base.json'),face);
      return `## ${title}\n\n\`\`\`text\n${compileProductionPrompt(brief).prompt}\n\`\`\`\n`;
    }).join('\n');
}

export function currentPortraitLookExamples() {
  const input = JSON.parse(fs.readFileSync(new URL('../examples/portrait-look-diversity-plan.json', import.meta.url), 'utf8'));
  const report = buildPortraitLookPlan(input);
  return '# 同一原创人物的多造型完整提示词\n\n'
    + '由 `npm run examples:build` 从 [造型方案](portrait-look-diversity-plan.json) 编译。[来源分析与优化方案](../docs/portrait-look-diversity-analysis-2026-10-15.md)仅用于提炼方法；这里另行原创人物，不复刻附件面容，不把旧拼板作为身份输入。\n\n'
    + '本例按来源场景演示十套、日韩风五套与中国风五套；这些是设计分组，不是人物族群、专属起源或2026流行榜单，实际任务的数量与分组另定。每套继承同一身份、正脸端正头位、自然乌黑发色、取景、身材和布光，分别选择脸前结构、妆面及可见表演。\n\n'
    + '这是文字设计演练。声明查重与编译通过不证明实际造型差异、本人保持、适配、流行度或用户接受，尚未生成新图。以下每套正文独立完整，可分别复制；真实参考任务仍须绑定并实际提供自己的身份原图。\n\n'
    + renderPortraitLookPrompts(report);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  fs.writeFileSync(path.join(root, 'examples/ancient-white-asset-current-prompts.md'), currentExamples());
  fs.writeFileSync(path.join(root, 'examples/character-style-current-prompts.md'), currentCharacterStyleExamples());
  fs.writeFileSync(path.join(root, 'examples/face-design-current-prompts.md'), currentFaceDesignExamples());
  fs.writeFileSync(path.join(root, 'examples/blue-benchmark-distinct-faces-current-prompts.md'), currentBlueBenchmarkDistinctFacesExamples());
  fs.writeFileSync(path.join(root, 'examples/face-design-controls-current-prompts.md'), currentFaceControlExamples());
  fs.writeFileSync(path.join(root, 'examples/portrait-look-diversity-current-prompts.md'), currentPortraitLookExamples());
  fs.writeFileSync(path.join(root, 'docs/current-asset-plan.json'), `${JSON.stringify(createAssetPlan({ presentation: 'costume_showcase', maturityGuard: 'none' }), null, 2)}\n`);
  console.log('Generated current prompts and plan; visual regression remains pending.');
}
