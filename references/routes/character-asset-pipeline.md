# v0.6 Character Asset Pipeline

## Step 1. 建立 Character Signature

从身份参考图提取：
- Face Signature
- Hair Signature
- Body Signature
- Identity Lock Scope

## Step 2. 建立 Asset Intent

明确任务：
- 半身 / 全身
- 白底 / 场景
- 单 Look / 多 Look
- 真人棚拍感 / 偏CG设定图

## Step 3. 建立 Garment Architecture Matrix

如果是多套服装，先写矩阵，不直接进入完整文案。

## Step 4. 设定 Budgets

- ornament_budget
- exposure_level
- transparency_budget
- armor_ratio

## Step 5. 生成完整提示词

完整提示词需要按优先级组织：
- 身份与人体
- 服装结构
- 材质与受力
- 露肤与透明预算
- 鞋履
- 白底灯光
- 真实肤感

## Step 6. 结果诊断

对返回图按 v0.6 failure codes 打标。
