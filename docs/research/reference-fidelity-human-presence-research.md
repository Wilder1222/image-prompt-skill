# v0.7.3 Reference Fidelity & Human Presence Research

Checked: 2026-09-26.

## Official model guidance

### OpenAI
Official image prompting guidance recommends assigning explicit roles to references, separating edits from constraints, and iterating one change at a time. This directly supports per-reference channel authority and narrow repair rounds.
Source: https://developers.openai.com/api/docs/guides/image-prompting

### Midjourney
V8.2 Edit Model supports up to four references and is distinct from Style Reference. Style Reference is intended to capture look and feel; Edit Model references can maintain characters/objects and perform edits. This supports separate identity/asset and style channels.
Sources:
- https://docs.midjourney.com/hc/en-us/articles/48495453462797-Edit-Model
- https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference

### Gemini
Gemini 3 image models support multiple references and specific character-consistency allowances. Official editing examples explicitly say to change only the named element while preserving style, lighting and composition, supporting scope isolation.
Source: https://ai.google.dev/gemini-api/docs/image-generation

### FLUX.2
FLUX.2 supports multi-reference editing. Official prompting guidance emphasizes ordering important subject/style/context information first and recommends explicit natural-language structure. This supports compiling strict asset continuity before secondary style/detail instructions.
Sources:
- https://docs.bfl.ai/flux_2/flux2_image_editing
- https://docs.bfl.ai/guides/prompting_guide_flux2

## Project conclusions

The following are project heuristics, not vendor-native controls:
- Fidelity 0–3
- Completion C0–C3
- Human Presence H0–H3
- Design Density lock
- Wear State W0–W4

They exist to translate user intent into safer, more maintainable prompts and evaluation criteria.
