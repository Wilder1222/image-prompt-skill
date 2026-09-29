# Fashion Proportion System v0.7.5

## Goal

Turn “nine-head perfect proportion” into a controlled fashion-anatomy workflow rather than a generic “longer legs” instruction.

The system is a **visual design heuristic**, not an anatomical measurement protocol and not a vendor-native parameter.

## Profiles

- `P7 Natural`: ordinary believable adult proportion.
- `P8 Elegant`: subtly taller and more editorial.
- `P9 Fashion`: high-fashion nine-head visual proportion while preserving adult anatomy.
- `P9.5 Stylized`: stronger editorial elongation; only use when the user explicitly wants stylization.

For full-body character assets, default to `P9` when the user asks for 九头身 / 高挑时装比例.

## P9 Core Rules

1. Hair buns, crowns and hairpins do not count as head length.
2. Reduce the head's **visual share** of the full figure, not the face width or identity geometry.
3. Keep a complete ribcage and torso; never manufacture long legs by crushing the torso.
4. Lengthen hip-to-knee and knee-to-ankle segments together.
5. Preserve believable pelvis width, knee position, ankle scale and foot size.
6. Raise the waist only visually through sash placement and skirt origin, not by shortening anatomy.
7. Use the garment itself to strengthen verticality: long center lines, controlled sleeve mass, controlled skirt spread and visible footwear.

## Failure Signals

- head_visual_too_large
- torso_visually_short
- waistline_too_low
- leg_extension_insufficient
- knee_position_low
- footwear_scale_too_large
- silhouette_too_wide
- vertical_flow_insufficient
