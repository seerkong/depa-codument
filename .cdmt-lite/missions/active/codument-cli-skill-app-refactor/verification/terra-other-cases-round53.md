# Round53：其他四个真实 E2E case

模型均为 `gpt-5.6-terra` / medium，42 个实际 parent/child turn contexts 已核验。四个完整试次已全部执行到终态；Todo 没有重生成。原试次最多 initial + 2 次外层纠偏，历史结果和成本保留。

## 结果

| Case | 原完整试次 | 外层模型纠偏次数 | 耗时 | 追加只读 UI 复验 |
|---|---|---:|---:|---|
| stream-pipeline-ai-agent | 首次 PASS | 0 | 11.94 分钟 | 非浏览器 case |
| blog | infrastructure-failed | 1 | 41.85 分钟 | 最新正式 PASS；较早复验仍保留 infra |
| ecommerce | infrastructure-failed | 2 | 34.39 分钟 | 正式业务 FAIL |
| nested-mission-agent | 第三次尝试 PASS | 2 | 40.82 分钟 | 双后端 HTTP case，无 UI gate |

原始全链路试次成功 **2/4**，首次 **1/4**，另外两次被基础设施问题中断。既有 report 的业务有效分母排除这两个 infra 后为 2，首次 1/2、最终 2/2；这个 100% **不是四个项目的总体成功率**，不能用于宣称编码能力提高。额外 UI-only roots 不进入原试次分母、不重置预算，也不把旧 infra 改写成 PASS。不要把混合阶段的最新验收视图重新包装为一组同协议完整试次的成功率。

### Stream

9/9 Track 任务、strict、fresh 内部验证及外层独立验收通过。实际 pytest、文本/reasoning 流、SDK adapter、tool loop 和缺字段路径验证均完成。没有外层纠偏。

### Blog

原第一次 UI finding 是缺评论提交控件，模型在同试次修复。第二次的 click options 被写成 JSON 字符串，SDK TypeError 帮助文字含 timeout?，旧 regex 错误 fence 会话；原试次保留 infra。

追加 DhAbq9 的 78 次真实请求无工具错误、业务 proposal 判 PASS，但 channel 提示遗漏 action.operation 枚举，controller 拒绝业务步骤名称；该 infra 成本仍保留。统一格式契约后，Nq7Zg0 fresh Terra 实际完成 83 次请求、13 条正式收据观察，**UI PASS**。9 个可恢复错误为一个非法操作和八个 stale ref，重新观察后继续，无 native uncertainty fence。

覆盖 author 创建/修改、跨用户权限与 author 发布负例、editor 发布/下线、tag/category 过滤、登录评论提交、pending/approved 公开投影和编辑审核。复验没有修改交付源码，源指纹仍为 bcca14fd6d61f1c1bf7671985ad20c404f95bc3f962f07ab3d963382696e4b9e。

### Ecommerce

原第一轮观察空目录；第二轮 viewport 快照未显示 checkout 控件；模型分别做了纠偏。第三轮禁用控件 actionability timeout 被误判 uncertain，且 proposal 的非连续引文被 admission 拒绝，原终态保持 infra。

最新 SGz97i 在 full_page 观察及可恢复 disabled 拒绝下，正常产出正式业务 FAIL：创建 pending 订单后，可用库存仍显示 12 而没有反映一单位预留。另一个 finding 是缺 payment/cancel UI 控件；acceptance 明确这些 API，但没有逐项定义相应 UI，故这里只记录 reviewer 的范围解释，不把它冒称明确的新 UI requirement。

还须注意：原 UI 用独立空数据库，SKU/coupon provisioning 是 API test/admin setup。首轮空目录含数据准备假设；viewport 也可能漏视口外控件。因此不能只凭这两条旧 finding 断言生成代码不具备功能。未来需由 AI 动态准备场景数据、区分 API 契约和 UI 契约，不能在 harness 硬编码商品/端点/业务步骤。本轮不改原需求、旧判定或已交付 App，保留这个解释边界。

复验源码仍为 9ff779bda81bd45eac5d2a0aa484b810623c03d3be7fbc1c3730e08d28a8c751，没有触发 implementation correction。

### Nested Mission

第一轮被真实外层 reviewer 拒绝：只有进程内 stub 测试，没有随机数据、双 live server 和跨仓状态观察。第二轮补测试后，因验证命令把绝对 project 路径写到 receipt 而被拒绝。最后一次模型纠偏通过真实双仓测试、独立验收、strict 和构建。root selected delivery 完成，独立 inventory child 保留 active backlog；没有把未选任务伪完成。

## Harness 修复和隔离

- 无效 options 在 Page effect 前拒绝；TypeError 文档中的 timeout? 不是 native timeout。
- 默认 full_page 观察；明确的 disabled 动作前拒绝可重新观察。真实 deadline、CDP timeout 和 late-effect 标志仍 fence，禁止自动重放。
- 共享 ui-contract.ts 是 prompt、admission、controller 的格式真源；PASS 先完成格式校验，再产出正式收据。不弱化真实观察/引文准入，不硬编码业务 oracle。
- 最新独立副本回归 **82 pass / 0 fail / 489 assertions**，typecheck/lint exit 0；真实自有 fixture 三轮验证 offscreen 发现/操作、参数拒绝恢复、disabled handler 零执行、连续 dialog 和 worker 释放。
- 13 个本批 worker endpoint 最终均不可连接。TaskSpace2 agent ownership 核对后只 finish 一次，关闭 p1、keep=[]；没有杀共享 NodeService。
- 原 codument/ 和旧 global codument 的模式/内容指纹与开头一致；不安装任何 global bin/Skill，不改 OpenCLI/Ego，也不手工修 App。

原四试次冻结候选 SHA256：372fe0befcf0717277199b5417fd6f0af00446b3d06a0d69a1f3409144b0cf61；冻结 harness：e3125d26491a3bfd008519928acbc0641525d29b8ebe62813457cc12dd9b8a0c。

追加最终只读复验的 harness：6701f34653a5f08593b2df364d318ace0dd91fa2351432e560f75c1f1f4329d8。没有热改原在途副本。全部路径、阶段状态、usage、实际模型、worker 释放和 source guards 见 [JSON 报告](terra-other-cases-round53.json)。

## 成本与比较限制

| Case / 阶段 | input tokens | cached input | output tokens |
|---|---:|---:|---:|
| Stream 完整试次 | 3,062,024 | 2,835,200 | 36,719 |
| Blog 完整试次 | 9,897,389 | 9,295,104 | 98,317 |
| Ecommerce 完整试次 | 7,117,437 | 6,541,568 | 89,578 |
| Nested 完整试次 | 10,410,226 | 9,750,784 | 117,498 |
| Blog 较早 infra 复验 | 1,908,044 | 1,831,424 | 12,411 |
| Ecommerce 最新只读复验 | 471,052 | 440,320 | 5,036 |
| Blog 最新只读复验 | 596,098 | 548,352 | 7,120 |
| **全部，包括失败/额外复验** | **33,462,270** | **31,242,752** | **366,679** |

这些是已观察 parent/child 每 response 去重计数，不是账户账单；cached 是 input 的子集，不另加一次。没有美元估算。当前公开 workflow-policy v2 原样保留：IndependentVerify 开启，GapLoop / AttractorCheck / HumanConfirm 未启用。旧不同 hook 强度、重复次数或未记录策略的历史试次不能等强比较。样本小且 UI harness 中途单列修复，不推论新版普遍编码能力提升/下降。

## 当前停点

本次用户选定的其他四 case 已真实执行，额外必要 UI 复验和修复验证已收口；失败如实报告，不授权继续修改交付 App 或重开原预算。更大的 codument-cli-skill-app-refactor mission 仍 active，未宣称完整重复试验/所有应用功能均通过，也未归档。
