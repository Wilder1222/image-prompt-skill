# 保持原任务风格的标准化

所有人物仍执行[共同身材规则](../core/fashion-proportion-system.md)：苗条、修长舒展、适当有肌肉的黄金比例美化。标准化不自动豁免身材，原图只作为身份和可见设计依据；已达标保持，未达标另建身材美化版本。明确仅限局部的操作保持本步骤边界，身材不足独立待修，近景不证明隐藏全身。

用户要求在原图任务与风格基础上统一调整时，默认采用 `task_style_preserve`。标准化整理质量和阅读层次，不把所有图转换为同一证件照、同一张脸、摄影棚或摄影媒介。原图仍是唯一身份与画面基准，新版本是候选。

## 按用途确定调整

| 原图用途 | 可统一的质量 | 要保留的区别 |
| --- | --- | --- |
| 风中电影近景 | 面部可读性、受光层次、发束与环境边缘层级 | 原暖侧后光、亮边、暖金赭红关系、回眸与横向发束动势 |
| 妆肤微距 | 妆肤、发丝与饰件的反射和焦点层级 | 原偏侧角度、紧裁切、青粉妆色、皮肤微纹理；不补完整发冠 |
| 人物与双兽环境图 | 面容与双兽各自阅读空间、材料区别、画框局部余量 | 原可见两张兽脸、高低前后与体量关系、衣发动态、石构环境 |
| 荷塘坐像 | 柔光下的人物阅读、衣景笔触和前后层次 | 原坐姿和手部支撑、荷叶荷花、水面与石台、原绘画媒介 |
| 精细面容与绘画衣景肖像 | 精细面容与宽衣料笔触的清晰度层级 | 蓝黑赭红色块、既有额饰和华饰、原握持与遮挡、混合媒介 |

取景微调依据当前用途。有意紧裁切不记作“头饰不全”的自动失败；环境人物图不因生物或植物占画面而删减主体；画外身体、发冠和物件端部不为统一画框补成来源事实。固定“上方四分之一、头只占一半、仅到肩顶”不是默认标准。

中性背景、统一正面与中性光属于另一个任务。只有用户明确要求肖像对照时，另建 `portrait_comparison` 目标并保留其请求；仍保护本人、媒介、基础肤色、妆色、发型衣饰以及实际可见结构。重要环境、生物、持物的隐藏或移除需要该请求明确说明，不能顺带取消。

## 原肖像与原妆容一致性

每张图仅以自己的原图保护肖像与妆容，不从同类参考或其他人物借脸、眼色、额饰或妆面。肖像核对实际可见的脸型、眉眼和眼距、鼻唇人中下巴、自然不对称、肤色年龄观感与眼部颜色；妆容另核对眉妆、眼线眼影睫毛、腮红、唇妆的形状位置、分布范围、色彩浓度、边缘过渡、原额饰或痣，以及原有光泽和肤感。

明暗校准保持原受光与妆色关系，不借提亮重新描眉、加眼线、换唇色、放大眼睛、磨平皮肤或追加颗粒。高光、阴影与真实妆色分别判断；C02青蓝眼部只保留原可见颜色，不宣称天然瞳色。被发丝遮挡的妆面、画外另一侧和小脸未展示细节保持未知。

肖像与妆容分别进入强制正文、关键验收和编辑保护。任一可见保护项失败或不确定，候选不替换原图；“人物相似”“更精致”及环境或风格通过均不能抵消。新要求重建新目标，已有四张试样的冻结检查、身份不确定及风格失败不回填成新标准通过。

## 生成与保护契约

[style-standardization.mjs](../../scripts/style-standardization.mjs) 提供：

```js
buildStyleStandardizationPlan({
  id: 'C05-style-standardization-v1',
  asset_id: 'VP-C05',
  original_reference_id: 'ORIGINAL', // 默认值
  mode: 'task_style_preserve',       // 默认值
  scope_format: 'compact',          // 新编写计划可选；旧计划省略时保持详细格式
  standardization_goals: [
    'readability', 'task_framing', 'tonal_hierarchy', 'edge_hierarchy'
  ],
  protected_observations: [
    // 索引来自该资产 observations 全数组，须先看实际原图再选。
    {dimension: 'pose', observation_index: poseIndex},
    {dimension: 'scene', observation_index: sceneIndex}
  ]
}, {catalog});

applyStyleStandardizationPlan(authoredBrief, plan, {catalog, base_dir});
```

计划依据 `framing` 和 `subjects` 推导任务类型。`task_type` 可为 `macro_portrait`、`scene_character`、`character_portrait`、`full_body_character`、`scene`、`product`、`other`；明确来源类型只能沿用，不能用 override 把微距、环境人物改为普通肖像。未分类的单人物画框才允许声明相容类型；换用途另建明确任务。一人与生物、环境组合仍是 `subject_kind: character`；多个人物身份混合与多造型拼板不适用。

质量目标只允许五类：`readability` 可读性、`task_framing` 符合当前任务的画框微调、`tonal_hierarchy` 原受光下的明暗层次、`edge_hierarchy` 符合原媒介的边缘层级、`material_separation` 原材料的反射区别。不接受借质量目标夹带换光、换脸、换背景、全画面锐化或新配件的任意正文。

默认目标按用途选择：微距及环境人物先整理可读性、原受光层次、媒介边缘与材质区别，不默认改画框；普通肖像包含符合当前取景的微调；全身与对象展示包含画框和材质层次。显式选取 `task_framing` 仍受原取景、主体关系与不可见范围约束。

原观察完整保留在审计中。通用类别保护以当前原图可见范围为准；只有显式选择的 `protected_observations` 才把具体观察加入强保护。`partial` 只保护可见部分；`unknown` 独立保留为不可判断，不生成严格复刻要求，也不能因候选近景清楚而升级为来源通过。偏好图的 `transfer` 描述不是本次的强制修改指令。

应用时核对图库 `source.local_path` 的当前文件 SHA 和实际图像输入字节。来源必须 `local_verified`；`actual_pixels` 和 `historical_pixels` 都可在本轮实际原图引用 `inspected: true` 且 SHA 相符时使用，保留原观察时期记录，不把历史观察改为本轮像素分析。`record_only`、缺失来源或未绑定 SHA 不可派发。默认仅送入唯一原图，并以同一原图为编辑基准；候选、标准化图或错 SHA 文件不能代替它。已有 RP 身份绑定保留；C 系列视觉偏好图不会自动获得一个新 RP 身份预设。角色、衣饰、生物、环境、媒介、配色、原光线、神态及动作的保护与质量目标进入正文、requirements、acceptance 和 edit_scope。

完整计划作为 `requirement.style_standardization_plan` 冻结进入 target。生产冻结和核验调用 `assertStyleStandardizationBindings(references, requirements)`，核对计划哈希与实际原图 SHA，防止 apply 后文件变化被误记为另一原图。计划仅声明契约，不提供图像、蒙版、姿态或深度控制，也不宣称工具启用了这些能力。

如仅允许面部暗部的微小亮度补偿，可选择 `standardization_goals: ['tonal_hierarchy']` 与 `change_variant: 'face_tonal_only'`，见[荷塘原风格示例](../../examples/style-preserving-standardization.json)。此声明收窄修改范围，不保证生成工具实际只改这些像素；需已有真实本地原图才能构建，示例自身不是已冻结或已派发的证据。完整保护文本、关键验收、原图基准及范围保护须继续存在，不能在 apply 后删保护项或将允许变化改成任意换光换背景。

已派生 brief 禁止再次叠加本契约。更改模式、输入、选定细节或质量目标时，从原始 authored brief 重建计划与快照，保留历史失败；旧 `edit_scope.changes` 不沿用为本轮授权。原有必须目标仍保留，agent 在生成前核对其意义，发现旧灰底、平光或换脸条款与当前目标冲突时先重写 authored brief。

`scope_format: 'compact'` 仅将 edit_scope 中的允许变化及保护摘要写成简短边界；所有具体观察、详细视觉正文、必须目标和逐项验收继续冻结。省略或使用 `detailed` 保持已有格式，不重写旧快照。需要检查正文与范围是否重复时，用 [提示词质量审查](prompt-quality-review.md)定位；不要在已派生契约上随意删除保护项。

## 评审

逐项查看原图与候选，先检查本人、内容与风格，再判断质量变化。标准化、肖像、媒介、环境/生物关系及来源可判断程度分别报告，工程通过不表示视觉通过。

原图已经满足本轮质量目标的部分可以原样保留，不为证明“已处理”强行重绘。优先一至两张代表图试产；即使正文只要求微小明暗校准，工具也可能改变金纹、颗粒、笔触和面容边界，须依据实际对照决定是否展开。同一问题连续两轮无明确改善时停止该修订路线，提出具备不同控制能力的方案，保留全部失败与原图；不能用新目标重评分旧测试。

`validateStyleStandardizationChecks(plan, {plan_sha256, checks})` 要求每个冻结检查恰好一次，附 verdict 与证据。不可判断的原观察只能继续标 `uncertain` 或 `not_assessable`。它只核验评审声明，不替代实际看图、不认证视觉质量，也不代表用户接受。
