# Skin Optical Coherence

## Goal

Facial realism should support refined makeup and visual appeal, following [the current makeup and skin direction](makeup-skin-integration-v2.md). Skin stays coherent under light without making surface detail compete with the face or overriding the selected makeup finish and apparent age.

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
- fine pores and lip texture may become more visible where appropriate to the makeup, lighting and resolution; keep contrast restrained and the finished face attractive

## Failure signals

- skin_optics_flat
- skin_waxy_surface
- skin_pigment_variation_overdone
- skin_pore_overstack
- skin_subsurface_fake_glow
