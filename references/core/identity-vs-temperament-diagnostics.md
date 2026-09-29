# Identity Drift vs Temperament Shift v0.7.1

## Core Distinction

A face can change in expression, maturity impression, or temperament while remaining the same identity. These changes should not all be labeled “identity drift.”

## Identity Drift

Use when stable facial geometry changes materially:

- face width/length changes beyond the target delta
- eye spacing changes
- eye shape geometry changes
- nose width/proportion changes
- lip geometry changes
- jaw/chin changes enough to read as another person

## Evidence before classification

Compare the actual source and candidate, naming the visible feature instead of relying on a generic similarity impression. Record head angle, lighting, expression, occlusion and face size in the full image as possible confounds. When these prevent a reliable comparison, record a provisional `possible_geometry_shift` with certainty `uncertain`; keep the identity verdict pending rather than declaring drift or stability. These are review annotations, not new CLI classifier outputs or image-model parameters.

The same hair color, accessory or head pose does not establish the same face. Conversely, a face correction that retains the whole costume does not automatically improve identity. If the before/after benefit cannot be clearly described at the available image detail, retain the prior candidate and mark the edit inconclusive. Do not run repeated face edits merely because approval is still pending.

For a shared wardrobe reference across different original portraits, keep the clothing brief fixed and rewrite only the source-specific facial and hair description. Compare the results to each respective original; different poses or expressions alone are insufficient evidence that all facial geometry was preserved. Never make one reference portrait the default face for other characters.

## Temperament Shift

Use when geometry remains stable but presentation changes:

- gaze becomes calmer / colder / warmer
- expression becomes more restrained
- makeup becomes less youthful
- eye openness changes slightly
- cheek softness presentation changes slightly

Temperament shift can be **targeted** or **excessive**.

## Classification Labels

- `identity_stable`
- `identity_drift`
- `temperament_shift_target`
- `temperament_shift_over`
- `maturity_undershoot`
- `maturity_overshoot`
- `beauty_template_drift`
- `age_shift_unwanted`
- `trait_reference_overborrow`

## Examples

### Good
Same face geometry, calmer gaze, slightly less cheek baby-softness, more restrained makeup → `temperament_shift_target`.

### Bad
Eyes become narrower, face gets much longer and chin sharper to look “expensive” → `identity_drift` + `beauty_template_drift`.

### Too mature
Same identity, but face becomes hollow, severe, visibly older than intended → `maturity_overshoot` or `age_shift_unwanted`.
