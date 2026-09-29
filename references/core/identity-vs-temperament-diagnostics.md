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
