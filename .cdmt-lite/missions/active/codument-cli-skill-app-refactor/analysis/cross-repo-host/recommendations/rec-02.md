---
status: proposed
last_verified: 2026-09-05
rec_id: rec-02
scope: package
---

# rec-02：归回公共包，固定身份兼容与基本安装闭包

## 背景问题

PD07 表明基本五包当前实际安装八个 workspace 包；C/H contract 同为 2.0.0 却有不同 exports 和 owner 指纹（PD08/R01）。直接换 npm 名既不解决职责，又会改变 admission 语义。

## 目标

在 H 建立可独立打包的基础/资源/可选实现公共闭包，基本命令 Host 无 Skill App/HTTP 依赖；分开 installed artifact provenance 与旧资源 semantic identity。按 D01/D02/D05 逐项移植而非统一替换前缀。

## 非目标

不宣称完整 CLI-first/live 已公开（rec-03 承接）；不以空 T13/T14 包占位；不改既有 subject/specVersion/owner fingerprint，不发布旧名 alias；不切产品入口、删除 C 通用副本或退役旧 src。

## 输入证据

- [C03–C13/H03–H05](../inventory/package-boundaries.md)：`C/packages/cli-host-capsule/package.json:25`、`cli-host-shell/package.json:15`，H MCP 默认 stdio `H/packages/mcp-app/src/support/stdio-server.ts:13`。
- [PD07/PD08/PD12](../inventory/provenance-distribution.md)、[R01](../boundary/backwrite-risks.md)：`C/packages/skill-app-contract/src/resource.ts:404`、`C/packages/skill-app-support/src/resources/package-protocol.ts:253`。
- D01/D02/D05/D08；[T01–T14](../convergence/package-disposition.md)、architecture §2/3/6/8。来源前缀见 rec-01。

## 目标包与角色边界

H 是以下源码 owner；目标名以 `halfcode-cli-lite-` 为共同前缀，完整后缀如下，精确 ID 对应唯一包表：

| T | 后缀 | 本项交付的真实边界 |
|---|---|---|
| T01/T02 | `cli-host-contract` / `cli-host-logic` | CLI identity、command/IO ports；纯验证/dispatch，禁止实现依赖/直接 IO |
| T03 | `cli-host-support` | 实现 T01 Output/Root/Process/HTTP-client 等 ports；纯 public codec 条件边须逐边证明 |
| T04/T05 | `cli-host-capsule` / `cli-host-shell` | command runtime factory/admission/drain closure；argv/help/output/exit 表面，无资源/HTTP 强依赖 |
| T06/T07/T08 | `skill-app-contract` / `skill-app-logic` / `skill-app-support` | Kind/catalog/bundle/compatibility ports；纯 admission/Processor；Catalog/Workspace/BundleMaterializer/SQLite 等 effect 实现 |
| T09 | `browser-support` | 实现 BrowserProviderEffect 和已有 WebAPI/debug effect，运行绑定选择 executable |
| T10 | `page-builder-vue-support` | 实现 T06 VuePageBuilderPort；worker 与 Vite/Vue/MF 独立闭包 |
| T11 | `mcp-app-capsule` | caller transport + MCP SDK/server/catalog/close 的真实组合，stdio 默认值回产品 shell |
| T12 | `skill-app-capsule` | 从 C06 迁出的 catalog/Kind/materializer/index resource closure；借用显式 bindings，rec-03 补全 invocation/drain 协议 |

T13 `halfcode-cli-lite-live-host-capsule`、T14 `halfcode-cli-lite-http-shell` 已定目标，本项只提供其所需 T01/T06 合同，不伪称实现完成。T04/T05 只用 T01/T02 与必要 T04；T12 用 T01/T06/T07/T08，不依赖 T09–T11/T13/T14；所有公共包禁止产品依赖、产品路径与跨包 internals。旧 C 实现只作迁移输入，删除由产品采用门控制，不能继续作为并行演进分支。

## 验收（conformance case）

1. 在 H 按真实导出打包本项交付包；隔离只装基本 CLI 五包并列实际 production closure：无 T06–T14、compiler/AJV/YAML/Hono/Vue/MCP/browser。另装资源闭包，资源发现/校验通过且不构造 browser/Page/Serve。import 惰性不能替代安装证据。
2. 对每包 exports、tarball files、production dependencies、role 禁止边核对；contract 无 IO，logic 无具体 support，support 回指表中 effect port，capsule 有选型/owned close，shell 仅外部表面。清空源码搜索路径，只从已安装 public exports 执行基本命令与资源/自定义 Kind fixture。
3. 两族 legacy fixture 分别保持旧 subject/owner/revision/reader/lock profile，映射到精确新包 name/version/integrity。旧读取和 preserve-existing-write 不改 semantic identity；错误 integrity、未知旧版本、同 subject 双 owner、伪造 alias 均拒绝。public library 不硬编码 Codument profile，由消费配置供给并按可信发行合同验证。
4. 旧 exact-name code-first descriptor 必须有可解析且精确认证的受限本地兼容入口或明确迁移判定；不能放宽 exact name/version/integrity。legacy globals 与 Vue injection key 的桥接指向单 implementation，冲突 owner 拒绝。未解决的真实旧名发布依赖保留 B04 发布 gate。
5. 受影响 package typecheck/tests 与隔离 pack fixture 结果记录到 evidence；H 根 `test` 未覆盖的 contract/Vue 等 package tests 必须显式选入（PD11）。源码迁出保持 INC-01–04 回归，不用新名字绕掉断言。

验收为 PLANNED；现有 `C/scripts/verification/consumer.ts` 与 architecture harness 是可改造基线，不假称 H 已有新的跨仓命令。实施新增入口时同步记录实际命令、exit 与制品 hash；本项不运行 full release。

## 依赖前置

rec-01 完成，目标输入 digest 未漂移；identity 映射中无法解释的值先阻断该迁移单元。rec-03/04 不阻塞本项基本/资源独立 fixture，但完整公共包集的采用等待三项合流。

## 对应三面与层级

扩展/数据面 × platform，产品 profile 属 application。DEPA Data/Effect/Processor/包 role；回溯 three-plane-map PD07、PD08 与全部 package-role 行。

## 落地建议（由同一 Mission Lite 承接）

先 ports/identity profile，再 CLI 安装分离与资源 capsule，再按来源表移植可选实现和测试。只在 H 改公共源码；C 的产品采用尚未发生，保留旧锁与旧包供回退。失败则撤回本次 H 变更或留实验分支，不能覆盖随后用户修改；不做 npm 发布或产品自动升级。
