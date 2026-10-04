# Round54：验收基础设施修复与已有应用只读复验

## 结论与范围

最终冻结版 harness 对既有 Todo、Blog、Ecommerce 的 fresh `gpt-5.6-terra` / medium **UI-only 只读复验全部取得正式 PASS**，没有使用协议格式修正轮。不是重新生成应用，也不是完整 E2E 编码成功率变为 100%。原应用源码、原 candidate、旧 result 与历史 attempt 预算未改；未安装 global，未修改 OpenCLI/Ego 或原项目 `codument/`。

机器证据：[terra-protocol-round54.json](terra-protocol-round54.json)。报告保留本轮四个冻结版本、12 个只读根和所有失败成本。真实日志重放的专项回归另见 [terra-protocol-round54-replay.json](terra-protocol-round54-replay.json)，它不是官方 UI/trial 收据，不提升旧结果。

## 修复内容

- 从原始完整需求建立来源可追溯的 API / UI / cross-boundary / artifact / unspecified 范围计划。API-only 合同不自动变成 UI 按钮要求；未知范围和真正漏测仍不通过。
- AI 自主决定准备数据，harness 只提供计划准入的有限 HTTP 能力：固定租约 origin、有限路由/次数、deadline、幂等和 seal。准备响应不作 UI 通过证据，harness 没有生成应用专用点击、端点或业务预期脚本。
- 区分非法参数、动作前拒绝、只读等待条件未满足与不确定副作用。确切 disabled / 非输入 fill 拒绝可重新观察；未知超时、CDP 故障和 late effects 仍 fencing，不能盲重放。
- 原生快照默认 full_page；收据通过同会话、同 origin 的成功原生 observationId 和真实原文准入。参数、失败事件、跨快照拼接、准备 HTTP 响应不作结果证据。
- `requirementIds` 与人类可读 coverage 分离，兼容明确的 `ID: prose`、`ID — prose` 和前置多 ID。显式引用矛盾、API/artifact 伪装 UI 和真正漏掉义务仍拒绝。
- 最多一次 protocol-only 修正：先关闭浏览器/准备能力，冻结 status、findings、coverage、url、target、expected 与已有 canonical 引用，只允许链接既有原生证据/修正表示；不能加业务动作、改应用或重置业务预算。
- 提供 `@绝对JSON文件` 输入避免引号插值；准备阶段有界 6 分钟，原 UI 13 分钟、协议修正 2 分钟不变，租约从统一预算求和。entry 级诊断与紧凑 scope map 减少无效计划修正。

## 最终真实结果

冻结副本：`/private/tmp/depa-codument-verification-TCfQTo/depa-codument/project`。

- manifest：`0ef3c3dfefdd4ece91438419b68bd3202250c1887d9232da60d267137f5e14ac`
- harness：`416ab3f61baaf563886f94c91fa4775e8fd64b5c06850d6a9b7f2e523e0bb5d9`
- 三个原 candidate 均为：`372fe0befcf0717277199b5417fd6f0af00446b3d06a0d69a1f3409144b0cf61`
- 最终批：`/private/tmp/depa-codument-e2e-batch-7baUFB`，completed。

| 用例 | 独立只读根 | 正式结果 | 验收动作 | 浏览器请求 | 可恢复拒绝 | 不确定副作用 / 协议修正 |
|---|---|---|---:|---:|---:|---:|
| Todo | `/private/tmp/depa-codument-e2e-hw66Uc` | PASS | 9 | 49 | 1 | 0 / 0 |
| Blog | `/private/tmp/depa-codument-e2e-eXfiFW` | PASS | 10 | 60 | 0 | 0 / 0 |
| Ecommerce | `/private/tmp/depa-codument-e2e-6LuHIb` | PASS | 5 | 12 | 1 | 0 / 0 |

这只验证各自 scope plan 中 UI 部分的真实功能与证据链。Ecommerce 的支付/取消契约仍是 API scope，本表不证明其完整异步/API/授权语义。Round52 Todo 的退出通知 finding 和 Round53 Ecommerce 的库存 finding 仍是历史证据；源码未改，本轮 PASS 不能证明这些旧 finding 已被修复。

## 回归、隔离与生命周期

- 最终副本 `bun test e2e`：98 pass / 0 fail / 587 assertions / 14 files。
- 最终 typecheck 和 e2e lint：exit 0。
- 最终 `bun run check`：typecheck、全量 lint 通过；705 pass / **1 fail** / 7514 assertions / 141 files。唯一失败为既有 `packages/cli/test/cli/release.test.ts:45` 的发行版本硬编码 0.1.0，与本轮开始前已修改为 0.6.0 的 arm64 manifest 不一致。本轮未修改该发行 manifest/test，不能宣称全量检查通过或整个 mission 完成。
- 最终源码无模型 smoke：`/private/tmp/depa-codument-e2e-CrlMRF`，10 项通过、0 模型调用（隔离安装、global layout、workspace App、help/guidance、未知命令退出、sandbox 拒绝/写入、超时、旧 CLI 拒绝）。
- 三个最终只读运行均先执行同版自有 fixture 三轮，验证 offscreen、非法参数、disabled、非输入 fill、等待未满足、真实输入效果、连续 prompt、幂等和 worker 释放；不是业务 App 的硬编码测试脚本。
- 汇总审计了 23 个新验证上下文，全部为实际 `gpt-5.6-terra` / medium；所有临时 auth 已移除，34 个本轮 worker/准备端点均不可达。
- 原应用 source guards、历史 result digest、原 `codument/` 和旧 global `codument` 指纹保持不变；original e2e 源与最终冻结副本匹配。
- 唯一测试 TaskSpace3：确认 ownership=agent 后 finish 一次成功；关闭 p1，closedSpace=true，preservedUnmanagedCount=0。没有关闭用户页面、重启或杀死共享 NodeService；不声称管理了旧轮次实验 listener。

## 被保留的失败与成本

| 冻结批 | 实际结果 / 修正依据 |
|---|---|
| QtLEYt | Todo scope/协议失败；Blog 非输入 fill 被误判不确定；Ecommerce 官方业务 FAIL，部分 finding 从 API 合同过度推断 UI 控件。旧结果保留，不当明确 UI 需求缺陷证明。 |
| fGMJBu | Todo 总述误归 unspecified；Blog/Ecommerce 准备阶段 180s 到期（entry 引文诊断/JSON 编写），没有浏览器请求。不是浏览器卡住或业务失败。 |
| H2sTW8 | 三个原生 UI 流程完成，但 coverage 格式被旧 admission 拒绝。只读日志重放证明 metadata 修复；不改写原 infra。 |
| 7baUFB | 最终三个正式只读 UI PASS，无 protocol repair，无 uncertain effects。 |

以下是四版本全部只读试验的逐响应观测计数，包含失败/中断上下文，不是新增完整编码试次，也不是账户账单：

| 用例 | input | cached（input 子集） | output |
|---|---:|---:|---:|
| Todo | 6,677,323 | 6,317,056 | 66,008 |
| Blog | 3,575,593 | 3,345,152 | 43,472 |
| Ecommerce | 1,948,812 | 1,785,856 | 34,850 |
| 总计 | 12,201,728 | 11,448,064 | 144,330 |

不把 cached 再加到 input，不估算订阅账单。完整 E2E 分母=0，首次/纠偏后编码通过率均为 null；没有用 3/3 UI 复验覆盖旧版 5/8 或任何历史编码率。

## 停点

当前用户批准的 harness 修复及只读验证闭包已完成；独立观察核对原需求、源码准入、负例、真实收据与保护指纹，符合当前范围的交付边界。更宽重构 mission 仍 active，完整发行检查仍有上述已存在的失败，未运行 completion/archived 或擅自推进全局切换、发布、重新生成/修复业务应用。
