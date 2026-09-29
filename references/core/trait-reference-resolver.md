# Trait Reference Resolver v0.7.1

## New Role: facial_trait

A `facial_trait` reference is **not** an identity reference. It provides only selected presentation traits such as maturity, gaze quality, restraint, makeup mood, and editorial tone.

## Allowed Authority

A facial_trait reference may control only explicitly requested trait dimensions:

- maturity_level
- gaze_stability
- expression_restraint
- cheek_softness_delta
- eye_openness_delta
- makeup_restraint
- editorial_tone
- temperament_direction

## Forbidden Authority

Unless separately authorized, a facial_trait reference must not control:

- face_shape
- eye_spacing
- eye_shape_geometry
- nose_width / nose_tip geometry
- lip_shape geometry
- jaw/chin geometry
- skin tone baseline
- hairstyle silhouette
- headwear design
- body shape
- costume
- background
- lighting style
- camera angle
- scene mood

## Recommended Two-Image Layout

### Image A — Asset Master
Controls:
- current identity geometry
- body
- pose
- composition
- hairstyle silhouette
- costume
- background
- current asset continuity

### Image B — Facial Trait Reference
Controls:
- reduced childishness
- maturity target
- calm / high-end temperament
- gaze restraint
- makeup restraint

Does **not** replace A's face geometry.

## Optional Three-Image Layout

If the user has a separate trusted portrait identity reference:

- A = Asset Master
- B = Face Identity Reference
- C = Facial Trait Reference

Precedence:

```text
B controls identity geometry
A controls asset continuity
C controls only trait direction
```

## Trait Extraction Rule

Do not say “make the face look like Image B” when B is only a trait reference. Instead extract the traits:

> Use Image B only for a calmer, less juvenile, more refined young-adult facial impression: steadier gaze, reduced babyish softness, restrained makeup, and a more editorial expression. Do not copy Image B's face shape, eyes, nose, lips, hair, lighting, clothing, or background.
