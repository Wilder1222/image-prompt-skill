# Resolution / Upscale Policy

## 原则

真实像素尺寸与“4K / 8K”语义词是两回事。

## Generate

优先：
- 身份
- 构图
- 服装结构
- 材质
- 光线

只有目标模型/API提供真实尺寸参数时，才把尺寸作为设置交接。

## Repair

不要使用“4K、8K、ultra detailed”来解决：
- 人脸漂移
- 塑料皮肤
- 材质统一
- 裁脚
- 光线平

这些问题必须回到对应 Change Point。

## Final Upscale

当：
- Identity pass
- Asset continuity pass
- Material pass
- Lighting pass

之后再做：
- target pixel size
- upscale
- restrained sharpening
- denoise if needed

最终放大阶段不重新设计脸、服装和姿态。
