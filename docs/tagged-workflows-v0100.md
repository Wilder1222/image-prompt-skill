# v0.10.0：中文分类与双风格资产路线

2026-09-29 用户提供两份完整参考提示词，明确 P9 Fashion 是目标比例。v0.9.7 将比例失败解释为需要七至七点五头身，方向不符合这次澄清；其测试记录保留作历史，不能作为当前比例规范或通过证据。

本版本更新：

- 所有最终提示词按语义分类，角色生成提供模式块、核心目标和十类正文。P0/P1 只属于内部修复优先级，不代替类别。
- CLI 和程序库同样默认中文；英文需显式选择，仍输出分类标签。这是程序库默认语言的行为变化。
- 本项目古风预设恢复 beauty_first 与协调 P9 Fashion；自然比例仍可明确选择，完整母图保留原比例。
- material_realistic_asset 使用 material_priority、focal_brightness、soft_realistic；dark_fantasy_asset 使用 concept_art_priority、focal_brightness、painterly_selective。
- 模式实际改变细节分布、表面表现和边缘正文；幻想原画路线不自动执行摄影抛光，也不接受互相矛盾的强制真人面部预设。
- 参考专属范例独立保存；黑白金红、花饰、冠饰和具体脸型不成为所有角色的统一身份。
- 局部编辑继续保留已验收范围，模式选择不自动重开造型、比例或光线。

第一份成功结果由用户提供，作为美感、服装材质和比例的效果标杆，不记成本版本工具生成。第二份是提示词范式。本轮实现与自动化检查不等于新图视觉验收；没有执行新的生图批次，不宣称比例问题已经通过图片验证。

交付文件：`SKILL.md`、`references/routes/tagged-prompt-workflows.md`、`examples/user-reference-tagged-prompts.md`、`resources/asset_style_workflows.json`。通用示例与当前计划通过 `npm run examples:build` 重新生成。
