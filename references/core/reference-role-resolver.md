# Reference Role Resolver v0.7.1

## Principle

Every reference has one primary job. More references do not automatically improve control; unclear roles increase leakage risk.

## Roles

### asset_master
Controls the current approved asset state:
- current face geometry if no separate face_identity reference exists
- composition
- body proportion / pose
- garment silhouette / structure / palette
- hairstyle silhouette
- background / footwear / current design extension

### face_identity
Controls only stable identity geometry:
- face shape
- eye spacing and eye-shape core
- nose proportions
- lip geometry
- cheek/jaw/chin identity structure
- age identity

It must not overwrite costume, pose, background, or lower-body design.

### facial_trait  **new in v0.7.1**
Controls only selected face-presentation traits:
- maturity level
- gaze stability
- expression restraint
- cheek softness delta
- eye openness delta
- makeup restraint
- editorial tone / temperament direction

It must not replace identity geometry.

### costume_reference / pose_reference / material_reference / lighting_reference
Keep the v0.7 role boundaries: each may control only its named domain.

## Precedence

```text
explicit user instruction
> face_identity (identity geometry only, if present)
> asset_master (approved asset continuity)
> facial_trait (traits only)
> other scoped references
```

## Current A/B Pattern

For the current “less childish, more high-end” edit:

- A = Asset Master + identity geometry source
- B = Facial Trait Reference only

A keeps the same face structure, hair, body, costume, pose and white studio asset continuity.
B contributes only a calmer, less juvenile, more refined young-adult facial presentation.

**Do not say “make A look like B.”** Extract the permitted traits from B instead.

## Optional A/B/C Pattern

If a trusted original portrait is available:

- A = Asset Master
- B = Face Identity Reference
- C = Facial Trait Reference

B wins only for identity geometry; C may change only maturity/temperament traits.
