# Lighting Reconstruction Module

## 1. Key Light Logic

Defines the primary readable form of face, torso and costume. Record direction, softness and relative intensity.

## 2. Fill Control

Defines shadow openness and sophistication. Fill should not automatically equal the key. A weaker fill preserves modeling.

## 3. Rim / Separation

Used to separate hair, armor, gauze and silhouette from atmospheric backgrounds. Keep it motivated and controlled.

## 4. Atmospheric Glow

Controls bloom, luminous haze, particles and painterly aura. Atmosphere may be stylized, but face/material details must remain readable.

## 5. Material Highlight Routing

Route different highlight behavior to:
- skin
- silk / satin
- gauze
- leather
- metal
- jewelry

## Hybrid recommendation

For `hybrid + R2`:
- cinematic directional key
- weaker fill
- luminous rim/backlight
- moderate atmospheric glow
- restrained bloom
- face and material micro-contrast remain legible
