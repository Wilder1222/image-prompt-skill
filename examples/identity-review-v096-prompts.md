# v0.9.6 面部评审与同衣装实际提示词

A 编辑现有全身候选，以原图 2 作为面部细节参考；B 以原图 3 和银发优秀图生成新衣装候选。提示词为项目 skill 路线下手工编写的实际发送文本，不声称是未经修改的 CLI 输出。

## a-02-face-reference-edit

输入角色：current_edit_target / identity_detail_reference。

```text
Edit Image 1, the black-haired woman in a full-body ivory and lavender-grey gown on white. Image 2, the original close portrait, supplies ONLY facial features and expression for this correction. Keep Image 1's exact full-body composition, head size and orientation, hair silhouette and ornaments, clothing layers, shoulder clasps, sash, hands, pose, train, shoe tip, white background and soft studio lighting.

Adjust only the facial region to better match Image 2: restore its softly rounded cheek volume and gently curved lower face rather than a narrowed V-shaped jaw, its natural upper eyelids and softly open eye shape, pale brown-grey irises, natural nose width and tip, and its own lip outline with relaxed slightly parted lips. Retain the original's quiet direct gaze and apparent adult age. Adapt those facial features to Image 1's existing head angle and lighting. Keep fine natural skin detail with soft transitions; do not add harder cheekbone shadows or hollow cheeks. Do not import Image 2's outdoor light, close-up framing, old clothes or flyaway strands covering additional facial features. Leave all non-face content unchanged. Return the complete full-body image in the same 3:4 format, not a headshot.
```

## b-03-same-wardrobe-identity

输入角色：identity_source / wardrobe_design_reference。

```text
Reference binding: Image 1, the black-haired close portrait, is the ONLY identity and hair source. Image 2, the silver-haired full-body gown portrait, supplies clothing construction, ivory/lavender-grey palette, draping layers, gold shoulder clasps and material relationships ONLY. Do not copy Image 2's face, body proportions, silver hair, high bun, long hairpin or forehead mark. The specific adaptation below takes precedence over clothing details in either image.

Make one full-body costume portrait of the adult woman from the identity portrait on a seamless white background, vertical 3:4. Show the whole hair silhouette, sleeves, gown hem and a visible embroidered shoe tip, with a little white breathing room around the complete figure. Soft neutral studio light gives gentle facial modeling and a faint floor contact shadow.

Retain this identity portrait woman's own facial geometry and apparent adult age: softly modeled cheeks with her natural jaw curve, dark brown-grey eyes with the original slightly intent eyelid expression, subtly angled brows, natural nose and defined relaxed lips. Preserve her slight head tilt and attentive direct gaze, rather than replacing them with a neutral generic beauty expression. Keep black half-up long hair, loose strands across the temples and small silver hair ornaments. Her forehead stays unadorned. Render her recognizable face with delicate realistic skin texture. Do not borrow the wardrobe reference woman's facial proportions or silver hair.

Moderate wardrobe redesign is authorized. Create an ivory and muted lavender-grey layered ceremonial gown. A soft opaque ivory crossover blouse has broad folds and a narrow pale pink inner collar edge. A lavender-grey woven sash shapes the natural waist with a fine warm-gold cord. Small antique-gold shoulder clasps support the light outer robe, with only a few slender hanging gold chains. Broad lavender-grey sleeve bands fall from her gently overlapping hands at the lower waist, making relaxed long draping arcs. The central ivory skirt is plain softly matte cloth, with generous vertical folds. Two long lavender-grey silk panels flank it and carry sparse fine gold botanical embroidery close to their lower edges. Lightweight ivory gauze overlaps the outer sleeves and side skirt, revealing the underlying panel edges in thin transparent layers. Let the center, side panels and outer gauze finish at slightly different lengths, opening into a modest soft train. The waist remains readable and the silhouette gradually widens below the hips. A slender lavender tassel hangs from the waist. One ivory embroidered shoe tip establishes contact with the white floor.

Keep construction readable: quiet opaque inner cloth, slightly lustrous colored silk and thin gauze respond differently to light and gravity. Keep hands relaxed with coherent visible wrists and fingers. No huge crown, silver hair, forehead jewel, scenery or lettering.
```
