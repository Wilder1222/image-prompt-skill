# Midjourney 手动交付例子

本页只展示文本编译，没有生成 MJ 图片。参数依据与冲突记录见 [MJ 指南](../references/providers/midjourney.md)。用户手动核对账号界面与当前设置后提交。

## V8.2 纯文生图：可直接复制

由 [示例 brief](midjourney-brief.json) 运行下列命令，网页与 Discord 均可使用完整输出；Discord 用户自行选择 `/imagine` 并粘贴至 prompt 字段，命令名不放入正文。

```bash
node scripts/iteration-director.mjs prompt-build --input examples/midjourney-brief.json --format native
```

```text
【场景与灯光】
雨后傍晚的小书店，青绿色木门半开，窗内暖黄色灯光照亮木质书架，湿润石板映出柔和窗光。

【招牌文字】
门楣招牌只写"雨巷书店"四个汉字，横向排列，笔画清楚，完整可见。

【构图与媒介】
竖版水彩插画海报，以店门为视觉中心，门前空巷没有人物；柔软色层勾勒墙面，保留清晰招牌。

【空间与成片完成度】
门窗墙体与台阶连接自然，门内入口可通行，书架尺度连贯。湿石面和小水洼各有质感，暖窗光仅映在开口附近；水彩色层塑造空间结构。
--v 8.2 --ar 3:4 --stylize 100 --raw --no 人物, 水印
```

`ready_to_submit: true` 只表示这份无参考文本已通过本地编译，不证明汉字或画面效果已经实现。`--format text` 继续只输出同一分类正文，不附参数。

## V8.2 网页参考图：正文与挂图分离

用户实际提供并经代理查看一张要编辑的书店图后，可按当前指令整理如下正文：

```text
【本轮修改】
将青绿色木门改为深蓝色木门，保留原有门框结构、门的开合角度和木纹。
【保持范围】
沿用参考图的取景、门楣招牌文字、窗内书架、墙面、台阶、湿石板与暖黄色窗光。
--v 8.2 --ar 3:4 --raw
```

手动附件清单：将该用户原图放入 **Attach to prompt**。不往文本里塞本地文件名或编造 URL。尚未挂图时编译状态是 `manual_input_required`，`ready_to_submit: false`；代理保留正文与附件说明，只有用户实际完成并确认挂图后才记录 `attachment_confirmed: true` 并重新冻结。这里的保持范围是编辑目标，未验证成图是否达到。

## Discord 缺少图片直链：明确待补

同一张本地图用于 Discord 时，只有本地路径或 Library ID 不足以输出完整参考语法。用户需要手动上传并提供实际图片 URL；在此之前返回 `ready_to_submit: false`、缺 URL 的原因和既有正文，不生成假地址，也不声称已经带图。完整 URL 收到后，由编译器在末尾加入 `--edit` 与该原始直链，保留合法签名 query；正文仍在所有参数之前。

若明确使用 V7，平台角色改为单图 Omni Reference，编译器输出 `--v 7` 与 `--oref`，不把 V8 Edit 参数搬过去；`--ow` 是可选 V7 参数，不是 V8 的编辑强度。

## 显式请求 Draft

```text
雨后傍晚的小书店，青绿色木门与暖黄色窗光，安静的空巷，水彩插画。
--v 8.2 --ar 3:4 --draft
```

这份 Draft 例子仅供网页手动使用，按 Draft 专页每条生成 24 张低分辨率图；编译器记录它与 Version 兼容表的冲突。相同 V8 Draft 请求指定 Discord 时会被拒绝。正常输出不默认加入 Draft。
