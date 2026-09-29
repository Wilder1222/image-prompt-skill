# Midjourney v0.7.3 Reference Fidelity

V8.2 Edit Model 可使用最多4张参考，并且 Style Reference 是独立的参考类型。因此：

- 角色/服装连续性用 Edit Model Reference
- 纯外观风格可用 Style Reference
- 不要把场景图作为普通 Edit Reference 后期待模型自动只提取风格

Style-on-Asset 模式：资产参考放 Edit Model，风格参考放 Style Reference，正文明确纯白/中性背景和完整全身目标。

`--raw` 可作为减少额外创意偏移的实验控制，但不是身份锁定开关。
