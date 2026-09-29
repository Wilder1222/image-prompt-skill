# v0.7.3 Reference Fidelity & Human Presence Pipeline

## 1. Decompose Reference

即使只有一张参考图，也先拆成 Identity / Costume / Material / Pose / Style / Lighting / Environment。

## 2. Assign Fidelity

使用 0–3 权重。白底角色资产默认环境 0；身份与服装通常 3；材质 2；风格/光线根据用户目标设 1–2。

## 3. Visible / Inferred

只有实际可见的部分才能被严格锁定。未展示区域进入 Completion。

## 4. Completion Level

默认 C1 Conservative Completion。只补必要全身结构，不增加新的主色、主装甲、主图腾和设计体系。

## 5. Density & Wear Lock

记录参考的设计密度和破损等级。扩展新区域不提升复杂度，不自动把 distressed 变成 ruined。

## 6. Render Mode

- asset：纯资产中性呈现
- style_asset：白/中性背景但保留参考风格、材料和人物气质
- restoration：原题氛围恢复
- hybrid：资产连续性 + 原题场景/风格融合

## 7. Human Presence

角色资产默认 H2：软组织 + 区域皮肤反射 + 微小自然非对称 + 真实镜头响应。身份几何保持锁定。

## 8. Compile

最终提示词优先顺序：
Identity → Costume Architecture → Completion Boundaries → Material/Style → Human Presence → Lighting/Camera → Quality。

## 9. Diagnose

重点识别：reference_channel_leak、completion_overdesign、design_density_inflation、wear_state_inflation、human_presence_undershoot、camera_cg_render、style_asset_environment_leak。
