# FLUX.2 v0.7.3 Reference Fidelity

FLUX.2 支持多参考编辑。官方提示指南强调词序：最重要的主体和关键约束放前面。

因此编译顺序：
1. Identity/asset continuity
2. Required completion
3. Style/material target
4. Human presence/camera
5. Secondary details

FLUX 不支持 negative prompt。将“不要复制背景”改为“pure white seamless background; reference environment excluded from the final scene”。

H2 真人感可使用清晰的摄影外观描述，但不靠相机型号替代身份和材料约束。
