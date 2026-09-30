# 人物辨识记录

## 目的

将“保持同一个人物”从一句模糊要求，升级为可以重复调用的结构化身份签名。

## 签名结构

### 1. 面容辨识

记录：

- face_shape：例如柔和偏长鹅蛋脸
- brow_eye_relation：眉眼距离与走向
- eye_shape_core：修长杏眼 / 丹凤眼 / 圆杏眼等
- eye_spacing：眼距倾向
- nose_bridge_and_tip：鼻梁、鼻尖、鼻翼关系
- lip_ratio：上唇 / 下唇厚度关系
- jaw_chin：下颌与下巴轮廓
- age_intent：18-20 / 20-25 / 成熟感等

### 2. 发型方向

记录：

- parting：中分 / 偏分
- bangs_grouping：刘海分组方式
- side_locks：鬓发长度与数量
- updo_height：发髻高度
- rear_hair_volume：后发体积
- long_hair_drop：长发主要落点
- hair_accessory_shape：发冠发簪的主要轮廓

### 3. 体型关系

记录：

- frame：骨架感
- shoulder_waist_relation：肩腰关系
- torso_leg_balance：躯干与腿长比例
- body_curve_intent：纤细 / 柔和 / 有力量等

### 4. 保持范围

强锁：
- 稳定面容辨识
- 已选发型方向，允许按授权整理与适配
- 已指定年龄
- 可见且已确认的身体关系

中锁：
- 已选妆容方向
- 已指定饰品家族

可变：
- 衣装
- 配色
- 授权范围内的姿态

## 使用规则

1. 同一人物的多套造型共用其辨识记录；不同人物不可共用一张脸。
2. 图生图时，身份参考图只能有一个主要人物来源。
3. 服装参考不能替代身份参考。
4. 若结果图出现“变成另一个人”，优先回到签名而不是继续加美貌词。
