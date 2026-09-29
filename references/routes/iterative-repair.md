# Iterative Repair Route v0.7.1

## Workflow

Generate → Diagnose → **Classify** → Lock → Patch → **Reclassify** → Lock → Polish → Upscale

The new Classify/Reclassify step distinguishes identity drift from acceptable temperament change.

## Planning

1. Resolve reference roles.
2. Resolve visible vs inferred regions.
3. Diagnose result.
4. Classify facial issue:
   - identity drift?
   - maturity undershoot / overshoot?
   - temperament shift?
   - trait-reference overborrow?
   - beauty-template drift?
5. Route to the smallest repair round.

## identity_skin
Use only when the same-person geometry or skin realism is actually failing.

## trait_calibration
Use when identity is stable but the face is too childish, too cold, too mature, too generic, or not refined enough.

Recommended A/B setup:
- A = Asset Master and identity geometry source
- B = Facial Trait Reference only

Target a named maturity level, normally M2.5 for “young but sophisticated.”

## garment_material
Use only after identity and maturity are accepted.

## studio_polish
Use only after semantic design and materials are accepted.

## upscale
Use after all visual acceptance checks pass.

## Key Principle
The more mature the iteration becomes, the **shorter and narrower** the edit prompt should become.
