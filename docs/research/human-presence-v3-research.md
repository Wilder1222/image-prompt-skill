# Human Presence v3 Research Notes

Version: 0.7.6\
Date: 2026-09-27

This document separates three things:

1. **Official model behavior and prompting guidance** from model vendors.
2. **Human-perception / optical evidence** from published research.
3. **Project heuristics** used by image-prompt-skill. Project heuristics are workflow rules, not claims about model internals or universal facial beauty.

## 1. What recent model docs imply for this stage

### OpenAI GPT Image

OpenAI's current image prompting guide recommends identifying what must change versus what must stay fixed, assigning roles to reference images, and iterating deliberately with one primary change at a time. It also warns that repeated edits can still change supposedly preserved details, so constraints should be restated and results inspected after each step.

Project implication: Human Presence v3 must be a **narrow edit round** after P9 proportion is accepted. It should not reopen body proportion, garment architecture, background, or identity geometry.

### Gemini Image

Google's image-generation docs recommend multi-turn image editing, highly specific prompts, explicit camera / lens / lighting language for photorealism, and detailed preservation instructions for high-fidelity edits.

Project implication: Gemini adapter can express H3/H2.5 realism with photographic language while keeping the approved character and costume locked.

### FLUX.2

BFL's FLUX.2 prompting guide says word order matters, important information should come first, photorealistic output benefits from camera/lens references, and multi-reference workflows should state the role of each image. FLUX.2 does not support negative prompts.

Project implication: put identity and accepted asset continuity first, then human-optics cues, then photographic context. Convert negative phrasing into positive target-state wording.

### Seedream

Volcengine's current image-generation API documents multi-reference editing and advises keeping Chinese prompts around 300 characters / English prompts around 600 words because very long prompts can diffuse attention.

Project implication: the internal H3 plan can be detailed, but Seedream output should be compressed to the highest-impact human-presence signals.

### Midjourney Edit

Midjourney V8.2 Edit supports instruction-based edits, multiple references, region editing, and outpainting.

Project implication: when only facial optical realism is failing, the preferred MJ workflow is a localized Edit/Editor patch rather than regenerating the entire character.

## 2. Human-perception evidence that changes our previous rules

### A. More skin detail is not automatically more realistic

Research on facial skin perception repeatedly finds that relatively homogeneous skin coloration is associated with youth, health, and attractiveness. This does **not** mean skin should be a uniform plastic color. It means Human Presence v3 should avoid turning "realism" into mottling, age spots, coarse pore fields, or random color noise.

**Project rule:** distinguish **regional optical response** from **pigment heterogeneity**.

- Regional optical response: allowed and useful. Forehead, nose, cheeks, eye area and lips can differ in sheen / diffusion / translucency.
- Random pigment heterogeneity: not a default realism signal for a young character.

### B. Skin is optically complex, not a uniform glossy shell

Optical studies of human skin describe appearance as the result of wavelength-dependent absorption and scattering through tissue. Exact coefficients vary with skin type and measurement method.

**Project inference:** prompts should seek layered, region-dependent response rather than "more gloss" or "more pores." Subtle translucency at thin regions can be useful, but the Skill should not pretend to simulate a physically exact biological renderer.

### C. Eye / skin realism mismatch can trigger an uncanny effect

Research on CG faces found that mismatches between eye realism and skin realism can increase eeriness; eye size/texture inconsistencies were particularly problematic.

**Project rule:** add a **Realism Coherence Guard**. Eyes, skin, lips, hair and surrounding face should live at roughly the same realism level. Do not create gemstone eyes inside otherwise photographic skin.

### D. Sclera should be natural, not "super white"

Research on scleral brightness shows natural white sclera contributes to gaze perception and health/youth cues, but experimentally making sclera whiter than their original values did not necessarily improve attractiveness.

**Project rule:** use natural off-white sclera with subtle vascular / gray warmth only when visible. Avoid paper-white or luminous sclera.

### E. Perfect symmetry is not a reliable "CG detector"

Face-perception research often finds symmetry attractive. Therefore our previous "micro-asymmetry" rule was too strong if treated as a mandatory realism cue.

**Correction in v0.7.6:** micro-asymmetry becomes **optional / observational**, not a required edit. Do not deliberately deform a good symmetrical face merely to make it look human. Natural variation may be preserved if already present.

## 3. Human Presence v3 design conclusion

The next realism step should not be:

- more pores
- more blemishes
- more asymmetry
- stronger sharpness
- stronger highlights

It should be:

1. **Eye Optical Realism** — natural sclera, iris variation, believable catchlights, real lid/eye contact.
2. **Skin Optical Coherence** — youthful color homogeneity plus regional sheen/diffusion/translucency.
3. **Makeup-Skin Integration** — makeup sitting on real skin instead of replacing skin texture.
4. **Hair Frequency Variation** — large masses, medium bundles, fine hairs, nonuniform specular response.
5. **Photographic Focus Hierarchy** — face strongest, garments readable, peripheral fine layers slightly softer when appropriate.
6. **Realism Coherence Guard** — prevent one facial subsystem from being more synthetic or more photoreal than the rest.
7. **Detail Budget** — realism uses the right clues, not maximum detail everywhere.

## 4. Recommended target for current silver-haired asset

The P9 test is already accepted. The next pass should use:

- Fashion proportion: locked P9
- Human Presence v3: **H2.5 Photographic Human**
- Identity geometry: locked
- Age intent: locked
- Costume / material design: locked
- Lighting layout: locked
- Editable: eye optics, skin optics, makeup integration, hair frequency variation, lens/focus response, realism coherence

This is intentionally narrower than the old H2 prompt.
