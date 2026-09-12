# 跨仓库改造建议

目录职责：把 [convergence](../convergence/index.md) 的 C01–C06 切成有边界、可验收的实施输入；不拥有架构决策、执行状态或运行证据。执行仅由 [Mission Lite 工作图](../../../loop.md) 承接，不创建 Codument track。

本轮仅设计。以下 PASS 表示建议输入就绪，所有实施验收均为 **PLANNED / NOT_RUN**；开始跨仓实现仍等待用户确认本方案。第一批限四项，先建立可信来源和公开边界，再把运行与执行字节保证补齐，尚不切换产品发行入口。

| 顺序 | 建议 | 可独立交付结果 |
|---|---|---|
| 1 | [rec-01 来源 reconciliation](rec-01.md) | 当前两树逐项来源、身份与差异凭据，明确可保留的基线 |
| 2 | [rec-02 公共包与身份/安装闭包](rec-02.md) | H 中真实的基本 CLI、资源与可选实现公共边界，精确身份兼容证明 |
| 3 | [rec-03 公共 CLI-first/live 生命周期](rec-03.md) | T12/T13/T14 完整 public execution、生命周期和服务端准入 |
| 4 | [rec-04 执行材料一致性](rec-04.md) | legacy 与 package 两条 source-to-execution 负例闭合 |

后续路线：四项合流 → Halfcode 自消费 → Codument 领域及产品封装消费 → 同一 immutable release set 的第三消费者、正常传递依赖解析与分层发行证明。clone 的 scaffold/source-only/full-snapshot 合同单列，不阻止无 clone 的消费者接入。后续项目见 [backlog](backlog.md)，不能被“第一批完成”吞掉。

[五闸](readiness.md) · [依赖与回滚检查点](order.md) · [依赖投影](dependency-order.md) · [冲突矩阵](conflict-matrix.md)。深度为 deep，最终独立建议复核由主编排记录到分析 manifest/reviews；本目录不预填 NO_GAP。

三个许可边界互不推导：本轮方案确认只解除核心跨仓实施等待；`init/status/upgrade-workspace` 合并、最终入口/旧 src/真实 dogfood 仍须核心验收后的用户决定；真实 npm 查询权属与发布按后续外部发布授权执行。可打包、可发布的设计或本地证明均不等于已发布。
