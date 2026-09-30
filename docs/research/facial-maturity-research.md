# 面容成熟感、气质参考与迭代编辑研究笔记（中文整理）

原版本：0.7.1；原记录核对日期：2026-09-26。

中文整理来源：提交 `a0432e3657152d696330a021311688462f1d31dd` 中的同路径文件；原文件 SHA-256 为 `b7efc58b817e43330b2d70b9bff1cb5b1401dc0b9b3fc52be0316a5a36b5459a`。[查看保留的历史原文](https://github.com/Wilder1222/image-prompt-skill/blob/a0432e3657152d696330a021311688462f1d31dd/docs/research/facial-maturity-research.md)。此处为中文整理与适用边界说明，不是新实测记录。

本轮整理历史内容并保留原有来源，不把旧日期的核对冒充当前核验。厂商版本、参考额度与编辑入口可能变化，执行时以 [工具适配公共规则](../../references/providers/provider-adaptation.md) 和当次接口为准。

## 一、原记录中的官方图像编辑建议

**OpenAI**：原笔记归纳了明确区分变化项与保持项、按图序和目的指定参考职责、有目的地逐项迭代，以及每次检查身份和非预期变化的建议。[原列图像提示指南](https://developers.openai.com/api/docs/guides/image-prompting)

**Midjourney**：原笔记记录编辑模型可接受文字编辑指令及当时最多四张参考，并区分编辑中的直接修改指令与常规生成中的最终画面描述。这是历史容量记录，不作为当前固定上限。[原列编辑模型文档](https://docs.midjourney.com/hc/en-us/articles/48495453462797-Edit-Model)

**Gemini**：原笔记记录第三代图像模型的多参考及部分版本的人物一致性额度。此能力可支持参考分工，但不代表模型自动理解各图权限，也不表示所有轻量版本具有相同能力。[原列图像生成文档](https://ai.google.dev/gemini-api/docs/image-generation)

**FLUX.2**：原笔记记录多参考编辑、身份连续性及重要信息靠前的提示建议。原来源为 [概览](https://docs.bfl.ai/flux_2/flux2_overview)、[图像编辑](https://docs.bfl.ai/flux_2/flux2_image_editing) 和 [提示指南](https://docs.bfl.ai/guides/prompting_guide_flux2)。

**Seedream**：原笔记记录第五代支持多参考，以及过长提示词可能分散注意力、遗漏细节的接口建议。[原列接口文档](https://docs.volcengine.com/docs/ark/image-generation-api?lang=en)

## 二、原记录引用的成熟感知研究

### 幼态面容的组合特征

原笔记归纳的研究将较大眼睛、较圆脸型、较高眉位、较小鼻或下巴等组合与幼态印象联系起来。这些属于群体层面的感知研究，不能直接作为修改某个人五官的处方，更不能将其套成通用漂亮脸。

原来源包括 [布兰迪斯大学收录的 1992 年研究](https://scholarworks.brandeis.edu/esploro/outputs/journalArticle/Impressions-of-Babyfaced-Individuals-Across-the/9924057013701921) 和 [中国面孔幼态研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC4886646/)。

### 面部对比与年龄印象

原笔记记录五官与周围肌肤的对比变化可能影响女性面孔的年轻印象，并引用跨文化结果。项目因此把妆容对比作为成熟感线索之一，不只依赖五官几何。不能据此无限加重眼妆或改变身份。

原来源：[面部对比研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC3590275/)、[跨文化研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC5524771/)。

### 肌肤中的年龄线索

原笔记将皱纹、松弛与肤色变化归为年龄感知线索。项目推论是：当目标为减少幼态但仍保持年轻时，不用这些老化线索代替神态或妆容调整。[原列研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC11102750/)

## 三、研究归纳与项目规则的边界

原笔记归纳的研究概念包括：成熟感受形状和纹理、对比等多种线索影响；幼态印象与特征组合有关；面部对比可能影响年轻感；皱纹与松弛提供年龄线索。

项目自行设计的内容包括：M0–M4 成熟感阶梯、用于特定年轻精致案例的 M2.5、三级线索排序、美感校准规则，以及气质参考可借与禁止借用的范围。

这些内部规则旨在帮助表达和修订，需要通过实际输出验证，不是心理学量表或工具参数。当前任务允许表情与妆容自然适配，但保持人物辨识和已确认年龄；精致、高级不固定等于冷脸或轻熟。
