# Style Intent Router v0.8.0

Face Mode answers **how the face should be treated**. Style Intent answers **what the final image should look like**. They must never be conflated.

## Highest-level rule

When the user explicitly says “use image X's style”, “restore the original style”, “make it like the original key art”, or otherwise names a visual target, that explicit style target outranks inherited asset presentation defaults.

A prior white-background Asset Master does **not** make future edits white-background by default.

## Render resolution

- Explicit white/neutral background + style reference → `style_asset`.
- Explicit target-style restoration + Asset Master, no white-background lock → `cinematic_hybrid`.
- Style restoration with no separate Asset Master → `restoration`.
- Plain character asset request → `asset`.

## What archetype may control

Character archetype may recommend Face Mode. It may not override explicit final style intent.
