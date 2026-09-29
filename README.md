# Image Prompt Skill

参考图驱动的角色定妆照提示词与迭代工作流。支持全身白底资产、服装展示、优质母图保留与局部修复，并区分身份、风格、服装和编辑母图的参考权限。

当前版本 **0.9.7**，同时提供独立 Skill、Node.js 命令行和 Codex 插件。编译器生成提示词与计划；实际出图使用宿主已有图像工具。

所有最终生图提示词按语义标签分类。`asset-prompt` 与程序库默认输出中文，角色新图提供模式块和十类正文。本项目古风预设采用用户指定的 `beauty_first + P9 Fashion`；完整全身母图保留自身比例。真实材质定妆照与东方幻想厚涂资产分成两条路线，实际提交文本与交付正文一致。

## 使用

需要 Node.js 22+，没有第三方 npm 依赖。以下命令在仓库根目录执行：

```bash
node scripts/iteration-director.mjs asset-prompt --presentation costume_showcase --maturity-guard none --format text
node scripts/iteration-director.mjs asset-prompt --style-workflow dark_fantasy_asset --format text
node scripts/iteration-director.mjs asset-prompt --reference-mode full_body_anchor --format text
node scripts/iteration-director.mjs asset-prompt --stage structure --focus hands --format text
```

在安装插件后的新 Codex 任务中，可直接说：

> 使用 $image-prompt-skill，根据这些参考图编写全身白底定妆照提示词，并生成测试图。

先查看实际参考再补充人物与服装信息；通用编译结果不是已经完成的角色设计。

## Codex 插件

[插件清单](.codex-plugin/plugin.json) 通过 `skills/image-prompt-skill/` 发现技能，该入口加载仓库内的 [主工作流](SKILL.md)。规则、资源和脚本只维护一份，安装包不依赖开发仓库的绝对路径。

```bash
npm run release:build
npm run validate
npm run plugin:build
```

构建目录为 `dist/codex-plugin/image-prompt-skill/`，可完整复制到个人插件目录。安装与更新步骤见 [Codex 插件说明](docs/codex-plugin.md)。

## 开发与验证

```bash
npm run examples:build
npm run release:build
npm test
npm run validate
npm run plugin:build
```

- `plugin:sync` 根据根技能元数据生成插件入口，保持版本、描述与代理配置同步。
- `RELEASE-MANIFEST.json` 记录发布文件和 SHA-256；版本化清单是历史快照。
- `.gitattributes` 固定文本使用 LF，避免 Windows 与其他系统检出后出现摘要差异。
- 生成图片、用户参考图、测试压缩包和构建产物保存在 `dist/`，不进入 Git 或插件包。
- 自动化测试验证编译、作用范围和发布完整性；真实视觉评审与用户验收单独记录。

## 入口

- [分类标签与两条风格路线](references/routes/tagged-prompt-workflows.md)
- [两份参考专属中文提示词](examples/user-reference-tagged-prompts.md)
- [v0.10.0 更新与验收边界](docs/tagged-workflows-v0100.md)
- [v0.9.7 自然比例实验（已被用户明确的 P9 方向取代）](docs/visual-evaluations/chinese-natural-proportion-v097.md)
- [参考图实测与当前候选总览](docs/visual-evaluations/current-overview.md)
- [技能主工作流](SKILL.md)
- [白底资产工作流](references/routes/asset-master-workflow.md)
- [标杆对照与服装展示](references/routes/benchmark-costume-refinement.md)
- [通用提示词示例](examples/ancient-white-asset-current-prompts.md)
- [四次真实测试的提示词](examples/benchmark-costume-v084-prompts.md)
- [材质生成规则实测与后续清单](docs/visual-evaluations/material-generation-v091.md)
- [八张原图覆盖与复杂造型实测](docs/visual-evaluations/character-layout-v092.md)
- [黑金与现代短裙实测](docs/visual-evaluations/wardrobe-redesign-v093.md)
- [四龙首组合与取景修复实测](docs/visual-evaluations/guardian-framing-v094.md)
- [身份与服装双参考实测](docs/visual-evaluations/wardrobe-reference-v095.md)
- [面部诊断与同衣装对照](docs/visual-evaluations/identity-review-v096.md)
- [简洁与详细提示词实图对照](docs/visual-evaluations/prompt-density-20260929.md)
- [视觉回归模板](templates/benchmark-comparison-record.json)
- [测试说明](tests/README.md)
