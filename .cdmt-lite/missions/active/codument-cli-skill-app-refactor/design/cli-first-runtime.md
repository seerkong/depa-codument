# CLI-first 执行与 Serve 最小职责

这是 2026-09-05 用户增量要求的设计投影，已获授权并开始实施（E092 起）；以下仍是完整目标，不代表全部达成。目标以 MISSION 为准，唯一执行计划在 loop；证据见 [增量观察](../analysis/cli-serve-placement.md)。

## 1. 三条边界先冻结

1. `init`、`status`、`upgrade-workspace` 的新旧合并暂停。撤销上一版“自动组合 + 可选 host 命名空间”的当前实施要求；不改名、不加别名、不决定哪套同名 handler 胜出。共享底层重构允许机械适配，但必须保留各自已有行为与参数。
2. 正式 App 根固定为 `workspace/codument/`，产品 shell 注入它，通用包不硬编码。`.codument/` 即使继续作为 Host 已有私有配置/缓存目录，也不装正式 Track、Mission、知识、业务 config 或第二份 App。不能从现有 `WORKSPACE_DIR = .codument` 推导产品 App 根。
3. 执行位置由所需事实/Effect 生命周期决定；本地调用能满足正确性时不探测、不启动、不依赖 Serve。读取配置或需要文件锁本身不是常驻理由。

## 2. 命令整合的阶段边界

非冲突旧命令保留原路径，注册到产品 shell；Kind 风格别名若新增，委托同一领域 operation。registry 对重复完整路径报错，不靠注册顺序覆盖。

三个暂停命令继续隔离：旧源码入口仍只作为旧产品基线，新 project 入口的同名命令仍只代表 Host 骨架，不能宣传为新 Codument 产品初始化/升级。测试用独立 registration fixture 或直接公开 capsule API 验证领域 installer、status projection、migration；这些不是新增用户命令或最终兼容证明。

同样禁止通过 `init-workspace`、`upgrade`、启动时自动修复或新 `host ...` 别名，暗中把暂停的三个合并决策做掉。其它 Host 管理命令保持原行为。

核心重构完成后，单独向用户展示三个命令的现有参数、写入范围、JSON/退出码和候选组合，再决定产品入口。此前可完成内部 workspace App 和迁移能力，但不能完成整体发行、旧 src 退役或真实 dogfood 切换。保留最终兼容验收，不把延期当成删功能。

## 3. Placement 合同

以完整叶子 command path 为静态索引；运行能力再依据已 admission 的 descriptor、选定 profile 和 Host-owned backend 生命周期规则解析。概念结果为 `local | serve-required | rejected`，包含可解释 reason；错误或未知能力不是“默认 local”。`serve` 管理和 `mcp-app serve` 为明确的进程入口，不伪装普通 RPC。

placement 是软件提供的策略，不接受 App 自报 `local`、用户 `--force-local` 或 invocation 覆盖。沿用已有注册协议，不维护第二套手写命令 dispatcher。策略只需覆盖真实公开入口和绑定能力，不预建 Omni 中此处没有的 commands。

| 命令 / 能力 | 目标位置 | 理由和细节 |
|---|---|---|
| 旧领域 `list/show/validate`、track/mission 生命周期与 verify、decisions、modeling、engineering、project bindings、archive、artifact sync、std lint、behavior-patch、migrate/upgrade-resource/upgrade-track | local | 文件 authority + 受控事务/验证子进程；锁/CAS 解决协作写入，不通过 server 统一写文件。尚未迁入的能力按旧完整清单补齐 |
| `Resource tree/validate`、全部已注册 Kind `list/detail/validate` | local | 源、contract、catalog 可本地观察。Page list 的 entryUrl/build status 是投影，不宣称服务在线 |
| SOP `list/detail/validate/graph/notebook init` | local | 确定性解析/graph 与显式文件写入；reset 原有安全语义不变 |
| LF 空 capabilities 或仅 `workspace/sqlite/clock/ids/configuration` | local | 按调用注入/释放；配置选择规则保持 |
| LF `database` | 当前 SQLite binding 为 local | 保持 profile/FQN allowlist/workspace-confined 路径和连接释放；未知 driver / host-managed binding 明确拒绝，不照搬 BaaS |
| LF `pageWorkflow` | serve-required，或已有 MCP connection 内的同一 owner | 新 CLI ingress 通过窄 typed 调用交给常驻 coordinator；不再创建 CLI 私有 workflow。与现有 Page/MCP 内调用共用操作 |
| LF `pageTargets` | 有合法目标上下文的 Page/MCP ingress；裸 CLI 请求 rejected | 不能把该标记简单变成“发给任意 server 就安全”；缺合法目标/allowlist 仍失败。新通用 CLI selector 不在本轮范围 |
| `PageWorkflow start/get`、`PageObject invoke` | serve-required | 常驻 receipt、目标选择和串行协调；保留已支持的专用 HTTP API |
| `BrowserWebApi invoke`、顶层 `invoke/run-web-api/exec` | backend 生命周期决定；已证明 one-shot / external-owned 则 local | Host 自持 persistent REPL/supervisor/共享队列才要求常驻；不能按 provider 名一刀切。未知生命周期拒绝并给诊断 |
| `serve [start/stop/restart/status]` | 明确的进程管理入口 | 保持现有 workspace/agent scope，不把每个本地命令接入管理器 |
| `mcp-app config` / `mcp-app serve` | 本地输出 / 独立 stdio connection lifecycle | MCP 长连接不自动转成 HTTP Serve 客户端；自身 target/workflow scope 必须独立 |
| `demo`、help/version、其它 Host 安装管理入口 | local，保持既有语义 | 三个暂停命令不因该分类而获得合并授权 |

`local` 指不依赖本产品 HTTP Serve，不代表不联网、不运行验证子进程或不连接外部浏览器；也不代表 local action 变成只读。真正用户业务的网络/命令执行仍遵守原授权和能力 contract。

### Server-required 的调用和启动分开

- `PageWorkflow start` 已自动 start Serve，保留这条行为；preflight 能发现的参数/资源错误先拒绝，避免无意义启动。
- `PageWorkflow get`、`PageObject invoke` 保持缺服务时报错；get 不能创建新空实例假装恢复旧 run。
- 新 LF/长期 browser ingress 初期要求显式已有健康 Serve；不扩大隐式启动范围。错误提示提供 `serve start` 指引；后续若要自动启动需单独决定。
- Server 使用相同 placement policy 重新读取与 admission 资源、profile、capabilities，校验 workspace/agent/instance 与目标 allowlist；不信任 client 的 placement 或序列化 capability 对象。preflight 后 descriptor/profile 变化时拒绝失效请求、要求重试，不按旧判定执行。
- 只保留/新增确有常驻需求的 typed endpoint；不新增任意 argv/code 的远程执行通道，不把 `exec --code` 搬成 HTTP eval。
- Server 不可用、instance 变更、未知 capability、目标缺失均不退回本地执行。失败不能落成功 receipt。状态改变请求的超时不自动重试，除非对应协议已有去重保证。

## 4. Runtime 组合：职责面，不机械新增六套包

```text
CLI 解析 + 本地 preflight + placement
  ├─ local ──────────> Catalog / Domain / 按调用 Execution
  └─ serve-required ─> typed transport ─> 常驻 Page / 必需 Execution owner

MCP stdio shell ─────> connection-owned Page targets / Workflow
```

- Catalog：source/Kind admission、descriptor/profile、SOP、只读 Page/Site projection。可在 CLI 和 Serve 构造；不是 server authority。
- Domain：repository、verification、registry、migration ports + domain owner；短生命周期 CLI 直接调用。跨进程同源写入仍遵守真实 lock/CAS/journal，不仅依赖单实例 queue。
- Request Execution：workspace、SQLite、clock/ids、profile 和已证明 one-shot browser；只按 admitted capabilities 获取，finally 释放自己创建的资源，不关闭外部 session。
- Page/live：HTTP/static/WebSocket/SSE、instance targets、workflow queue/receipt、Agent binding；Serve 或明确 MCP connection 拥有。配置变化可刷新 catalog，请求级 runtime 不得重复建立 live coordinator。
- Long-lived Execution：只有实际需要的 supervisor/bridge/shared queue；惰性创建，单 owner、并发首次访问只构造一次，关闭拒绝新调用、drain 后精确释放，初始化失败释放已获得的部分资源。
- Build projection 与 live automation 分开：Page list 可读取/必要时生成确定性 build 投影，不装 workflow/browser/Agent；现有输出字段不得因拆分静默消失。build 文件写入与构建子进程单独测量，不和 Serve spawn 混算。

在现有 `cli-host-contract/logic/support/capsule/shell`、`skill-app-*`、`browser-support`、`domain-*`、`mcp-app-capsule` 内落实职责；优先拆公开 factory/runtime 类型，不预设更多 npm packages。contract 放类型/port，logic 放纯 placement 和业务处理，support 实现 process/http/fs/browser，capsule 负责生命周期组合，产品 shell 注入目录和命令。通用层不得知道 Track/Mission 名称。

当前 `createPageHostRuntime` 构造本身 no IO，因此不能把“少创建几个对象”当成进程减少的证据；分别测 factory acquisitions、spawn/listen/probe 和请求 trace。

## 5. 安全、兼容与证据

- catalog admission 和业务函数执行分开；不为 list/detail 调用业务 handler。现有 code-first materializer 有编译/模块加载边界，按现有信任合同检查，不承诺任意第三方模块完全无副作用。
- FQN/profile/根目录从 canonical source 解析；配置读取不隐含 server 探测。local 路径不给 Serve process 或 HTTP loopback transport port，测试中设置“调用即抛错”的哨兵。
- `codument/` 正式文件身份与 locks/CAS/backup 由同一领域边界维护；HTTP Page 如需使用 domain 能力，仅复用公开 operation，不另写文件算法。
- 不新增 daemon、workspace placement 配置、secret/cookie/token 文件；保留 Page/MCP allowlist、Agent 绑定、错误脱敏与关闭行为。
- 旧 JSON/exit code 不因内部 HTTP envelope 改变；升级的 exit 2 和 review 收据在最终命令接入后仍需实测。
- GapLoop、Hook、AttractorCheck、fresh verify 不转成后台 server 调度、不降低次数；原 Skill/Agent 的语义循环继续掌握流程，CLI 提供确定性支撑。
- 延期只是冻结三个命令的产品组合，不是取消 installer/migration 能力或静默放弃发行验收。

## 6. 验收与实施入口

工作节点、依赖、状态统一在 [loop.md](../loop.md)。`serve-placement --scope policy` 已执行真实测试（E094）；`--scope runtime` 与完整 suite 尚未完成，必须视为 UNVERIFIED。详细无 Serve 矩阵、动态 capability/backend、并发/关闭、目录保护见 [acceptance.md](../verification/acceptance.md)。

核心里程碑只可宣称“非冲突命令 + 内部 App/迁移 + CLI-first runtime 已验收”。三个暂停命令、最终包入口兼容和真实 dogfood 未过线时，mission 不得标 completed。
