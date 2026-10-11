# 图像提示词技能

当前版本 **0.16.3**。输入文字描述与可选参考图，输出任务专属的中文分类提示词；已要求测试时，使用宿主图像工具生成、查看并修订。

支持纯文字描述，参考图可选。新增 OpenAI GPT Image、Gemini、FLUX、Midjourney、Seedream、Stable Diffusion、Qwen-Image 的指定版本适配，提供独立请求设置、参数检查和执行摘要绑定；停用的 Imagen Gemini API 入口会明确报错。详见 [文生图模型指南](references/providers/text-to-image-models.md)。这是提示词与请求编译支持，尚未完成各供应商的联网出图验证。

## 使用

安装插件后，在新任务中提供参考图并说明目标。例如：

> 使用 $image-prompt-skill，保留这个人物，适度优化服装和造型，生成中文提示词并出图测试。

提示词使用不带编号的中文语义标签与具体视觉描述；英文参数改写为对应类别中的中文提示词，不输出模式设置或参数表。默认美感与精致妆容优先；代理按角色、年龄、媒介、衣装、动作与用途 [自动选择身材比例](references/core/fashion-proportion-system.md)，将自然、修长、力量或明确的风格化方向写成具体身体关系，不统一九头身、长腿或细腰。已认可体型继续保留。发型、表情、动作和背景可以按要求适配；白底和双脚露出均不是通用必选项。

主体入口为 [SKILL.md](SKILL.md) 和 [提示词生产流程](references/routes/prompt-production.md)。代理负责观察、决策与编写，用户无需填写模板。程序检查不能代替实际图像评审，也不保证任意输入都生成好图。

[人物捏脸系统](references/routes/character-face-design.md) 支持按脸型骨相、眉眼、鼻唇、软组织与辨识锚点设计面容；神态、妆肤、发型和光线独立变化。提供四个来源分组与十个可调种子，也支持不采用种子的自定义人物。参考复刻从实际观察建立结构，局部改脸检查允许范围；生效面容进入现有提示词与验收契约。种子来自文字分析，尚未完成本系统实际出图验证。

[蓝衣长发肖像](docs/blue-long-hair-portrait-benchmark.json) 是人物面容、妆肤和神态的审美示例之一。规则吸收精致面容、柔亮肤质和协调表情的表现方法，每个人物保持自己的结构辨识点；[共同妆肤与不同面容示例](examples/blue-benchmark-distinct-faces-current-prompts.md) 展示三套独立结构与既有角色的呈现修订。它是用户认可的外部参考参与生成样本，尚不提供本项目更新后出图或跨模型效果证据。

## 项目结构

2026-10-11 的两批用户参考已整理为 [满意人物图校准](references/routes/satisfied-character-reference-calibration.md)，逐图来源和观察见 [参考记录](docs/satisfied-character-references-2026-10-11.json)。共享表现方法与每个人物的结构辨识点分别维护，原图本地副本保存在不随发布包分发的 `output/` 下。

- `references/`：现行专项规则与流程；重复版本已合并。
- `resources/`：当前脚本实际使用的配置。部分文件名含接口版本号，属于现行依赖，不是旧发布副本。
- `scripts/`：提示词编译、执行记录、评分与发布工具。
- `examples/`：当前编译示例与两份中文参考范例。
- `tests/`：当前功能和发布回归测试。
- `docs/`：插件安装说明、当前计划和当前视觉测试账本。
- `dist/`：本地生成结果及构建产物，不发布到 Git 或插件。

旧版本源码和报告从 Git 历史追溯。当前工作树不保留历代发布清单、阶段报告、译文索引或历史提示词副本。未完成目标所需的完整测试证据继续保留，不删除失败提高统计结果。

## 编译与验证

需要 Node.js 22+，无第三方 npm 依赖。

```bash
node scripts/iteration-director.mjs prompt-build --input path/to/agent-authored-brief.json --format text
node scripts/iteration-director.mjs model-list
node scripts/iteration-director.mjs prompt-build --input examples/text-to-image-brief.json
node scripts/iteration-director.mjs prompt-review --input path/to/agent-authored-brief.json --review path/to/review.json
node scripts/face-design.mjs build --input examples/face-design-original.json --out dist/face-design/original.json
node scripts/face-design.mjs apply --input examples/face-design-original.json --brief examples/face-design-portrait-base.json --out dist/face-design/portrait-brief.json
npm run examples:build
npm run release:build
npm test
npm run validate
npm run plugin:build
```

旧资产编译命令仍是现行兼容功能，输出通用素材而非完成的参考专属提示词。资源模式仅用于内部选择，最终文本描述可见结果。

## 当前结果与安装

[当前状态](docs/current-status.md) 记录尚未完成的视觉目标；[完整当前测试账本](docs/current-visual-evaluation.json) 保留所有实际尝试、评分和失败项。当前累计34张均分9.1632，尚未达到9.5。旧错误通过的复核注记参与当前合格判断，原分数不重写。

[Codex插件安装与更新](docs/codex-plugin.md) 使用同一份技能和资源，构建输出为 `dist/codex-plugin/image-prompt-skill/`。发布清单仅维护 `RELEASE-MANIFEST.json`。
