# Skin Optical Coherence

## Goal

Young, beautiful skin should remain relatively even and healthy while still behaving like living tissue under light.

## Distinguish two concepts

### Color / pigment homogeneity
For a young character, keep this relatively high. Do not add random blotches, age spots or noisy redness to simulate realism.

### Regional optical response
This can vary naturally:

- forehead: low-to-medium soft sheen
- nose bridge / tip: slightly stronger specular response
- inner cheek: fine texture with moderate diffusion
- outer cheek: softer diffuse response
- eye area: thinner-looking skin and lower saturation / slightly darker tone
- lips: independent moist material response
- ears / thin edges: only subtle translucency if visible and lighting supports it

## Subsurface cue

Use subtle tissue softness / translucency rather than "glowing skin." This is a perceptual cue, not a claim of physically exact subsurface rendering.

## Detail budget

At full-body scale:
- pores are support-level, not primary
- soft structure and region-dependent reflectance matter more

At close-up scale:
- fine pores and lip texture can become more explicit

## Failure signals

- skin_optics_flat
- skin_waxy_surface
- skin_pigment_variation_overdone
- skin_pore_overstack
- skin_subsurface_fake_glow
