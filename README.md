# 图像提示词技能

当前版本 **0.15.0**。输入文字描述与可选参考图，输出任务专属的中文分类提示词；已要求测试时，使用宿主图像工具生成、查看并修订。

支持纯文字描述，参考图可选。新增 OpenAI GPT Image、Gemini、FLUX、Midjourney、Seedream、Stable Diffusion、Qwen-Image 的指定版本适配，提供独立请求设置、参数检查和执行摘要绑定；停用的 Imagen Gemini API 入口会明确报错。详见 [文生图模型指南](references/providers/text-to-image-models.md)。这是提示词与请求编译支持，尚未完成各供应商的联网出图验证。

## 使用

安装插件后，在新任务中提供参考图并说明目标。例如：

> 使用 $image-prompt-skill，保留这个人物，适度优化服装和造型，生成中文提示词并出图测试。

提示词使用不带编号的中文语义标签与具体视觉描述；英文参数改写为对应类别中的中文提示词，不输出模式设置或参数表。默认美感与精致妆容优先，真实肌肤、修长匀称体型与适度肌肉服务整体视觉效果。发型、表情、动作和背景可以按要求适配；白底和双脚露出均不是通用必选项。

主体入口为 [SKILL.md](SKILL.md) 和 [提示词生产流程](references/routes/prompt-production.md)。代理负责观察、决策与编写，用户无需填写模板。程序检查不能代替实际图像评审，也不保证任意输入都生成好图。

## 项目结构

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
