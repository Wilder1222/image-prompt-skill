# 执行记录与按标签修订

用户无需填写以下记录；代理在理解文字、查看实际提供的参考并独立编写正文后操作。纯文生图不需要参考图。只需要提示词时无需强制生成图片。生产流程见 [主路线](prompt-production.md)，评审口径见 [视觉验收](../core/visual-acceptance.md)。

## 生成前固定目标

新生产 brief 必须由代理声明 `subject_kind: character|scene|product|other`。人物生成、换风格、多视角和人物局部编辑使用 `character`；产品自身、无人场景等按实际范围选择。混合画面中包含本轮需设计或验收的人物，也使用 `character`。这是代理依据任务作出的范围声明，脚本不会识图或从关键词自动猜测，不能为绕过检查错填成其他类型。

人物 brief 至少包含一条 `channel: proportion`、`priority: must`、`target_head_count: 9` 的要求，并在 proportion 正文类别中引用该要求，关联一个 `critical: true` 的验收项。自然语言仍需写明人体直立高度为九个颅顶至下巴头长，排除发量、头饰和鞋底鞋跟增高，检查各段协调。数字字段只固定设计意图，不会自动向提示词塞入文字，也不能证明图片达到九头身；代理仍须核对字段、正文与验收语义一致。现行示例见 [人物 brief](../../examples/character-asset-front-brief.json) 与 [无人场景 brief](../../examples/text-to-image-brief.json)。

局部编辑保留比例目标，正文说明保持已达标比例或记录原图比例未决，不自动扩大到全身修复。未观察到或无法确认比例时，如实记录 `uncertain` 或 `not_assessable`，即使局部通过也不能宣称整个人物合格。场景、产品等非人物任务不会被插入人体比例条款。

`scripts/production-run.mjs` 将本轮输入编译为一个不可覆盖写入的快照：参考文件内容摘要及实际输入顺序、提示词全文及摘要、要求与验收标准摘要、已知工具、未知模型/种子、任务与重复实验组。普通哈希只能检测相对于已保存记录的变更，不是不可伪造签名，也不能证明代理真的看图或真的提交了某次调用。

```bash
node scripts/production-run.mjs prepare --input brief.json --id run-01 --case subject-01 --cohort fixed-prompt-repeat --out run-01.snapshot.json
node scripts/production-run.mjs inspect --snapshot run-01.snapshot.json
```

`inspect` 重新核对参考内容，并返回可传入宿主图像工具的实际参数。逐字发送返回的 prompt 与输入路径。文件路径相对 brief 所在目录解析；内部记录可以含本机路径，公开报告不携带私人附件路径或图片。

指定 `target` 时按 [文生图模型指南](../providers/text-to-image-models.md) 冻结模型与设置，`inspect` 改为返回 `transport`、`model`、`request`、`runtime` 和 `execution_sha256`。按对应入口解释请求，不能把所有模型都发送给宿主图像工具。生成完成回执还须带同一 `execution_sha256`；正文相同但模型、设置、负面或原生后缀不同，属于不同执行计划。未指定 `target` 的旧记录保持兼容。

新快照把 `subject_kind` 连同要求和验收写入目标摘要。旧冻结快照仍可查看并按旧标准评审，不回填新字段、不自动升级为九头身通过。旧 brief 再次编译或准备新生成前必须明确范围，人物 brief 补齐上述要求；以旧快照为父记录时，新范围或要求会令 `goal_changed` 为真，不能冒充原目标未变。历史正文与哈希保持原样。

## 生成后记录

保留实际图片，写 receipt：`status: completed`、`snapshot_sha256`、`target_sha256`、`prompt_sha256`、`output_image`、`output_sha256`、`inspected`、`reviewer`、`checks[{id,verdict,evidence}]`。输出路径相对 receipt 所在目录解析。调用失败记录 `status: tool_error`、同一快照摘要和实际错误；没有图时不填写假输出。

用户改动目标或取消队列时记录 `status: interrupted`、`reason`、`dispatch_state: not_started|started|unknown` 和快照摘要。没有逐次派发日志时，未收到输出不等于没调用，也不等于模型失败；保留 unknown。执行器应在每次调用前留存派发记录，停止新任务后尽量接收已在执行的结果。保留旧快照，新要求另建实验组。统计中的 runs_planned 不是实际调用次数，known_tool_calls 与派发状态未知的记录分列。

```bash
node scripts/production-run.mjs review --snapshot run-01.snapshot.json --receipt run-01.receipt.json --out run-01.outcome.json
```

输出图、参考或目标变更都会拒绝验证。关键项不确定仍是 needs_review；观察者通过不等于用户接受。旧版本只有 prompt-review 的记录可以作为历史证据，不回填成“生成前已冻结”。

## 修订与多轮意图

区分用户改变目标与同目标下修复失败。新的自然语言要求优先，但必须另记目标变更。`reviseProductionInput(input, change)` 接受本轮 request、允许修改的 channels、按现有 label 提供的 sections，以及需要更新的 requirements/acceptance；只替换允许范围，保留其他正文及参考。改变身份、来源或增加整个新类别时重新分析，不能借局部修改暗中换图。

背景使用 background 通道，光线使用 lighting；只改背景时不自动重写人物或照明，换场景确需匹配灯光时把 lighting 也列入本轮允许范围。既有背景与光线合写的记录可继续使用原通道，或在新任务中重建类别，不能修改旧冻结记录。

设定表的分格、顺序和间隔使用 `layout`，格内人物朝向与取景使用 `composition`；模板笔触需要独立的 `style` 权限。只改版式时允许范围写 `layout`，不能顺带改姿态或比例要求。新示例 [三视图版式 brief](../../examples/character-sheet-layout-brief.json) 可用 `prompt-build --input examples/character-sheet-layout-brief.json` 编译；它是没有参考输入的原创文字示例。首版两次 [实图诊断](../../docs/character-sheet-evidence.json) 未整体通过，当前版已拆分背景要求，尚无本版出图验收。旧快照无需迁移，旧 brief 下次编辑时按需要拆分混合段落。

表情使用 expression 通道，与 identity 分开修改和验收。仅改表情保留身份、年龄、发型、衣装、姿态、背景和灯光；需要同步转头或改变身体姿态时显式加入 composition。旧 identity 段同时锁定神态或嘴角位置时，先在新任务中拆清稳定辨识点与可变表情，不通过新增一句“自然微笑”掩盖旧冲突。

换装按 `costume` 更新新衣要求和验收，独立材料目标变化时同步声明 `material`。原图可继续作为身份与当前编辑基准，但旧衣装不再是必须保持的目标；新衣造成的自然遮挡和衣服局部阴影写进 `edit_scope.changes`，受保护的人物、表情和其他画面内容写进 `preserve`。身体未达标不借换装范围偷偷修身，也不因新衣遮住腿脚就判比例通过。新造型版本的 `goal_changed` 应为真，不计为旧造型的同目标修复；具体检查见 [换装流程](character-asset-pipeline.md#换装版本与保护范围)。

身体动作可使用 action 通道。用户允许动作自动适配时，代理依据整体意图选择必要的 action、composition、expression、hands_feet、material 或 hair 联动范围，分别调整动作、取景/朝向、神态与动态响应，无需用户逐项选参数。保留仍有效的身份、衣装设计和其他要求；旧“站直、双脚落地”等若不适用于当前动作，在新记录中同步改写要求与验收。只修特定局部时仍遵守该轮边界。

只要参考声明了 `authority: ["identity"]`（可同时含其他通道），就必须实际送入生成，即 `generation_input: true`；即使身份正文只引用用户要求、没有引用具体观察条目，也不能降为仅观察。纯文字新人物仍可使用 `references: []`；服装或评价资料若只用于观察，不要为其附加身份权限。脚本检查输入声明，不会自动判断图片里是否同一人。

身份图可以声明 `identity_group` 和 `identity_role: primary|support`。单张图也检查角色值，未指定时省略该字段，不使用空值或其他名称。多个身份视角必须同组、恰好一个主参考、均实际送入生成；衣装或评价参考不因此取得身份权限。是否同一人物仍由观察与用户说明决定。

`reviseProductionInput` 只接受 `request`、`channels`、`sections`、`requirements`、`acceptance` 和 `edit_scope`。传入 `references`、`target` 或拼错的字段会明确报错，不静默忽略。需要按已授权任务更换参考或模型时，重新审阅完整 brief，并通过 `prepare` 冻结新输入及适当父任务；不能在仅改某个标签的请求中顺带换身份来源或执行模型。此校验适用于新的编译与修订，不重写旧快照。

编辑或重生成使用 `prepare --kind edit|revision --parent previous.snapshot.json`，保持 case 与 cohort。快照会比较目标摘要，改变要求或验收标准时自动标记 goal_changed。不能把新目标的成功算作原目标修复成功。每轮同时重查已通过项，最多两轮无改善即停止该修订路线。

新局部编辑（`kind: edit`）还必须在 brief 中声明 `edit_scope`，将实际送入的基准图、允许变化和必须保持的内容一起冻结。例如：

```json
{
  "edit_scope": {
    "baseline_reference_id": "candidate",
    "changes": ["调整头部整体大小及必要的上颈连接"],
    "preserve": ["保持肩部轮廓、衣领、躯干、四肢和足部位置", "保持背景标尺的位置与间距"]
  }
}
```

基准引用必须已声明为实际生成输入。编译器把上述边界写入中文提示词的“本次编辑范围”，并绑定提示词和快照摘要；有模型执行计划时也进入实际请求。它是本轮操作边界，不自动改变人物的最终验收目标。全图重生成使用 `revision`，可按任务选择是否声明边界；不能将局部编辑伪装成无边界重生成。已有边界的 brief 再修订时，须通过 `change.edit_scope` 明确本轮范围，避免沿用上一轮操作。

含冻结边界的完成回执额外需要 `scope_review`。新快照自动绑定 `scope_review_contract: preservation_items_v1`；为 `edit_scope.preserve` 的每一项填写独立观察，`index` 从零开始对应原数组，不因回执排序变化而换义。身份、衣装、身体和背景若是独立保护内容，应分别列项；不能只写一句“其余保持”代替具体范围。例如上述两项保护对应：

```json
{
  "scope_review": {
    "verdict": "fail",
    "change_evidence": "头部缩小，颅顶更接近目标线",
    "preservation_evidence": "衣领和肩部随之上移，超出允许修改范围",
    "preservation_checks": [
      {"index": 0, "verdict": "fail", "evidence": "衣领和肩部上移，四肢与足部位置未见明显变化"},
      {"index": 1, "verdict": "pass", "evidence": "逐条比对背景尺线，位置和间距保持"}
    ]
  }
}
```

必须分别观察修改处和保护处。逐项记录不得遗漏、重复、越界或空写证据；结果带回原保护文本便于复核。任何保护项失败都阻止整体通过，不确定或不可判断保持待审，汇总“通过”不能覆盖它们；结果保留原声明结论并计算较保守的有效结论。原汇总的其他越界观察也继续生效。边界通过不能抵消身份、九头身或其他关键项失败。该记录依赖实际看图比对，脚本只检查覆盖与状态，不会识别图像越界或验证证据语义。工具失败或任务中断无需虚构视觉检查。

旧快照没有 `scope_review_contract` 时仍按原聚合回执核对，不强制补填、也不接受追加逐项字段冒充新冻结合同。旧冻结编辑连 `edit_scope` 都没有时亦保留原样；需要补充发现可另记人工观察，不能改变旧快照和原生成前口径。新逐项合同不改变人物目标摘要，也不追溯提升旧图合格状态。

新增编辑范围之后仍须通读完整正文，清理上一轮操作指令。例如本轮仅调整头部，旧段落却还要求全身重建，不能只追加一句“其余不变”就派发；保留最终九头身目标，删除不适用于本轮的操作措辞。若已经冻结但尚未派发，保留旧快照并记录 `interrupted`、`dispatch_state: not_started`，另冻清理后的版本；它不是一次模型调用。脚本检查范围字段并不等于已完成自然语言冲突审查。

## 比较与统计

对固定 prompt 重复出图，使用不同 run_id、同 case/cohort，kind 都为 initial，准确记录随机重复。修改提示词或规则后使用另一个 cohort，避免混算。新一轮独立编写提示词的测试也要独立 cohort，不声称它和固定文本重复出图是同一实验。

统计输入是 snapshot/outcome 文件路径列表，`report --input entries.json` 输出每组的初始完成数、首次通过数、同目标修订后完成数、工具错误、未评审、待审、重复图和目标变化。路径相对执行目录。参考样本是已知回归图还是未参与调参的图，另在实验说明中写清。

保留全部尝试，不删除失败后只展示胜出图。统计脚本验证引用关系与声明状态；报告前仍要核对 outcome 的真实文件、检查证据及调用记录，不能把任意手写结果当成自动视觉判断。

量化图像测试采用 `scripts/visual-score-report.mjs` 汇总时，还会读取运行目录的 `review-notes.json`，处理绑定原图与冻结检查的撤回通过注记，格式和边界见 [评分标准](../core/图像评分标准.md)。原始执行统计保留历史回执结论；有复核时不能单独用它证明当前视觉合格，应同时报告生效复核。两种视角的差异需要说明，不覆盖原文件制造一致。
