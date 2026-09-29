# Seedream — Facial Trait Calibration v0.7.1

Seedream supports multi-reference image generation, but the official API notes that overly long prompts can disperse attention. For trait calibration, compress the edit into one objective:

```text
保持A图人物五官结构不变；B图仅参考轻熟、高级、沉静的面部气质。减少幼态感，眼神更稳定，面颊软组织略收，妆容更克制；不改变脸型、眼距、鼻唇、下颌，不引入B图服装、背景和光线。
```

Do not repeat the full costume description during a face-only repair round.
