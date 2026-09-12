---
status: proposed
last_verified: 2026-09-05
scope: package
---

# 已有原语与自有契约的分工

来源仅是 [inventory](../inventory/index.md)；不新增厂商调查或强制采用 DEPA 库。`C/`、`H/` 的完整根见 [包表](package-disposition.md)。下表的“自有”是项目已有/需要显式化的业务或 Host 边界，不表示重造 vendor。

| 候选 / 决策 | 已有可承接原语 | 处置与必须自有的边界 | inventory / path:line |
|---|---|---|---|
| C01/C03；D01/D05/D06 | halfcode-compiler.xnl 的 source loader、owner/revision/reader/resolution registry、lock | 复用 compiler admission；Host 只持通用 catalog/registration contract；Codument 提供自己的 reader/semantic validation 和 finite legacy profile。禁止复制第二 compiler/Kind registry | F06/P04.1；INC-01；`C/packages/skill-app-support/src/resources/host-resource-contracts.ts:217`；`authored-loader.ts:52` |
| C01/C02；D02/D03 | 已提取 CommandHost、command validation、service admission/drain | 迁回 H 并公开已有机制；CLI-first 前后校验提炼为单一合同，不能两仓各维护 preflight 或新建万能 dispatcher | C03–C07；R02；`C/packages/cli-host-logic/src/commands.ts:4`；`C/packages/cli-host-capsule/src/service.ts:79` |
| C02；D04 | 现有 Promise queue/pending tracking 和 coordinator | 以 explicit runtime + Processor 重组已有 live owner；同步 parser 直接调用。当前没有需要新 Actor mailbox 框架的证据 | conformance Actor/Effect；F13/F14；`C/packages/cli-host-capsule/src/page-automation.ts:210`；`C/packages/skill-app-logic/src/local-function.ts:46` |
| C02/C04；D04/D07 | Bun.build 与 compiler materialization | 保留真实文件 resolver 与 captured source staging，消除 legacy live-import 窗口；对 package metadata/dependency bytes 明确并验证 admission 边界。不是新 bundler | INC-03；R04/R05；`C/packages/browser-support/src/web-api.ts:10`；`C/packages/skill-app-support/src/resources/host-package-materializer.ts:283` |
| C02；D03 | Hono / fetch / 现有 Serve record 与窄 invocation route | Hono 归可选 T14；通用 HTTP transport 实现 T01/T06 明确 ports；身份、digest、placement 的服务端复验属于 Host 协议逻辑，不交给客户端自报 | C07、R02；P05.5/6；`C/packages/cli/src/cli/http/app.ts:207` |
| C02/C05；D04/D08 | Bun SQLite | 复用 SQL/transaction，保留现有 query/prepare handle tracking 和 close 修复；不平行造 DB runtime | INC-02；`C/packages/skill-app-support/src/sqlite.ts:7,21` |
| C02/C05；D08 | Vite/Vue/Module Federation builder | T10 实现 VuePageBuilderPort；worker 与资产按包闭包发行；不重造页面 compiler，optional install 与 external Bun requirement 写明 | C12/H05、PD04/05/10；`C/packages/page-builder-vue/src/worker-port.ts:3,16` |
| C02/C03；D04/D08 | MCP SDK/ext-apps/zod | T11 选择 server/transport closure；默认 stdio/日志归消费方 shell，保持 caller transport 与 close | C13/H04、PD12；`C/packages/mcp-app/src/connect.ts:5,15`；`H/packages/mcp-app/src/support/stdio-server.ts:13` |
| C03；D06 | 已有 filesystem repository lock/CAS、xnl-core codec | Codument 保留领域 transition、archive policy 与 semantic migration；通用 Host 不解释 track/mission 状态。journal 不升级成 canonical event log | C14–C17；F15/F16；`C/packages/domain-support/src/lifecycle-repository.ts:30,163` |
| C05；D08/D10 | Bun pm pack/install、既有隔离 consumer、native build/check | 增加精确发布闭包与三消费者验证；结构比较 manifest/从 recipe 生成 payload 清单；保留失败退出与 integrity 检查，不只读 PASS 字符串 | PD03–PD11；INC-04；`C/scripts/verification/consumer.ts:18,35`；`C/scripts/check-release.ts:177` |
| C06；D09 | Git 只读 provenance、当前 working-tree 文件枚举与 source allowlist | 采用现有枚举能力，新增明确 scaffold/snapshot 合同及逐文件 reconciliation receipt；不以 HEAD 替代 dirty bytes、不造 merge base、不默认整树复制 | PD01/02；`H/scripts/clone.ts:12,155`；`C/scripts/clone.ts:143,286` |

Support → public pure logic codec 的现有条件依赖不能被误报为已证明 cycle。目标验收要求只触公开、纯净、下层 codec；若迁移发现反向业务规则依赖才按证据拆解。公开 ports/实际 closure 优先于为了减少依赖图箭头而复制 codec。
