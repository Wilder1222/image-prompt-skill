# 中文分类提示词与两条资产路线

本页保留两份已有案例的比较；完整人物风格能力见 [人物风格选择与适配](character-visual-styles.md)，包括真人、CG、三维、动画与绘画。不要将这两份古风案例当作全部风格范围。

以下是审美知识与对照样例。实际任务先走 [提示词生产流程](prompt-production.md)，由参考和描述决定内容；不是先选本页模板再填空。分类与模式只帮助组织表达，不证明效果。

用户提供两份参考提示词作为编写范式。共同要求是单一人物身份、正面完整全身、白底、精致面容美感与协调的九头身时装观感。两份范式有不同的表面表现，不能因背景都是白色而统一真人化。

| 视觉要求 | 古风材质定妆照 | 东方幻想原画资产 |
| --- | --- | --- |
| 整体表现 | 精致定妆摄影感，衣料具有真实厚度与反射 | 保留厚涂原画、柔和笔触和幻想气质 |
| 面部 | 自然精致妆容与轻度真实肌肤 | 保留冷艳精致原画面容，不强行照片化 |
| 身体 | 修长匀称，头肩、完整躯干和四肢共同协调 | 同样保持完整人体结构，不用缩头或拉腿追求修长 |
| 细节 | 面料重量、透光、织纹、缝合与反射差异 | 面部与主饰最清楚，大衣片中等细节，边缘选择性概括 |
| 亮度 | 面部与邻近头饰为重点，衣摆高光克制 | 面部与主饰突出，次要金属和裙摆不争夺焦点 |
| 边缘 | 柔光下真实的发丝、纱边与接缝 | 焦点结构清楚，发梢、披帛、次要裙边保留笔触 |

使用 [当前生成示例](../../examples/ancient-white-asset-current-prompts.md) 编译通用规则，或对照 [两份参考专属提示词](../../examples/user-reference-tagged-prompts.md) 理解每类应填写的可见内容。后者是用户范例的分类整理，不是本版本生成实测。第一份已有用户提供的成功结果，第二份只有提示词范式，不冒称有配套新图。

## 分类与调整

角色新图默认使用十类标签：人物身份与面容、妆容与肌肤、发型与头饰、服装设计、材质与服装真实感、构图与姿态、身材比例、手部与脚部完整性、背景与灯光、最终目标。第二份的“风格要求”归入核心目标及材质/边缘要求，“限制项”归入相关类别与最终目标；也允许用户保留自己的语义标签。标签只写类别名称，例如 `【人物身份与面容】`，不加数字、中文序号或优先级编号。

不要只列标签或模式代号：每类必须描述能看见的结果。参考专属的发色、脸型、纹样、主色、配件与衣片要填入对应类别；泛化规则不能代替服装采集。默认按参考保留设计，用户授权适度优化时可调整衣片和造型细节，但不替换人物身份或核心风格。

人物身材默认协调、修长好看，不强制九头身；检查头颈肩、完整躯干、自然腰线及四肢，不通过极端缩头拉腿或加长裙摆凑数。人物占画面大小和留白另行设计，按 [取景规则](../core/character-framing.md) 处理。明确数字仅按本轮用户要求选用。

## 编译

```bash
node scripts/iteration-director.mjs asset-prompt --style-workflow material_realistic_asset --format text
node scripts/iteration-director.mjs asset-prompt --style-workflow dark_fantasy_asset --format text
node scripts/iteration-director.mjs asset-prompt --detail-budget concept_art_priority --edge-control painterly_selective --format text
```

可分别调整 `--detail-budget material_priority|concept_art_priority`、`--highlight-hierarchy focal_brightness`、`--edge-control soft_realistic|painterly_selective`；正文必须反映设置。当前资产模式配置以 [资源目录](../../resources/asset_style_workflows.json) 为准，历史原画目录中的 `selective_painterly` 是旧名，不是当前资产命令的选项值。

CLI 和 `compileAssetPrompt()` 都默认中文；显式 `language: 'en'` / `--language en` 输出同样有类别的英文。已有程序若依赖旧的默认英文，需要显式指定。旧模式标签只作为理解意图的输入，最终文本不保留设置块、参数赋值或孤立代号；其效果融入各类自然语言描述，也不作为 API 字段发送。

纯保留完整母图使用 `full_body_anchor`，拒绝风格、比例或细节覆盖。局部修复按已接受图保留风格，不因为选择某个工作流重新处理整个角色。内部英文计划片段不属于最终交付；所有最终新图提示词仍需分类并保存实际提交正文。
