# FLUX.2 — Facial Trait Calibration v0.7.1

FLUX.2 supports multi-reference editing. Its prompting guide emphasizes word order and putting the most important information first. For a maturity edit:

1. Put the Asset Master identity first.
2. Put the target facial presentation second.
3. Mention the trait reference only after the identity lock.
4. Use positive target language instead of negative-prompt syntax.

Example structure:

```text
Same woman and same facial geometry as Image 1, young adult, refined oval face, unchanged eyes/nose/lips/jaw. Slightly more composed light-mature presentation inspired by Image 2: steadier gaze, less babyish cheek softness, restrained editorial makeup. Keep the same hair, costume, pose, background and framing.
```
