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

Before diagnosing noncompliance, audit the failed constraint against its source: explicit user requirement, observed reference fact, or assistant-authored design choice. Correct an unsupported or contradictory design choice with a recorded reason; do not silently downgrade an actual user requirement. Keep the old failure and the revised target as separate evidence.

## framing_only

When an otherwise usable candidate merely touches the frame, use that exact candidate as the edit target. Request more surrounding background and a smaller overall ensemble within the specified aspect ratio, preserving all internal spatial relationships, face, pose, outfit and object count. Do not add identity or costume redesign clauses. A candidate can be tested this way without being promoted to an approved master.

Record the edit target separately from original identity references and evaluation-only benchmarks. After the edit, inspect both the new margins and possible detail or identity drift. Increasing white space reduces the subject's pixel coverage at the same output dimensions; retain the larger-subject candidate when that is preferable. A successful edit does not prove that the original-to-image generation prompt fixed framing by itself, nor that all pixels stayed unchanged.

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
