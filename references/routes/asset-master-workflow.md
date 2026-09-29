# 当前白底资产工作流（v0.8.4）

适用：成年古风角色从参考图扩展到完整全身白底资产，或对现有资产局部修复。默认案例为 `ancient_female_white_master`。其他主体、年龄、画幅与服装要求按用户和实际图像调整，不能套用案例外观。

## 配置与可复制输出

```bash
node scripts/iteration-director.mjs asset-prompt --stage generate --format text
node scripts/iteration-director.mjs asset-prompt --stage generate --face-profile humanized_real_light --format text
node scripts/iteration-director.mjs asset-prompt --stage generate --hand-mode relaxed_down_safe --format text
node scripts/iteration-director.mjs asset-prompt --presentation costume_showcase --maturity-guard none --format text
node scripts/iteration-director.mjs asset-prompt --reference-mode full_body_anchor --format text
```

`--format json`（默认）返回配置、文本、编辑范围和未生成图像的证据状态；`text` 只输出提示词。模式代码只保留在配置中。编译器输出英文；面向中文用户可译成中文，保持参考权限、编辑范围和遮挡语义。

支持选项：`--preset`、`--face-profile`、`--hand-mode`、`--maturity-guard`、`--presentation`、`--reference-mode`、`--stage`、`--focus`、`--passed`、`--format`。参数缺值、拼写错误、未知模式会失败，不会悄悄退回默认。

`--presentation neutral_asset` 兼容原有预设；`costume_showcase` 适用于需要长袍层次与袖摆的服装定妆展示，允许原设计的宽裙、短拖尾与自然遮鞋，修长感通过颈肩腰和长衣片组织。它不改变脸、年龄、材质与用户显式选择的手势。需要填写本套衣服的具体构造，不能直接把通用提示词当作完整设计。

`--reference-mode portrait_expand` 为默认扩身路线；`full_body_anchor` 则保留已给全身造型的脸、渲染、比例、手势、材料和光线，绕过通用预设，不编造新的下半身。后者只用于保留式生成，拒绝相冲突的预设覆盖或编辑锁；局部修复直接选 edit stage / focus。遇到用户提供更好的旧图时读取 [标杆对照](benchmark-costume-refinement.md)。

Face profile 有 `beauty_first_clean`、`beauty_first_character`、`humanized_real_light`、`humanized_real_full`、`stylized_beauty`。切换只改变面部渲染，不顺带改变年龄目标、手势或服装。年龄独立选择 `youthful_18_22`、`young_adult_20_26` 或 `none`；后者保留参考年龄，不能据此推断人物年龄。默认成年青年预设与参考年龄不符时，选择 `none` 并在最终文本明确用户的年龄要求。

`asset-master-plan-v082` 和 `ancient-white-asset-plan-v082` 保持兼容，也支持脸、手、年龄与展示型覆盖。`--reference-mode` 仅由 `asset-prompt` 接收。计划不表示阶段已完成。新消费者使用 `asset-prompt` 获取编辑文本。

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

## 视觉回归

保持相同参考、基础母图、模型设置和画幅，A/B 只更换 face profile。两组编辑从同一母图开始，不能把 A 的结果作为 B 输入；如果平台支持种子可记录，但相同种子也不是严格同条件的保证。

用 [记录模板](../../templates/visual-regression-record.json) 保存参考路径/标识、母图、实际输出、最终提示词、可获得的模型设置和人工评审。未支持或未知的参数填 null。至少分别检查身份、年龄、脸部方向、比例、可见手部、服装连续性、材料和白底分离；遮挡不可判断的项记录 `not_assessable`，不能视为通过。

编译回归只证明配置和范围正确，真实改进必须由输出图比较支持。单张结果也不能证明批量稳定性。

服装展示回归额外检查：袖摆是否与手势连贯、腰线与前中长衣片是否清楚、宽摆是否仍有重量、密集花纹和安静区域是否互相衬托。对比不同输入权限时使用 [标杆回归模板](../../templates/benchmark-comparison-record.json)，不要把加入全身母图的结果当作纯提示词的 A/B 胜出。

## 依据

- [Anthropic Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)：保持入口精简，按任务逐步加载参考，以实际行为评估技能。
- [OpenAI Image prompting](https://developers.openai.com/api/docs/guides/image-prompting)：局部编辑明确要改与要保持的内容，迭代使用前一张已接受图像。

检索日期：2026-09-29。以上原则用于组织本地技能；P9、年龄范围和材质层均为项目预设，不是厂商参数或生成质量保证。
