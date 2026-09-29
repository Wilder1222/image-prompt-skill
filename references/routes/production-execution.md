# 执行记录与按标签修订

用户无需填写以下记录；代理在已经看图并独立编写正文后操作。只需要提示词时无需强制生成图片。生产流程见 [主路线](prompt-production.md)，评审口径见 [视觉验收](../core/visual-acceptance.md)。

## 生成前固定目标

`scripts/production-run.mjs` 将本轮输入编译为一个不可覆盖写入的快照：参考文件内容摘要及实际输入顺序、提示词全文及摘要、要求与验收标准摘要、已知工具、未知模型/种子、任务与重复实验组。普通哈希只能检测相对于已保存记录的变更，不是不可伪造签名，也不能证明代理真的看图或真的提交了某次调用。

```bash
node scripts/production-run.mjs prepare --input brief.json --id run-01 --case subject-01 --cohort fixed-prompt-repeat --out run-01.snapshot.json
node scripts/production-run.mjs inspect --snapshot run-01.snapshot.json
```

`inspect` 重新核对参考内容，并返回可传入宿主图像工具的实际参数。逐字发送返回的 prompt 与输入路径。文件路径相对 brief 所在目录解析；内部记录可以含本机路径，公开报告不携带私人附件路径或图片。

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

身份图可以声明 `identity_group` 和 `identity_role: primary|support`。多个身份视角必须同组、恰好一个主参考、均实际送入生成；衣装或评价参考不因此取得身份权限。是否同一人物仍由观察与用户说明决定。

编辑或重生成使用 `prepare --kind edit|revision --parent previous.snapshot.json`，保持 case 与 cohort。快照会比较目标摘要，改变要求或验收标准时自动标记 goal_changed。不能把新目标的成功算作原目标修复成功。每轮同时重查已通过项，最多两轮无改善即停止该修订路线。

## 比较与统计

对固定 prompt 重复出图，使用不同 run_id、同 case/cohort，kind 都为 initial，准确记录随机重复。修改提示词或规则后使用另一个 cohort，避免混算。新一轮独立编写提示词的测试也要独立 cohort，不声称它和固定文本重复出图是同一实验。

统计输入是 snapshot/outcome 文件路径列表，`report --input entries.json` 输出每组的初始完成数、首次通过数、同目标修订后完成数、工具错误、未评审、待审、重复图和目标变化。路径相对执行目录。参考样本是已知回归图还是未参与调参的图，另在实验说明中写清。

保留全部尝试，不删除失败后只展示胜出图。统计脚本验证引用关系与声明状态；报告前仍要核对 outcome 的真实文件、检查证据及调用记录，不能把任意手写结果当成自动视觉判断。
