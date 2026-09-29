# Human Presence Protocol v0.7.3

## 为什么“毛孔 + photorealistic”仍然会像 CG

真人感不只来自微纹理。高质量数字角色常已经有毛孔，却仍然缺少真人存在感，因为软组织、局部反射、微小非对称和镜头响应仍然过于理想化。

## H0–H3

### H0 Stylized
不主动真人化。

### H1 Surface Realism
皮肤、发丝、材料有基础真实纹理，整体仍偏概念图/CG。

### H2 Human Presence（默认角色资产）
加入：
- soft tissue
- regional skin response
- natural asymmetry
- camera response
同时保护年轻、漂亮和角色身份。

### H3 Photographic Presence
更接近真实模特/摄影棚成像，允许更明显的自然肤色变化、镜头响应和非完美细节，但仍不自动增加衰老、痘印或粗糙。

## A. Soft Tissue

关注：
- 眼睑厚度与眼球包裹关系
- 下眼睑轻微体积
- 面颊软组织
- 鼻翼软组织
- 嘴角与唇周过渡
- 下颌到颈部的真实转折

## B. Regional Skin Response

不同区域不同：
- 额头：较平滑、弱油脂反射
- 鼻梁/鼻尖：更集中高光
- 鼻翼/内侧面颊：极细微纹理
- 外侧面颊：柔和漫反射
- 眼周：更薄、更柔、略有色差
- 嘴唇：独立材质与细唇纹

禁止把整张脸写成同一种“自然光泽”。

## C. Natural Asymmetry

只允许非常轻微：
- 左右眉高度差
- 眼睑开放度差
- 唇角差
- 面颊/高光差

目标是去掉完美建模感，不是让脸变歪。

## D. Camera Response

真实摄影感还来自：
- 柔和高光 roll-off
- 阴影保留细节
- 自然微对比
- 主体焦点最清楚，边缘不过锐
- 不做全局 uniform sharpness
- 不用 HDR / clarity 把所有纹理同时抬高
