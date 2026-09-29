# OpenAI GPT Image — Facial Trait Editing v0.7.1

Official OpenAI guidance supports explicit reference roles, separating changes from constraints, and iterating one change at a time. For trait calibration:

1. Label images by role and number.
2. Say “change only facial presentation / maturity traits.”
3. Repeat the identity geometry to preserve.
4. Keep the prompt shorter than the initial generation prompt.
5. Reuse the previous approved output as the next edit input.

Recommended pattern:

```text
Image 1 = Asset Master and identity geometry source.
Image 2 = facial maturity / temperament reference only.
Change only maturity presentation and makeup restraint. Preserve face shape, eye spacing, eye geometry, nose proportions, lip shape, jaw/chin, hair, pose, costume, background and framing.
```

Do not ask OpenAI to “make her look like Image 2” if Image 2 is not intended to replace identity.
