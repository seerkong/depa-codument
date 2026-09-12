---
status: proposed
last_verified: 2026-09-05
scope: package
---

# 每包处置与目标公开边界

输入真源：[package-boundaries](../inventory/package-boundaries.md) 的 C01–C21/H01–H12，共 **33 个 physical manifests**。下表逐一覆盖；三个 H generated builder 是派生 payload，不是独立源码项目。所有新公共 Host 名为无 scope 的 `halfcode-cli-lite-*`；npm 可用性与所有权未查询。处置词使用 method 04 的 `RETAIN / RELOCATE / SPLIT / REMOVE / ADD-CONTRACT`；`SPLIT` 可以包含“把既有职责并入已存在目标包”，并不表示每个去向都新建一包。

`C/`、`H/` 分别为 inventory 中两个绝对源码根。证据列给 inventory row 与源 manifest/API locator；目标 ID T01–T14 在下文定义。所有迁移是 proposed；现阶段源码保留不动，兼容门通过前不得删除旧实现。

## Codument 当前 manifests

| inventory / 当前精确 package name | current role | 动作 | 目标及 owner / 真实职责 | 依据 |
|---|---|---|---|---|
| C01 `depa-codument` | private shell/build coordinator | RETAIN | 私有工作区根保留；原 npm 产品名 `depa-codument` 也保持发行兼容，二者不自动等同 | `C/package.json:2,5,10`；D01 |
| C02 `depa-codument-cli` | shell + product capsule | SPLIT | `depa-codument-cli-shell`、`depa-codument-product-capsule`、`depa-codument-host-adapter`（Codument owner）；可复用 private execution 部分归 T08/T09/T12/T13/T14 | `C/packages/cli/src/cli/runtime.ts:52`；R02/R03；D03/D06 |
| C03 `depa-codument-cli-host-contract` | contract | RELOCATE | T01，Halfcode | `C/packages/cli-host-contract/src/index.ts:5`；D01 |
| C04 `depa-codument-cli-host-logic` | logic | RELOCATE | T02，Halfcode；只保留领域中立 CLI logic | `C/packages/cli-host-logic/src/commands.ts:4`；D01/D02 |
| C05 `depa-codument-cli-host-support` | support / public codecs | RELOCATE | T03，Halfcode；实现精确 effect ports，codec 仅允许下层公开纯 API | `C/packages/cli-host-support/src/index.ts:3`；`src/codex.ts:3`；D01 |
| C06 `depa-codument-cli-host-capsule` | real broad capsule | SPLIT | T04 基本 CLI/service closure；资源 lookup/invocation 组装 → T12；Page/live coordination → T13 | `C/packages/cli-host-capsule/src/index.ts:11`；PD07；D02/D04 |
| C07 `depa-codument-cli-host-shell` | CLI + HTTP shell | SPLIT | T05 只负责 argv/help/output/exit；HTTP/Page 路由 → T14，Hono 随 T14 安装 | `C/packages/cli-host-shell/src/index.ts:49`；manifest:8,15；PD07 |
| C08 `depa-codument-skill-app-contract` | contract | RELOCATE | T06；distribution 名变更与原有 semantic identity 分开，必须 D05 gate | `C/packages/skill-app-contract/src/resource.ts:68`；PD08/R01 |
| C09 `depa-codument-skill-app-logic` | logic | RELOCATE | T07；加入从 private CLI 提取的纯 admission/placement 和 Page Processor，公开稳定 ports 在 T06 | `C/packages/skill-app-logic/src/resources/schema-validator.ts:17`；R02；conformance Effect |
| C10 `depa-codument-skill-app-support` | support / materializer | RELOCATE | T08；已有 filesystem/catalog/codec/materialization 真实闭包，不为每种资源拆包；D07 修 admission 一致性 | `C/packages/skill-app-support/src/resources/workspace-resource-catalog.ts:1`；R04/R05 |
| C11 `depa-codument-browser-support` | BrowserProviderEffect support | RELOCATE | T09；外部 executable 由产品 runtime 显式配置/注入 | `C/packages/browser-support/src/ego-browser.ts:5,24`；PD10 |
| C12 `depa-codument-page-builder-vue-support` | VuePageBuilderPort support | RELOCATE | T10；保持独立可选安装与 worker 生命周期 | `C/packages/page-builder-vue/src/worker-port.ts:3`；PD04/05 |
| C13 `depa-codument-mcp-app-capsule` | transport/lifecycle capsule | RELOCATE | T11；caller transport 必填，stdio 创建仍在 product shell | `C/packages/mcp-app/src/connect.ts:5,15`；PD12 |
| C14 `depa-codument-domain-contract` | contract | RETAIN | 同名，Codument；领域 schema/port/operations，消费 T06 公共合同 | `C/packages/domain-contract/src/operations.ts:28`；C14 dependency row |
| C15 `depa-codument-domain-logic` | logic | RETAIN | 同名，Codument；领域 transition/semantic validation，不让 Host 代持规则 | `C/packages/domain-logic/src/operations.ts:10,47` |
| C16 `depa-codument-domain-support` | repository support | RETAIN | 同名，Codument；实现 LifecycleRepositoryPort，codec/archive policy 注入；通用 FS support 依赖改 T08 | `C/packages/domain-support/src/lifecycle-repository.ts:18,30` |
| C17 `depa-codument-domain-capsule` | owner/drain capsule | RETAIN | 同名，Codument；显式 borrowed runtime 与 owned bindings | `C/packages/domain-capsule/src/index.ts:4,7` |
| C18 `depa-codument-darwin-arm64` | native distribution shell | RETAIN | 同名 Codument product artifact；作为 OS distribution identity 的窄例外保留，修正 recipe/依赖，不因 role suffix 强制产品迁名 | `C/packages/runtime-darwin-arm64/package.json:2,6,20`；PD03–05 |
| C19 `depa-codument-darwin-x64` | native distribution shell | RETAIN | 同名，Codument；同上 | `C/packages/runtime-darwin-x64/package.json:2,6`；PD10 |
| C20 `depa-codument-windows-x64` | native distribution shell | RETAIN | 同名，Codument；同上，不声称实机已通过 | `C/packages/runtime-windows-x64/package.json:2,6`；PD10 |
| C21 `opencli-plugin-codument-opencli` | materialized plugin shell/adapter | RETAIN | 原名称作为 OpenCLI materialized template identity 例外；Codument owner 的 template，真实 fetch provider 可由 T09 供应；不升级为公共 Host 包 | `C/packages/cli/src/templates/private/global/opencli-browser-fetch/browser-fetch.js:5`；manifest:2,7 |

## Halfcode 当前 manifests

| inventory / 当前精确 package name | current role | 动作 | 目标及 owner / 真实职责 | 依据 |
|---|---|---|---|---|
| H01 `halfcode-cli-lite` | private shell/build coordinator | RETAIN | 原私有根与产品发行 identity 保留，Halfcode owner | `H/package.json:2,10`；D01 |
| H02 `halfcode-cli-lite-cli` | mixed shell/capsule/support/logic | SPLIT | 私有 `halfcode-cli-lite-cli-shell` + `halfcode-cli-lite-product-capsule`；通用机制逐项归 T01–T14；自己的 CLI 也走公共 exports | `H/packages/cli/src/cli/runtime.ts:3,36`；R02/PD01/02 |
| H03 `@halfcode-cli-lite/skill-app-contract` | contract | RELOCATE | T06 与 C08 做逐条 API/身份 reconciliation；不以两者都 2.0.0 判断相等；旧 scoped 名仅有限兼容路径 | `H/packages/skill-app-contract/src/resource.ts:68`；PD08 |
| H04 `halfcode-cli-lite-mcp-app` | capsule + default stdio shell | SPLIT | reusable capsule → T11；stdio/logging 默认值 → Halfcode CLI shell，沿用现有 MCP vendor transport | `H/packages/mcp-app/src/support/stdio-server.ts:13`；PD12 |
| H05 `halfcode-cli-lite-page-builder-vue` | support + owned request contract | SPLIT | effect request/receipt contract → T06；concrete builder → T10；实际差异合并，不按目录覆盖 | `H/packages/page-builder-vue/src/index.ts:1,27`；PD12 |
| H06 `halfcode-cli-lite-darwin-arm64` | native distribution shell | RETAIN | 同名，Halfcode product recipe；作为 OS distribution identity 的窄例外保留 | `H/packages/runtime-darwin-arm64/package.json:2,6`；PD10 |
| H07 `halfcode-cli-lite-darwin-x64` | native distribution shell | RETAIN | 同名，Halfcode；同上 | `H/packages/runtime-darwin-x64/package.json:2,6` |
| H08 `halfcode-cli-lite-windows-x64` | native distribution shell | RETAIN | 同名，Halfcode；同上 | `H/packages/runtime-windows-x64/package.json:2,6` |
| H09 `opencli-plugin-halfcode-cli-lite-opencli` | materialized plugin shell/adapter | RETAIN | 原 vendor-facing template identity 例外，Halfcode owner；不是公共 Host library | `H/packages/cli/src/templates/private/global/opencli-browser-fetch/browser-fetch.js:5`；manifest:2,7 |
| H10 generated `halfcode-cli-lite-page-builder-vue` / Darwin arm64 | derived builder payload | REMOVE | 旧复制配方生成的副本退役，native recipe 消费已打包 T10 的完整声明闭包；无独立源包 | `H/packages/runtime-darwin-arm64/builder-vue/package.json:2`；`H/scripts/build-release.ts:33` |
| H11 generated `halfcode-cli-lite-page-builder-vue` / Darwin x64 | derived builder payload | REMOVE | 同 H10，生成物只可由新 recipe 重建 | `H/packages/runtime-darwin-x64/builder-vue/package.json:2`；PD04/05 |
| H12 generated `halfcode-cli-lite-page-builder-vue` / Windows x64 | derived builder payload | REMOVE | 同 H10 | `H/packages/runtime-windows-x64/builder-vue/package.json:2`；PD04/05 |

处置计数：**RETAIN 14 / RELOCATE 10 / SPLIT 6 / REMOVE 3 = 33**。REMOVE 是未来旧派生 recipe 的处置，不是本轮删除动作。`ADD-CONTRACT` 用于下面新公共接缝，而不是用来掩盖既有 mixed 包。

## 目标公共 Host 包清单

14 个包均由 Halfcode 持有源码与公共发布责任；这是 **11 个已有能力边界 + 3 个按安装/生命周期真实差异新增的边界**，不生成六角色模板。重命名后版本号、exports 和声明依赖由 D08 独立验证。

| ID / 精确目标名 | role / public responsibility | implemented port / selected closure / external surface | 允许依赖与禁止边 |
|---|---|---|---|
| T01 `halfcode-cli-lite-cli-host-contract` | contract | CLI identity、CommandDefinition、Root/Output/Process/HTTP 等已有及提取后 effect ports | 无 product/Skill App implementation；零具体 IO |
| T02 `halfcode-cli-lite-cli-host-logic` | logic | command tree 验证、解析、dispatch、通用 policy/codec | T01；禁止 T03 与 product |
| T03 `halfcode-cli-lite-cli-host-support` | support | 实现 T01 的 terminal/root/process/service-record/HTTP-client 等实际 ports；browser provider 不装入本包 | T01；已有 public pure codec 可依赖 T02，禁止 logic internals 或业务决策 |
| T04 `halfcode-cli-lite-cli-host-capsule` | capsule | command host 的 per-root runtime factory、admission/drain、通用 service owner；选 T01/T02 + injected runtime/owned support handles | T01/T02；不依赖 T06–T14，不强制组装资源 |
| T05 `halfcode-cli-lite-cli-host-shell` | shell | argv/help/output/exit；输出与退出 effects 注入 | T01/T02/T04；不依赖 Hono 或 Skill App |
| T06 `halfcode-cli-lite-skill-app-contract` | contract | resource/catalog/Kind/bundle/execution/Page ports，有限 execution request/receipt 与兼容 profile 数据格式 | 稳定 compiler contract、必要 T01；不依赖 Host/product 实现 |
| T07 `halfcode-cli-lite-skill-app-logic` | logic | schemas、resource admission、LocalFunction runtime-first execution、placement、pure Page/workflow processors | T01/T06 + 已有 compiler/AJV/xnl 纯处理能力；禁止具体 support |
| T08 `halfcode-cli-lite-skill-app-support` | support | 实现 T06 的 Catalog/Workspace/BundleMaterializer/SQLite/Notebook/Generation ports | T06 + 公开纯 T07 codec + compiler/Bun/YAML；禁止 product 规则 |
| T09 `halfcode-cli-lite-browser-support` | support | BrowserProviderEffect、已有 WebAPI/debug provider；external executable 的选择在 runtime binding | T01/T03 + 必需 public codec；不反向依赖 product/live capsule |
| T10 `halfcode-cli-lite-page-builder-vue-support` | support | T06 VuePageBuilderPort；worker build/release，独立 Vite/Vue/MF build closure | T06 + 现有 builder vendors；不依赖 Codument/CLI shell |
| T11 `halfcode-cli-lite-mcp-app-capsule` | capsule | caller transport + MCP server/catalog 组装 + close；选 MCP SDK/ext-apps/zod closure | T06 + MCP vendors；不创建默认 stdio、浏览器或 product identity |
| T12 `halfcode-cli-lite-skill-app-capsule` **new** | capsule | catalog/Kind runtime/materializer/index + per-invocation capability admission/drain；从 C06/private execution 收敛真正 resource closure | T01/T06/T07/T08，借用 bindings；不依赖 T09/T10/T11/T13/T14 |
| T13 `halfcode-cli-lite-live-host-capsule` **new** | capsule | PageBuild/PageWorkflow/Serve 实例状态与 owner handles 组装；选 T04/T12 + T07 Processor/T08 stores + injected optional effects | 公共 T01/T06/T07/T08/T04/T12；不依赖产品或具体 browser/Vue/MCP；无 HTTP 协议表面 |
| T14 `halfcode-cli-lite-http-shell` **new** | shell | 窄 execution/instance/Page HTTP routes、server-side re-admission、Hono protocol mapping | T01/T06/T07 + T12/T13 公共入口 + Hono；不持有领域 authority |

T12/T13/T14 的 `ADD-CONTRACT`：由 T06 声明 catalog/execution/live request/receipt 与 effect ports；由 T01 保留纯 transport/process 通用 ports。细分以能力归属为准，不能让 T01 反依赖 T06。实现迁出时保留 API 子路径兼容映射，最终废弃时间由兼容矩阵决定。

## 产品拥有的真实封装

| 精确目标名 / owner | role | 边界证据与实际职责 |
|---|---|---|
| `depa-codument-host-adapter` / Codument | adapter | outer = `depa-codument-domain-contract` commands/resources/receipts；inner = T01/T06 command/resource/execution contracts。把领域 resource root、旧命令/退出码、domain schema/readers 与历史 identity profile 映射进 Host。依据 R01/R03、C02、C14；不写领域源文件，不复制 parser/dispatch |
| `depa-codument-product-capsule` / Codument | capsule | 选择四个 domain 包 + host adapter + T04/T12，以及按产品需要选择 T13/T14/T09/T10/T11；拥有产品 runtime profile、模板、Kind 注入、binding ownership 和 aggregate close。依据 F01/F02/F18、R02/R03 |
| `depa-codument-cli-shell` / Codument | shell | 两个原 bin、legacy command/JSON/exit compatibility、stdio 与 process exit。依赖 product capsule 和 T05；三命令最终集成仍冻结 |
| `halfcode-cli-lite-product-capsule` / Halfcode | capsule | 选择自身 identity、templates、resources/commands、legacy profile 与 optional providers；对公共 Host 是普通消费者。依据 H02/R02 |
| `halfcode-cli-lite-cli-shell` / Halfcode | shell | Halfcode argv/help/bin/stdout/stdio 默认行为，调用自身 product capsule 与 T05。依据 H02/H04 |

前述五包可以 private；是否对外发布取决于消费者需求，不由 role 后缀推导。Codument adapter 确实跨两个语义边界；Halfcode 同构字段映射放在 product capsule 的普通函数，无需另建空 adapter。

命名例外限于私有 workspace root、现存 vendor-facing plugin identity、原 npm 产品名，以及六个现存 OS distribution artifact 名。后者表达选择平台的发行身份，保留并不等于确认已发布；仅凭 role 后缀无法证明改名收益，因此本次不扩展产品/native 命名迁移。它们的 observed role 仍记录为 shell，recipe 与依赖仍需整改。14 个公共复用库无此例外，全部以六种合法 role 之一收尾。三个 generated builder 无独立命名权、版本权或发布权。
