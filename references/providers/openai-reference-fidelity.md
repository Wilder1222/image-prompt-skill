# OpenAI GPT Image v0.7.3 Reference Fidelity

OpenAI 官方图像提示指南明确建议为每张参考图分配角色，并在编辑时分开说明“改变什么”和“必须保持什么”。因此本 Skill 的 Reference Fidelity Matrix 在 GPT Image 上编译为自然语言职责，而不是虚构数值权重。

## 单参考白底资产

先声明：
- reference controls identity/costume/material language
- environment is not inherited
- unseen regions are conservative extensions

再写：
- preserve exact visible identity/garment architecture
- complete lower body conservatively
- keep design density and wear state
- increase H2 human presence

## 多参考

每张图按用途编号。不要用“综合参考所有图片”这种模糊语句。

## H2 Human Presence

用软组织、区域皮肤反射、自然非对称、镜头响应表达。不要只追加 pores / 8K / photorealistic。
