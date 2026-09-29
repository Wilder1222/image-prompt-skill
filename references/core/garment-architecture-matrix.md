# Garment Architecture Matrix

## 目的

让多套服装真正形成结构差异，而不是同一版型换颜色。

## 必填维度

每个 Look 至少填写：

- look_id
- silhouette
- neckline
- shoulder_structure
- sleeve_type
- waist_system
- lower_structure
- armor_ratio
- transparency_budget
- exposure_level
- ornament_budget
- footwear_family

## 推荐值

### silhouette
- column_vertical
- wide_sleeve_long_skirt
- asymmetric_battle_skirt
- robe_layered
- ceremonial_ballgown
- split_front_panels

### neckline
- crossed_v
- high_collar
- halter_collar
- layered_collar
- ceremonial_round

### shoulder_structure
- bare_shoulder_soft
- light_pauldrons
- one_sided_guard
- draped_shawl
- structured_formal

### sleeve_type
- translucent_wide
- fitted_with_drapes
- split_sleeve
- long_streamers
- ceremonial_full

### waist_system
- narrow_belt
- wide_corset_belt
- armor_cincher
- high_waist_sash
- layered_waist_panels

### lower_structure
- layered_full_skirt
- front_slit_panels
- asymmetrical_panels
- skirt_armor_mix
- robe_over_pants

### armor_ratio
- none
- low
- medium
- high

### transparency_budget
- 0-10
- 10-20
- 20-30

### exposure_level
- conservative
- balanced
- open
- dramatic

### ornament_budget
- low
- medium
- high

### footwear_family
- eastern_flat_brocade
- eastern_lowheel_wrap
- armored_soft_boot
- ceremonial_flat_shoe

## Look 差异规则

同一组系列图中，每套 Look 必须在以下维度至少改变 3 项以上：

- silhouette
- neckline
- shoulder_structure
- waist_system
- lower_structure
- armor_ratio
- exposure_level
- transparency_budget

否则判定为“换色不换款”。
