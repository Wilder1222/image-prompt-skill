# Realism Coherence Guard

The face can look synthetic even when individual parts are detailed. A common failure is **inconsistent realism**: photographic skin paired with gem-like eyes, or realistic eyes paired with plastic hair / makeup.

## Coherence channels

- eyes
- skin
- lips
- brows/lashes
- hair
- makeup
- nearby costume materials
- camera / lighting response

## Rule

Adjacent channels should not differ by more than one project realism tier.

Example:
- H2.5 skin + H1 eyes = mismatch
- H2.5 eyes + H2.5 skin + H2 hair = acceptable

These tiers are internal planning heuristics, not vendor controls.

## Repair order

1. eyes + skin
2. makeup integration
3. hair
4. camera/focus response
5. adjacent costume highlight consistency

## Failure signals

- realism_mismatch_eye_skin
- realism_mismatch_face_hair
- realism_mismatch_face_costume
- realism_channel_overprocessed
