# Maturity Signal Router v0.7.1

## Goal

When the user asks for “less childish, more sophisticated, more high-end,” the model must choose **safe maturity signals** before altering facial geometry.

## Signal Priority

### Tier 1 — Preferred signals
Use these first because they can raise perceived maturity while preserving identity:

- steadier gaze
- slightly more restrained expression
- less wide-eyed openness while keeping the same eye shape
- calmer mouth corners
- more controlled makeup contrast
- slightly cleaner cheek-to-jaw transition
- more editorial, less cute facial presentation
- reduced blush / reduced glossy lip treatment if it is contributing to a juvenile look

### Tier 2 — Limited structural adjustment
Only after Tier 1, and only within identity-safe bounds:

- reduce cheek baby-softness slightly, without hollowing
- increase jaw clarity slightly, without narrowing the face
- slightly reduce apparent eye openness, without shrinking the eye geometry
- slightly reduce excessive “cute” facial contrast from makeup

### Tier 3 — Forbidden for light maturity
Do not use these to reach M2–M3:

- sharp chin
- significantly narrower jaw
- visibly longer face
- smaller nose or narrower nose wings
- major eye reshaping
- hollow cheeks
- stronger nasolabial lines
- wrinkles / sagging / pigmentation
- strong age shift

## Maturity vs “High-End”

“High-end” is not a scientific facial category. In this Skill it is a styling target produced mainly by:

1. identity stability
2. restrained expression
3. coherent makeup
4. realistic skin optics
5. controlled lighting and photography
6. styling consistency

Therefore the compiler should not use facial geometry as the primary way to create “high-end.”

## Makeup Contrast Note

Academic work suggests greater facial feature contrast can make female faces look younger. Therefore, when the goal is “slightly less youthful but still young,” the Skill may reduce exaggerated makeup contrast a little, but should not flatten the face or deliberately add aging cues.
