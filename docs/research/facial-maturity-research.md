# v0.7.1 Research Notes — Facial Maturity, Trait References, Iterative Editing

Checked: 2026-09-26

## 1. Official image-editing guidance

### OpenAI
OpenAI's current image prompting guide recommends:
- explicitly separating what changes from what must stay the same;
- assigning roles to each reference image by number and purpose;
- iterating deliberately, usually changing one thing at a time;
- checking identity preservation and unwanted changes after each edit.

Source: https://developers.openai.com/api/docs/guides/image-prompting

### Midjourney
Midjourney Edit Model supports written edit instructions and up to four reference images. The docs also note that direct instructions are appropriate in Edit mode, unlike classic Imagine prompting which generally describes the final image.

Source: https://docs.midjourney.com/hc/en-us/articles/48495453462797-Edit-Model

### Gemini
Gemini 3 image models support multiple references, with explicit character-consistency allowances on Flash and Pro variants. This supports reference-role workflows, but does not mean roles are automatically inferred correctly.

Source: https://ai.google.dev/gemini-api/docs/image-generation

### FLUX.2
BFL documents multi-reference editing and identity consistency, and notes that word order matters in prompts. Important elements should be placed early.

Sources:
- https://docs.bfl.ai/flux_2/flux2_overview
- https://docs.bfl.ai/flux_2/flux2_image_editing
- https://docs.bfl.ai/guides/prompting_guide_flux2

### Seedream
Seedream 5 supports multiple reference images. The official API also warns that very long prompts may disperse attention and cause details to be ignored.

Source: https://docs.volcengine.com/docs/ark/image-generation-api?lang=en

## 2. Research on perceived facial maturity

### Babyfacedness morphology
Peer-reviewed work on babyfacedness commonly associates more youthful/babyfaced impressions with combinations such as larger eyes, rounder face shape, higher brows, smaller nose/chin, or related proportions. These are population-level perceptual findings, not rules that should be blindly applied to one person.

Sources:
- Zebrowitz & Montepare, Developmental Psychology (1992), summarized at Brandeis: https://scholarworks.brandeis.edu/esploro/outputs/journalArticle/Impressions-of-Babyfaced-Individuals-Across-the/9924057013701921
- Chinese babyface study: https://pmc.ncbi.nlm.nih.gov/articles/PMC4886646/

### Facial contrast and perceived age
Research found that higher contrast between facial features and surrounding skin can make female faces appear younger, with effects replicated cross-culturally. This supports treating makeup contrast as one maturity cue, rather than using only facial geometry.

Sources:
- https://pmc.ncbi.nlm.nih.gov/articles/PMC3590275/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC5524771/

### Skin-age cues
Wrinkles, sagging, and skin-tone changes are strong cues to older perceived age. Therefore, if the design goal is “less childish but still young,” the Skill should not add those aging cues.

Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC11102750/

## 3. What is research-backed vs project heuristic

### Research-backed concept
- facial maturity perception uses both shape and texture/contrast cues;
- babyfacedness is related to recurring facial configurations;
- facial contrast can shift perceived youthfulness;
- wrinkles/sagging are aging cues.

### Project heuristic
- M0–M4 maturity ladder;
- M2.5 as a useful target for “young but sophisticated”;
- the exact Tier 1/2/3 signal ordering;
- “high-end beauty” calibration rules;
- trait-reference allowlist and borrow-blocklist.

These heuristics are designed for prompt stability and should be validated against actual image outputs.
