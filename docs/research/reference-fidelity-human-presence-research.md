# v0.7.3 参考忠实度与人物生命感研究记录

这是历史记录的中文译文，保留原核查日期与来源网址；本次未重新核验厂商能力或研究结论。历史默认不覆盖当前用户要求和主流程。不可变原文见[源提交](https://github.com/Wilder1222/image-prompt-skill/blob/60a7c258dd74bc4f832227bc8eea0ebc6eb8e1ac/docs/research/reference-fidelity-human-presence-research.md)，摘要见[译文来源](../历史报告译文来源.json)。

原记录核查日期：2026-09-26。

## 原记录中的官方模型指导

### OpenAI
原记录将官方图像提示指导归纳为：明确参考职责，区分编辑目标与保持约束，一次围绕一项变化迭代。项目据此采用逐参考通道权限和范围明确的局部修复。

来源：https://developers.openai.com/api/docs/guides/image-prompting

### Midjourney
原记录称，V8.2 编辑模型支持最多四张参考图，与风格参考不同。风格参考传达整体观感；编辑模型的参考可用于保持人物或物体并进行编辑。项目据此区分身份、资产与风格通道。

来源：
- https://docs.midjourney.com/hc/en-us/articles/48495453462797-Edit-Model
- https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference

### Gemini
原记录称，Gemini 3 图像模型支持多参考，并具有特定的人物一致性支持范围。官方编辑示例明确要求只改变指定元素，同时保留风格、灯光和构图，项目据此隔离编辑范围。

来源：https://ai.google.dev/gemini-api/docs/image-generation

### FLUX.2
原记录称，FLUX.2 支持多参考编辑；官方提示指导强调提前放置重要主体、风格和语境信息，并推荐明确的自然语言结构。项目据此将严格资产连续性要求编排在次要风格和细节指令之前。

来源：
- https://docs.bfl.ai/flux_2/flux2_image_editing
- https://docs.bfl.ai/guides/prompting_guide_flux2

## 项目结论

下列是项目经验规则，不是厂商原生控制参数：
- 参考忠实度 0–3。
- 补全等级 C0–C3。
- 人物生命感 H0–H3。
- 设计密度锁定。
- 磨损状态 W0–W4。

其作用是将用户意图转化为更稳妥、易维护的提示词与验收标准。
