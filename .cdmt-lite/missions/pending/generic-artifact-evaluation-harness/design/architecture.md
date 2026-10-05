# 设计假说：独立产物评估，不再绑定五例生成流程

此文是规划设计；最终验收以 MISSION 与两个 attractor 为准。实现时根据证据细化，不创建第二套运行状态。

## 1. 边界和依赖

```text
独立目标 + 冻结产物 ────────────┐
                              ▼
Codument benchmark adapter → evaluation capsule/shell → contract + logic
      │                              │
      └ 安装/生成/工作流/纠偏          └ 显式 runtime ports
                                           │
                           process / browser / agent / ledger support
```

首阶段拟放 `project/evaluation/`，内部明确 contract、logic、support、adapter、组合和入口角色；物理目录可以随真实内聚调整，不预建六个 npm 包。

- contract：输入、结果、effects 端口与版本。无 IO、无 vendor、无产品引用。
- logic：状态转换、admission、budget、覆盖与结果投影。采用 `fn(runtime, input, config)`；无隐式 HOME/clock/fs/浏览器。
- support：进程、sandbox、浏览器、模型调用、文件账本；实现显式端口，不拥有业务结论。
- adapter：产品工作流、browser scope、历史格式/agent runtime 的转换；由消费侧拥有，不改上游事实。
- capsule：选择完整可运行 runtime；不是空转发。
- shell：独立 evaluate、calibrate 与 report，保留现有 benchmark 命令入口薄委托。

默认用户级产品 CLI 不增加命令；内部入口 `bun evaluation/cli.ts evaluate` 可独立执行，SOP 在 evaluation 内。新增目录必须接入现有工程检查，防止仅 `bun test e2e` 看似绿色。

## 2. DEPA 事实 owner

| 事实 | 唯一写入者 / transition | 读取/派生 | 明确不拥有 |
|---|---|---|---|
| 原始目标、确认约束 | 用户/来源锁定 effect | obligation planner/reviewer | scenario 不能改目标 |
| Artifact identity | freeze effect，复验为新 identity/run | 各 observer/reviewer | reviewer 不修交付物 |
| runtime effect 与 Observation | 受信通道 owner 的 dispatch/observe | admission/reviewer | agent proposal 不造执行记录 |
| Obligation/Claim proposal | source-bound planner/reviewer | admission | 非用户需求 authority、非 native fact |
| 官方评估 Decision/Ledger | harness admission transition | report/benchmark adapter | 不回写 Track 或重置 attempts |
| Codument Hook/工作流状态 | 产品原 lifecycle CLI | benchmark observer | evaluation 不变成第二工作流 owner |
| calibration gold | 独立 fixture author/reviewer | 校准比较器 | 被评估 agent 无 gold 写权限 |

所有路径、origin、lease、agent identity、phase 与 digest 由 owner 绑定；提示词说明不是权限边界。

## 3. 输入与结果协议

输入至少包括：

1. `TargetSource[]`：原始完整文件路径、digest、确认约束、优先级/来源；不截断拼接需求，不提供 CLI line-range 功能。
2. `ArtifactIdentity`：只读 source root、完整来源指纹及被允许的构建输入；必要多仓资产显式列 roots。
3. `EvaluationPolicy`：schema/policyVersion、能力/安全范围、阶段预算、模型身份、弃判规则。
4. `Runtime`：显式 observer/model/storage/clock/lease 能力；config 仅静态数据，不塞 callbacks 或万能 runtime。

产物路径只是输入，不能自动授权执行它的任意脚本或访问个人 HOME。启动/构建/依赖准备需 confined effect 执行，mutable data 在 scratch，不给源码写权限豁免。

结果的最低分轴：

- execution：completed / interrupted / infrastructure-failed。
- judgment：pass / fail / indeterminate；局部发现不因整体中断消失。
- failureClass：business / infrastructure / protocol-cost / scope-unresolved 等诊断，不能只凭该分类反推产物正确。
- observations、claims、coverage/unresolved、support references、policyVersion、native usage 与阶段时间。

字段名字可在首节点优化，分轴和 authority 语义不能丢。非 completed 的总体评估不能获得“已验收通过”；局部 FAIL finding 可保留但不能把失控本身写成业务 defect。

## 4. 目标解释与语义判断

- planner 完整读原始需求与确认约束，形成带引用/解释理由的义务、未知和候选验证方法。分类是开放语义标签，browser adapter 可用其现有分类，不强推所有领域。
- reviewer 独立读原文与真实产物/观测，检查派生义务遗漏和证据支持，必要时补列遗漏；派生集合不是覆盖上限。
- provenance/admission 确定性检查来源、phase、fingerprint、实际 observation、预算和格式。它不能用 substring 或 ID 集合独立证明业务正确。
- 判断需区分真实入口、替代入口、准备动作、业务结果和状态演进。方法通用，不固定 HTTP/UI/数据库业务步骤。
- 完整目标可能不可唯一解释。保留有根据的解释与未解问题，不通过“改成长需求”消灭歧义；不能验证的显式义务阻止无条件 PASS。
- 模型判断可能错误。协议的职责是使判断可追溯、可挑战和可校准，不把 AI 输出封为不可证伪事实。

## 5. Effects 和可恢复性

- process：使用真实 spawn/native completion 观测，不把宽泛 shell 文本解析当执行 oracle。保留旧解析器用于兼容，而非证明所有语言测试通过。
- browser：复用 restricted channel、序列化/去重、native observation IDs。setup capabilities 在 isolated app runtime；setup 回包不是 UI 证据。
- agent：复用当前 Codex runtime 的身份、auth 临时文件、原生 usage 和日志；参数与模型身份实际核对。
- storage：官方 receipt 只由 owner 写；ledger append，报告派生。secret/private session 原文不随报告公开。
- lifecycle：期限及 event wait 来自 policy；只有已知无派发/安全再观察可恢复。unknown effect/lost control 后 fence，不重复 mutation、不替换空间掩盖失败。
- protocol repair：最多一次、仅表示修正、语义冻结、关闭业务能力后执行；也扣总模型预算。budget 已耗尽则不修，不偷偷第七次。
- cleanup：只释放本 run 持有资源；原始交付/历史结果保留。agent 不做 `rm -rf` 清理交付 workspace。

## 6. 公共包复用与既有代码迁移

按实际导出的 contract/subpath 使用 `halfcode-lite-*` 0.2.1，不依据过期 README 或 node_modules 中的残留目录名判断有效依赖。

- public CLI shell/contract 可用于可组合入口，但不应让 eval-only 间接加载完整产品 Serve/MCP/Vue 闭包。
- public process support 可提供匹配的进程生命周期原语；其裸 PID/health 契约不足以承载 observation authority 时，由评估 support 包装，不跨包 import internals。
- public browser support 提供 vendor 执行原语，受限通道、receipt admission 与安全策略仍由评估消费者持有。
- 原 `runtime.ts`/`agent-runtime.ts`/`browser-channel.ts` 按所有权抽离或薄适配，旧路径转发同一实现；不得复制到 evaluation 后两边继续独立演进。
- 五例配置、version installation、Track/Hook/归档检查仍在 benchmark adapter。未选 Hook 与产品默认不能由评估器擅自改变。
- 当前/历史 reports 增加策略标识与兼容读取；旧记录不可重写为新 verdict。同需求不同政策比较需分组，不合并 denominator。

## 7. 校准边界

校准集至少有两种通道，各自已知通过、已知缺陷、证据不足。fixture gold 可确定性编写，因为对象是 harness 自身；真实生成应用的业务期待仍由 agent 从目标推导。

- 无模型：fake ports/fault injection + native restricted browser/process smoke。验证真实 dispatch 与资源关闭，stub 不伪装 native。
- 有模型：六样本、最多十二次 Terra/medium 模型调用、总120分钟。六次独立判断，浏览器样本最多三次额外准备，至多三次预算内表示修正；逐样本最多一次表示修正，未必每个样本都有预算可修。优先四个两通道 pass/fail，再两个 insufficient。准备调用不是免费步骤；样本未完成则验收不通过，不能绕开总预算。
- frozen 历史 Todo 可作只读失效样本，先恢复完整来源/指纹。不存在就明确使用校准 fixture，不假称历史结果复验通过。
- 加入错误 wiring/部分入口、自测假绿、已知遗漏、误导 claim、延迟未完成、失控/timeout、产物注入指令等机制反例。
- 报告 false PASS/false FAIL、目标遗漏、适当弃判、错误归因、wall time、input/cached/output、返回/读取 bytes。读取范围仅来自实际工具记录，不增加 CLI line-range 参数；不可观测项为 unknown。
- 缓存指标不猜 token：cached 为 input 子集，不能再相加；阶段调用失败也计成本。同源首读/复用读取可对比字节与可得原生 usage，但不宣称因果缓存收益已证明。

## 8. 未来收敛而非本阶段承诺

当第二个真实消费者证明稳定 public contract 的必要性，再考虑独立公共 evaluation 包和跨领域适配矩阵。首阶段的成功信号是任意冻结产物能独立接入、业务特例不向 core 滑落、判断局限可见，不是多建文件/模块或大幅提升某五例成绩。
