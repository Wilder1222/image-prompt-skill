# Human Presence v3

v0.7.6 changes the realism target from **detail accumulation** to **optical coherence**.

The problem observed in v0.7.5 tests was not low detail. The silver-haired asset already had high detail, stable P9 proportion, correct costume, and clean rendering. It still read as CG because the eyes, skin, hair, makeup, and camera response were too uniformly polished.

## Core rule

A convincing human portrait does not need maximum detail everywhere. It needs a coherent set of human visual signals:

1. eye optics
2. skin optics
3. soft-tissue structure
4. makeup integrated with skin
5. hair at multiple spatial frequencies
6. photographic focus / highlight behavior
7. realism consistency across all facial subsystems

Identity geometry, age intent, accepted P9 proportion, costume, and composition remain locked.

## Levels

Human Presence v3 adds `H2.5` between H2 and H3.

- H0 — stylized
- H1 — surface realism
- H2 — refined human presence
- **H2.5 — photographic human**: recommended for premium character assets
- H3 — strong photographic presence

`H2.5` is the default target for the current silver-haired asset because H2 v2.1 was visibly better but still read as high-quality CG.

## H2.5 priorities

### Primary
- eye optical realism
- skin optical coherence
- soft-tissue fidelity
- makeup-skin integration
- realism coherence guard

### Secondary
- hair frequency variation
- camera / focus hierarchy
- highlight roll-off

### Support
- optional natural asymmetry only when already present or clearly useful

## Non-goals

Human Presence v3 does **not** achieve realism by:

- coarse pore fields
- random blotchy pigmentation
- stronger global sharpness
- exaggerated blood vessels
- visible aging cues
- reshaping the face
- making sclera paper-white
- deliberately deforming a symmetrical face

## Young-skin rule

For young-adult character assets, maintain relatively even skin color while allowing region-dependent **optical response**. The distinction is important:

- good: forehead, nose, cheeks, eye area and lips respond differently to light
- bad: adding random spots, redness, mottling and pore noise everywhere

## Micro-asymmetry correction from v2.1

Micro-asymmetry is no longer a mandatory realism signal. Preserve natural small differences if visible, or allow tiny variation when it appears organically. Do not intentionally shift brows, eyes or mouth corners merely because the face looks "too symmetrical."

## Iteration rule

When P9 fashion proportion has passed:

`P9 LOCK → H2.5 optical refinement → studio polish → upscale`

Do not reopen proportion during H2.5.
