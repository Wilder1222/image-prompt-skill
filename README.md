# Image Prompt Skill

参考图驱动的角色定妆照提示词与迭代工作流。支持全身资产、服装展示、场景保留或调整、优质母图保留与局部修复，并区分身份、风格、服装、背景和编辑母图的参考权限。

当前版本 **0.12.5**，同时提供独立 Skill、Node.js 命令行和 Codex 插件。编译器生成提示词与计划；实际出图使用宿主已有图像工具。

提供参考图和描述，Skill 负责观察、解析意图、决定保留与改造、撰写中文分类提示词、检查冲突，并在已授权时执行出图评审与修订。用户无需选择模板或填写参数。主入口是 [提示词生产流程](references/routes/prompt-production.md)；历史范例用于校准表达与评估，不是每次生成的填空底稿。

效果保障分三层：代理对实际图像和描述做语义审查；编译器检查来源权限、要求覆盖和交付完整性；实际输出由视觉评审与针对性修订检验。三层不能互相替代，单次成功不证明批量稳定。

面容真实感与肌肤纹理建立在精致妆容之上，服务整体视觉美感。按角色选择妆面，按景别控制细节，保留身份与年龄；不以更多毛孔或更强锐化代替自然和好看，见 [妆容与肌肤](references/core/makeup-skin-integration-v2.md)。

本项目成年角色体型以修长、匀称和适度肌肉线条为目标。P9 下分别协调头身、肩腰臀、上下臂与上下腿，按动作体现自然肌肉体积；“黄金比例”不当作各部位统一公式或遮挡处的测量结论，见 [身材比例与体型](references/core/fashion-proportion-system.md)。

动作可按人物、情绪、场景和用途自动适配，支持自然小动作、坐倚、行走、奔跑、跳跃、旋舞及夸张动作，以整体自然协调为准。眼神、表情、肩颈手部松紧、支撑或腾空关系与衣料运动共同体现真实感和生命力，见 [动作与生命感](references/core/action-direction.md)。鞋履可露一脚、双脚或自然被遮住，腾空不强制接地；明确展示鞋的要求另行处理。

v0.12 增加统一视觉验收、生成前冻结记录、目标变更与中断记录、同人多视角和按标签限定的修订。参见 [站姿决策](references/core/standing-pose-direction.md)、[视觉验收](references/core/visual-acceptance.md) 和 [执行记录](references/routes/production-execution.md)。

背景可保留、调整、替换，也可选择白底或其他棚背景；白底不是必选项。按 [背景与环境适配](references/core/background-direction.md) 决定景物、空间和照明，支持独立 background 通道。选择白底定妆时默认采用 [摄影棚布光](references/core/studio-lighting-direction.md)；保留场景时让人物受光与环境协调，不强制清空场景或移除合理环境色。背景与面部布光分别验收。发型可自动适配分缝、鬓发和局部束发，大幅减少碎发遮脸，保留整体方向与自然蓬松度。

表情也可按人物气质、姿态、背景和用途自动适配，支持独立 expression 通道与【表情与眼神】标签。保留身份而允许自然的眉眼、嘴角与唇部运动，明确表情和视线要求优先，不锁死原神态或统一微笑。表情适切性与身份保持分别评审，见 [表情与身份区分](references/core/identity-vs-temperament-diagnostics.md)。

## 使用

安装插件后，直接提供图片和自然语言描述，例如：

> 使用 $image-prompt-skill，根据这些参考图和我的描述生成可直接使用的中文生图提示词。保留人物，适度优化服装，白底正面全身；如果我要求测试，再生成图片并检查偏差。

需要持久化生产记录时，由代理完成内部分析文件。检查工具需要 Node.js 22+，无第三方 npm 依赖：

```bash
node scripts/iteration-director.mjs prompt-build --input path/to/agent-authored-brief.json --format text
node scripts/iteration-director.mjs prompt-review --input path/to/agent-authored-brief.json --review path/to/review.json
```

在安装插件后的新 Codex 任务中，可直接说：

> 使用 $image-prompt-skill，根据这些参考图编写全身白底定妆照提示词，并生成测试图。

旧 `asset-prompt` 保留为素材兼容命令，返回 `scaffold_only`，不能直接当作完成的参考专属提示词。最终正文来自本轮实际观察和设计决定，不自动混入固定古风衣装、女性脸型或九头身。本项目已确认的 P9 与两份美感范例仍作为对应任务的上下文使用。

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

- [v0.12 站姿、独立调用、摄影布光与发型实测：29 张输出及未通过项](docs/visual-evaluations/maturity-v0120.md)
- [下一阶段目标、任务优先级与验收标准](docs/next-milestone.md)
- [当前提示词生产与效果验证流程](references/routes/prompt-production.md)
- [三套独立提示词与五次真实出图记录](docs/visual-evaluations/production-skill-v0110.md)
- [分类标签与两条风格路线](references/routes/tagged-prompt-workflows.md)
- [两份参考专属中文提示词](examples/user-reference-tagged-prompts.md)
- [v0.10.0 更新与验收边界](docs/tagged-workflows-v0100.md)
- [v0.9.7 自然比例实验（已被用户明确的 P9 方向取代）](docs/visual-evaluations/chinese-natural-proportion-v097.md)
- [v0.9.6 历史实测与候选总览](docs/visual-evaluations/current-overview.md)
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
