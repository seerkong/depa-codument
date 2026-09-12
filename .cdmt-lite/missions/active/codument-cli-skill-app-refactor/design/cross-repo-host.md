# 跨仓公共 Host 设计入口

本页只导航，不持有第二套设计或执行计划。用户最新要求优先：通用能力的源码归 Halfcode、公共包采用无 scope halfcode-cli-lite-*，Codument 保留领域和真实封装；当前回合仅设计。

- [分析恢复点与复核状态](../analysis/cross-repo-host/manifest.md)
- [现状报告与证据](../analysis/cross-repo-host/report/current-state.md)
- [现状架构图](../analysis/cross-repo-host/report/index.md)
- [目标架构与公共接缝](../analysis/cross-repo-host/convergence/architecture.md)
- [逐包处置](../analysis/cross-repo-host/convergence/package-disposition.md)
- [决策与候选边界](../analysis/cross-repo-host/convergence/decisions.md)
- [首批建议与就绪条件](../analysis/cross-repo-host/recommendations/index.md)
- [实施顺序与回滚门](../analysis/cross-repo-host/recommendations/order.md)

正式 `codument/` 目录、[CLI-first](cli-first-runtime.md)、[历史迁移](migration.md)、[上下文经济性](context-economy.md) 合同继续成立。跨仓方案确认、核心重构后的三命令决定、真实 npm 发布是三个不同的用户 checkpoint。实施状态仅见 [loop](../loop.md)。
