# Black / Red / Gold Character → Image 4 Style Plan

## Diagnosis of previous output

The white-background black/red/gold result succeeded as a costume asset but failed the requested final style. Its errors were not primarily facial:

- asset_mode_leak
- style_target_underweighted
- style_medium_loss
- motion_language_loss
- static_pose_leak
- atmosphere_loss
- clean_catalog_lighting_leak

## Correct routing

- Render Mode: cinematic_hybrid
- Style Target: Image 4
- Asset Master: black/red/gold full-body character
- Style Profile: oriental_epic_painterly
- Face Mode: stylized_beauty by default
- Style Strength: S2/S3 boundary, with medium/motion/lighting/atmosphere strongly preserved
- Reality Gain: R1-R2 only; realism must not erase painterly medium

## Style Target authority

Strict: painterly medium, sweeping motion, luminous rim/backlight, atmospheric depth, composition energy.
Strong: palette relationships and mythic environment scale.
Ignore: style-reference face identity and garment geometry.

## Asset Master authority

Strict: character identity, black long hair family, gold crown/accessories, black-red-gold costume architecture, signature waist/shoulder ornament language.

Pose may change dynamically because the user explicitly wants Image 4's style and did not lock the static asset pose.
