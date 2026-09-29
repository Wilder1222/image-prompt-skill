# v0.8.2 Ancient White Asset Regression Checklist

Use the latest successful white-background ancient-costume full-body result as the visual regression case.

## Pass criteria

### Face
- beauty is maintained or improved
- visual age stays youthful
- face feels more character-specific, not more generic
- no maturity/fatigue inflation

### P9 / body read
- tall fashion read is clearer under the long robe
- torso remains complete and natural
- no head-shrink shortcut
- no isolated thigh/calf stretching
- shoes remain clearly readable

### Hands
- clean crossed-hand relationship
- one thumb and four fingers anatomically per hand; judge visible segments and natural occlusion without requiring all ten digits in view
- finger roots not swallowed by sleeves
- natural hand scale and wrist direction

### Materials
- main robe has more weight than outer gauze
- gauze has real layered transparency
- gold floral pattern reads woven/embroidered, not printed
- sash/collar/ties are structurally clearer

### Asset master framing
- top ornament and shoes fully visible
- controlled hem spread
- balanced negative space
- stable frontal body axis

### Lighting
- pale fabric separates from white background without dark outlines
- face remains primary read
- gold-thread highlights are restrained
- soft floor contact shadow grounds the character

## Failure routing

- generic face → `asset_master_face_refine`
- weak P9 / hands / framing → `asset_master_structure_refine`
- merged materials / flat light / weak white separation → `asset_master_material_light_refine`
