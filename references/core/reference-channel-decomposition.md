# Reference Channel Decomposition v0.7.3

## 目的

参考图往往同时包含人物、服装、材质、姿态、风格、灯光和环境。如果只写“参考这张图”，模型会把不该迁移的内容一起带入。

因此即使只有一张图，也必须内部拆成七个通道：

1. Identity
2. Costume
3. Material
4. Pose
5. Style
6. Lighting
7. Environment

## 权限原则

每个通道单独分配 Fidelity：0 ignore / 1 weak / 2 strong / 3 strict。

### Identity
控制：脸部身份、年龄感、发型主轮廓、稳定体型特征。

### Costume
控制：服装轮廓、结构、层级、主装甲、鞋履家族和标志性配饰。

### Material
控制：丝绸、云锦、纱、金属、皮革、机械表面的真实行为。

### Pose
控制：身体朝向、手势、重心、腿部关系。

### Style
控制：媒介感、幻想强度、色彩关系、画意、动势语言。

### Lighting
控制：光位、明暗关系、轮廓光、辉光、色温。

### Environment
控制：背景、建筑、山水、雾、粒子、场景尺度。

## 典型配置

### 原画 → 白底全身角色资产

```text
Identity     3
Costume      3
Material     2
Pose         2
Style        1
Lighting     1
Environment  0
```

### 原画 → 风格还原成片

```text
Identity     2–3
Costume      2–3
Material     2
Pose         1–2
Style        3
Lighting     3
Environment  2–3
```

### 白底资产 + 原画风格 → Hybrid

资产图承担 Identity / Costume / Pose；原画承担 Style / Lighting / Environment。不要让两个参考在同一通道都处于 strict，除非内容完全一致。
