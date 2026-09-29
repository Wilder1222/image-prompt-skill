# Edit Scope Guard v0.7.1

Every repair round must define `editable`, `locked`, and `forbidden` dimensions.

## identity_skin
Editable: identity geometry when genuinely drifting, regional skin optics, natural makeup, hair-strand realism.
Locked: composition, body, pose, garment, palette, footwear, background.

## trait_calibration  **new**
Editable:
- facial_maturity
- gaze_stability
- expression_restraint
- cheek_softness_delta
- eye_openness_delta
- makeup_restraint
- editorial_tone

Locked:
- face_identity_geometry
- eye spacing and eye-shape core
- nose / lip / jaw-chin geometry
- age identity
- hair silhouette
- body / pose
- garment / palette
- composition / background

Forbidden:
- copying trait-reference face geometry
- importing trait-reference clothing, background, lighting, body type or hairstyle
- adding wrinkles, sagging, pigmentation or other aging cues for M1–M3
- major face-shape changes

## garment_material
Editable: material contrast, embroidery density, folds/gravity, controlled asymmetry, attachment logic.
Locked: identity and maturity target, body, composition, pose, silhouette, palette, hair, footwear, background.

## studio_polish
Editable: key/fill ratio, white-background separation, rim separation, micro-contrast, specular balance, final optics.
Locked: all semantic identity and design.

## upscale
Editable: target pixels, upscale, final sharpen, denoise.
Locked: all semantic design.

## Scope Leakage
If a trait calibration changes costume, body, face geometry or scene, mark `edit_scope_leak` and `trait_reference_overborrow` as appropriate.
