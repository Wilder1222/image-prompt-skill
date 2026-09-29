# Anti-Borrow Guard v0.7.1

## Purpose

Multi-reference editing can cause attribute leakage. This guard explicitly blocks a trait reference from importing unrelated identity, styling, or scene information.

## Borrow Allowlist

For `facial_trait`, only borrow the explicitly named traits:

- maturity direction
- gaze stability
- expression restraint
- makeup restraint
- overall composure

## Borrow Blocklist

Do not borrow:

- complete face geometry
- ethnic or identity replacement
- hairstyle / hair color
- costume / armor / accessories
- background / architecture
- color grading / atmosphere
- lighting direction
- camera framing
- pose
- body proportions

## Dominance Order

1. explicit user instruction
2. face_identity reference, if present
3. asset_master identity geometry
4. facial_trait traits only
5. all other references within their assigned scope

## Leakage Diagnosis

Mark `trait_reference_overborrow` if a trait edit introduces any of these from the trait reference:

- a different jaw/face shape
- different eye spacing
- a different hairstyle
- new clothing motifs
- the reference scene's lighting or background
- a new body type

## Repair

Reduce trait borrowing to a short allowlist and restate A/B roles in one compact paragraph. Do not add more facial description unless the actual identity reference is unclear.
