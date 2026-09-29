# Fashion Anatomy & Human Presence Pipeline v0.7.5

## When to use

- user requests 九头身 / 高挑修长 / 时装比例
- a full-body asset looks visually short even though anatomy is not obviously broken
- the face is still high-quality CG after identity and material controls are already stable

## Round A — Fashion Proportion

Lock identity, face, hairstyle, costume design, materials, background, lighting and hand integrity.

Edit only:
- head visual share
- neck/shoulder openness
- torso-to-leg relationship
- visual waistline
- hip-knee-ankle segmentation
- garment verticality
- sleeve/skirt lateral mass
- footwear scale/visibility

For the user’s current silver-haired full-body asset, use `P9`.

## Round B — Human Presence v2.1

Only after proportion is accepted, lock the P9 structure and edit:
- soft structure fidelity
- regional skin response
- micro-asymmetry
- eye anatomy
- hair irregularity
- lens response

Do not reopen face identity or costume design.

## Round C — Final Polish

Then return to existing studio/cinematic polish and upscale stages.

## Principle

Nine-head fashion proportion is not “longer legs.” Human realism is not “more pores.” Both are coordinated visual systems.
