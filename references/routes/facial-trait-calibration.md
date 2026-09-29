# Facial Trait Calibration Route v0.7.1

## When to Use

Use when the user says:

- too childish / too baby-faced
- not sophisticated enough
- make the face more mature but keep the same person
- use another reference only for face temperament / maturity

## Round Definition

`trait_calibration`

### Editable
- facial_maturity
- gaze_stability
- expression_restraint
- cheek_softness_delta
- eye_openness_delta
- makeup_restraint
- editorial_tone

### Locked
- face_identity_geometry
- eye_spacing
- eye_shape_core
- nose_geometry
- lip_geometry
- jaw_chin_geometry
- age_identity
- hairstyle_silhouette
- body
- pose
- garment
- composition
- background

### Forbidden
- copying trait-reference face geometry
- importing trait-reference background / clothing / lighting
- adding aging cues for M1–M3
- changing body or costume to create “maturity”

## Recommended Prompt Shape

1. State A is the direct edit target and identity source.
2. State B is only a facial trait reference.
3. Name the target maturity level, e.g. M2.5.
4. Describe the permitted trait shift in 3–5 clauses.
5. State the identity geometry that must remain unchanged.
6. Block borrowing from B outside its trait role.

## Example

```text
Image A is the Asset Master and identity geometry source. Image B is only a Facial Trait Reference.
Keep Image A's face shape, eye spacing, eye geometry, nose proportions, lips and jaw/chin unchanged.
Move the facial presentation from youthful-soft toward M2.5 light-mature: steadier gaze, slightly reduced babyish cheek softness, more restrained eye openness, calmer mouth expression, and more editorial natural makeup.
Do not make the face longer, narrower, sharper or older. Do not copy Image B's face geometry, hair, costume, scene, lighting or color grading.
```
