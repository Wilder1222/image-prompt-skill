# Constraint Budget System v0.7.4

## 目的

v0.7.3 已经能区分参考图职责，但真实出图显示：模型在“补全看不见的区域”时仍会扩大轮廓、增加机械件、装饰和破损。v0.7.4 将这些软要求改成内部预算，再翻译成自然语言约束。

预算不是模型原生参数，也不表示模型可以精确执行百分比。百分比只用于项目内部比较和回归测试，最终提示词使用可见结果描述。

## Completion Budget

### C0
只补最低限度结构，不扩大轮廓，不增加装饰或材料体系。

### C1，角色资产默认
允许为了完整人体和穿着逻辑做少量结构补全，但：
- 主装饰增长 = 0
- 新主图腾 = 0
- 新材料家族 = 0
- 轮廓扩展保持最小
- 不可见区域不能比可见区域更复杂

### C2
允许有限创意补全，但所有新内容仍是 secondary。

### C3
用户授权重设计。

## Design Density Budget

设计密度不是“复杂/不复杂”一个标签，而是检查：
- 主装饰数量
- 次级装饰数量
- 机械模块数量
- 链条/流苏数量
- 微型纹样密度

补全区域默认匹配参考图的平均密度，而不是复制最复杂区域的峰值。

## Wear Budget

破损必须保持同一 wear state。扩全身不会因为画面面积增加而增加污渍比例、裂口数量或金属损伤等级。

## Prompt 编译

不要输出：`ornament_growth = 0%`。

输出：
> Do not add new primary ornaments or increase decoration density in the newly completed lower body; keep it no more complex than the already visible reference areas.
