# 黑红金角色转为图4风格的历史计划

本文件是历史示例的中文整理，分类标签用于组织提示词；不据此宣称已执行新图或已获用户验收。旧白底、年龄、鞋履、姿态、发型、真人化和比例条件只属于当时案例，不覆盖当前主工作流与用户要求。原例中的“已接受”“已通过”保留其历史语境。

[不可变原文](https://github.com/Wilder1222/image-prompt-skill/blob/861084f7e612f7e69ab1b9ea07df7cc6753569dc/examples/black-red-image4-style-plan-v080.md)；源文件SHA-256：`e3b393f42b74076d6790bda0422891593dd7e40c9df66a17bfa16175f148aedb`。见[历史示例译文来源](../docs/历史示例译文来源.json)。


## 上轮输出诊断
白底黑红金结果作为服装资产成立，但没有达到所需最终风格，主要错误不在面部。原诊断标识：
- asset_mode_leak：资产模式外溢。
- style_target_underweighted：风格目标权重不足。
- style_medium_loss：媒介风格丢失。
- motion_language_loss：动作语言丢失。
- static_pose_leak：静态姿态残留。
- atmosphere_loss：氛围丢失。
- clean_catalog_lighting_leak：干净目录式布光残留。

## 当时确定的路线
- 渲染模式：cinematic_hybrid。
- 风格目标：图4。
- 资产母图：黑红金全身角色。
- 风格配置：oriental_epic_painterly。
- 当时默认面容模式：stylized_beauty。
- 风格强度：S2/S3之间，强保留媒介、动作、灯光和氛围。
- 真实感增益：仅R1–R2，不能抹除绘画媒介。

## 风格目标权限
严格继承绘画媒介、大幅流动动作、明亮轮廓或逆光、空间氛围深度及构图动势。
强继承配色关系与神话环境尺度。
忽略风格参考中的面容身份和衣装几何。

## 资产母图权限
严格保持人物身份、长黑发体系、金冠饰件、黑红金衣装构造，以及标志性腰肩饰物语言。

用户当时明确希望图4风格且未锁定静态资产姿态，因此允许姿态动态变化。
