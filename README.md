# 图像提示词技能

当前版本 **0.19.0**。输入文字描述与可选参考图，输出任务专属的中文分类提示词；已要求测试时，使用宿主图像工具生成、查看并修订。

支持纯文字描述，参考图可选。新增 OpenAI GPT Image、Gemini、FLUX、Midjourney、Seedream、Stable Diffusion、Qwen-Image 的指定版本适配，提供独立请求设置、参数检查和执行摘要绑定；停用的 Imagen Gemini API 入口会明确报错。详见 [文生图模型指南](references/providers/text-to-image-models.md)。这是提示词与请求编译支持，尚未完成各供应商的联网出图验证。

## 使用

安装插件后，在新任务中提供参考图并说明目标。例如：

> 使用 $image-prompt-skill，保留这个人物，适度优化服装和造型，生成中文提示词并出图测试。

提示词使用无编号中文语义标签，正文描述实际可见结果，内部模式和执行设置分开。人物先适配年龄与指定体型，未指定时默认适度美化为黄金比例审美下轻盈修长的仙侠身形，并分别落实自然发型和面容可读性；按景别及明确用户范围应用，已达标关系保持连续。完整标准只在 [主入口](SKILL.md) 与 [生产流程](references/routes/prompt-production.md) 维护，白底、站姿和数值头身均不是通用必选项。

主体入口为 [SKILL.md](SKILL.md) 和 [提示词生产流程](references/routes/prompt-production.md)。代理负责观察、决策与编写，用户无需填写模板。程序检查不能代替实际图像评审，也不保证任意输入都生成好图。

[全身体型基准](references/routes/full-body-baseline.md)支持在出图前声明图内每个人物的位置与视角，逐人检查头肩、躯干、手臂、双腿、体量和整体轮廓。`npm run body:review -- --input review.json` 检查真实共同基准与逐人物证据。[八张比例正例的实图核验](docs/body-proportion-validation-2026-10-18.md)保留七次实际生成：最终单人基准、五套换装及三视图通过代理评审，失败和遮挡未决记录保留，不等同用户已接受或跨任务稳定性。

后续[十张满意比例参考](docs/user-approved-body-references-2026-10-19.json)与首批精确去重后累计十四份不同图像，按现代可见腿部、古装静态长轮廓和动态体量选用；不把长裙、发髻、鞋跟或原图倾头写成身体数值及统一姿势。[四次近景与全身复核](docs/portrait-look-detail-validation-2026-10-19.md)保留原发区、妆面及构图失败。0.19.0新增实际比例标杆绑定和可核验的局部父图链，减少旧身体基准反复带入旧妆发；来源认可不替代新图验收。

[多造型实图执行](docs/portrait-look-execution-2026-10-15.md)记录了原图妆发惯性、刘海落点与修订回退。现行[造型路线](references/routes/portrait-look-variation.md)支持从当前完整方案修订指定通道，并用 `npm run portrait:review -- --input review.json` 复核实际图片、选定版本、人工差异比较和连续未改善问题；文字计划通过不等于十套造型已在实图中分化。

姿势 `action` 已纳入多妆造计划和成组复核，默认端正头位，分别设计躯干、手势、重心及妆发神态。旧[13次试验](docs/portrait-look-posture-validation-2026-10-18.md)保留原失败；[本批14次实际生成](docs/body-look-qualification-2026-10-19.md)在新计划中区分用户关键要求与代理自选细节，三套最终图通过代理的身体和四通道差异评审。棚拍采用轻微柔光、均匀面部照明，保留浅淡体积与妆色；用户接受及跨模型稳定性仍未验证。

[提示词质量审查](references/routes/prompt-quality-review.md)补齐必需目标在对应通道的正文覆盖，阻止同一句同时声明允许改变与必须保持；`npm run prompt:audit -- brief.json`定位重复、编辑范围复述和捏脸呈现重叠。标准化新计划可显式选择 `scope_format: 'compact'`，保留全部详细正文及验收，只精简范围摘要；既有详细计划继续使用原格式。[本轮调研与实图复查](docs/prompt-quality-research-2026-10-12.md)区分已修复的文本结构与尚未通过的图像目标。

[人物捏脸系统](references/routes/character-face-design.md) 支持按脸型骨相、眉眼、鼻唇、软组织与辨识锚点设计面容；神态、妆肤、发型和光线独立变化。提供四个来源分组与十个可调文字种子，也支持不采用种子的自定义人物。参考复刻从实际观察建立结构，局部改脸检查允许范围；生效面容进入现有提示词与验收契约。文字种子的两批本地实图测试仍未形成十种稳定鲜明的面容，不作为身份预设。

[24个RP原图绑定预设](resources/reference_face_presets.json) 来自用户选定的两批25次上传，仅合并完全相同文件（A02/A06）。使用 [原图绑定脚本](scripts/reference-face-presets.mjs) 选择一个RP编号，并提供实际原文件作为唯一身份输入；候选预览不能替代原图。原图不随插件分发，目录只记录来源摘要和别名。[本地实图证据](docs/reference-portrait-presets-evidence-2026-10-11.md)记录24张统一化候选的逐张检查范围与未通过项，不宣称24个人物或全部肖像保持合格。

[视觉偏好分类库](references/routes/visual-preference-library.md)按13个借鉴维度、11个多归属合集及题材/媒介/取景管理参考。现有46项档案包含2026-10-12新增10图及历史来源；44项有文件摘要，34项原图在项目本地，另有10项历史摘要和2份外部指针。新补充的暖光生活肖像与精细妆肤近景分别归入自然现代肖像、神态表达与妆肤近景合集。整体偏好、逐维度观察与身份权威分开，新10图不自动成为肖像预设。支持分类检索、按维度选择主来源、投影中文借鉴与视觉保持边界，以及导出本地引用计划。

[保持原任务风格的标准化](references/routes/style-preserving-standardization.md)按原图用途统一质量，保留取景、动势、原光色、衣景笔触、颗粒与场景主体。[标准化模块](scripts/style-standardization.mjs)提供 `buildStyleStandardizationPlan`、`applyStyleStandardizationPlan` 和逐项评审声明校验；原图 SHA、允许变化与保护项冻结进入生产目标。中性正面肖像对照须单独明确请求。来源绑定和程序通过不证明实际风格保持成功，生成候选仍需逐张看图。

[白底棚光参考卡](references/routes/white-background-reference-cards.md)属于明确授权后的独立资产目标，提供正面肖像、正面全身及正侧背三视图。提示词先按当前比例规则选择实际身体关系，转面保持共同尺度；未见全身、侧脸和背衣只标生成补全。用户明确选择本地 Python 后，可用 [卡片打包脚本](scripts/package-reference-cards.py)从实际生成板的白色分隔处裁出三类卡，保留板内像素与摘要；一张板的三张派生卡不计作三次独立生图。白底和棚光不授权换脸、换妆或把绘画转成照片，原图仍是身份依据。

[蓝衣长发肖像](docs/blue-long-hair-portrait-benchmark.json) 是人物面容、妆肤和神态的审美示例之一。规则吸收精致面容、柔亮肤质和协调表情的表现方法，每个人物保持自己的结构辨识点；[共同妆肤与不同面容示例](examples/blue-benchmark-distinct-faces-current-prompts.md) 展示三套独立结构与既有角色的呈现修订。它是用户认可的外部参考参与生成样本，尚不提供本项目更新后出图或跨模型效果证据。

## 项目结构

捏脸目录现有[15组、205项因素](docs/face-factor-catalog.md)，包括眉毛各段、眼距、鼻根鼻尖鼻翼、人中、上下唇、下巴、耳部及个体表面特征。[全面设计规则](references/core/face-factor-system.md)区分稳定面容、当前表情和妆肤观察条件，支持人物自身左右与授权单侧修改；[游戏调研](docs/game-face-system-research-2026-10-11.md)分别记录永劫无间PC/手游与燕云十六声国服/国际服的官方证据。细部维度是本项目的定性模型，不是游戏参数码或精确三维滑杆。

2026-10-11 的两批用户参考已整理为 [满意人物图校准](references/routes/satisfied-character-reference-calibration.md)，逐图来源和观察见 [参考记录](docs/satisfied-character-references-2026-10-11.json)。共享表现方法与每个人物的结构辨识点分别维护，原图本地副本保存在不随发布包分发的 `output/` 下。

- `references/`：按任务加载的现行规则；[38份辅助说明的职责合并](docs/rule-consolidation-2026-10-15.md)保留唯一维护位置。
- `resources/`：当前脚本实际使用的配置。部分文件名含接口版本号，属于现行依赖，不是旧发布副本。
- `assets/`：可复用的视觉偏好管理网页模板；用户原图仍仅保存在本地 `output/`。
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
node scripts/face-design.mjs catalog --group philtrum
node scripts/face-design.mjs build --input examples/face-design-original.json --out dist/face-design/original.json
node scripts/face-design.mjs apply --input examples/face-design-original.json --brief examples/face-design-portrait-base.json --out dist/face-design/portrait-brief.json
node scripts/visual-preferences.mjs list --collection warm_cinematic
node scripts/visual-preferences.mjs select --input examples/visual-preference-selection.json
npm run visual:gallery:build
npm run examples:build
npm run release:build
npm test
npm run validate
npm run plugin:build
```

旧资产编译命令仍是现行兼容功能，输出通用素材而非完成的参考专属提示词。资源模式仅用于内部选择，最终文本描述可见结果。

## 当前结果与安装

[肖像对照修订](references/routes/reference-portrait-standardization.md)仅在明确的中性正面对照目标下处理对应构图、倾头、受光失败；保持原任务风格时走独立标准化路线，两种目标的评审不互相改写。[面容复查计划](scripts/face-review-plan.mjs)把选定轴、原图事实、视角限制及逐项检查冻结进生产目标；候选不得填补原图未知几何或扩大本轮修改权限。

[当前状态](docs/current-status.md) 记录尚未完成的视觉目标；[完整当前测试账本](docs/current-visual-evaluation.json) 保留所有实际尝试、评分和失败项。当前累计34张均分9.1632，尚未达到9.5。旧错误通过的复核注记参与当前合格判断，原分数不重写。

[Codex插件安装与更新](docs/codex-plugin.md) 使用同一份技能和资源，构建输出为 `dist/codex-plugin/image-prompt-skill/`。发布清单仅维护 `RELEASE-MANIFEST.json`。
