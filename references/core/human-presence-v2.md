# Human Presence v2

## 为什么 v1 不够

“毛孔、真实皮肤、真实发丝”仍然可以生成高质量 CG。Human Presence v2 把真人感拆成六个独立来源：

1. soft_tissue
2. regional_skin_response
3. natural_asymmetry
4. eye_anatomy
5. hair_irregularity
6. camera_response

## Soft Tissue

保持身份几何不变，但让：
- 眼睑有真实厚度
- 下眼睑有轻微体积
- 面颊存在年轻软组织
- 鼻翼不是硬建模边缘
- 嘴角有自然体积
- 下颌到脖颈为软组织过渡

## Regional Skin Response

不同区域必须有不同光学响应。真人感不通过“全脸更多毛孔”实现。

## Natural Asymmetry

只允许非常轻微的人体自然差异：眉毛高度、眼睑开放度、嘴角、局部高光。禁止把身份结构做歪。

## Eye Anatomy

重点检查：
- 眼球在眼眶中的包裹关系
- 上下眼睑厚度
- 内外眼角结构
- 睫毛根部，而不是黑色贴片
- 眼白不过度纯白

## Hair Irregularity

头发不是均匀细丝。使用主发束、次级发束、少量细软发与不均匀高光。

## Camera Response

真实人物感还取决于成像：柔和高光 roll-off、阴影细节、自然微对比、无全局数学锐化和边缘 halo。
