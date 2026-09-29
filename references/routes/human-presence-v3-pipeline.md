# Human Presence v3 Pipeline

## Entry condition

Use this route when:

- identity is already acceptable
- body / P9 proportion is already accepted
- costume architecture is already accepted
- the remaining complaint is "still looks CG / game render / digital person"

Do not use it to repair identity drift, wrong body proportion, wrong costume, or missing hands.

## Workflow

1. lock identity geometry
2. lock accepted P9 proportion
3. lock pose / costume / palette / composition / background
4. classify the visible CG cue
5. edit only the corresponding optical channels
6. re-check realism coherence
7. stop when the image reads human; do not continue adding detail indefinitely

## Default current-asset target

`H2.5 Photographic Human`

### Primary
- eye_optics_realism
- skin_optical_coherence
- soft_structure_fidelity
- makeup_skin_integration
- realism_coherence

### Secondary
- hair_frequency_variation
- camera_optics_hierarchy
- highlight_rolloff

### Optional
- natural asymmetry

## Recommended sequence

If the face still looks CG:

1. eyes + skin optics
2. makeup integration
3. hair frequency
4. camera / focus hierarchy

Do not rewrite the whole costume prompt in this round.
