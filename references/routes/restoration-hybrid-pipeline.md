# Restoration / Hybrid Pipeline

## Step 1 — Classify references

Recommended:
- A: `style_restoration`
- B: `asset_master`
- C optional: `facial_trait`

## Step 2 — Select render mode

Choose asset / restoration / hybrid before prompt writing.

## Step 3 — Select style intensity and reality gain

Typical current task:
- mode = hybrid
- style = S2
- reality = R2

## Step 4 — Lock continuity

From Asset Master:
- identity geometry
- body proportions
- garment architecture
- signature crown/accessories
- core palette family unless style task explicitly changes it

## Step 5 — Restore style channels

From Style Restoration Reference:
- mood
- motion language
- lighting language
- atmosphere
- environment scale
- painterly-cinematic medium

## Step 6 — Merge realism

Apply R-level to:
- human skin / soft tissue
- hair
- costume material behavior
- lighting coherence

## Step 7 — Resolve conflicts

Run Conflict Resolver v2. Do not forward unresolved contradictory instructions.

## Step 8 — Compile by provider

OpenAI / Gemini may keep explicit reference roles. Midjourney may use Edit + Style Reference differently. Seedream requires denser compression. FLUX.2 should place main subject and critical style early.

## Step 9 — Diagnose result

Classify:
- asset_continuity_drift
- style_underrestored / style_overborrow
- realism_undershoot / realism_overwrite
- material_unified_gloss
- lighting_flat_restoration
- atmosphere_haze_over

Then patch only the failing layer.
