# Concept Art Hierarchy Pipeline v0.8.1

Use when the returned image already passes:
- style target
- character identity
- face mode
- palette
- large-scale motion
- cinematic environment

but fails because it is too uniformly finished, too bright, too sharp, or the background competes.

## Route
1. Diagnose hierarchy failures.
2. Lock style target, identity, face mode, palette, motion and costume architecture.
3. Apply `concept_art_hierarchy_refine` only.
4. Re-check focal readability and breathing room.

## Do not reopen
- identity
- face mode
- garment redesign
- palette
- motion language
- render mode

## Exit criteria
- face/crown/upper torso clearly dominate
- background remains monumental but subordinate
- peripheral detail is selectively omitted
- highlights have a clear primary/secondary/tertiary hierarchy
- edge sharpness varies by visual importance
