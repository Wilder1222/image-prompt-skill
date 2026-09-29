# Facial Maturity Ladder v0.7.1

## Purpose

This module controls **perceived facial maturity** separately from identity and chronological age. It is an image-design heuristic, not a biological age estimator.

The model must never interpret “more mature / more high-end” as permission to replace the person with a different face.

## Maturity Levels

### M0 — strongly youthful / childlike cues
- rounder facial read
- relatively large/open eyes
- very soft cheek volume
- smaller/narrower chin impression
- bright, open, highly youthful expression

Not recommended for adult character assets unless explicitly requested.

### M1 — youthful, fresh, soft
- clear young-adult identity
- noticeable cheek softness
- open gaze
- gentle jaw transitions
- high facial freshness

### M2 — young adult / refined
- keeps youthful skin and identity
- slightly calmer gaze
- cheek softness still present but less dominant
- jaw and cheek transitions clearer, not sharp
- natural eye size and spacing

### M2.5 — light mature / high-end young adult
**Default target for “reduce childishness, keep young and elegant.”**

- identity geometry stays locked
- youthful skin preserved
- babyish roundness reduced only slightly
- gaze becomes steadier and more composed
- expression becomes restrained rather than cold
- cheek volume becomes a little cleaner, not hollow
- jaw becomes clearer, not narrower or pointed
- eye shape stays the same; only openness and expression intensity may shift slightly
- makeup becomes more restrained and editorial

### M3 — cool mature
- visibly more composed
- stronger cheek/jaw definition
- more reserved eye expression
- lower makeup contrast / more controlled styling
- still no aging cues such as wrinkles or sagging unless specifically requested

### M4 — strong mature / authoritative
- strong adult authority and distance
- reserved expression
- clear facial structure
- use only when the user explicitly wants a queen/empress/strong mature archetype

## Delta Rule

For iterative edits, do not jump more than one maturity level per round unless the user explicitly requests a strong transformation.

Recommended internal representation:

```text
current_level: M1.5
requested_level: M2.5
max_delta_this_round: +0.5 to +1.0
```

## Important Boundary

Maturity is not the same thing as aging. For M1–M3, do **not** introduce wrinkles, sagging, pigmentation, coarse texture, hollow cheeks, or aged skin unless explicitly requested.

## Research Basis

Research on perceived “babyfaceness” commonly associates larger eyes, rounder faces, smaller nose/chin structures, and related facial configurations with more youthful/babyfaced impressions. Facial contrast also influences perceived age, with higher contrast often making female faces appear younger. These findings support treating maturity as a combination of shape, contrast, and expression cues rather than “make the face sharper.” See `docs/research/facial-maturity-research.md`.
