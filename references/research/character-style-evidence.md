# 人物风格的历史实测与证据范围

编译与回归测试只证明路线、分类输出、冲突拦截和局部编辑边界，不能证明模型出图稳定。2026-10-06 已实测真人摄影和风格化三维各两次，见 [四次实图证据](../../docs/character-style-evidence.json)。首次风格化图仍保留较多照片纹理；第二次提前具体转换并同步改写材质，发束和衣料概括改善，但身份与九头身仍待审，四张均未整体通过。这是单角色、多个提示词变量共同改变的诊断，不能证明仅靠顺序调整就稳定有效。

正式批量派生前检查本轮候选身份、比例与构图要求。不同风格的单张诊断可另建目标，诊断状态不等于验收母图。以下历史九头身结果继续按原冻结目标保留，不自动重判。

九类路线的证据分开查看。下表列代表性实测及其原冻结媒介项，不把局部通过称为整张通过，也不把后一次自动视为最佳母图。

`resources/character_style_evidence_catalog.json` 指定每条路线使用的报告和筛选条件，`npm run character:evidence-audit` 生成 [结构化覆盖审计](../../docs/character-style-evidence-audit.json)。`configured_routes` 仅表示风格配置存在，`recorded_outputs` 表示报告中有效登记的输出；不代替编译执行或原始回执认证。历史样本的合格声明必须与其冻结九头身要求、关键检查及已记录编辑范围自洽，媒介项通过不能升级为整体合格。跨报告重复输出只计一次，空筛选、重复路线及缺失报告均报错。

第三版分别保存原报告与复核后的计数：`original_consistent_qualified_reports`、`original_medium_pass_runs`、`original_body_pass_runs` 保留原声明；不带 `original_` 的对应字段应用报告层 `review_notes`，`applied_review_notes` 只统计当前筛选命中的有效注记。撤回关键通过使整体合格数下降，撤回媒介或比例通过也同步减少对应计数；非关键撤回不自动否定其他关键项。输出次数、文件摘要和原回执不改变。

复核格式沿用 [评分复核](../core/图像评分标准.md)，绑定运行、快照摘要、输出摘要及原检查；必须有冻结验收，不能仅对同名图添加随意结论。注记只能把原 `pass` 撤回为 `fail` 或 `uncertain`，不提升结果。无效或重复注记明确报错，相关报告的生效通过计数归零，保留原登记输出和原声明供诊断。没有注记时按原检查汇总；本审计只读取报告中显式携带的注记，不自动搜索历史目录，也不能发现未带入报告的人工复核。

需要本地核验时运行 `node scripts/character-style-evidence-audit.mjs dist/visual-tests/style-audit-output-verification.json --verify-files`。它按各报告的 `evidence_directory` 定位输出并比对 SHA-256；缺失或变更报错。默认报告的 `file_verified_outputs=null` 表示未执行此检查，不是文件核验失败或零张通过。哈希核验不检查像素内容、不测量头身比，也不证明实际生成过程或批量稳定性。旧版 `compiled_routes`、`actual_outputs` 和路线 `qualified` 字段已移除，避免扩大元数据审计所能证明的范围。

| 路线 | 媒介项证据 | 尚未完成 |
| --- | --- | --- |
| 真人摄影 | [两次](../../docs/character-style-evidence.json)均通过媒介项 | 首次比例失败，第二次比例待审 |
| 电影CG | [原绘画转换两次](../../docs/character-cinematic-cg-evidence.json)及[双参考一次](../../docs/character-cg-fusion-evidence.json)均失败；[独立新人物一次](../../docs/character-cg-direct-evidence.json)通过媒介项 | 新人物不替代旧人物转换；比例均待审 |
| 写实三维 | [独立短发男性](../../docs/character-proportion-control-evidence.json)通过媒介项 | 九头身失败，后续参考输入也未解决 |
| 风格化三维 | [转换首次失败、第二次待审](../../docs/character-style-evidence.json)；[年长男性文生图](../../docs/character-senior-evidence.json)年龄可读但媒介失败 | 转换身份与比例待审；新人物毛发、肤质和比例失败，不能互相替代 |
| 三维动画／三渲二 | [首次失败、修订后通过媒介项](../../docs/character-anime3d-evidence.json) | 九头身失败，脚部朝向待审 |
| 二维动漫 | [首次失败、修订后通过媒介项](../../docs/character-anime-evidence.json) | 九头身失败 |
| 厚涂 | [首次失败、修订后通过媒介项](../../docs/character-painterly-evidence.json) | 九头身及严格足部朝向待审 |
| 水彩 | [一张通过媒介项](../../docs/character-wash-evidence.json) | 九头身及严格足部朝向待审 |
| 水墨 | [首次待审](../../docs/character-wash-evidence.json)，[墨层修订后仍待审](../../docs/character-ink-refine-evidence.json) | 墨层组织、比例、脚部朝向及修订背景保护未决 |

水墨修订明确了淡墨连暗面、浓墨收褶谷及薄设色关系，但未得到清楚改善，停止重复该母图与同类文字组合。该例不能反推所有水墨都应黑色为主；技法、纸面和题材也不能互相替代。保留原目标和未决项，不追加黑白面积阈值。外部技法依据和实验边界见 [水墨修订研究](../../docs/character-asset-research.md#水墨层次的同目标修订)。

九条新增路线均有实图诊断，完整人物仍未通过；专项总数以 [当前状态](../../docs/current-status.md) 为准，避免与比例、表情或换装实验重复汇总。这不是九类风格的稳定性认证，图像表现不能证明存在底层可编辑三维模型。
