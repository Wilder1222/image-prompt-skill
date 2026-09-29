# Leg Segmentation Guard v0.7.5

## Purpose

Prevent the common AI failure where a “long-leg” request stretches only one limb segment.

## Rules

- Hip-to-knee and knee-to-ankle elongation must be coordinated.
- Knee location remains believable relative to pelvis and ankle.
- Pelvis width and thigh attachment remain natural.
- Lower-leg soft tissue remains believable.
- Foot scale is coordinated with the elongated figure and must not become oversized.
- Do not create a compressed torso + extreme legs combination.

## Diagnostics

- thigh_overstretched
- calf_overstretched
- knee_position_low
- pelvis_leg_disconnect
- footwear_scale_too_large
