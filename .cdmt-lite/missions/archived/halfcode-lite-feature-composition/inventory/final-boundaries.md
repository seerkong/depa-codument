# 最终包边界复核（gap-1 修正后）

本表为对最终源码、安装制品和调用结果的独立重观察，不采信工作图勾选。范围为此次公共能力与两产品组合边界，不宣称所有既有模块获得全面 DEPA 认证。

## 21 个公共包的 observed role

表中省略共同前缀 `halfcode-lite-`，证据路径相对 Halfcode 主仓库的 `packages/`。

| 包 | 判定 | 观测依据 / authority 边界 |
|---|---|---|
| cli-host-contract | PASS contract | `src/index.ts`、`install.ts`、`clone.ts`：命令、IO、生命周期 ports；无产品实现依赖 |
| cli-host-logic | PASS logic | argv/schema、command table、install/clone 纯计划；clone-scaffold 中的 process/IO 文本是生成物，不是执行中的全局 IO |
| cli-host-support | PASS support，有限公开 logic 依赖 | process/file-backup/resource/clone/codex 实现 contract ports；复用纯路径裁决、命令参数和资源遍历，不拥有产品安装策略 |
| cli-host-capsule | PASS capsule | createCommandHost 按 profile 组装 owner，管理 acquire/drain/dispose；类型与运行期 conflict admission 同源 |
| cli-host-shell | PASS shell | runCli 的输入输出、exit 和格式边界；无预选产品能力 |
| skill-app-contract | PASS contract | `skill-app-contract-public/src`：descriptor/schema/port，compiler 纯合同工厂；npm version 与协议 identity 分离 |
| skill-app-logic | PASS logic | reader、Kind admission、SOP、CommandOperation、projection；无文件/网络 effect 实现 |
| skill-app-support | PASS support，有限公开 logic 依赖 | captured material/文件与 SQLite/构建平台、catalog acquisition；复用公开 schema/投影/codec，不定义第二套 reader 或产品规则 |
| skill-app-capsule | PASS capsule | createResourceHostRuntime 组合加载、catalog、definition 和 close；compatibility 只接受可信 profile，不自动承认旧 package alias |
| resource-bundle-support | PASS support | 实现 ResourceEffect；source/embedded byte parity、provenance、冲突和路径逃逸测试；无产品文件所有权 |
| resource-capsule | PASS capsule | commands/runtime 组合公开 handler 与窄 runtime；CommandOperation 使用既有投影，不建立第二 catalog |
| local-function-capsule | PASS capsule | list/detail/invoke schema、解析与显式 executor binding；不隐式获取 live owner |
| browser-support | PASS support | BrowserProvider/Codex-process ports 的 Ego/OpenCLI 等实现；测试使用假传输，不改变 OpenCLI 源码 |
| browser-capsule | PASS capsule | invoke/run-web-api/exec/profiled API 的公共命令与 adapter，产品提供 provider/config |
| page-builder-vue-support | PASS support | Vue build port、worker 和注入 SDK；vendor Vue/Vite 只进入选择它的闭包 |
| page-capsule | PASS capsule | Page/Site/PageBundle 命令与 projection；不包含 Serve/Browser owner |
| live-host-capsule | PASS capsule | Page instances/build/workflow owner；注入 effect，拥有与借用 close 区分 |
| http-shell | PASS shell | Hono routes 和 transport admission；不创建完整产品或拥有业务 catalog |
| serve-capsule | PASS capsule | serve lifecycle 和 live command factories；通过必填 ports 借用具体 server，depa 的 preflight policy 不丢失 |
| mcp-app-capsule | PASS capsule | MCP runtime + commands/stdio，借用 page/live ports；产品 EOF/identity 策略显式绑定 |
| management-capsule | PASS capsule | command factory + 安装阶段/备份事务组合；产品拥有目标路径、迁移与 status 语义 |

以上 support 对 lower logic 的依赖是公开纯 schema/codec/projection 调用，不是反向依赖本产品领域 internals。将它们机械搬成 contract 中的业务实现反而混淆角色；明确保留，并在设计中记录实际依赖细化。

## 产品选择、ownership 与依赖

- 两个 `product-capsule/src/commands.ts` 分别选择共享 factories；CLI 的 `*-feature.ts` 只绑定实际 effect 与 runtime facet。没有把 depa 的 Track/Mission/migration 放入公共包。
- CLI 仍是进程 composition root，因实例化实际 effect 而保留所用底层公开依赖；不把“manifest 只能依赖一个 capsule”作为人为规则。产品选择与通用实现不再位于 CLI 私有副本。
- `audit-boundaries.ts` 逐个 AST import/export 检查：44 个包、21 个 shared、889 个公共 import；无未声明 direct dependency、无跨仓源引用、无私有 export、无 DAG 环、无 shared→product 反向边。发现并补齐了 depa product-capsule 的 cli-host-contract direct dependency。
- 精确 exports 和 JS+d.ts 对照真实 tarball；第三消费者没有 Browser/Serve/MCP/Vue/Hono/Vite 依赖。不能用 dynamic import 伪装依赖隔离。
- APP scoped facade 是兼容边界，不属于新公共发布集合；无主产品 canonical import。其旧 fingerprint 由自身测试保留，删除前须调查其他外部消费者，最迟下个 stable release 前复核。

## 吸引子排除集的可证伪检查

| 排除集 | 负向检查 |
|---|---|
| 两份公共命令 / 第二 catalog | 产品组合导入同一 factories；PageWorkflow/PageObject/Serve/Agent 通用协议与结果转换来自公共 page-live-client / agent-client；fake transport 与两产品完整调用回归；duplicate command/operation tests。两个 legacy/production 树由同一产品 factory 派生，不是第二套 authored command authority |
| optional 全集或强转掩盖缺能力 | feature-types + production-profile-types 编译实际 profile 缺口/错配；PRODUCTION_COMMANDS 使用 required union，静态 requireResourceFeature 拒绝原 empty 反例；真实 clone 缺 SOP 的 producer 无法编译。动态 policy admission 的经验证判别强转不用于伪造 runtime 能力 |
| 兄弟源码或未选能力强依赖 | 独立 tarball realpath/manifest/closure 检查；minimal consumer forbid 集 |
| 静默覆盖或仅更新 help | duplicate command/Kind、资源碰撞/逃逸 fail closed；源码与 standalone binary 实际 Resource/SOP 调用 |
| 每 App 复制 Kind / 安装拼文本 | 两产品默认安装都检查无标准 KindDefinitions；Halfcode 14 定义转显式夹具，source/embedded 字节与 depa 固定 global App 不变；最小产品 reader 只选 SkillApp/SOP，未选 Page admission 失败 |
| 仅 help/build 通过或破坏旧安装 | source tarball 的实际命令、embedded 构建与历史 backup/noop；新增真正 npm/Bun launcher→payload→命令验收、缺 optional 失败、PATH 唯一 bin；全局摘要前后相同 |

## 数据 authority 与生命周期

源码 manifest/模板是 versioned repository authority；包制品是不可变发行投影；安装目录、catalog 和 CLI receipt 是派生。安装与迁移通过产品受控入口写入，备份可恢复，reader lock 漂移 fail closed。既有 actor 的 owner/borrowed lifecycle 已由 runtime 测试覆盖。事件溯源/响应式图 profile 未因本次包重构而激活，不据未采用这些模式判 GAP。
