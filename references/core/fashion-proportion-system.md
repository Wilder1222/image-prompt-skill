# Fashion Proportion System v0.7.5

## 当前身材设计规则

本项目成年角色采用高挑修长、匀称且有适度肌肉线条的体型，服务视觉美感与活人感。已选 P9 时保持约九头身的时装观感（现有预设参考范围 8.6–9），严格检查各部位是否共同协调，不用单纯拉长腿部实现。此偏好不覆盖其他任务明确指定的年龄、体型或局部编辑边界。

“黄金比例”在这里表达均衡的审美目标，不把 1.618 或任意腰臀数值套到每个身体部位。用户提供具体比例时记录其定义和目标；腰臀围比与正面轮廓宽度比不能混用。参考不足或裙装遮挡时，不编造精确测量，也不宣称已证明达到数学黄金比例。

按【身材比例与体型】或既有【身材比例】明确写出：

- **头身与肩颈**：头部与肩宽协调，颈部舒展，保留人物脸型；头长取颅顶至下巴，不计发髻头饰，人体高度不计鞋跟与拖尾。不通过缩小脸、拉长颈部或加宽肩膀凑头数。
- **胸廓、腰与臀**：完整躯干和骨盆，腰部收束、臀部有自然体积，肩腰臀曲线连续且有支撑。腰线由身体结构决定，衣带不能替代解剖位置；避免细腰突然接夸大臀部或压短腰腹。
- **手臂**：肩、上臂、肘、前臂、腕和手掌尺度一致，上臂与前臂长度互相协调；手臂修长但有体积，向腕部自然收细。放松和屈伸时分别检查关节位置，不能只延长前臂或缩小手掌。
- **腿部**：骨盆、大腿、膝、小腿、踝与足连续；大腿修长且有适度饱满的肌肉体积，膝部不过分尖细，小腿有自然起伏并向踝部收束。大腿与小腿在长度、粗细和关节位置上协调，不把整条腿画成等粗细杆，不单独拉长某一段。
- **肌肉与软组织**：肩臂、腰腹、臀腿可见处有柔和、匀称的肌肉起伏，紧致有弹性，仍保留自然软组织。线条随动作收缩与放松，不默认健美分块、深刻腹肌、凸出青筋或削瘦骨感；均衡不等于把左右肌肉画成完全相同的静态轮廓。

肌肉表现不要求额外裸露、紧身化或透视服装。厚衣下用轮廓、支撑和受力褶皱表现身体，不能穿透面料画出腹肌。动态按空间和透视关系判断，屈腿或透视缩短不需要在画面投影里仍凑九头身。

验收时分别检查头身、肩腰臀、上下臂、上下腿和肌肉量，再看整体是否修长自然。任何一处明显失衡都不能被“长腿”或总体分数掩盖；遮挡处注明不可判断。比例优化优先修正失衡部位，保持已通过的面容、妆容、服装与动作。明确要求保持完整母图时不自动改身材；已授权体型再设计时走主生产流程，不调用冻结体型的保留母图预设。

## Goal

Turn “nine-head perfect proportion” into a controlled fashion-anatomy workflow rather than a generic “longer legs” instruction.

The system is a **visual design heuristic**, not an anatomical measurement protocol and not a vendor-native parameter.

## Profiles

- `P7 Natural`: ordinary believable adult proportion.
- `P8 Elegant`: subtly taller and more editorial.
- `P9 Fashion`: high-fashion nine-head visual proportion while preserving adult anatomy.
- `P9.5 Stylized`: stronger editorial elongation; only use when the user explicitly wants stylization.

For full-body character assets, default to `P9` when the user asks for 九头身 / 高挑时装比例.

## P9 Core Rules

1. Hair buns, crowns and hairpins do not count as head length.
2. Reduce the head's **visual share** of the full figure, not the face width or identity geometry.
3. Keep a complete ribcage and torso; never manufacture long legs by crushing the torso.
4. Lengthen hip-to-knee and knee-to-ankle segments together.
5. Preserve believable pelvis width, knee position, ankle scale and foot size.
6. Raise the waist only visually through sash placement and skirt origin, not by shortening anatomy.
7. Use the garment itself to strengthen verticality: long center lines and balanced sleeve/skirt mass. Footwear may be naturally hidden; do not change the hem merely to expose shoes.

## Failure Signals

- head_visual_too_large
- torso_visually_short
- waistline_too_low
- leg_extension_insufficient
- knee_position_low
- footwear_scale_too_large
- silhouette_too_wide
- vertical_flow_insufficient
