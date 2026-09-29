---
name: image-prompt-skill
description: 根据参考图编写角色资产图、全身定妆照、风格还原与局部修复提示词；分离身份、服装、风格参考的权限，并根据返回图规划下一轮修改。适用于角色图提示词和迭代诊断，不替代通用图像生成工具。
---

# Image Prompt Skill

先识别用户要的是新图提示词、现有图局部编辑，还是返回图诊断。只交付所需内容；请求提示词不代表请求执行图像生成。使用用户的语言。

## 参考图与意图

- 查看实际参考图后，再描述可见脸部特征、发型、服装结构、材质与光线。参考不可见时说明限制，不从旧示例借用发色、性别、年龄或服装。
- 区分身份参考、风格参考与当前编辑母图；每个属性只指定一个主来源。需要多参考时读取 [参考权限](references/core/reference-authority-matrix-v080.md)。
- 用户提供「之前更好的结果」时，先读 [标杆对照与定妆展示](references/routes/benchmark-costume-refinement.md)：提取可见的姿态、轮廓、层次与材质优势；区分审美标杆和完整造型母图。已有好图可以直接保留，不默认重做脸或身体。
- 可见设计可以锁定；遮挡与未入画区域只能标为推断或设计延展。半身扩全身时读取 [可见与推断](references/core/visible-inferred-detector.md)。
- 用户指定的身份、年龄、比例、姿态、画幅和背景优先于预设。古风成年女性白底预设只是一个案例，不能成为所有角色的默认脸型或年龄。
- 用户允许服装或造型优化时，采用适度再设计：保留人物辨识度与气质，允许按本轮方案调整可见衣服的衣片、袖型、腰饰、配色比例、饰品和姿态，不只补全未入画部分。不要把“身份保留”误写成“全部造型冻结”；明确哪些是再设计。CLI 使用 `--design-freedom moderate`；保留母图和局部修复仍按其原范围执行。

## 选择所需路线

| 当前请求 | 读取 |
| --- | --- |
| 古风全身白底资产、模式对比、局部修复 | [当前资产工作流](references/routes/asset-master-workflow.md) |
| 现代服装、铠甲、带守护形象的复杂造型或多套服装 | [角色资产流程](references/routes/character-asset-pipeline.md) |
| 保留参考画风、场景气氛或风格与身份融合 | [风格目标流程](references/routes/style-target-fusion-pipeline-v080.md) |
| 真人感、风格化脸、美感方向选择 | `resources/face_profile_v082_catalog.json`；需要旧模式兼容时读取 `resources/face_mode_catalog.json` |
| 面容气质与身份不一致 | [身份与气质诊断](references/core/identity-vs-temperament-diagnostics.md) |
| 返回图问题排序 | [迭代修复](references/routes/iterative-repair.md)，`resources/diagnostic_catalog.v07.json` |

按任务读取对应参考，避免加载所有历史文档。`docs/v0.*` 是历史快照，当前行为以此入口、当前工作流、资源目录和运行结果为准。

## 提示词交付

用可见的主体、服装构造、材质反应、姿态、光位和构图描述目标。内部模式名和预算只是规划标识，不是图像模型参数。需要脚本时使用 Node.js 22+，工作目录为此技能目录：

```bash
node scripts/iteration-director.mjs asset-prompt --stage generate --format text
node scripts/iteration-director.mjs asset-prompt --presentation costume_showcase --maturity-guard none --format text
node scripts/iteration-director.mjs asset-prompt --presentation costume_showcase --design-freedom moderate --maturity-guard none --format text
node scripts/iteration-director.mjs asset-prompt --reference-mode full_body_anchor --format text
node scripts/iteration-director.mjs asset-prompt --stage material-light --focus materials --format text
```

首条命令仅适合上述成年古风白底预设。服装展示型按流动长袍的实际设计选用；不要将其自动用于短装、日常服或贴身铠甲。全身母图模式保留原来的脸、比例、手势与服装，不应用这些预设。调整人物、年龄、画幅或其他用户约束时，基于观察编辑最终提示词；CLI 仅暴露工作流文档列出的选项，不支持的选项会报错。

生成提示词覆盖本轮必要信息；编辑提示词先指出当前母图、允许变化和需要保持的内容，再写局部变化。不要把三轮编辑指令拼成一轮。保留已通过的身份与设计，发现漂移则回到最近通过的母图。

返回：可复制提示词，必要的参考角色说明，以及本轮需人工检查的重点。用户只要提示词时，不附加整份内部计划。

## 结果与验证边界

手指被自然遮挡时，只检查可见结构是否连贯，不能要求十指全部展开。长裙遮住关节时，不编造精确人体测量。九头身视觉是可选审美目标，不是所有人物的解剖标准。定妆展示也要检查脸、颈肩腰、袖摆轮廓、衣片层次和厚薄对比；鞋尖与落地关系可读时，不为了露出整只鞋而破坏长裙。

脚本只编译计划与文字，不查看图像，也不生成图像。`prompt_ready`、`planned` 与图像已生成、人工验收通过分开记录。使用 [视觉回归记录](templates/visual-regression-record.json) 留存真实输入输出与人工判断；没有对比图时保持 `pending`。

开发检查：`npm test`、`npm run validate`。修改发布文件后先运行 `npm run release:build` 更新当前清单，再验证。历史版本清单保留作为快照。

Codex 插件支持使用同一主工作流；插件入口、构建和个人安装方式见 [插件说明](docs/codex-plugin.md)。
