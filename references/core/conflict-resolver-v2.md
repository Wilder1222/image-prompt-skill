# Conflict Resolver v2

Resolve contradictions before the final prompt is written.

## Priority ladder

- P0 Identity
- P1 Asset continuity
- P1M Render mode
- P2 Style restoration
- P2R Reality gain
- P3 Material and lighting
- P4 Micro quality / resolution language

## Common conflicts

### Asset pose vs original dynamic pose
If hybrid: preserve body identity and costume architecture; allow motion language in hair, sleeves, fabric and composition energy unless pose change is explicitly authorized.

### Realism vs painterly atmosphere
Apply realism to human/material behavior first. Preserve stylized atmosphere and environment in R1/R2.

### Real material vs extravagant fantasy design
Keep silhouette and ornament language; change material behavior, attachment logic and highlight response rather than simplifying the entire costume.

### Face lock vs facial trait/style reference
Identity geometry wins. References may change only authorized presentation traits.

### White studio asset vs style restoration environment
Render mode decides. In `hybrid/restoration`, white asset background is not automatically locked unless the user explicitly says to keep it.
