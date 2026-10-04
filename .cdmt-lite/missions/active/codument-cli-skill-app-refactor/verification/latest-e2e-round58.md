# Round58：基础设施修复、全局安装与真实 E2E

日期：2026-10-04。本轮授权已完成；整体重构 mission 仍 active，未归档。

## 结论

本轮发现的 proposal 交付、原生派发前拒绝误分类及未知 TypeError 安全边界已修复并通过真实校准。最新 `depa-codument v0.6.0` 和三种 agent 的完整 global App 已覆盖安装，旧 `codument`、原仓 `codument/` 和其他 Skills 未升级。

五个 fresh 完整试次最终 **4/5（80%）**、首次外层 **2/5（40%）**。Todo 原试次保留基础设施失败；修复后的独立只读 UI 复验正常完成评分，但检出真正的组合筛选缺陷，正式业务 FAIL。不能把它改成 PASS 或第六个正式试次。

相较 Round55 上一轮新版：首次从 1/5 到 2/5，最终仍 4/5；总时间增加 12.1%，原始输入 token 减少 8.5%，输出减少 6.7%。因此没有证据支持“整体效果已经稳定提升”。这是每 case 一个样本的描述性历史比较，不是因果 A/B。

## 五个正式试次

| Case | 正式终态 | 外层 attempts | 首次外层通过 | 总分钟 | 输入 token（含缓存） | 缓存输入 | 输出 token |
|---|---|---:|---|---:|---:|---:|---:|
| todo | infrastructure-failed | 2 | 否 | 45.17 | 8,619,420 | 8,043,520 | 94,580 |
| stream-pipeline-ai-agent | passed | 2 | 否 | 25.63 | 5,732,117 | 5,295,872 | 60,836 |
| blog | passed | 1 | 是 | 22.89 | 5,085,258 | 4,720,896 | 56,960 |
| ecommerce | passed | 2 | 否 | 49.53 | 6,398,788 | 5,895,680 | 76,329 |
| nested-mission-agent | passed | 1 | 是 | 18.39 | 5,482,341 | 5,230,336 | 42,103 |
| 合计 | 4/5 passed；1 infra | 8 | 2/5 | **161.62** | **31,317,924** | **29,186,304** | **330,808** |

“首次”是首次外层 attempt，可以包含实现内部的 fresh Verify 和纠正，并非最初生成代码一次无缺陷。预算沿用 initial + 最多两次外层业务纠偏；本轮没有 case 用到第三 attempt。排除 infra 的有效业务分母是 4、通过 4；它不能冒充全样本 100%。所有失败成本包含在合计。

阶段时间（分钟）来自实际回合收据，未计入的安装/preflight/调度开销仍在上表 runner 总时间中：

| Case | 规划 | 实现（含内部验证/修复） | 外层 review | UI 准备 | UI 验收 |
|---|---:|---:|---:|---:|---:|
| todo | 4.35 | 27.88 | 5.21 | 2.79 | 4.22 |
| stream-pipeline-ai-agent | 4.34 | 15.55 | 5.37 | — | — |
| blog | 3.68 | 10.65 | 2.59 | 1.82 | 3.46 |
| ecommerce | 4.34 | 34.93 | 4.30 | 3.02 | 2.23 |
| nested-mission-agent | 4.85 | 10.83 | 2.65 | — | — |

Blog 和 Ecommerce 均有正式原生 UI PASS；Stream、Nested 原需求不要求 UI。Nested 主 Mission 完成，子 Mission 保持 active，未选中的未来 backlog 保留。

## 检出的缺陷与纠偏

- Todo attempt0：内联 JavaScript 引号转义错误，注册/登录提交无反馈。模型在 attempt1 修复。随后 UI 选择不存在的 `all` option，被冻结 R58a 误判未知执行效果并 fence，原终态为 infra，不发第三次业务纠偏。
- Stream attempt0：实际入口未向 SDK 请求注册 tool definitions；下一轮消息缺前序 assistant tool-call，脚本 bridge 注入 transcript 掩盖真实接线问题。模型纠偏后独立 review/15 测试通过。
- Ecommerce：内部 fresh Verify 先检出前端仅为部分演示；外层 review 又检出一个 failed 持久化 payment job 堵住后续 queued job。模型修复并补失败/重试回归，新 fresh 验证、外层 review/7 测试与实际 UI 通过。
- Blog、Nested 首次外层通过，不等于证明从未内部修复。

## 基础设施修复与验证边界

1. Codex UI proposal 使用宿主 `--output-schema` 最终输出文件作为唯一建议传输，不相信 FileChange 自述或 prose，也不因 typed JSON 自动 PASS。正式收据仍由原生观察、租约 origin、scope 和 controller admission 裁决；一次格式修正不能变更业务判断或重新操作。
2. 只有完整已知 native 诊断允许恢复观察：disabled、pointer interception、单字符串选择不存在的 option；保留空字符串、descriptor、array、null 的 SDK 参数能力，不替 AI 猜数据。
3. 原生异常类型不是派发阶段事实。只承认完整已知 click-options TypeError；未知 TypeError、错 op、追加诊断、array/descriptor 不确定效果、真正 deadline、late/after-dispatch 均 fence，不重放输入。
4. harness 不含生成业务的操作序列/selector/预期值。自有固定 fixture 仅校准浏览器协议；实际评分由 fresh Terra 从原始需求与原生页面决定。不改 OpenCLI/Ego 源码，没有 Chrome fallback、强制点击或应用手工修复。

先完成 R58a 的 726 项宽回归、smoke、真实 model/review probe、原生 fixture 和 build/install；正式 batch 此后冻结。Todo 发现新参数问题后，在原仓及独立 R58b 修复：最终窄 **39 pass**，最宽 `bun run check` **732 pass / 0 fail / 7,730 assertions**，类型/lint 通过。R58b 与原仓源码相同；新的真实 fixture 和只读复验在整个 batch 结束后串行执行，未热改正式试次。

真实 R58b fixture 三轮通过：不存在的单个 option 未派发 change，拒绝后仍能观察并用正确数据选择/清空；empty fill 有原生可见状态。pointer/disabled/dialog/去重/offscreen 继续通过，worker 真正关闭。

## Todo 独立只读复验与额外成本

复验根：[qoSE4C](/private/tmp/depa-codument-e2e-qoSE4C)。源为原 Todo 最终 workspace，源码指纹和原 `result.json` 保持；独立数据目录、模型、收据，不执行新的 implementation correction。

正式结果：**failed，failureClass=business**。观察 `ui-025-after-reapply-filter`：筛选 `status=doing, tag=urgent, due<=2026-10-20` 已重新应用，但列表仍显示 `doing 2026-10-21 [work, planning]`。不匹配标签且超出 inclusive cutoff，组合筛选实际错误。7 组操作和原生观察经过正式准入；这不是收据超时/工具不可用。

事后独立只读源审阅确认原因：`src/app.ts` 的内嵌前端 `load()` 向 `URLSearchParams` 赋 `q.status/q.tag/q.dueBefore` 属性，未调用 `set()`。相同原生 JS 表达式序列化为 `""`，因此请求实际没有筛选参数；后端谓词本身正确。这不是单次 snapshot 过早的推测。未修改生成应用，也未把这个业务断言写进通用 harness。原生清空操作也成功完成：`all statuses` 选择、空 tag/date fill 没有再被错误 fence。

复验额外输入 734,905（缓存 684,288）、输出 13,081；2 份 Terra/medium 上下文。其拥有的 run-root 创建至终态约 **6.41 分钟**，包括自身 native fixture 与 UI 准备/验收，不使用正式 runner 同口径冒充第六试次。

前置 model-probe 与 review-probe 另耗输入 153,342（缓存 104,704）、输出 2,436；review-probe 6.88 分钟，包含 PyPI 下载 timeout 重试，model-probe 总时间未记录。无模型 fixture/smoke 不计模型成本。已观测的本轮被测模型合计：输入 32,206,171（缓存 29,975,296）、输出 346,325；不含当前控制会话，不能当账号账单。校准失败原件保留。

## 历史描述性对照

| 批次 | 首次外层 | 最终 | infra | runner 总分钟 | 输入 token（含缓存） | 缓存输入 | 输出 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Round55 旧版 | 1/5 | 4/5 | 1 | 161.13 | 45,065,742 | 42,372,096 | 452,117 |
| Round55 新版 | 1/5 | 4/5 | 1 | 144.16 | 34,229,946 | 31,895,552 | 354,516 |
| Round58 新版 | 2/5 | 4/5 | 1 | 161.62 | 31,317,924 | 29,186,304 | 330,808 |

Round58 比历史旧版时间 +0.3%、输入 -30.5%，但两组都不是本轮 matched 新旧 A/B。产品提示词、harness、生成结果及执行环境时间不同；不能据小样本归因“缓存优化成功”或泛化编码能力。需求原文/hash、Terra/medium、公开 workflow policy 与最多三 attempt 相同。本 benchmark 未开启 GapLoop/AttractorCheck/HumanConfirm，不能外推到启用它们的检查强度或成本。

输入已包含缓存部分，**不能 input + cached 再相加**。token 使用原生 per-response deltas 按 response ID 去重，覆盖可观测 parent/child/中断会话。正式 40 个有日志会话、42 份模型上下文；不将 top-level 收据再累加，也不估算货币价格。

## 安装、隔离与生命周期

- 最新二进制：`/Users/kongweixian/.local/bin/depa-codument`，原软链接保留；测试 candidate、release 与实际 target SHA 相同。版本由工程 manifest 决定，三平台源清单一致，release 验证不再硬编码旧版本/builder 版本。实际 build/install 是本机 darwin-arm64，不声称 npm 发布或三平台正式发行已完成。
- Claude/Codex/Eidolon 的完整 App 各 46 文件/14 CommandOperations，与正本和本轮安装相同。备份：runtime `~/.local/share/depa-codument-local/round58-backup-6e8aSb`；global App `~/.tmp/depa-codument/upgrade-global-TcuwOi`。
- 原件只修改 harness、必要工程版本与 mission。所有 build/测试/模型/业务运行在独立 `/tmp` 快照，真实原仓 `codument/`、旧 bin/link 及相邻 Skills 未升级。
- 两个审计器真实 exit0：正式 42 份/追加 2 份模型上下文均 Terra/medium；旧 bin/workspace、需求、policy、candidate、global App 和原 Todo result/source 保护过线。所有记录的正式/追加/早期失败 fixture 端点不可达，临时 auth 已移除。
- 唯一 Ego TaskSpace **5** 从开始贯穿至结束。全部 worker 释放后，ownership=agent，`finish({keep:[]})` **调用一次并实际 resolve**；不替换空间、不清个人 profile、不保留后台服务。

## 可追溯入口

- 正式原始审计：[observation.json](/private/tmp/depa-codument-e2e-batch-CKnlv2/observation.json)
- 追加原始审计：[supplement-observation.json](/private/tmp/depa-codument-e2e-batch-CKnlv2/supplement-observation.json)
- 五个正式根：Todo `6RHPUl`；Stream `GmC9IB`；Blog `AgLN3A`；Ecommerce `wrDe62`；Nested `fwEKS5`，均位于 `/private/tmp/depa-codument-e2e-<suffix>/`。
- 正式快照：`/private/tmp/depa-codument-verification-8fKHQp/depa-codument/project`；修复校准快照：`/private/tmp/depa-codument-verification-ayFIAU/depa-codument/project`。
- candidate/global SHA256：`688dca806b2cb6206ec0e4446f775e60d19ed236e132321f9f89bf9c48ae1c2d`。
- R58a 正式 harness：`3ac3d42dce799b3173c5b49efbd9deae8ff53f8ec17244ad5cadbdbf19ec1af7`。
- R58b 最新 harness：`b89fb6107853207794d8dd6592e92a762678ee04fa9ec444cabccc00055394be`。
- global App：`452fe6aed91b3b6f6936be51bcda32d9b0e903b3e3f90aff24fdf36987f1b80e`。

当前用户所选 Round58 目标已闭包。未重新跑旧版/增加样本、未修 Todo 应用、未 npm 发布、未迁移真实 dogfood；这些不得从本轮结果推导为已完成或继续写入的授权。
