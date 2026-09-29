# v0.8.3 白底角色资产测试提示词

由 `npm run examples:build` 自动生成。A/B 使用同一张参考图、相同画幅与模型设置，只改变面部渲染方向；不要将 A 的输出作为 B 的输入。局部编辑使用最新已接受母图。

以下是成年古风角色预设，年龄、比例、手势与用户不符时需按实际要求调整。尚未执行图像生成或视觉验收。

## A：角色感优先的全身白底生成

```text
Create a 3:4 full-body front-facing white-background ancient-fantasy character asset from the supplied reference.

Preserve the observed facial identity, apparent age, hairstyle, accessories, visible costume construction and palette. Extend unseen lower-body regions conservatively in the same design language; these are designed extensions, not observed facts.

Keep the face beautiful first, but preserve character-specific facial identity rather than averaging it into a generic AI beauty face.

Retain the reference cheek volume, natural eyelids, individual mouth-corner placement and a calm character-specific gaze.

Add only restrained regional skin response and soft-tissue realism; do not increase maturity, fatigue or facial severity.

Keep the visual age in the youthful 18–22 range.

Do not create mature fatigue, hollow cheeks, deep eye sockets, heavy under-eye darkness or a stern older fashion-model impression.

Preserve youthful cheek softness and clear facial energy while allowing only subtle natural skin realism.

Compose the character as a clean master asset portrait: full body visible from the top of the hair ornament to the shoes, centered, front-facing and upright, with balanced negative space and a pure white seamless background.

Keep the hem controlled rather than excessively spread, and keep the footwear clearly readable so the full-body scale and costume construction can be used as a reusable character asset master.

Maintain a clear tall, balanced fashion proportion with an approximately nine-head visual read even under layered long robes: refined head-to-body read, elongated neck-to-waist rhythm, naturally elevated waist, strong vertical garment lines and a readable foot-to-hem relationship.

Keep the torso anatomically complete and lengthen the lower-body impression through balanced hip-knee-ankle relationships rather than artificial leg stretching.

Control sleeve and hem width so the costume supports height instead of visually compressing it.

Place the right hand gently over the back of the left hand in front of the lower abdomen, with relaxed fingers and distinct wrist directions; avoid interlacing.

Each hand has exactly five digits anatomically: one thumb and four fingers. Natural overlap may hide some digits; do not force all ten digits into view. Keep visible finger segments, knuckles and wrist connections coherent, with sleeve openings clear of the hand contact area.

Separate the garment materials clearly where present in the reference: the main robe should feel denser and more structured, any existing gauze lighter and semi-transparent, existing gold floral patterns woven or embroidered rather than printed, and existing waist/collar/tie structures visibly more defined. Do not add missing gauze, gold motifs or accessories.

Do not let all layers share the same soft glossy fantasy surface.

Use a premium high-key studio setup: a large soft key from slightly front-left and above, weaker frontal fill, and only a very subtle separation light for pale gauze edges.

Keep the white background clean but not clipped; preserve a soft grounded floor shadow, clear face modeling, readable fabric hierarchy and restrained gold-thread highlights.
```

## B：轻度真人感；其余条件与 A 相同

```text
Create a 3:4 full-body front-facing white-background ancient-fantasy character asset from the supplied reference.

Preserve the observed facial identity, apparent age, hairstyle, accessories, visible costume construction and palette. Extend unseen lower-body regions conservatively in the same design language; these are designed extensions, not observed facts.

Increase believable human facial presence while keeping the character attractive, identity-stable and consistent with the approved apparent age.

Use realistic eyelid structure, regional skin optics and natural nose/lip anatomy without pushing the face toward mature documentary realism.

Keep the visual age in the youthful 18–22 range.

Do not create mature fatigue, hollow cheeks, deep eye sockets, heavy under-eye darkness or a stern older fashion-model impression.

Preserve youthful cheek softness and clear facial energy while allowing only subtle natural skin realism.

Compose the character as a clean master asset portrait: full body visible from the top of the hair ornament to the shoes, centered, front-facing and upright, with balanced negative space and a pure white seamless background.

Keep the hem controlled rather than excessively spread, and keep the footwear clearly readable so the full-body scale and costume construction can be used as a reusable character asset master.

Maintain a clear tall, balanced fashion proportion with an approximately nine-head visual read even under layered long robes: refined head-to-body read, elongated neck-to-waist rhythm, naturally elevated waist, strong vertical garment lines and a readable foot-to-hem relationship.

Keep the torso anatomically complete and lengthen the lower-body impression through balanced hip-knee-ankle relationships rather than artificial leg stretching.

Control sleeve and hem width so the costume supports height instead of visually compressing it.

Place the right hand gently over the back of the left hand in front of the lower abdomen, with relaxed fingers and distinct wrist directions; avoid interlacing.

Each hand has exactly five digits anatomically: one thumb and four fingers. Natural overlap may hide some digits; do not force all ten digits into view. Keep visible finger segments, knuckles and wrist connections coherent, with sleeve openings clear of the hand contact area.

Separate the garment materials clearly where present in the reference: the main robe should feel denser and more structured, any existing gauze lighter and semi-transparent, existing gold floral patterns woven or embroidered rather than printed, and existing waist/collar/tie structures visibly more defined. Do not add missing gauze, gold motifs or accessories.

Do not let all layers share the same soft glossy fantasy surface.

Use a premium high-key studio setup: a large soft key from slightly front-left and above, weaker frontal fill, and only a very subtle separation light for pale gauze edges.

Keep the white background clean but not clipped; preserve a soft grounded floor shadow, clear face modeling, readable fabric hierarchy and restrained gold-thread highlights.
```

## 只修手部，锁定已通过的比例与构图

```text
Edit the supplied current asset image. Use it as the only direct edit target.

Preserve facial identity, apparent age, approved facial rendering, hairstyle, costume design, palette, materials, background type and lighting layout.

Keep body proportions, garment drape, framing and footwear unchanged. Repair only the hands and their wrist/sleeve contact locally, retaining the existing gesture.

Each hand has one thumb and four fingers anatomically. Preserve natural occlusion; only visible segments need to be resolved. Correct fused or duplicated visible digits and incoherent knuckle/wrist connections without forcing hidden fingers into view.

Also preserve these accepted dimensions: fashion asset proportion, asset framing.
```

## 只修材质，保持脸、姿态与灯光

```text
Edit the supplied current asset image. Use it as the only direct edit target.

Preserve facial identity, apparent age and approved facial rendering, body proportions, hairstyle, pose, hands, footwear shape, costume construction, palette and framing.

Keep the current light positions, background and floor shadow unchanged. Refine only the response of materials already present.

Separate the garment materials clearly where present in the reference: the main robe should feel denser and more structured, any existing gauze lighter and semi-transparent, existing gold floral patterns woven or embroidered rather than printed, and existing waist/collar/tie structures visibly more defined. Do not add missing gauze, gold motifs or accessories.

Do not let all layers share the same soft glossy fantasy surface.
```

## 只修灯光与白纱边缘分离

```text
Edit the supplied current asset image. Use it as the only direct edit target.

Preserve facial identity, apparent age and approved facial rendering, body proportions, hairstyle, pose, hands, footwear shape, costume construction, palette and framing.

Keep the existing garment materials and textures unchanged. Refine only studio illumination, pale-edge separation and contact shadow.

Use a premium high-key studio setup: a large soft key from slightly front-left and above, weaker frontal fill, and only a very subtle separation light for pale gauze edges.

Keep the white background clean but not clipped; preserve a soft grounded floor shadow, clear face modeling, readable fabric hierarchy and restrained gold-thread highlights.
```
