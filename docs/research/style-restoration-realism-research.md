# v0.7.2 风格恢复与真实感融合研究记录

这是历史记录的中文译文，保留原核查日期与来源网址；本次未重新核验厂商能力或研究结论。历史默认不覆盖当前用户要求和主流程。不可变原文见[源提交](https://github.com/Wilder1222/image-prompt-skill/blob/60a7c258dd74bc4f832227bc8eea0ebc6eb8e1ac/docs/research/style-restoration-realism-research.md)，摘要见[译文来源](../历史报告译文来源.json)。

原记录核查日期：2026-09-26。

## 原记录中的厂商文档归纳

### OpenAI
当时的官方图像提示指导被归纳为：
- 明确哪些内容改变、哪些保持。
- 为多张参考图分配明确职责。
- 有目的地迭代编辑，通常一次处理一项变化。
- 每次编辑后检查身份和细节是否保持。

来源：
- https://developers.openai.com/api/docs/guides/image-prompting
- https://developers.openai.com/api/docs/guides/image-generation

### Midjourney
原记录称，V8.2 编辑模型支持文字编辑指令及最多四张参考图；风格参考专用于色彩、媒介、纹理和光线等整体观感，而非复制人物或物体。

来源：
- https://docs.midjourney.com/hc/en-us/articles/48495453462797-Edit-Model
- https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference

### Gemini
原记录称，Gemini 图像模型支持编辑与多参考工作流。即便模型支持多参考，仍需明确每张参考负责哪些元素。

来源：
- https://ai.google.dev/gemini-api/docs/image-generation

### Seedream
原记录将官方接口指导归纳为：过长提示词可能分散注意力。因此，项目当时选择让提交厂商的提示词比内部计划更紧凑。

来源：
- https://docs.volcengine.com/docs/ark/image-generation-api?lang=en

### FLUX.2
原记录称，FLUX.2 支持多参考图像编辑；提示指导强调词序，建议将最重要的主体、动作、风格和背景语境提前，并称不支持负向提示词。

来源：
- https://docs.bfl.ai/flux_2/flux2_image_editing
- https://docs.bfl.ai/guides/prompting_guide_flux2

## 项目经验规则，不是厂商事实

下列属于 image-prompt-skill 当时的设计决策，需要持续实测：
- S0–S3 风格恢复强度。
- R0–R3 真实感增益等级。
- 将 `hybrid + S2 + R2` 用作当时电影感角色恢复的默认组合。
- P0/P1/P1M/P2/P2R/P3/P4 优先级次序。
- 材质分层模型与灯光重建结构。

这些规则不能被表述为适用于所有模型的普遍规律。
