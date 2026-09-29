# v0.7.4 Constraint Budget & Human Realism Pipeline

## 1. Reference Fidelity
先完成 v0.7.3 的通道拆分。

## 2. Visible / Inferred
只有可见内容可以 strict preserve；不可见区域进入 completion budget。

## 3. Constraint Budgets
为本次任务选择：
- Completion C0–C3
- Density preserve / reduce / enrich
- Wear W0–W4
- Extremity E0–E3

角色资产默认：C1 + density preserve + 原 wear state + E2。

## 4. Human Presence v2
角色资产默认 H2。身份几何继续锁定。

## 5. Prompt Compile
把内部预算翻译成自然语言。优先级：
P0 identity → P1 reference/completion/extremity → P2 human presence/material → P3 lighting/optics。

## 6. Generate and Diagnose
结果图必须检查：
- 是否换脸
- 补全区域是否过度设计
- 设计密度是否上涨
- wear 是否升级
- 真人感是否仍为 CG
- 手指与脚部是否正确

## 7. Local Patch
单点失败优先局部 patch，不回到整图重生成。
