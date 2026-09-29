# Reference Authority Matrix

Choose the scenario by the actual task. The style-restoration rules below do not freeze clothing when the user has authorized a new wardrobe design.

Current execution uses [prompt production](../routes/prompt-production.md). For multiple views of the same person, declare one primary identity reference and supporting views in the same `identity_group`; never merge different people merely because their style is similar. Group declarations do not verify identity. Evaluation-only images remain outside generation inputs unless the current task explicitly assigns another role.

## Style Target
Owns: medium, motion, lighting language, atmosphere, composition energy, color relationships and environment scale when authorized.

Never owns by default: identity geometry, body identity, garment silhouette, garment construction or signature accessories.

## Asset Master
Owns: identity, hairstyle silhouette, body continuity, costume architecture, signature accessories and approved design family.

## Background Reference
Owns: the explicitly assigned setting, spatial layout, scene elements and background appearance through the `background` channel. Assign `lighting` separately when the reference also controls illumination. It does not gain identity or wardrobe authority. Preserve, adjust or replace the environment according to the current brief; a white background is optional. See [background direction](background-direction.md).

## Key rule

A style target should be allowed to change **presentation** strongly without silently replacing **design identity**.

If style demands dynamic composition and the user did not lock the static pose, motion may be authorized. This is not an identity change.

## Identity A / Wardrobe B

Use this separate scenario when a user authorizes clothing redesign and the current brief assigns a specific image as the wardrobe reference. A supplies the face, apparent age, expression and hair. B supplies the named clothing construction, palette, layering and material relationships; selected accessories only as assigned. The written adaptation controls changes, pose and background. A portrait does not establish unseen full-body proportions, and B's body is not an identity template.

Bind the roles to the actual submitted image order and describe each image briefly. Explicitly exclude distinctive donor traits that could transfer accidentally: for example silver hair, a high bun, a forehead mark or a crown. This is targeted clarification, not a long generic negative list. User-authorized hairstyle changes still take precedence over defaults.

```bash
node scripts/iteration-director.mjs reference-authority --scenario identity_A_wardrobe_B
```

This command returns planning metadata and reference-binding text; it does not inspect images, generate a complete costume prompt, or enforce model behavior. Authority levels are planning labels, not image-model weight parameters. Use the [character asset route](../routes/character-asset-pipeline.md) for the actual design brief. Do not feed this scenario into the cinematic style-restoration plan, whose A/B meanings are different.

Keep an original-only baseline when testing the added wardrobe image. Preserve the same concrete clothing brief where possible and record the new image and role-binding text as changes. Review face/hair against A and clothing against B separately; also check accessory count and ornament density against the brief. A successful black-hair check does not prove the face is unchanged. The additional visual source is not a prompt-only improvement. See [the actual comparison](../../docs/visual-evaluations/wardrobe-reference-v095.md).
