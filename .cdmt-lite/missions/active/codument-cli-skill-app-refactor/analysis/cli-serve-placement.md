# CLI / Serve 职责：增量观察

观察日期：2026-09-05。Scope=package，针对 command→runtime→effect 的模块抽样。只读分析，不代表已实现或通过行为验收。执行状态仍只在 [loop.md](../loop.md)。

## 用户新增约束

- `init`、`status`、`upgrade-workspace` 暂不合并，核心重构后另行讨论；不以改名、加 `host` 前缀或自动组合绕过暂停。
- 正式工作区目录始终为 `workspace/codument/`；Host 私有目录不是替代 App 根。
- 产品主要功能在 CLI 执行，仅确需长期状态的少数功能经过 Serve；参考 Omni 思路，不复制其具体平台依赖。

## Omni 参考及证据边界

外部只读来源：`/Users/kongweixian/work-repos/omni/omni-cli/codument/missions/active/minimize-omni-cli-serve-responsibilities/{proposal.md,design.md,mission.xnl}`。

可借鉴：叶子 command+verb placement、local 与 serve-required 分离、先 catalog preflight 后执行、Server 复验、Catalog/Execution/Page runtime 分层、惰性构造与关闭、常驻调用不可静默本地降级。

不可照搬：Omni 的 YAML、ACE/BaaS token、`--skill-app` 参数、Browser backend 名称、通用 `/api/commands/resource` transport。此项目未提供等价入口的地方不应为了模仿而新增功能。

额外抽样了 Omni 实际 `packages/omni-cli-shell/src/cli/runtime/serve-command-transport.ts`：当前 `LOCAL_FUNCTION_REQUEST_CAPABILITIES` 已含 `openApi/database`，与 mission design 第一版“这两项留 Serve”不同；`BrowserFunction invoke` 也已直接 local。因此采用生命周期判定原则，不把其规划表或 completed 字段当最终实现证明。没有运行 Omni 的测试，也不声称审计其整个重构。

## 本项目真实起点

下列路径均相对本仓库根。

| 入口 / 能力 | 已观察的执行路径 | 改造含义 |
|---|---|---|
| `Resource tree/validate`、多数 Kind `list/detail/validate` | `project/packages/cli/src/cli/commands/resource.ts` 直接调用 resource/definition catalogs | 已本地，不存在 Omni 那种整类 HTTP 转发需要先删除；补无 Serve 依赖合同 |
| SOP 查询/graph/notebook | `commands/sop.ts`、`commands/sop-notebook.ts` → 注入 SOP port | 保持本地；notebook 是显式文件写入，不是必须常驻的 Workflow state |
| `Page list` | `commands/page.ts` 读取 `runtime.page.pages` | 已本地，但依赖聚合 Page runtime；拆出 definition/build projection，保持原输出形状 |
| `LocalFunction invoke` | `commands/local-function.ts` → `runtime/local-functions.ts` → shared catalog + scoped capabilities | 已本地；按能力进一步限制，不把所有调用先搬到 HTTP |
| LF `pageWorkflow` | `runtime/local-functions.ts` 直接注入 `runtime.page.workflows` | 与短命 CLI 的生命周期冲突风险；不能把进程内 receipt 当跨命令可读状态。需迁到明确常驻 owner 并用实测确认 |
| LF `pageTargets` | 同文件，没有 `options.pages` 就拒绝 | 不允许 CLI 凭 FQN 伪造 Page authority；有效 Page/MCP ingress 才注入目标能力 |
| LF `database` | `skill-app-logic/src/profiled-database.ts` 只接已声明、profile-selected、workspace-confined SQLite | 本项目当前 database 应 local；不是 Omni 的 ACE/BaaS database |
| `BrowserWebApi invoke` / `invoke` / `run-web-api` / `exec` | CLI 直接构造所选 provider 后调用；`runtime/browser-web-api.ts`、对应 commands | 当前无统一 Serve 中转；按 provider 实际 lifecycle 决定是否保留本地，不能只见 browser 字样就常驻化 |
| `PageWorkflow start` | `commands/page-workflow.ts:43` 先调用 Serve start，再通过 `app/invoke.ts` POST `/api/page-workflows/start` | 是已存在的常驻入口，保留按需启动；CLI 不能接管内存 receipt |
| `PageWorkflow get` / `PageObject invoke` | `app/invoke.ts` inspect Serve 后访问专用 HTTP endpoint，缺 Serve 则失败 | 保留常驻语义；get 不启动新实例来假装找回旧 receipt |
| `mcp-app serve` | `commands/mcp-app.ts` stdio connection，`runtime/mcp-app.ts` 有独立 target store | 长连接但不等于 HTTP Serve；保留连接拥有的 target/workflow 生命周期 |
| `createCommandRuntime` | `runtime.ts:36` 无条件组合 resourceHost、Codex effect、PageHost；env 存在时构造 Ego supervisor | 工厂把短命 catalog 与 Page/build/workflow 生命周期混在一起，是主要拆分点 |
| 通用 Page capsule | `cli-host-capsule/src/pages.ts:24` 同时组合 catalogs、builds、workflows，构造注释明确 no IO | “构造了对象”不等于“已启动浏览器/server”；目标须分别测构造、spawn/listen 和请求执行 |
| 新领域包 | `domain-capsule` 经 `domain-logic` + repository/verification ports 执行；产品 registry 尚无领域绑定 | 绑定时保持直接本地调用，禁止新增 HTTP 领域调度通路 |

## 事实边界盘点

| node | semantic_role / authority_model | owner / transition | relation / 判定 |
|---|---|---|---|
| `codument/` authored XNL、Markdown、配置 | current_authority / workspace durable source | 用户作者 + 受控 domain repository/migration boundary | 单向产生 catalog/ContextView；不得迁到 `.codument/` |
| Kind contract | current_authority / versioned package contract | 产品/通用 contract owner | App 引用，不复制定义 |
| catalog、Page definition projection | derived_observation / reconstructible projection | resource readers/materializers | 可跨 CLI 重建；可缓存不等于 Serve 拥有事实 |
| lifecycle receipt / journal / lock | verification evidence / recovery material / coordination | repository、verifier 对应边界 | 不因有锁就需要 daemon；不夸大任意编辑器并发保证 |
| Serve Page instance / workflow run | runtime_control / process memory authority | Page/Workflow coordinator + typed ingress | 跨 CLI 命令引用要求同 instance；不能从 stale record 恢复 live state |
| MCP targets | runtime_control / connection memory authority | MCP connection target store | 与 HTTP instance 分属不同 scope，不共用可写 target map |
| browser session / queue | external authority 或 process runtime_control，按 backend | 外部浏览器或 Host supervisor | 明确 state owner 后才定 placement；未证明者不猜测安全本地执行 |

现存 Page/Workflow 的 actor 协作保持；不引入通用 mailbox 平台，不激活无证据的事件溯源 profile。源码构造关系与具体行为风险分别记录；负例测试在后继实施节点补齐。

## 设计输出

[CLI-first 设计](../design/cli-first-runtime.md) 定义目标分类、暂停边界、执行位置和验证；本文件仅承载观察，不保存第二套任务状态。
