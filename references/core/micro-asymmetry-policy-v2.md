# Micro-Asymmetry Policy v2

v0.7.5 treated tiny asymmetry as a positive realism cue. v0.7.6 weakens that rule.

## New policy

- preserve naturally observed asymmetry
- allow tiny variation if it emerges organically
- do not deliberately distort a good face just to prove it is human
- symmetry is not itself a CG failure

Use asymmetry edits only when:

- the face is visibly mirrored / procedurally duplicated
- both highlights or eyelid openings are unnaturally identical
- the user specifically asks for less perfect symmetry

## Failure signals

- micro_asymmetry_overdone
- mirrored_face_artifact

`micro_asymmetry_missing` is retained for backward compatibility but becomes advisory rather than a mandatory repair trigger.
