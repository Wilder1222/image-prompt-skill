# 服装结构矩阵

用于观察衣装构造、延展未见部位，或比较用户要求的多套新设计。先记录当前参考与设计意图，不要求每个任务重新设计一套服装。

## 记录维度

下表的英文仅为兼容字段与选项标识；实际观察、设计理由和提示词用中文。未见或不适用的部位明确说明，不用预设填补事实。

| 维度 | 兼容字段 | 可选结构及标识 |
| --- | --- | --- |
| 造型编号 | `look_id` | 本轮造型的唯一编号 |
| 整体轮廓 | `silhouette` | 纵向直身 `column_vertical`；宽袖长裙 `wide_sleeve_long_skirt`；不对称战裙 `asymmetric_battle_skirt`；层叠长袍 `robe_layered`；礼仪大裙 `ceremonial_ballgown`；前开衣片 `split_front_panels` |
| 领口 | `neckline` | 交叠领 `crossed_v`；立领 `high_collar`；挂颈领 `halter_collar`；层叠领 `layered_collar`；礼仪圆领 `ceremonial_round` |
| 肩部 | `shoulder_structure` | 柔和露肩 `bare_shoulder_soft`；轻肩甲 `light_pauldrons`；单侧护肩 `one_sided_guard`；垂坠披肩 `draped_shawl`；挺括礼服肩 `structured_formal` |
| 袖型 | `sleeve_type` | 轻透宽袖 `translucent_wide`；合体袖加垂片 `fitted_with_drapes`；开衩袖 `split_sleeve`；长飘带 `long_streamers`；完整礼仪袖 `ceremonial_full` |
| 腰部连接 | `waist_system` | 窄带 `narrow_belt`；宽腰封 `wide_corset_belt`；甲片束腰 `armor_cincher`；高位衣带 `high_waist_sash`；层叠腰片 `layered_waist_panels` |
| 下装 | `lower_structure` | 层叠长裙 `layered_full_skirt`；前开裙片 `front_slit_panels`；不对称衣片 `asymmetrical_panels`；裙甲组合 `skirt_armor_mix`；袍下配裤 `robe_over_pants` |
| 甲片占比 | `armor_ratio` | 无 `none`、少 `low`、中等 `medium`、多 `high`，按实际设计说明分布 |
| 半透明范围 | `transparency_budget` | 旧兼容档位 `0-10`、`10-20`、`20-30` 仅为内部概括；具体写明哪层、哪处及遮盖关系 |
| 露肤范围 | `exposure_level` | 含蓄 `conservative`、局部开放 `balanced`、较开放 `open`、强烈展示 `dramatic`；均非自动默认 |
| 装饰密度 | `ornament_budget` | 克制 `low`、适中 `medium`、繁复 `high`，另说明主次与固定位置 |
| 鞋履家族 | `footwear_family` | 东方平底绣鞋 `eastern_flat_brocade`；东方低跟包裹鞋 `eastern_lowheel_wrap`；软甲靴 `armored_soft_boot`；礼仪平底鞋 `ceremonial_flat_shoe` |

这是旧古风系列的选项集合，不是所有服装的封闭分类。现代装、裤装、特殊领袖或用户新方案按实际描述，不为匹配选项强加甲片、开衩、透纱、腰封或东方鞋。鞋被自然遮挡时，不强制展示。高位衣带属于衣装构造，不能据此移动人体腰位。

## 多套设计的差异

只有用户要求结构不同的新款时，才比较轮廓、领袖、肩部、腰部连接、下装等是否存在清楚差异。需要明显区分的系列可优先选择三项结构变化作为设计策略，但数量不能代替实际辨识度，也不是每项任务的通过门槛。

同款换色、严格还原参考、同一衣装多姿态和局部材质修复，不要求改变三项结构。露肤、透明度和甲片数量不是制造差异的必选手段。已批准的结构按当前编辑范围保持，未知下装依据可见设计自然延展。
