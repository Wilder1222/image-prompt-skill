# Extremity Integrity Guard v0.7.4

## 触发条件

全身资产图、手势可见、鞋履/脚部可见时自动检查。

## 手部

- 每只可见手应为五指
- 拇指位置与掌心朝向一致
- 四指长度层级自然
- 不出现融合、重复、断指、多指
- 指节弯曲和手腕方向符合姿势

不要依赖一句“correct hands”解决问题。生成后必须视觉验收。

## 足部与鞋履

- 脚踝与足部方向符合承重
- 鞋面包裹真实足部体积
- 脚/鞋不与裙摆或机械件错误穿插
- 地面接触符合人物重心

## 局部修复

如果角色、衣服和构图已经通过，只出现手指/脚部错误：

> Diagnose → Lock passed asset → extremity_integrity round → only repair hands/feet.

不得因为修手重新设计整套角色。
