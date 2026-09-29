# Identity Drift vs Temperament Shift v0.7.1

## Core Distinction

A face can change in expression, maturity impression, or temperament while remaining the same identity. These changes should not all be labeled “identity drift.”

## 表情适配

用户允许表情自动调整时，根据本次人物气质、姿态、背景和用途决定一项明确表情，不机械复制参考神态，也不把所有女性统一成甜笑或冷脸。明确指定的表情优先；只允许修灯光、手部等局部问题时，不把一般适配许可扩大为每轮都重做表情。

- 将情绪写为可见动作：视线目标、眼睑开合与眉眼张力、嘴角走向、唇部闭合或微启、面颊变化。强度由任务决定，普通定妆通常克制自然，叙事要求的笑、哭、愤怒或惊讶可以更明确。
- 每张图选一个协调结果，避免同时写冷漠、灿笑、忧伤、魅惑等互相拉扯的目标。没有情绪要求时结合角色与用途选择，不为了体现“调整”强行换一种心情。
- 眼神可调整不等于可以转头、侧身或换镜头。已要求看镜头时保持视线目标；头部角度属于构图范围，需要改变时明确列入允许项。
- 保持人物的稳定辨识点和表观年龄；允许笑意或其他表情引起的自然眼睑、唇形、嘴角和面颊运动，不用逐像素锁定嘴角去阻止表情。不要用放大眼睛、削尖下巴、收窄鼻翼或换唇形模板制造情绪。
- 可使用独立【表情与眼神】标签与 expression 通道。只有表情参考权限的辅助图不能决定人物脸型；要迁移表情动作，不借用另一个人的五官。

验收分别回答：表情是否符合任务，眼口眉是否协调自然，人物是否仍可辨认。开放微笑时检查可见牙齿、口腔与嘴唇连接；不需要张嘴的表情不强加牙齿要求。先排除表情运动、头角和照明造成的差异，再判断身份是否漂移；图像细节不足时保持不确定，不仅凭表情改变就判失败。

## Identity Drift

Use when stable facial geometry changes materially:

- face width/length changes beyond the target delta
- eye spacing changes
- underlying eye structure changes beyond plausible expression movement
- nose width/proportion changes
- underlying lip structure changes beyond plausible expression movement
- jaw/chin changes enough to read as another person

## Evidence before classification

Compare the actual source and candidate, naming the visible feature instead of relying on a generic similarity impression. Record head angle, lighting, expression, occlusion and face size in the full image as possible confounds. When these prevent a reliable comparison, record a provisional `possible_geometry_shift` with certainty `uncertain`; keep the identity verdict pending rather than declaring drift or stability. These are review annotations, not new CLI classifier outputs or image-model parameters.

The same hair color, accessory or head pose does not establish the same face. Conversely, a face correction that retains the whole costume does not automatically improve identity. If the before/after benefit cannot be clearly described at the available image detail, retain the prior candidate and mark the edit inconclusive. Do not run repeated face edits merely because approval is still pending.

For a shared wardrobe reference across different original portraits, keep the clothing brief fixed and rewrite only the source-specific facial and hair description. Compare the results to each respective original; different poses or expressions alone are insufficient evidence that all facial geometry was preserved. Never make one reference portrait the default face for other characters.

## Temperament Shift

Use when geometry remains stable but presentation changes:

- gaze becomes calmer / colder / warmer
- expression becomes more restrained
- makeup becomes less youthful
- eye openness changes slightly
- cheek softness presentation changes slightly

Temperament shift can be **targeted** or **excessive**.

## Classification Labels

- `identity_stable`
- `identity_drift`
- `temperament_shift_target`
- `temperament_shift_over`
- `maturity_undershoot`
- `maturity_overshoot`
- `beauty_template_drift`
- `age_shift_unwanted`
- `trait_reference_overborrow`

## Examples

### Good
Same face geometry, calmer gaze, slightly less cheek baby-softness, more restrained makeup → `temperament_shift_target`.

### Bad
The underlying eyes are redesigned, face gets much longer and chin sharper to look “expensive” → `identity_drift` + `beauty_template_drift`. Natural eyelid narrowing during a smile alone is not this failure.

### Too mature
Same identity, but face becomes hollow, severe, visibly older than intended → `maturity_overshoot` or `age_shift_unwanted`.
