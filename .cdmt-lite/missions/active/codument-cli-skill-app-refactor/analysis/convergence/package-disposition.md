# 目标包处置

历史方案说明（2026-09-05）：以下是本仓抽取阶段的 dated 处置。最新用户要求将通用包归回 Halfcode 并采用 halfcode-cli-lite-*，因此下述通用包的最终归属与名称已被 [跨仓库分析](../cross-repo-host/manifest.md) 覆盖；保留本文供已有实施证据回溯，不再据此扩大本仓通用包实现。

全部实现先留在 `project/packages/`。下面的名字是待确认方案，均无 npm scope；具体目录可以简写，package basename 以 role 收尾。目标是有真实职责的边界，不按每一条命令复制六包。

| 目标 npm 包 | role / Owned here | 来源与处置 | Not owned here |
|---|---|---|---|
| depa-codument-cli-host-contract | contract：命令、Host identity、runtime ports、workspace/template/process/HTTP/browser/build port 类型 | CLI contracts 中稳定类型、effects 中 port 提升；ADD-CONTRACT | parser、fs、具体 provider、Codument 状态 |
| depa-codument-cli-host-logic | logic：argv/schema 校验、命令解析、通用安装/生命周期计划、输出数据投影 | command-registry/contract parser/lifecycle 的纯规则；SPLIT | 终端输出、process exit、默认品牌 |
| depa-codument-cli-host-support | support：workspace/template/file/process/HTTP/配置读取能力 | effects/workspace/resource、serve/filesystem/notebook store 等 IO；RELOCATE | 产品 lifecycle 决策、Kind owner 裁决 |
| depa-codument-skill-app-contract | contract：App/Module/bundle/Kind/版本、source closure 和 authoring descriptors | 原 contract 收紧；RETAIN | admission 执行、文件扫描、Codument Kinds |
| depa-codument-skill-app-logic | logic：catalog/admission/materialization/SOP/config 规则和 typed readers | resources/*、sop/*、LocalFunction/Page registry 中规则；SPLIT | 直接文件/网络/动态 import 实现、产品路径 |
| depa-codument-skill-app-support | support：compiler binding、source IO、动态 module loader、bundle build/cache 实现 | materializer/source closure 的 effect 实现；SPLIT | 第二份 compiler/schema、产品特例 |
| depa-codument-browser-support | support：现有 ego/opencli/mdd provider 和会话/进程实现 | browser effects、supervisor；RELOCATE | 每种业务 App 的决策、默认启动浏览器 |
| depa-codument-page-builder-vue-support | support：PageBuilder port 的 Vite/Vue 实现 | 原 page-builder-vue；RELOCATE/rename | Page/SkillApp membership authority |
| depa-codument-mcp-app-capsule | capsule：MCP App 配置、catalog、server 的真实组合入口 | 原 mcp-app 内部 contract/logic/support；RELOCATE，收敛 public API | product-specific 调用、CLI 参数/终端出口 |
| depa-codument-cli-host-capsule | capsule：组合 discovery/readers/materializers/SOP/providers/Serve | createCommandRuntime 拆后的 composition；SPLIT | product Kinds、产品默认目录、CLI 最外层 |
| depa-codument-cli-host-shell | shell：通用命令集适配、CLI/stdio 呈现与 runCli 入口 | 通用 commands/output/index 协议部分；SPLIT | 产品 COMMANDS、正式领域 state transition |
| depa-codument-domain-contract | contract：Codument Kinds/schema/versions、资源、生命周期/registry/migration ports | 旧 Kind/track/mission/config/registry 契约；ADD-CONTRACT | 通用 Host 原语、语义推理、IO |
| depa-codument-domain-logic | logic：生命周期/DAG/merge/frontier/校验/migration 纯转换、上下文投影 | 旧 src/cli 的领域规则；SPLIT | process.cwd/chdir/fs、通用 Host shell |
| depa-codument-domain-support | support：备份、原子文件事务、verification process/receipt、archive/sync | 旧领域 filesystem/Git/process 实现；SPLIT | schema 重复定义、AI 语义裁决 |
| depa-codument-domain-capsule | capsule：领域操作构造与统一受控入口 | 旧领域入口重新组合；ADD | CLI 终端协议、通用 Host 的自注册特例 |
| depa-codument-cli-shell | shell：产品 identity、Kind/command/template/provider 注册和旧命令兼容 | 原 project CLI entry + 旧 product registry adapters；REPLACE | 领域算法、独立旧 runtime |

browser/MCP/Vue 的细粒度内部拆包由实际公共边界驱动，当前不为各 provider 预建 contract/logic/capsule 三件套。HTTP 和通用文件 ports 有不同 runtime facets，首批可同包公开子入口；只有独立依赖闭包、生命周期或打包压力有证据时再分包。

## 依赖方向

- host-contract 与 skill-app-contract 是通用契约底座；通用逻辑/支持依赖公开 contracts。skill-app-logic 需要 host 的读写能力时使用 host-contract，不能 import host-capsule。
- domain-contract 可以引用通用资源 contract；domain-logic 依赖 domain-contract 和必要的纯 resource API；domain-support 实现 domain ports，可复用公开 host/skill-app supports。
- cli-host-capsule 组合通用 logic/support 和按需的 browser/MCP/Vue 能力；由输入 registrations 决定 profile、sources 和 command capability，无 Codument import。
- domain-capsule 组合 domain logic/support；product cli-shell 组合 host/domain capsules，注册产品命令和内置 Kinds。
- cli-host-shell 接收已构造的 runtime/commands；product cli-shell 复用它。所有跨包 import 只触 exports，禁止 `../另一包/src`、tsconfig paths 偷渡或导出 internals。
- 同一进程多 Host 实例的 workspace root、registry、cache、session 独立；共享静态 schema 可 immutable 复用。

## 公共构造协议草案（待实现，不是当前 API）

`createCliHost(runtimeBindings, hostDefinition)` 返回资源读取、命令调度所需的实例能力与显式 dispose。`hostDefinition` 为 identity、source declarations、版本选择等数据；可执行 readers/commands/providers 放在 bindings/registrations，避免函数藏入静态 config。

`createCodument(runtimeBindings, domainConfig)` 返回受控 domain operations；命令 adapter 把 CommandContext 转为 `(runtime, input, config)` 并映射 CommandResult。

`runCli({ argv, host, commandRegistrations, outputPorts })` 是外部 shell。`process.exit`/stdout/stderr 只在真正外部边界执行。

## 发行身份

- 保留 npm 产品入口 `depa-codument` 和两个 bin，作为明确的历史发行名例外；该薄入口只委托 `depa-codument-cli-shell`。
- `project/` private root 只做 monorepo 管理；执行时为产品发行入口安排独立 package，避免以 private root 误当发布物。
- 平台分发包计划采用 `depa-codument-darwin-arm64-shell`、`depa-codument-darwin-x64-shell`、`depa-codument-windows-x64-shell`；只是可执行 packaging shell，无领域逻辑。
- 现 clone 0.1.0 版本、Skill App contract 2.0.0、产品 0.5.4 不强行同步。writer/reader version 按 contract 演进，发行版本独立。
- 通用包验收通过本地 pack/install，不需要购买 scope 或实际 publish。source `.ts` 入口若保留，Bun runtime/engines 必须明确且依赖完整；不能依赖 monorepo hoist 才能运行。

## 拆分顺序

先 types/ports 和单命令垂直切片，再 resource loading 和可执行能力，随后产品领域迁移。全过程只有一条选定的新 dispatch/runtime 路径；旧源码作为测试/迁移参考，不作为新包运行依赖。
