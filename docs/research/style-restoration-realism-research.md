# v0.7.2 Research Notes — Style Restoration & Realism Merge

Checked: 2026-09-26

## Vendor-documented findings

### OpenAI
Official image prompting guidance recommends:
- identify what changes and what stays fixed
- assign explicit roles to multiple reference images
- refine edits deliberately, often one change at a time
- inspect identity/detail preservation after each edit

Sources:
- https://developers.openai.com/api/docs/guides/image-prompting
- https://developers.openai.com/api/docs/guides/image-generation

### Midjourney
V8.2 Edit Model supports written edit instructions and up to four reference images. Style Reference is specifically for overall look/feel such as color, medium, texture and lighting rather than copying people/objects.

Sources:
- https://docs.midjourney.com/hc/en-us/articles/48495453462797-Edit-Model
- https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference

### Gemini
Gemini image models support editing and multi-reference workflows. The model does not remove the need to clearly state which reference is responsible for which element.

Source:
- https://ai.google.dev/gemini-api/docs/image-generation

### Seedream
Official API guidance warns that overly long prompts may disperse attention, supporting the project decision to keep provider prompts denser than the internal plan.

Source:
- https://docs.volcengine.com/docs/ark/image-generation-api?lang=en

### FLUX.2
FLUX.2 supports multi-reference image editing. Its prompting guide says word order matters and recommends putting the most important subject/action/style/context earlier. It also does not support negative prompts.

Sources:
- https://docs.bfl.ai/flux_2/flux2_image_editing
- https://docs.bfl.ai/guides/prompting_guide_flux2

## Project heuristics, not vendor facts

The following are image-prompt-skill design decisions and require continued empirical testing:
- S0–S3 Style Restoration intensity
- R0–R3 Reality Gain levels
- `hybrid + S2 + R2` as the current default for cinematic character restoration
- priority ordering P0/P1/P1M/P2/P2R/P3/P4
- material layer model and lighting reconstruction schema

These should not be presented as universal model laws.
