# Style Target Fusion Pipeline v0.8.0

1. Parse explicit user output intent.
2. Assign references: Style Target / Asset Master / optional Face Trait.
3. Resolve background policy independently from asset history.
4. Resolve Render Mode.
5. Resolve Face Mode independently.
6. Build Reference Authority Matrix.
7. Restore target style channels.
8. Lock style channels that passed.
9. Apply material/human realism without erasing medium, motion or atmosphere.
10. Diagnose style drift before micro-quality polishing.

## Example

User wants Image 4's painterly dynamic look using a clean full-body black-red-gold asset as the character source.

- Image 4 → Style Target
- full-body asset → Asset Master
- Render Mode → cinematic_hybrid
- Style Profile → oriental_epic_painterly
- Face Mode → stylized_beauty by default, unless user requests another
- White studio background from the Asset Master → ignored
- Costume architecture from the Asset Master → locked
- Dynamic pose / hair / fabric motion → authorized unless user locks pose
