# 当前白底资产工作流

本页保留预设与局部修复资料；完整生产入口已改为 [图像观察与提示词生产](prompt-production.md)。`asset-prompt` 及旧计划命令没有逐图观察，返回 `scaffold_only`，不能直接提交为已完成提示词。由代理据实际参考独立写正文，再用 `prompt-build` 检查来源和要求覆盖。

适用：成年古风角色从参考图扩展到完整全身白底资产，或对现有资产局部修复。默认案例为 `ancient_female_white_master`。其他主体、年龄、画幅与服装要求按用户和实际图像调整，不能套用案例外观。

这里的白底仅为专项案例。保留、调整或替换场景时，走生产入口和 [背景与环境适配](../core/background-direction.md)，不要直接继承此案例中的清空场景、纯白背景与棚拍锁定条款。

本页预设中的 `upright_neutral_elegant`、`vertical_body_axis_stable`、`no_capture_motion` 仅适用于已选择的静态检查姿态。自动动作、跳跃、旋舞或夸张动态通过生产入口与 [动作与生命感](../core/action-direction.md) 决策，不套用站直、固定手势或禁止动态的旧条件；明确保留母图与仅修局部的任务仍按当前范围处理。

## 历史素材配置（不能直接提交生成）

```bash
node scripts/iteration-director.mjs asset-prompt --stage generate --format text
node scripts/iteration-director.mjs asset-prompt --stage generate --face-profile humanized_real_light --format text
node scripts/iteration-director.mjs asset-prompt --stage generate --hand-mode relaxed_down_safe --format text
node scripts/iteration-director.mjs asset-prompt --presentation costume_showcase --maturity-guard none --format text
node scripts/iteration-director.mjs asset-prompt --reference-mode full_body_anchor --format text
```

`--format json`（默认）返回配置、文本、编辑范围和未生成图像的证据状态；`text` 只输出提示词。`asset-prompt` 和 `compileAssetPrompt()` 均默认中文。生成正文采用核心目标和十类语义标签，内部模式选择转为各类中的具体视觉描述，不输出模式设置块，局部编辑使用编辑对象、锁定范围和变化类别；不以 P0/P1 优先级替代分类。`--language en` / `language: 'en'` 显式切换英文后仍分类。图像调用使用与交付相同的完整正文。

支持选项：`--preset`、`--face-profile`、`--hand-mode`、`--maturity-guard`、`--presentation`、`--proportion-profile`、`--design-freedom`、`--style-workflow`、`--detail-budget`、`--highlight-hierarchy`、`--edge-control`、`--reference-mode`、`--stage`、`--focus`、`--passed`、`--format`、`--language`。参数缺值、拼写错误、未知模式会失败，不会悄悄退回默认。风格及细节选项见 [两条风格路线](tagged-prompt-workflows.md)。

本项目人物统一执行黄金九头身硬性规则，唯一生产比例为 `P9_FASHION_ASSET`。不能极端缩头、拉长颈部或推高骨盆；其他比例选项会报错，不静默替换。比例与衣片展示独立，`costume_showcase` 不覆盖比例；完整全身母图同样执行九头身。先验收头颈肩、完整胸廓与骨盆、上下腿和手脚尺度，裙摆拖尾不计入站立身高。数字是设计方向，不是测量或模型遵守的保证。

`--design-freedom reference_preserve` 是未授权改造型时的默认；用户明确允许服装、造型优化或希望再设计时，用 `--design-freedom moderate`。后者保留人物辨识度与表观年龄，释放可见服装构造与造型的硬锁：先写一套连贯方案，再调整衣片、领袖、腰部、饰物、材料和配色比例；不要在负向提示中把这些设计变化逐一禁止。表情可按当前任务独立适配，不因保持身份而锁定原神态。方案可从优秀效果图提取，但不能把标杆人物的脸也迁移过来。现代装和铠甲按实际角色路线写文本，不强套古风长袍预设。此选项只用于新候选生成，不能混入 `full_body_anchor` 或局部编辑阶段。

`--presentation neutral_asset` 兼容原有预设；`costume_showcase` 适用于需要长袍层次与袖摆的服装定妆展示，允许原设计的宽裙、短拖尾与自然遮鞋，修长感通过颈肩腰和长衣片组织。它不改变脸、年龄、材质与用户显式选择的手势。需要填写本套衣服的具体构造，不能直接把通用提示词当作完整设计。

`--reference-mode portrait_expand` 为默认扩身路线；`full_body_anchor` 保留已给全身造型的脸、渲染、手势、材料和光线，比例以黄金九头身为硬约束：已达标则保持，未达标则协调调整身体与服装贴合，不编造新衣层。后者只用于保留式生成，拒绝相冲突的预设覆盖或编辑锁；局部修复直接选 编辑阶段与焦点。遇到用户提供更好的旧图时读取 [标杆对照](benchmark-costume-refinement.md)。

面容配置有 `beauty_first_clean`、`beauty_first_character`、`humanized_real_light`、`humanized_real_full`、`stylized_beauty`。切换只改变面部渲染，不顺带改变年龄目标、手势或服装。年龄独立选择 `youthful_18_22`、`young_adult_20_26` 或 `none`；后者保留参考年龄，不能据此推断人物年龄。默认成年青年预设与参考年龄不符时，选择 `none` 并在最终文本明确用户的年龄要求。

旧 `face` 编辑阶段只修面部渲染，保留原表情；`full_body_anchor` 属于明确保留式生成。这些局部锁定不适用于已授权的表情改案。需要适配或修改表情时用生产入口的 expression 通道，独立写明眼神、眉眼与唇部动作及身份保留范围。

`asset-master-plan-v082` 和 `ancient-white-asset-plan-v082` 保持兼容，也支持脸、手、年龄与展示型覆盖。`--reference-mode` 仅由 `asset-prompt` 接收。计划不表示阶段已完成。新消费者使用 `asset-prompt` 获取编辑文本。

生成阶段采用独立的 `generation_prompt_translation` 材质条款：材料来自可见参考或明确补全方案，不能把“禁止局部编辑新增衣层”套到已授权的扩身设计。素面区域包括同色提花也应保持无纹样；厚薄区别来自织物重量、褶皱尺度、透叠和光泽，不统一改成锦缎或同一种细碎褶皱。局部材质编辑仍使用原来的 `prompt_translation`，只调整已有面料，不新增纱层和装饰。新图中的素面范围应在补全方案中具体写明。

## 按可见问题决定提示词细节

不把长短作为质量结论。相同参考与相同造型说明下，简洁的参考驱动文本可以生成完整候选；详细编译文本也可能改善花纹分区、内层可读性或白底表现。先看实际输出中哪些信息缺失，再决定补充或删除哪些条款。没有重复或冲突时，不为了缩短字数删掉已有效的材质、手势或取景说明。

对简单布袍，可先明确布料的干湿光泽、织纹、领型和补全范围；对织锦层叠造型，通常还需要说明花纹集中处、浅色内层与主要衣片的关系。服装适度优化意味着允许有依据的设计变化，不等于只能用简短文本，也不等于默认堆满额外装饰。

比较简洁版与编译版时，为两组保留相同的实际图片和参考专属说明，记录编译参数与完整文字。通用段落的语义也不同，就标作两套提示方案的比较，不宣称是“只改变字数”的单变量实验。历史原始证据可从 Git 历史追溯。本轮没有足够证据改变编译器默认输出或新增简洁模式。

## 返回图与局部迭代

先实际查看返回图。身份漂移优先于美化；如果只有一个局部问题，直接使用对应 focus。无需为了遵循阶段列表重做已通过的脸或比例。

| 问题 | stage | focus | 保持 |
| --- | --- | --- | --- |
| 脸的渲染方向不对 | face | 不填 | 身份几何、年龄、非面部设计 |
| 手部粘连 | structure | hands | 既有手势、比例、构图、鞋履 |
| 长袍压低身高感 | structure | proportion | 脸、手、服装构造、相机取景 |
| 裁切或鞋履不可读 | structure | framing | 脸、比例、服装设计 |
| 衣料混为同一材质 | material-light | materials | 脸、比例、光位、背景 |
| 白纱融入白底 | material-light | lighting | 脸、比例、既有材质与纹理 |

```bash
node scripts/iteration-director.mjs asset-prompt --stage structure --focus hands --passed fashion_asset_proportion,asset_framing --format text
node scripts/iteration-director.mjs asset-prompt --stage material-light --focus materials --format text
node scripts/iteration-director.mjs next --failures material_layers_merged
```

`--passed` 是人工已验收的维度或阶段名，以逗号分隔。若本轮试图改动它，编译器拒绝输出；缩小 focus，或仅在用户明确要重开该维度时移除锁定。阶段计划中的 `requires_accepted_rounds` 表示前提，不是验收记录。无 focus 的结构/材质光线阶段用于确实有多个相关问题的情况。

身体比例的历史名称 `body_proportion`、`fashion_proportion` 与当前 `fashion_asset_proportion` 在保持已通过结果时按同一维度处理。传入完整轮次名称，还会保持该轮次原本可编辑的维度；不会把该轮次继承的其他锁定项自动认定为已经验收。计划中的 `accepted_locks` 展示展开结果，仍只是调用方声明，不是程序检查过图片。`round`、`next`、`proportion-plan` 与 `asset-prompt` 共用此处理，发生冲突时不再默默丢弃已通过项。只修手部可继续保持已通过比例；更窄的独立生产任务按实际授权撰写。

## 视觉回归

保持相同参考、基础母图、模型设置和画幅，A/B 只更换面容配置。两组编辑从同一母图开始，不能把 A 的结果作为 B 输入；如果平台支持种子可记录，但相同种子也不是严格同条件的保证。

用 [记录模板](../../templates/visual-regression-record.json) 保存参考路径/标识、母图、实际输出、最终提示词、可获得的模型设置和人工评审。未支持或未知的参数填 null。至少分别检查身份、年龄、脸部方向、比例、可见手部、服装连续性、材料和白底分离；遮挡不可判断的项记录 `not_assessable`，不能视为通过。

编译回归只证明配置和范围正确，真实改进必须由输出图比较支持。单张结果也不能证明批量稳定性。

服装展示回归额外检查：袖摆是否与手势连贯、腰线与前中长衣片是否清楚、宽摆是否仍有重量、密集花纹和安静区域是否互相衬托。对比不同输入权限时使用 [标杆回归模板](../../templates/benchmark-comparison-record.json)，不要把加入全身母图的结果当作纯提示词的 A/B 胜出。

## 依据

- [Anthropic 技能编写实践](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)：保持入口精简，按任务逐步加载参考，以实际行为评估技能。
- [OpenAI图像提示指导](https://developers.openai.com/api/docs/guides/image-prompting)：局部编辑明确要改与要保持的内容，迭代使用前一张已接受图像。

检索日期：2026-09-29。以上原则用于组织本地技能；P9、年龄范围和材质层均为项目预设，不是厂商参数或生成质量保证。
