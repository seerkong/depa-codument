# 分析入口

Scope: package
Depth: standard
Mode: active mission; 2026-09-05 incremental design-only replan, awaiting confirmation before code resumes

Latest analysis: [cross-repo-host/manifest.md](cross-repo-host/manifest.md), scope=package, depth=deep, design-only。它覆盖下表原本仓方案的通用包源码归属、命名前缀、发行及消费边界；原始证据保留为 dated 快照。

本目录保存本次 mission 的证据分析与设计输入。执行状态只在 `../loop.md`；不存在独立的扫描调度器。

## 文件职责

| 文件 | 用途 |
|---|---|
| [current-state.md](current-state.md) | 当前事实、DataTopology、能力清单、关键风险 |
| [inventory/package-boundaries.md](inventory/package-boundaries.md) | 已有包 declared/observed role、证据与差距 |
| [convergence/package-disposition.md](convergence/package-disposition.md) | 目标包、处置与依赖方向 |
| [user-review.md](user-review.md) | 外部评审的参考性采纳记录 |
| [cli-serve-placement.md](cli-serve-placement.md) | Omni 只读参考、本项目实际调用链、三命令暂停与目录不变量 |
| [../design/cli-first-runtime.md](../design/cli-first-runtime.md) | CLI-first placement、生命周期分面与重构后讨论边界 |
| [../design/architecture.md](../design/architecture.md) | 目标 Host/产品/Skill App 组合与切换方式 |
| [../design/migration.md](../design/migration.md) | 历史升级桥、版本、回滚/重试与语义兜底 |
| [../design/context-economy.md](../design/context-economy.md) | 成本假说、上下文闭包、失效和测量方案 |
| [../verification/acceptance.md](../verification/acceptance.md) | 验收场景和可执行 harness 需求 |
| [../verification/cli-first-progress.md](../verification/cli-first-progress.md) | 更正后第一实施切片、实际证明范围与 runtime 尚欠边界 |

## 方法与证据界限

已完成：问题拆解→authority/transition 盘点→代码证据→包处置→依赖切片与验收设计。模块实现抽样以支撑包级判断为限；没有全量调用图或 fresh-child 架构审计结论。

采用 `depa-expert` 当前 DataTopology 规则；事件溯源和响应式 profile 尚无必要激活证据，均为 NOT_APPLICABLE。当前有 Browser/PageWorkflow 异步调度，允许在该已存在边界保留 Actor 类协作，不推及全部 Codument 任务。

Mission Lite 内置 DEPA 参考文有旧七级阶梯、事件回放普遍化及 targets 术语。技术判据按 `depa-expert` 当前主文；此处只借 Mission Lite 的建档与循环方法。本次 attractors 独立写明方程。

实施期基线与测试更新见 evidence E011 起；冻结机器清单见 baseline.json，compiler metadata 边界可用 probe-compiler.ts 重放。规划期的静态数字不冒充当前实现快照。

## 未展开的局部工作

- Browser provider、Vue 编译器、HTTP session 的全部内部状态机：本次先定包归属与回归入口，执行到对应包时再审计其内部 lifecycle。
- 每个历史版本的真实 release artifact：尚未建立全矩阵；现有 XML/Decision fixtures 已定位，完整来源和缺口由“冻结基线与验收夹具”节点调查。
- 真实账单 token 数：目前只量文件字节和行数；无当前会话 usage 数据，不声称已经降低 token。

## 2026-10-04：通用 Spec Coding 方法论追问

[general-spec-convergence.md](general-spec-convergence.md) 记录用户对 Web 场景过拟合的纠正、当前 global SkillApp 选定协议与 cdmt-lite 的对照，以及通用的意图—观察—行动收敛建议。此轮为架构指导/协议审查，不是新的全仓 scan 或实施；不覆盖上文 dated 分析、不新增工作图、不改产品、不重跑 E2E。Round55 的实际对照及限制见 `../verification/paired-e2e-round55-findings.md`；已确认约束不能以“计划是假说”为由删除，改造效果尚未验证。
