# Priority Compiler v3 — v0.7.5

## P0 Identity
Face identity geometry and age identity remain the strongest invariants.

## P0R Reference Fidelity
Reference channel ownership and fidelity assignment.

## P0T Trait Calibration
Maturity / temperament presentation without changing identity geometry.

## P1 Asset Continuity
Composition, pose, costume architecture, hairstyle silhouette, palette and footwear family.

## P1E Extremity Integrity
Visible hand/foot anatomy errors are repaired locally.

## P1P Fashion Proportion
Head visual share, neck/shoulder openness, torso preservation, visual waistline, leg segmentation, garment verticality and footwear scale.

## P1B Constraint Budgets
Completion, design density and wear budgets.

## P1C Completion Semantics
Visible vs inferred / conservative completion.

## P1M Render Mode
Asset / style_asset / restoration / hybrid.

## P2H Human Presence
Soft structure, regional skin, micro-asymmetry, eye anatomy, hair irregularity and lens response.

## P2 Materials
Material separation and garment physics.

## P3 Lighting & Optics
Studio/cinematic lighting, separation, micro-contrast and final optics.

## P4 Output Resolution
Actual upscale / sharpen / denoise stages.

## Compile rule

If both `head_visual_too_large` and `face_too_cg` are present, route first to `fashion_proportion`. Lock accepted proportion before entering `human_presence_refine`.
