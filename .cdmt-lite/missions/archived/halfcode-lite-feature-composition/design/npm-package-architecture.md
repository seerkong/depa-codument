# npm package 级目标架构与 Sparrow / ACE 对应矩阵

状态：用户已授权实施的目标设计，非已完成包清单。本文是本 mission 的目标包/API/依赖设计真源；[architecture.md](architecture.md) 保留系统层决策，[package-disposition.md](../convergence/package-disposition.md) 记录迁移处置，实际进度见 loop.md。

## 1. 怎么理解对应关系

下面使用真实 npm package 名，不将目录名当包名。参考事实来自三个仓库当前 `packages/*/package.json` 和 `src/index.ts`；archived mission 只说明设计意图。

- **职责对应**：有相同架构位置，不意味着协议相同、API 相同或直接依赖参考包。
- **分布式对应**：参考方一个包的职责，在 Halfcode 由数个已有 role 包完成；不为凑一对一合并它们。
- **无直接对应**：本项目已有但参考方没有同等产品能力，明确标注，不虚构参考包。
- 本次不增加 ACE/Sparrow npm 依赖，仍保留 Halfcode XNL 协议。`halfcode-compiler.xnl` 保持其既有独立包身份。

## 2. 目标包的 owner 与发布分类

| 类别 | 源码 owner | 发布设计 | 谁消费 |
|---|---|---|---|
| 中立 host / 协议 / effect 支持 / feature capsules | Halfcode Lite 主仓库 | 无 scope 公共 `halfcode-lite-*`，不是 private scope | Halfcode 产品、depa、未来其他 CLI |
| Halfcode 默认产品组合与资产 | Halfcode Lite 主仓库 | `halfcode-lite-product-capsule` 可发布但可选；bin 单独发行 | Halfcode 自身，不作为 depa 必需底座 |
| Codument 业务与产品组合 | depa-codument/project | 保留既有 `depa-codument-*`，是否发布延续既有策略 | depa 产品；不因公共底座重构而归入 Halfcode |
| CLI build entry、资源源码、测试夹具 | 各自产品仓库 | 内部 workspace，不当公共 library 发布 | 构建与验收 |
| 产品 npm launcher / 平台二进制包 | 各自产品仓库 | 面向用户安装；只提供 bin，不提供通用库 API | 用户安装 |

这是发布边界设计，尚不授权 npm publish。公共库发布 compiled JS + `.d.ts`，不能像某些参考包的当前 exports 一样要求消费者直接编译 `src/*.ts`。内仓可用 workspace 开发，打包后依赖须变成真实版本，不能残留跨仓 `file:` 或 `workspace:*`。

## 3. 公共底座包：保留而不是重新造 skeleton

下表的依赖是**目标直接内部依赖**，未列 vendor；不等于当前所有 package.json。只允许 public exports。`C/L/S/A` 在表内代表 `halfcode-lite-cli-host-contract/logic/support/capsule`；`RC/RL/RS/RA` 代表 `halfcode-lite-skill-app-contract/logic/support/capsule`。

| 目标 npm package | 拟公开面与拥有职责 | 目标直接依赖 | 与真实参考包的对应 |
|---|---|---|---|
| `halfcode-lite-cli-host-contract` | CommandDefinition/Schema/Context、identity、executionPolicy、lifecycle/process/install ports；不含具体 IO | 无内部实现包 | `@ks-ea-ace/ace-rt-skeleton` 的 command contract；`@ks-ea-ace/ace-rt-host-capsule` 的部分 host ports（拆分对应） |
| `halfcode-lite-cli-host-logic` | parse/resolve/execute/admission、不可变命令树组合与冲突检查、clone/install 纯计划 | C | `@ks-ea-ace/ace-rt-skeleton` 的 dispatcher/schema；`@ks-ea-ace/ace-rt-extension` 的 command-table（拆分对应） |
| `halfcode-lite-cli-host-support` | process/fs/backup/shutdown/HTTP client/agent-host 的具体 effect bindings；不决定产品策略 | C；必要 codec 先归 contract/adapter | `@ks-ea-ace/ace-rt-host-capsule` 的 effect 部分；`@ks-ea-ace/ace-rt-management-capsule` 的 install IO 部分 |
| `halfcode-lite-cli-host-capsule` | createCommandHost、按 profile 创建 runtime、drain/dispose、scope 与所有权 | C、L；具体 bindings 从参数注入 | `@ks-ea-ace/ace-rt-skeleton` 的命令 host + `@ks-ea-ace/ace-rt-host-capsule` 的生命周期组合（部分对应） |
| `halfcode-lite-cli-host-shell` | runCli、argv/global options、help/result/error/exit-code 输出；无 feature 默认集合 | C、L、A | `@ks-ea-ace/ace-rt-skeleton` 的 CLI 表面；ACE/Sparrow CLI 的中立启动部分 |
| `halfcode-lite-skill-app-contract` | XNL-facing App/Resource/Kind/FQN/catalog/runtime effect/definition/LocalFunction/Page 等标准类型和协议子路径 | `halfcode-compiler.xnl` 的公开协议面 | `@ks-ea-ace/ace-rt-resource-contract` + `@ks-ea-ace/skill-app-standard/contract` + `@ks-ea-ace/skill-app-sdk` 的 definition types；语法不同，不替代其协议 |
| `halfcode-lite-skill-app-logic` | canonical reader/admission、projection/FQN、SOP/CommandOperation 规则、configuration/definition dispatch、扩展贡献验证 | RC、C、必要公开 L、既有 compiler | `@ks-ea-ace/skill-app-standard` 的规则面；`@ks-ea-ace/ace-rt-resource-capsule` 的 catalog 规则；`@ks-ea-ace/ace-rt-extension` 的 Kind/capability admission；`@ks-ea-ace/ace-rt-data-capsule` 的部分配置/读取规则 |
| `halfcode-lite-skill-app-support` | source/embedded 加载、materializer、文件目录/SQLite/config IO 等 effect 实现；页面专用 support 通过子路径和 feature 显式选择 | RC、必要 C、compiler acquisition API；不得反向依赖领域规则 | `@ks-ea-ace/fs-resource-tree` 的 acquisition 职责 + ACE resource/data capsules 的 IO 部分；保持 XNL 而非复制 FS-native 实现 |
| `halfcode-lite-skill-app-capsule` | createResourceHostRuntime，统一 catalog/definition/SOP owner 和关闭边界；注入具体 materializer | RC、RL、RS | `@ks-ea-ace/ace-rt-resource-capsule` 的 resource runtime 组合部分 |
| `halfcode-lite-resource-bundle-support` | 新提取：版本化资产输入、source/embedded ResourceEffect、确定性覆盖/重命名及 install material 输出；不拥有 Codument 文本 | RC、C；调用已有资源 effect，避免新写 dispatcher | `@ks-ea-ace/ace-rt-resource-bundle-support`；归档方案 resource-skill-composition 的资源供应/构建面 |

明确处置：现有 `halfcode-*-cli-shell` 与 `cli-host-shell` 的中立能力合并到后者。实施重观察确认前者已有真实产品 dialect：命令相关 agent 参数、历史 JSON 解析与 help 路由；它调用公共 runCli/host，不拥有第二 dispatcher。因此保留为产品 shell，而不是给中立 shell 添加 Halfcode 特判；未来废弃 dialect 须另行批准。新增 resource-bundle-support 提取的是现有 product/resources 与资源构建机制，不复制一份新实现。

`skill-app-logic/support` 的包内公开子路径不等于依赖隔离。必须保证基础 root exports 不静态导入 Browser/Serve/Vue/MCP 实现；feature-specific vendor 不进入基础 package dependencies。确实无法隔离的实现应迁入下表已有的 feature 包，而不是用 dynamic import 掩盖安装依赖。

## 4. 公共 feature 包：命令和运行能力同源

这些是本方案建议的明确 npm 边界，不再写“某 capsule 或某子路径任选”。既有包保留，新包只提取已存在的能力，不增加未有的产品功能。公共 API 名是目标协议草案，实施时由类型探针验证。

| 目标 npm package | 拟公开 API / runtime facet | 目标直接内部依赖 | 参考项目对应包 |
|---|---|---|---|
| `halfcode-lite-resource-capsule`（新） | createResourceCommands/createSopCommands/createCommandOperationCommands；ResourceFeatureRuntime 需要一个借用的 ResourceHost，读取/路径/XNL 返回及 Kind verb factory | C、L、RC、RL、RA；不依赖 live/browser | `@ks-ea-ace/ace-rt-resource-capsule` 的 command factories；SOP/CommandOperation 无完整一对一对应，Halfcode 自有标准能力 |
| `halfcode-lite-local-function-capsule`（新） | createLocalFunctionCommands、typed invocation/admission、LocalFunctionFeatureRuntime；默认本地执行，通过注入 capability 扩展 | C、RC、RL、RS、RA | `@ks-ea-ace/ace-rt-local-function-capsule`；能力扩展 admission 部分对应 `@ks-ea-ace/ace-rt-extension` |
| `halfcode-lite-browser-support`（已有） | Ego/OpenCLI 等具体 browser port bindings，明确 owner/borrowed close；不拥有 command table | C、S、RC 中有关 browser effect ports | `@ks-ea-ace/ace-rt-browser-capsule` 的 vendor/effect 实现部分 |
| `halfcode-lite-browser-capsule`（新） | createBrowserCommands、invoke/run-web-api/exec factories，BrowserFeatureRuntime；选择既有 support，不绑 Serve | C、L、RC、RL、browser-support | `@ks-ea-ace/ace-rt-browser-capsule` 的 commands/runtime 组合部分；BrowserWebApi 与 ACE 数据/API 接口仅部分对应 |
| `halfcode-lite-page-builder-vue-support`（已有） | Vue builder worker、build diagnostics、Page SDK Vue 入口；仅页面构建者选择 | RC；Vite/Vue vendor | `@ks-ea-ace/skill-app-sdk/build`、`/frontend` 的部分构建/前端职责；没有相同 Vue builder 包 |
| `halfcode-lite-page-capsule`（新） | createPageInspectionCommands、Site/Page/PageBundle 的 catalog/projection、PageFeatureRuntime；运行期能力显式注入 | C、RC、RL、RA；不必直接依赖 browser/serve/builder | `@ks-ea-ace/ace-rt-page-capsule` 的页面投影/definition 部分；不是复制 ACE 的全部 browser/host 依赖 |
| `halfcode-lite-live-host-capsule`（已有） | Page instances/generation/build/control/workflow owner，live runtime 与关闭；builder/browser materializer 由 bindings 注入 | C、L、RC、RL、RS、RA | `@ks-ea-ace/ace-rt-page-capsule` + `@ks-ea-ace/ace-rt-serve-capsule` 的 live runtime 所有权部分 |
| `halfcode-lite-http-shell`（已有） | Hono HTTP routes、transport adapter、live/resource 请求 admission；不私自组装整个产品 | RC、RL，借用注入的 live ports | `@ks-ea-ace/ace-rt-serve-capsule` 的 HTTP 表面；Halfcode 按 role 单独分包 |
| `halfcode-lite-serve-capsule`（新） | createServeCommands、ServeFeatureRuntime、server process/lifecycle、PageWorkflow/PageObject live verb factories | C、L、S、RC、live-host-capsule、http-shell；页面/browser 能力从产品绑定 | `@ks-ea-ace/ace-rt-serve-capsule` 的启动/管理/命令部分 |
| `halfcode-lite-mcp-app-capsule`（已有扩展） | MCP Apps runtime + createMcpAppCommands；借用选中的 Page/live capabilities | C、RC；MCP vendor；live 不作为必需静态依赖 | 无直接同等 ACE/Sparrow 包；这是 Halfcode 已有可选能力 |
| `halfcode-lite-management-capsule`（新） | createManagementCommands/createInstallationCapability；init/upgrade/status 通用机制、asset copy/backup/admission；product policy 必须注入 | C、L、S、resource-bundle-support；无 live/browser | `@ks-ea-ace/ace-rt-management-capsule`；只共享机制，不共享 Codument workspace migration 语义 |

SOP 与 CommandOperation 留在 resource-capsule，不为两个相关资源命令建立额外 shell/contract 包。Browser 的 IO 与命令 capsule 分开，live 与 HTTP 分开，是因为已存在的 effect/owner/协议边界，不是为了每组凑六个包。

### 参考能力没有独立照搬包的情况

| 参考 npm package | 本方案落点 | 原因 |
|---|---|---|
| `@ks-ea-ace/ace-rt-extension` | command-table 在 cli-host-logic；Kind/capability contributions 在 skill-app-logic；公开 contract 归对应 contract 包 | 三类 authority 不合成万能 extension；不新增重复 registry |
| `@ks-ea-ace/ace-rt-data-capsule` | configuration/database/resource read contract/logic/support 子路径，加 resource/local-function/browser feature 的实际调用面 | 本次不引入 ACE BaaS/OpenAPI 全集，Halfcode 现有能力按其 effect 边界组装 |
| `@ks-ea-ace/ace-rt-authoring-capsule`、`@ks-ea-ace/skill-app-authoring` | 现有 skill-app-logic 的 authoring/admission + support materializer + 产品 authoring policy；若将来暴露独立 authoring CLI 再单独立包 | 不能仅因参考方有包就新增当前没有的命令产品 |
| `@ks-ea-ace/ace-rt-app-sdk`、`@ks-ea-ace/skill-app-sdk` | skill-app-contract 的 code-first 定义面 + 既有 support materializer + page-builder-vue-support | code-first/resource-first 继续融合；本次不新建空 SDK wrapper |
| Workbench `@ace-workbench/*` 私有 authoring/build/release/publishing/devops/capsule | 现有 Halfcode release/build scripts 与产品构建策略，必要公共机制从已有 support 复用 | Workbench 是独立工程产品，不把其完整产品治理包搬进 CLI runtime |

## 5. 产品包和 depa 业务包的逐项对应

| 目标 package / 内部单元 | 公开职责与直接依赖边界 | 参考项目对应 |
|---|---|---|
| `halfcode-lite-product-capsule` | 可选的 Halfcode 完整默认组合、authoring policy、默认资源；依赖本产品明确选中的 feature capsules，不反向被基础 feature 依赖 | ACE 内部 `ace-rt-host` 的默认产品 assembly、`ace-rt-logic` 的产品规则部分（职责对应，不复制其 mixed role） |
| `halfcode-lite-cli`（private workspace） | build/bin entry，调用 product-capsule + cli-host-shell；不再含第二份通用 commands | `@ks-ea-ace/ace-rt-cli` 中的产品入口；其发布包另见下文 |
| `depa-codument-domain-contract` | Track/Mission/Acceptance/Hook/GapLoop/迁移输入输出与 repository ports；依赖 canonical RC，非 Halfcode 产品 | `sparrow-fabric-contract` + `@ks-ea-ace/ace-rt-ai-agent-contract` 的“产品自有契约”位置；业务语义不同 |
| `depa-codument-domain-logic` | Codument lifecycle/frontier/validation/gap/registry 规则；只依赖 domain-contract 与纯公开规则 | `sparrow-fabric-logic` 中自有规则 + `@ks-ea-ace/ace-rt-ai-agent-logic` 的位置；后者仅类比非直接替代 |
| `depa-codument-domain-support` | 文件 repository、验证 effect、事务/备份；依赖 domain-contract 与公开支持 API，不依赖领域内部规则 | Sparrow host adapters 的 IO 边界，**无单个一对一 support 包**；禁止为对齐而改成 adapter-codex |
| `depa-codument-domain-capsule` | createDomainOwner、lifecycle actor 及 processor 组合；依赖 domain-contract/logic、bindings 注入 | `@ks-ea-ace/ace-rt-ai-agent-capsule`、`@ks-ea-ace/ace-rt-workflow-capsule` 的自有能力组合位置 |
| `depa-codument-host-adapter` | Codument command/资源形态适配公共 host；createCodumentDomainCommands，必要 Codument Kind contributions；依赖 domain-contract/logic + C/RC/RL 公开面 | Sparrow 自有 feature 的 command factories、`ace-rt-workflow-host` 的边界转换职责（分布式对应） |
| `depa-codument-product-capsule` | 选择公共 resource/local-function/browser/page/serve/MCP/management；装配 domain owner 与 global/project App；公开 `createCodumentProduct`，可分 `/local`、`/live` 实际组合入口 | `sparrow-fabric-logic` 的 createSparrowShell/createSparrowCommands 产品组合部分 |
| `depa-codument-cli-shell` | Codument-specific presentation/identity；依赖 product-capsule 与 cli-host-shell，不能再提供通用 dispatcher | `@ks-sparrow/sparrow-fabric-cli` 中的产品 CLI 表面 |
| `depa-codument-cli`（private workspace） | 最终 compiled bin entry/资产构建；依赖 product capsule + shell，当前通用 commands 迁出 | Sparrow 产品 bin/build entry；不能重复上表 shared feature 实现 |
| `depa-codument-skill-app-contract`（兼容过渡） | 若只是同构转发，消费者迁到 RC 后退役；真正 Codument definitions 归 domain-contract；过渡阶段 exports 不破坏 | **无必要的新参考包**；不能将兼容 facade 当独立 protocol authority |
| `depa-codument-mcp-app-capsule`（兼容过渡） | 目前 public 转发包；内部消费迁到 Halfcode MCP capsule；确有外部 consumer 才留 deprecated wrapper | 无直接对应；不双侧维护 MCP |
| `depa-codument-page-builder-vue-support`（兼容过渡） | 同上，迁到公开 Halfcode builder；产品特有配置注入，不复制 builder | 无直接对应；不双侧维护 Vue build |
| depa global SkillApp 资产、project codument/ seed | 继续在 depa 拥有完整源码，通过 resource-bundle-support 组合/打包；不是动态生成的新 npm wrapper | Sparrow 产品 resources/skills input + resource bundle composition；资产不是业务 contract |

Sparrow 私有 `@ks-ea-ace/ace-rt-ai-agent-adapter-codex/myflicker/grokbot` 表明“谁执行适配，谁拥有 adapter”；它们不是所有下游产品必须新增的包。Codument 没有本次需求下的对应 vendor-agent 调用能力，不照搬其包名或功能。

## 6. npm 安装产品与平台包

| 目标 npm package | 定位 | 参考对应 | 依赖规则 |
|---|---|---|---|
| `halfcode-lite` | 用户安装入口，bin `halfcode-lite`，无 library exports | `@ks-ea-ace/ace-rt-cli` 的 npm binary 产品 | optionalDependencies 选择平台包；公共 API 由上述 library packages 提供 |
| `halfcode-lite-darwin-arm64` | 该平台 compiled executable + 必需资产 | `@ks-ea-ace/ace-rt-cli-arm64`（平台策略非完全相同） | 不引入 product 的 TS 源码 workspace；构建工具与真正运行依赖分开 |
| `halfcode-lite-darwin-x64` | 同上 | `@ks-ea-ace/ace-rt-cli-x64` 的对应职责 | 同上 |
| `halfcode-lite-windows-x64` | 同上 | 当前 ACE 清单无同等 Windows 包 | 同上，保留 Halfcode 已有平台支持 |
| `depa-codument` | 用户安装入口，bin 只有 depa-codument | Sparrow 的产品发行职责；不假设其 private workspace 已作为 registry 包发布 | 选择现有 depa 平台包；不安装或覆盖旧 codument bin |
| `depa-codument-darwin-arm64` / `depa-codument-darwin-x64` / `depa-codument-windows-x64` | 保留既有三个 npm 平台包，不随 Halfcode 身份改名 | 对应上述 Halfcode/ACE 平台发行职责；不是可复用业务包 | compiled bin 与 depa 资产闭包；公共支持包版本真实可解析 |

上表入口包是目标发行模型，现有打包脚本若尚未生成 launcher，实施需验证再迁移，不将目标 package 描述为已经发布。平台包里当前携带 Vue/Vite 等依赖需逐项确认是运行构建还是构建期依赖，不能一刀删除。

## 7. 目标依赖 DAG 与按需选择

```text
cli-host-contract → cli-host-logic → cli-host-capsule → cli-host-shell
        ↑                 （以上箭头表示依赖的构建层次：右侧依赖左侧）
skill-app-contract → skill-app-logic / skill-app-support → skill-app-capsule
                 └→ resource-bundle-support → management-capsule

resource-capsule      ← resource host + narrow command contracts
local-function-capsule ← resource host + local execution support
browser-capsule       ← browser-support + browser contracts
page-capsule          ← resource host + page projection rules
live-host-capsule     ← resource host + injected build/browser bindings
http-shell            ← borrowed live ports
serve-capsule         ← live-host-capsule + http-shell + process support
mcp-app-capsule       ← MCP support + borrowed Page/live ports

Halfcode product-capsule ← 选中的公共 capsules + Halfcode 自有资产
depa product-capsule     ← 选中的公共 capsules + depa domain/host-adapter/资产
各 product bin          ← 自己的 composition + 公共 cli-host-shell
```

依赖边以 §3–§5 表为准；上图只用于显示层次，不引入所有 feature 彼此强依赖。禁止 resource/local-function/management 反向依赖 live/serve/browser/product。任何公共 package 的 dependencies 都会被 npm 安装，不能仅靠“不开启功能”证明裁剪成功。

### 三个消费者的 package.json 设计

- 最小 CLI：直接依赖 cli-host-contract/capsule/shell、resource-capsule、skill-app-capsule/contract/support、resource-bundle-support；不引入 product-capsule、browser-support、live-host、Serve、MCP、Vue。真实 lock 闭包验证这一点。
- Halfcode 完整产品：自己的 product-capsule 显式依赖选中 feature 集合，组装默认效果/资产；build scripts 可有 devDependencies，运行 dependencies 不带测试/authoring 工具全集。
- depa 完整产品：自己的 product-capsule 显式依赖公共 features 与自有 domain-* / host-adapter。最外层 CLI 不直接依赖所有底层包；配置和 policy 从产品注入，不从 Halfcode product-capsule 复制默认值。

例如目标组合调用关系为 `createResourceCommands<ResourceAndDomainRuntime>()` + `createCodumentDomainCommands<ResourceAndDomainRuntime>()` → 公共命令表组合 → `createCommandHost` → `runCli`。这几个调用不是再生成一份实现；缺失 Resource/domain facet 的实际 runtime 必须编译失败。

## 8. 包 exports、版本和验收合同

- 每个公共包公开 Boundary / Not Owned Here、入参 runtime、输出、owner/close 与允许依赖；contract 不 export support 工厂，feature 不能通过 `src/*` 内部路径取其他包实现。
- root export 不把可选 feature 拉进基础闭包；协议类型重导出也要核对运行时 import。公用 root 和 `./commands` / `./runtime` / `./build` 等 subpath 明确用途；不使用无限通配 exports 暴露 internals。
- 编译产物独立，types 与实际 JS 一致。打包包含公开 `.d.ts`、JS、必需资源及 metadata；不包含 sibling source、node_modules、临时验证根或 secret。
- 内仓 workspace 依赖只用于开发，tarball metadata 的公共内部依赖变成精确兼容版本；每个新 identity 有真实新制品与 integrity。旧 wrapper 的兼容期限由实际 consumer inventory 决定。
- 本次不靠包名迁移自动升级 XNL contract revision；version matrix 单列 npm package version、产品 binary version、compiler/spec revision 和最小 compatible consumer。
- 包级负向验收：依赖 DAG 无环/禁反向边；最小 consumer lock 无 browser/serve/MCP/Vue；每个 feature 类型缺失负例；公共命令无重复私有实现；未知 Kind 与 override fail closed；packed artifacts 可独立消费。
- 产品验收：两个 binary 命令基线、global SkillApp 字节一致、临时历史 workspace 迁移、source/embedded 资源调用。不能用 npm pack/build/help 代替实际消费。

## 9. 从当前包到目标包的迁移批次

1. 保留改名底座/支持/现有 capsules；cli-shell 与 scoped wrapper 先过渡，分别记录 consumer，不能立即破坏性删除。
2. 提取 resource-capsule 和 resource-bundle-support；公共 SOP/CommandOperation 与资源文件 provenance 测试先闭环。
3. 提取 local-function、browser、page、serve、management capsules；MCP 在现有 capsule 增加命令公开面。每批同步定义 dependencies、exports、facets、assets 和独立 consumer 证据。
4. 两产品 product-capsule 组装迁移；depa 原通用 command/runtime 副本删除；产品领域 retained，wrapper 按兼容清单处理。
5. 打包全部真实 npm 制品并验证最小/完整/depa 三个消费闭包；随后才讨论发布和全局切换。

如果实际抽取发现某一目标包的 effect/dependency 边界不能成立，需要在本文件明确修订和记录理由；不能执行时默默又退回“复制通用代码到产品”。

## 10. 实施证据驱动的依赖细化

本节取代上表依赖草案中更宽的推测；包职责和 Sparrow/ACE 对应关系不变。完整 actual import/exports 检查见 `verification/audit-boundaries.ts` 与 [最终边界复核](../inventory/final-boundaries.md)。

- `cli-host-support` 明确依赖 cli-host-logic 的公开纯路径/参数/遍历规则；`skill-app-support` 依赖 skill-app-logic 的公开 admission/codec/projection。这些不定义新 authority、无反向 internals，不为消除箭头而把实现塞入 contract。
- resource-capsule 使用 contract + cli-host-logic + skill-app-logic/support，借用 resource host，不依赖其具体 capsule 构造。
- local-function-capsule 与 serve-capsule 只依赖 cli-host-contract/logic、skill-app-contract；实际 executor/server 通过必填 ports 提供，不额外静态依赖 live/http。
- page-capsule 依赖 cli-host-contract/logic、skill-app-contract/support 的公开 catalog 投影；不绑定 live owner。
- browser-capsule 的 profiled API 复用 skill-app-logic/support；浏览器 provider 来自明确 binding。
- resource-bundle-support 只需 cli-host-contract/support，不需要 skill-app-contract；management-capsule 的事务组合只需 cli-host-contract/logic/support，不强制附带资源供应包。
- 产品 CLI 作为最终进程 composition root 仍直接引用创建 effect 所需的公开包。产品 command selection 归各自 product-capsule；不能为了 manifest 好看创建空透传层。目标公开 `createCodumentProduct` 具体落为 typed `createCodumentProductCommands` 加已有 domain/resource/live 构造入口，而非新增万能 runtime 袋。
- 当前 resource authority 为用户明确批准的 `@halfcode-lite/skill-app-contract/resource-contracts/v1`，对应 npm 包仍为 `halfcode-lite-skill-app-contract`。旧 CLI/APP 的合同生成及 hash 兼容测试独立保留，reader profile 与 FQN 不机械重命名。
