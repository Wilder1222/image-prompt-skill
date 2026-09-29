import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileAssetPrompt, createAssetPlan } from './asset-master.mjs';

export function currentExamples() {
  const cases = [
    ['A：角色感优先的全身白底生成', {}],
    ['东方幻想原画资产：保留厚涂面容与选择性边缘', { styleWorkflow: 'dark_fantasy_asset', maturityGuard: 'none' }],
    ['B：轻度真人感；其余条件与 A 相同', { faceProfile: 'humanized_real_light' }],
    ['服装定妆展示：有层次的长袍与袖摆', { presentation: 'costume_showcase', maturityGuard: 'none' }],
    ['适度优化服装与造型：保留人物辨识度，按方案再设计', { presentation: 'costume_showcase', maturityGuard: 'none', designFreedom: 'moderate' }],
    ['已有优质全身参考：保留原造型，不重新套用预设', { referenceMode: 'full_body_anchor' }],
    ['只修手部，锁定已通过的比例与构图', { stage: 'structure', focus: 'hands', passed: ['fashion_asset_proportion', 'asset_framing'] }],
    ['只修材质，保持脸、姿态与灯光', { stage: 'material-light', focus: 'materials' }],
    ['只修灯光与白纱边缘分离', { stage: 'material-light', focus: 'lighting' }],
  ];
  return '# 当前白底角色资产测试提示词\n\n'
    + '由 `npm run examples:build` 自动生成。A/B 使用同一张参考图、相同画幅与模型设置，只改变面部渲染方向；不要将 A 的输出作为 B 的输入。局部编辑使用最新已接受母图。\n\n'
    + '以下是通用编译示例，仍需填写本套服装的具体构造和参考权限。展示型仅适合用户需要的流动长袍；全身母图模式保留自身造型。这些示例本身没有对应生成图，实际回归另存输入输出回执。\n\n'
    + cases.map(([title, options]) => `## ${title}\n\n\`\`\`text\n${compileAssetPrompt({...options, language:'zh-CN'}).prompt}\n\`\`\`\n`).join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  fs.writeFileSync(path.join(root, 'examples/ancient-white-asset-current-prompts.md'), currentExamples());
  fs.writeFileSync(path.join(root, 'docs/current-asset-plan.json'), `${JSON.stringify(createAssetPlan({ presentation: 'costume_showcase', maturityGuard: 'none' }), null, 2)}\n`);
  console.log('Generated current prompts and plan; visual regression remains pending.');
}
