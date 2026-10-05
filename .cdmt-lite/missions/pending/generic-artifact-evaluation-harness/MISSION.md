# Mission: 通用 AI 产物评估 Harness 的第一阶段收敛

终点: 将现有 E2E 中可复用的独立验收能力收敛为可单独运行的产物评估 harness：不依赖应用生成流程，能够用同一评估协议验收冻结的浏览器应用与非 Web 产物，并通过故障注入和有限的真实模型校准证明隔离、证据、判定及成本记录可靠。现有 Codument 新旧版本基准测试成为它的一个消费者，而不是通用评估的定义者。

本文件是期望态权威。循环状态见 [loop.md](loop.md)，证据账本见 [evidence.md](evidence.md)。这是长期通用评估方向上的有限第一阶段，不承诺覆盖一切领域或使模型判定变成确定性证明。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构 | [attractors/general-evaluation.md](attractors/general-evaluation.md) | 评估独立、事实 owner、副作用及产品适配边界 | 计划 / 决策 / 实现 / 校验 | 1 |
| AT2 | 质量 | [attractors/judgment-validity.md](attractors/judgment-validity.md) | 原始目标、证据充分性、未知态与验收器校准 | 计划 / 决策 / 实现 / 校验 | 2 |

## Notes

- 每轮加载 `cdmt-mission-lite`；架构判断加载 `depa-expert`。本 mission 使用独立重观察收口，不启用选装 gap-loop 协议；不因此修改产品已有 GapLoop/Hook/AttractorCheck。
- 本轮只立项、分析和规划；执行前等待用户确认。命名候选为 `generic-artifact-evaluation-harness`、`artifact-evaluation-core`、`independent-delivery-assessment`，选择第一项，已检查不与既有 mission 撞名。
- 设计及事实库存见 [design/architecture.md](design/architecture.md)、[design/current-state.md](design/current-state.md)。验证环境、预算和计划命令见 [verification/plan.md](verification/plan.md)。这些不是第二套工作图。
- 源头库存：`project/e2e/` 的隔离 runner、进程/浏览器 owner、模型运行时、原生收据、协议修正、报告；历史业务 oracle 保持历史身份。
- 需要改造：抽出通用评估契约与生命周期，隔离五例选择、安装/生成/Track/Hook 校验，统一 process/browser 观测和独立判断；注册新增代码的 test/lint/typecheck 覆盖。
- 最终暴露：项目内独立 `evaluate` 入口、报告与评估 SOP；原 E2E 入口继续作为产品基准适配器。此次不新增 `depa-codument` 产品命令、不发布新包、不把评估 SOP 自动装到全局 Skill。

## 期望结果

- 期望-1: 冻结产物 + 原始需求/确认约束 + 评估配置即可启动 eval-only；既不创建 Track，也不调用规划、实现、安装或业务纠偏。浏览器与非 Web process 样本可走同一入口。
- 期望-2: 有版本化的 obligation/claim/observation/decision 协议与单一评估账本，记录来源、产物指纹、run/phase、实际观测及判定依据，显式保留歧义、遗漏和证据不足。
- 期望-3: 执行状态与产物判断分轴记录；基础设施、协议、控制权和业务发现不混淆。预算、一次表示修正、去重、未知副作用 fencing、deadline 和资源释放有实际验证。
- 期望-4: Codument current/legacy 基准均消费同一评估能力，保留真实安装/生成/工作流/Hook/外层尝试语义；旧日志仍可读取，但不伪装为新版策略下的同政策样本。
- 期望-5: 验收器自身具备通过、业务失败、证据不足及基础设施失败的校准集；至少验证浏览器应用和非 Web CLI/库两类通道，报告误判、遗漏、弃判、归因、耗时和可测成本，而不只报告 schema 通过。
- 期望-6: 有可复现的独立验收 SOP 和报告，说明怎样接入新的目标/产物/能力，哪些判定已校准、哪些尚未覆盖；新增代码纳入完整工程检查。

## 约束

- 约束-1: 架构及质量方向以 Attractors 表为准；不得用局部测试绿色替代排除集审查。
- 约束-2: 业务代码仍只改本仓库 `project/`；复用当前 `halfcode-lite-*` 公共 0.2.1 契约/能力，只在适配方封装，不改 Halfcode、OpenCLI、Ego 源码或安装，不复制平行底座。
- 约束-3: 验证在独立 `/tmp` 仓库副本和评估根内执行；交付源码、原始需求、历史记录与两个全局 CLI/Skill 均不写入；明确区分只读交付物与可变的隔离运行态。
- 约束-4: 不干扰 `npm-release-install-e2e` 等其他 mission 的活动批次、TaskSpace、状态及共享文件。执行前重观察其 owner；安全默认使用冻结副本，源码整合须避开活动批次的共享依赖。
- 约束-5: 不把五个 case 的 selector、业务断言或步骤加入通用 core，不把 API/UI 分类当通用领域模型，不要求用户为适配 harness 把模糊需求写成长规格。
- 约束-6: 不删除或放宽产品 GapLoop、Hook、AttractorCheck、独立 Verify、终态预算和安全闸门；infra/protocol 失败不得启动 implementation correction，旧历史尝试与成本不重置。
- 约束-7: 先无模型验证，后有限校准。计划确认后真实模型仅用 `gpt-5.6-terra` / medium，六个评估样本、最多十二次模型调用（含准备与协议修正），总时限 120 分钟；不跑完整五例生成，不自动扩大预算，未观测成本记 unknown 而非零。

## Acceptance

下列新增命令是待实现的验收合同，不是本轮已运行结果。均从隔离副本的 `project/` 运行；测试写入该副本及专属临时根，不写真实工作区或全局安装。具体调用见 verification/plan.md。

- [ ] 期望-1 → `bun test evaluation/test/eval-only.test.ts` + `bun evaluation/calibrate.ts --profile=artifact-smoke --no-model --output-dir=<新评估根>` → 浏览器与 process 样本各有评估结果，未调用安装/生成/实现/Track，负向写入被拒绝。
- [ ] 期望-2 → `bun test evaluation/test/contracts.test.ts evaluation/test/admission.test.ts` → 来源/指纹/run/phase 校验生效；伪造观测、漏显式义务、只凭 coverage ID 或自报测试通过均不能获得 PASS。
- [ ] 期望-3 → `bun test evaluation/test/lifecycle.test.ts evaluation/test/faults.test.ts` → 中断、超时、过期 lease、未知 effects、失去控制权、一次格式修正与资源释放均有结构化结果，无不安全重放。
- [ ] 期望-4 → `bun test evaluation/test/benchmark-adapter.test.ts` + `bun test e2e` → current/legacy 消费同一评估实现；历史格式回放通过，终态及既有 attempts/usage 不变，旧策略不能合并进新策略通过率。
- [ ] 期望-5 → `bun evaluation/calibrate.ts --profile=judge-calibration --agent=codex --model=gpt-5.6-terra --effort=medium --max-invocations=12 --deadline-ms=7200000 --output-dir=<新校准根>` → 两类通道各覆盖已知通过/已知失败/证据不足；已知缺陷无 false PASS、已知可证通过无 false FAIL、不足样本不通过，基础设施未知不改判业务失败。任一未完成项明确不通过本项，不补造模型结论。
- [ ] 期望-6 → `bun run check` + `bun test evaluation/test/sop.test.ts` → typecheck/lint/test 包含新增 evaluation 路径；SOP 命令能在隔离根复现；报告含策略/模型/来源/覆盖与局限。
- [ ] 约束-1 → `bun test evaluation/test/boundaries.test.ts` + 独立读取两份 attractor 对照最终源码/产品面 → AT1/AT2 排除集逐条有负向证据，无纯靠绿色构建的完成声明。
- [ ] 约束-2 → `bun test evaluation/test/boundaries.test.ts` + `git diff --name-only` + 依赖解析审计 → core 不 import 产品适配器或具体 IO；无跨仓写入/内部路径依赖/重复 owner；公共版本仍来自已确认 npm 闭包。
- [ ] 约束-3 → `bun test evaluation/test/isolation.test.ts` + 真实 eval 前后指纹对比 → 产物/需求/历史与全局 bin/Skill 一致，运行态仅在评估根，秘密不进入报告。
- [ ] 约束-4 → `bun test evaluation/test/concurrency.test.ts` + 运行 owner 清单与活动根前后只读比对 → 活动批次及其 TaskSpace 无变更、复用或销毁；源码整合已确认共享读依赖安全。
- [ ] 约束-5 → `bun test evaluation/test/boundaries.test.ts evaluation/test/target-coverage.test.ts` → core 无 case 白名单/专属断言；未知业务只通过目标与适配器接入，原需求 bytes 不变，歧义/遗漏可保留。
- [ ] 约束-6 → `bun test evaluation/test/benchmark-adapter.test.ts evaluation/test/faults.test.ts` + `bun test e2e` → infra 不触发业务修复；耗尽终态不能绕过；历史收据不重写；产品关键检查仍存在。
- [ ] 约束-7 → `bun test evaluation/test/budget.test.ts evaluation/test/usage.test.ts` + 校准原生 session/进程账本核对 → 最多十二次调用、120 分钟硬上限；准备/失败/修正都计入，缓存包含关系不双计、缺计数记 unknown，无全量生成。

## 范围外

- 本阶段不重跑新旧版本五个完整生成用例，不用小校准样本宣布编码能力提升或稳定成功率。
- 不实现游戏/基础设施/所有语言的现成评估适配器，不承诺通用语义判定完备或数学证明；保留接入边界和未覆盖报告。
- 不立即创建独立公共 npm 包、插件市场、远程评估平台、多租户调度或评分排行榜；第二个真实消费者与稳定合同出现后再另立项目。
- 不改 Codument 通用规划/实现提示词以迎合 Web case，不更改需求正文，不修复已经生成的 Todo/Blog 等应用。
- 不进行全局安装、发行、切换用户 session，或接管其他 mission。
