# 文生图模型适配

核对日期：2026-10-04。机器可读权威为 [模型目录](../../resources/image_model_catalog.json)，脚本为 [适配器](../../scripts/model-adapter.mjs)。下列是明确版本与入口的提示词和请求编译支持，未做供应商联网生成或跨模型画质验证。账号可用性、接口变化和实际出图效果需在执行时检查。

## 选择与编写

先保留用户选定模型和当前宿主；未指定时使用宿主，不因目录中有新模型自动切换。文生图不需要图片，`references` 留空。身份、场景、产品、文字各按任务编写，不套古风女性白底资产预设。

| 档案 | 入口与已实现设置 | 编写与迁移要点 |
| --- | --- | --- |
| `host` | 当前宿主；不猜测未暴露设置 | 正文保持中文；执行时查看当次工具参数 |
| `gpt-image-1.5` | OpenAI Images；尺寸、质量、格式、背景 | 具体对象与位置关系；不填种子、采样器或负面字段 |
| `gpt-image-2` | OpenAI Images；自定义尺寸、质量、格式 | 不沿用旧版本的输入保真开关 |
| `gpt-image-2.5-sunburst`、`gpt-image-2.5-flare` | OpenAI Images；另有扩展质量档位及背景设置 | 文字内容、空间布局与材料分别写清；质量不自动升档 |
| `gemini-3.1-flash-image` | Gemini Interactions REST；比例、分辨率 | 先定义画面文字再描述布局，显式描述对象关系；不混入其他 SDK 命名 |
| `flux-2-pro` | BFL `/v1/flux-2-pro`；宽、高 | 正向陈述目标，无独立负面字段；不沿用 SD 权重表达 |
| `midjourney-7`、`midjourney-8.2` | 原生提示词；版本、比例、种子、风格化、Raw、排除词 | 主体、构造、媒介、光线与构图优先；参数统一放最后。这里不实现图片参考语法 |
| `seedream-4.5` | 火山方舟 Images；2K、4K，单张生成 | 中文写清数量、位置、动作和文字，删除重复但不删必要约束 |
| `sdxl-1.0` | Diffusers SDXL；尺寸、步数、引导强度、负面、种子 | 优先关键主体，实际 tokenizer 检查长文本；不用字符数代替 token 数 |
| `sd-3.5-large` | Diffusers SD3；尺寸、步数、引导强度、负面、种子 | 完整空间关系；不移植 Turbo 或 LoRA 的步数建议 |
| `qwen-image` | Diffusers Qwen；尺寸、步数、真实引导强度、负面、种子 | 中文标牌逐字说明，区分文生图与 Edit 管线 |
| `imagen-4-gemini-legacy` | 已停用，编译拒绝 | Gemini API 的 Imagen 4 已于 2026-08-17 关闭；显式选择替代模型后再编译。不外推 Vertex AI |

目录列出可编译的设置子集。未收录字段会报错，不能把“不在本适配器中”解释为供应商没有该能力。Diffusers 尺寸、步数、强度范围是本项目支持范围，非模型理论上限；FLUX 总像素和 OpenAI 自定义尺寸还会做联合校验。需要其他设置时先按具体入口扩充目录与验证，不能把自定义内容藏入正文。

同一个种子在不同模型间不代表同一构图；同一模型还受 scheduler、依赖版本和硬件影响。画幅语义写在正文中，实际尺寸或比例写在设置中，两者由代理核对，编译器不理解自然语言中的矛盾。透明背景与 JPEG 冲突会直接报错。

## 正文、负面与原生语法

正文始终是最终交付的分类文本，不自动翻译、重新排序或截断。模型编写差异由代理在编译之前落实并审查，不让机械替换器改写含义。英文可能适合部分工作流，但必须先有用户语言选择；中文版和执行稿若不同需分别交付，不能冒称同一正文。

负面要求先作为用户要求进入正文与验收；独立 `negative_prompt` 是额外执行条件，不是替代约束覆盖的捷径。OpenAI、Gemini、FLUX 与本 Seedream 档案不接受独立负面字段，代理需将不需要的结果转成正向可见目标，例如“商品边缘清晰，背景干净”。禁止直接丢弃负面要求。SD/Qwen 的字段可接收专门排除项，显式设置对应引导强度大于 1；没有排除需求就省略字段和该分支。Midjourney 使用 `--no`，避免用包含歧义修饰词的长句代替明确排除对象。

Diffusers 原生管线不解析网页前端的 `(词:权重)` 或 LoRA 命令为通用参数。Qwen 的 `true_cfg_scale` 与 SD 的 `guidance_scale` 不互换。种子放在 `runtime.generator_seed`，执行方需构造 `torch.Generator(...).manual_seed(...)`，不能将其作为 `pipe(seed=...)` 传入。运行时还需安装相应库、加载模型并核对硬件；本脚本不做这些操作。

Midjourney 的 `request.prompt` 是同一中文正文，`parameter_suffix` 保存原生参数，`submission_text` 是供原生界面粘贴的完整文本。`--format text` 只给正文；需要带参数执行时读取 JSON 的 `submission_text`。版本由档案锁定，不能在正文、负面词或设置中另塞 `--v`、`--oref` 等。V8.2 的 Edit Model 与 V7 的 Omni Reference 分开处理，不能从文生图档案推断编辑支持。

Qwen 没有排除词但需要启用真实引导时，可显式使用 `negative_prompt: " "`（单个空格）；编译器原样保留，不虚构额外排除对象。Midjourney 当前两份档案的比例上限是 14:1，超出直接报错，不压缩画幅。

## 编译与执行记录

代理可从 [完整文生图例子](../../examples/text-to-image-brief.json) 整理内部任务，不要求用户填写 JSON：

```bash
node scripts/iteration-director.mjs model-list
node scripts/iteration-director.mjs prompt-build --input examples/text-to-image-brief.json
node scripts/iteration-director.mjs prompt-build --input examples/text-to-image-brief.json --format text
```

`target` 是可选字段。省略时完全保留原有编译行为；指定时只接受 `profile`、`settings`、`negative_prompt`。例如 `{"profile":"gemini-3.1-flash-image","settings":{"aspect_ratio":"3:4","image_size":"2K"}}`。模型目录可通过 `listModelProfiles()` 查询；不要把系列名称映射成未经选择的默认版本。

返回的 `model_execution` 包含设置、请求、运行时信息、文档来源与 `execution_sha256`。OpenAI 的 `request` 用于 Images generations，Gemini 用于 `/v1beta/interactions`，BFL 路径由档案确定，Seedream 用于方舟 `/api/v3/images/generations`，Diffusers 的 `request` 是调用参数而非网络 JSON API。这里不提供通用 HTTP 发送器、不读取密钥、不上传素材、不触发收费任务。

非宿主档案目前只处理文生图：观察用参考可以保留在内部依据中，但 `generation_input: true` 的图片会阻止该入口编译，不能为了通过检查谎改成观察用。需要图片参与生成时按 [公共适配规则](provider-adaptation.md) 核对编辑入口和参考权限。宿主档案沿用当次图像工具的图片输入。

使用 `production-run.mjs prepare` 冻结任务时会同时冻结模型计划；`inspect` 返回对应的 `transport`、`request` 与 `runtime`。执行方只按已授权入口调用，并在实际完成回执中记录相同的 `execution_sha256`。模型、参数、负面内容或 Midjourney 后缀改变后必须重新冻结，不能只用未变的正文摘要复用旧验收。旧无 `target` 的回执仍兼容。

跨模型比较应保留同一用户要求与图像验收项，分别记录实际模型、完整正文、设置、输出与评审，失败也保留。请求编译、文档核对、真实调用、看图评审分别记录；不能用单元测试结果证明画质、中文排版或身份保持。

## 官方依据与更新

- [OpenAI 图像生成](https://developers.openai.com/api/docs/guides/image-generation)：版本、质量、尺寸及输出格式。
- [Gemini 图像生成](https://ai.google.dev/gemini-api/docs/image-generation)：当前 Interactions 请求；[停用表](https://ai.google.dev/gemini-api/docs/deprecations) 与 [Imagen 页面](https://ai.google.dev/gemini-api/docs/imagen) 用于停用拦截。
- [FLUX.2 文生图](https://docs.bfl.ai/flux_2/flux2_text_to_image)、[尺寸](https://help.bfl.ai/articles/8916739058-what-aspect-ratios-and-output-dimensions-are-supported)、[负面提示限制](https://help.bfl.ai/articles/7734566352-does-flux-2-support-negative-prompting)。
- [Midjourney 参数](https://docs.midjourney.com/hc/en-us/articles/32859204029709-Parameter-List)、[版本](https://docs.midjourney.com/hc/en-us/articles/32199405667853-Version)、[种子](https://docs.midjourney.com/hc/en-us/articles/32604356340877-Seeds)、[风格化参数](https://docs.midjourney.com/hc/en-us/articles/32433330574221-Personalization)。
- [Seedream 方舟接口](https://docs.volcengine.com/docs/ark/image-generation-api?lang=zh&redirect=1)。
- [SDXL 模型卡](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0)、[Diffusers 管线](https://huggingface.co/docs/diffusers/api/pipelines/stable_diffusion/stable_diffusion_xl)、[SD 3.5 Large 模型卡](https://huggingface.co/stabilityai/stable-diffusion-3.5-large)、[Qwen-Image 模型卡](https://huggingface.co/Qwen/Qwen-Image)。

扩展时先确定具体版本、入口和可用性，再改目录与必要的序列化逻辑，加入有效请求、拒绝路径和冻结回执测试；更新核对日期、本文及发布清单。不能仅添加模型名称就声称完成适配。
