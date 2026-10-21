# Midjourney 手动提示词适配

核验日期：2026-10-19。仅核验官方文档与离线编译，未访问 MJ 创作界面、提交任务或验证出图。使用 [模型目录](../../resources/image_model_catalog.json) 与 [MJ 编译器](../../scripts/midjourney-prompt.mjs)。其他模型继续按 [模型指南](text-to-image-models.md) 处理。

## 先确定模型与界面

官方 [Version](https://docs.midjourney.com/hc/en-us/articles/32199405667853-Version) 当前默认 V8.2，自 2026-07-24 生效。用户只说 MJ 且没有历史版本约束时，说明采用当前核验的 V8.2 并显式输出 `--v 8.2`；已有明确模型选择继续保留。编译器要求具体 `profile`，不猜测别名。支持 `midjourney-8.2`、`midjourney-8.1`、显式选择的 `midjourney-7`；V8.0 已不可用，直接拒绝，不自动升级。未知版本需要重新核验。Niji 7 是独立的动漫模型，不能用 `--v 7` 代替 `--niji 7`；当前编译器未开放 Niji 档案，明确报错后按其专门文档另行扩充。

`target.surface` 取 `web` 或 `discord`，省略时按网页交付并在结果标明。两种界面都只提供给用户手动粘贴的文本与参考操作说明。[条款](https://docs.midjourney.com/hc/en-us/articles/32083055291277-Terms-of-Service) 对自动化访问、交互和生成有限制；本 skill 不提供 sender、浏览器填表、自动上传、批量开窗口、自动点击提交、密钥或持久权限。普通使用授权不等于 MJ 平台的自动化特批。

## 写正文，再附参数

代理先完成当前任务的来源观察、设计与质量审查，再写简洁、具体的主体、动作、结构、材质、空间、光线和媒介。保留必须项与验收，不堆同义修饰词，不套人物模板到场景和产品。中文仍是 skill 默认；官方没有强制英文，只有用户要求时才交付其他语言版本。画面可见文字用双引号保留原文，例如 `招牌写着"雨巷书店"`，不翻译招牌内容。

[参数规则](https://docs.midjourney.com/hc/en-us/articles/32859204029709-Parameter-List) 要求正文在前，ASCII `--` 参数统一放末尾。正文、负面字段不能藏原生参数或 `::` 文字 multi-prompts；V7 与 V8.X 均不支持文字 multi-prompts。Discord 的单张 Style Reference URL 权重 `URL::2` 是独立参考语法，放在角色绑定中，不因此误拒绝。不要笼统禁用 URL、比例冒号或 `--no` 逗号。

编译返回 `model_execution.request`：

| 字段 | 含义 |
| --- | --- |
| `prompt` | 原样保存分类正文，与原有接口兼容 |
| `native_prompt` | 平台正文；Discord Image Prompt URL 前置，网页路径不进入正文 |
| `model` / `surface` | 明确版本与网页/Discord |
| `parameters` / `parameter_suffix` | 同一份末尾参数，后者兼容原接口 |
| `submission_text` | 原生正文与参数的完整手动粘贴文本；没有 `/imagine` 前缀 |
| `reference_manifest` | 每张图的来源、平台角色、原 URL（如有）及就绪状态 |
| `warnings` / `blockers` | 已知文档冲突、能力边界与待补输入 |
| `ready_to_submit` | 离线输入条件已满足；不证明 URL 可访问、账号有权限、图片已被平台接受或成图合格 |
| `manual_instructions` | 与粘贴文本分离的手动操作说明 |

默认不添加 HD、Draft、质量、速度、重复、排列组合、隐私或 Personalization 开关。设置继承仍可能来自用户 MJ 账号；提交前由用户核对当前界面。需要准确画幅时显式指定比例。高 `stylize`/`exp` 可能牺牲遵循；种子也不保证跨提示词的角色或风格保持。

## 参数子集与校验

设置使用下表的语义字段，可用列出的短别名；同一项出现两种写法时直接报重复/冲突，不能靠顺序覆盖。版本只由 profile 决定，不接受设置中的 `v`、`version` 或 `niji`。

| 设置（别名） | 支持与范围 |
| --- | --- |
| `aspect_ratio` (`ar`, `aspect`) | 正整数 `宽:高`，SD 与 V7 两方向上限 14:1；V8 HD 上限 4:1；不是像素尺寸 |
| `seed` | 整数 0–4294967295 |
| `stylize` (`s`) | 整数 0–1000 |
| `chaos` (`c`) | 整数 0–100 |
| `weird` (`w`) | 整数 0–3000 |
| `raw` | 布尔值，true 输出 `--raw` |
| `resolution` | V8.1/V8.2 的 `sd` 或 `hd`；也可显式 `sd: true` / `hd: true`，冲突拒绝 |
| `quality` (`q`) | 仅 V7 的 1、2、4；拒绝 3，避免服务自动升为 4 的额外费用 |
| `draft` | 显式布尔值；V7 两界面，V8.1/V8.2 仅网页，见下方文档冲突 |
| `tile` | 显式布尔值；与 Edit Model 不兼容 |
| `exp` | 整数 0–100，实验美学参数，默认省略 |
| `image_weight` (`iw`) | 仅 Image Prompt；V7/V8.1 为 0–3。V8.2 官方范围表未列出，暂不开放 |
| `style_reference` (`sref`) | 显式字符串数组，数字代码或 `random`；图像必须走参考角色，不把图推断成代码 |
| `style_weight` (`sw`) | 0–1000，需要 style 参考或代码，不用于 Moodboards |
| `style_version` (`sv`) | 仅 V7 1–6；含代码/random 时只能 4 或 6；V8 未明确，不继承 |
| `omni_weight` (`ow`) | 仅 V7 omni，1–1000，默认不添加；官方通常建议低于 400 |
| `personalization` (`p`) | 仅明确请求时使用 true（账号默认）或用户实际提供的 ID/代码字符串；不生成或推断 profile |
| `target.negative_prompt` | 非空字符串，输出 `--no`；逗号分隔明确排除对象，逐词解释可能误伤复合短语 |

V8 拒绝 `q`、`oref/ow`、`cref/cw`、Turbo 与文字 multi-prompts。`edit` 没有官方强度参数，不发明 `ew`，不拿 `iw/ow` 当身份强度。未知字段及跨模型字段报错，不藏入正文。当前子集不开放速度、repeat、permutation、public/stealth、视频、Moodboards；这不代表厂商没有相应能力。

参数依据：[Aspect Ratio](https://docs.midjourney.com/hc/en-us/articles/31894244298125-Aspect-Ratio)、[Seeds](https://docs.midjourney.com/hc/en-us/articles/32604356340877-Seeds)、[Stylize](https://docs.midjourney.com/hc/en-us/articles/32196176868109-Stylize)、[Chaos](https://docs.midjourney.com/hc/en-us/articles/32099348346765-Chaos-Variety)、[Weird](https://docs.midjourney.com/hc/en-us/articles/32390120435085-Weird)、[Raw](https://docs.midjourney.com/hc/en-us/articles/32634113811853-Raw)、[Quality](https://docs.midjourney.com/hc/en-us/articles/32176522101773-Quality)、[Personalization](https://docs.midjourney.com/hc/en-us/articles/32433330574221-Personalization)、[exp 官方公告](https://updates.midjourney.com/v7-update-editor-and-exp/)。

## 参考图角色与界面操作

仍先在 brief 的 `references` 记录实际来源、已观察事实和 `generation_input: true`。用 `target.references` 绑定平台角色，不能为了通过编译将真正需传入的图改为观察用。每张生成输入至少一个角色；不存在、只观察、重复或未知角色均拒绝。单身份及同人补充视角继续遵守主工作流，官方支持四图不等于本 skill 已实现多人物逐人绑定。

| `role` | 网页手动操作 | Discord 手动粘贴语法与边界 |
| --- | --- | --- |
| `image` | 上传/选择图，设为 Image Prompt | 图片 URL 空格分隔放正文前；引导内容、构图和风格，不当身份控制 |
| `style` | 上传/选择图，设为 Style Reference | 末尾 `--sref` 后接 URL 列表；可显式 `weight` 输出各图 `URL::weight`，仅 Discord、有限正数 |
| `edit` | V8.1/V8.2 的 Attach to prompt | 末尾 `--edit` 后接 1–4 个 URL；可与 image/style/p/HD 组合，不兼容 tile |
| `omni` | 显式 V7 的 Omni Reference | 末尾 `--oref` 后接单个 URL；不兼容 q4 和 Draft；V8 不沿用 |

网页无需伪造 URL。编译器交付附件清单和可粘贴正文，等待用户手动挂图；仅确有用户已挂图证据时记录 `attachment_confirmed: true`。URL 存在也不等于网页已挂图。示意绑定（R1 必须对应实际已观察的生成输入）：

```json
{"profile":"midjourney-8.2","surface":"web","settings":{"aspect_ratio":"3:4","raw":true},"references":[{"reference_id":"R1","role":"edit"}]}
```

Discord 由用户手动取得真实、可公开读取的 HTTP(S) 图片直链，填入绑定的 `url`；原来源本身是直链时也可直接使用。文件路径须以 png/gif/webp/jpg/jpeg 结尾，可带 query，保留签名原文；网页链接、占位地址、本地路径、Library ID、sandbox 路径不能当图 URL。不联网探测或自动上传；缺 URL 返回 `ready_to_submit: false` 与原因，不填假 URL，不悄悄退回纯文生图。操作说明里的 `/imagine` 与 `submission_text` 分离。

Edit 第一图决定比例，除非显式 `ar`；本编译器不从 URL 猜尺寸，因此 HD + Edit 缺明确比例时保留待补状态。主体参考的身份权限必须使用 edit 或 omni；style/image 不替代身份绑定。参考只引导新图，不能保证同一人物、标识或细节完全一致。V7 Omni 专页另有“当前不兼容 Fast”说明，本适配器不设置速度，输出警告要求手动核对。

参考依据：[Edit Model](https://docs.midjourney.com/hc/en-us/articles/48495453462797-Edit-Model)、[Image Prompts](https://docs.midjourney.com/hc/en-us/articles/32040250122381-Image-Prompts)、[Style Reference](https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference)、[Omni Reference](https://docs.midjourney.com/hc/en-us/articles/36285124473997-Omni-Reference)。本生产编译器要求非空文字，不提供官方“两张 Image Prompt 无文字”模式；未实现不等于官方不支持。

## 文档冲突与保守边界

- Version 表将 V8.X Draft 标为不可用，但 [Draft 专页](https://docs.midjourney.com/hc/en-us/articles/35577175650957-Draft-Conversational-Modes) 明确 V8.1/V8.2 为网页专属，每条 24 张低分辨率图。依专页分界面允许显式网页 Draft 并给出冲突警告，Discord 拒绝；不默认加 Draft。
- Image Weight 表只明确 V8.1/V7 0–3 与 Niji 7 0–2，未列 V8.2；Version 的支持勾选不能证明相同范围，V8.2 暂不编译自定义 iw。
- Style Reference 的 sv 范围只明确 V6/V7，不推断 V8 继承。Legacy 页仍称 V7 为默认且有旧无限比例记录，当前模型以 Version 页为准。
- 文档核验、请求合法、真实调用与实图验收分开记录。这里没有通过任何 MJ 生图验证。

## 使用与冻结

JSON 由代理整理，不要求用户填模板。现有 `--format text` 保持仅正文；MJ `--format native` 输出完整原生正文与参数，未就绪则报错并引导查看 JSON。可运行 [可复用例子](../../examples/midjourney-brief.json)：

```bash
node scripts/iteration-director.mjs prompt-build --input examples/midjourney-brief.json --format native
node scripts/iteration-director.mjs prompt-build --input examples/midjourney-brief.json --format json
```

`production-run prepare/inspect` 冻结完整 MJ 清单与就绪状态。参考源文件仍用于本地摘要证据，Discord URL 另放绑定，不把远程 URL 冒充本地文件。界面、URL、角色、确认状态、参数改变均改变 `execution_sha256`，需重新冻结；检查始终返回 `manual_submission_required: true`、`dispatch_ready: false`，即使手动输入已就绪也不自动派发。未就绪计划不能记完成回执。已冻结旧计划沿用原合同，不补造挂图或出图事实。

例子输出及说明见 [手动交付例子](../../examples/midjourney-manual-prompts.md)。
