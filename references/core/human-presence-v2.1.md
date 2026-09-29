# Human Presence v2.1

v2.1 keeps the v0.7.4 soft-tissue / skin / eye / hair / camera framework but shifts emphasis from “more detail” to **photographic human presence**.

## Soft Structure Fidelity

Realism should appear in cheek volume, eyelid thickness, nose-wing softness, mouth-corner volume and jaw-to-neck transition while all identity geometry remains locked.

## Micro-Asymmetry

Use tiny natural variations in brow height, eyelid openness, mouth-corner balance and highlight distribution. The goal is to avoid mathematically perfect rendering, not to deform the face.

## Lens Response Realism

- soft highlight roll-off
- retained shadow detail
- natural local micro-contrast
- no global clarity/HDR look
- no sharpened cut-out face edge
- slightly softer peripheral cloth resolution than facial focus when appropriate

## Beauty Without CG

The face can remain beautiful and refined, but beauty should come from identity, makeup restraint, skin optics, soft structure, hair and lighting rather than a polished CG surface.

## Failure Signals

- face_too_cg
- skin_too_uniform
- eye_anatomy_too_clean
- hair_too_uniform
- micro_asymmetry_missing
- highlight_rolloff_digital
