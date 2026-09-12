# 验收方案

本目录保存验收合同和之后的机器/人工报告。所有真实命令、退出码、输入版本和产物引用追加到 `../evidence.md`；此文件不保存独立任务状态。

跨仓新增合同（2026-09-05）：[cross-repo-host](../analysis/cross-repo-host/manifest.md) 为公共包上游归位、版本化发行闭包与三消费者验收的设计入口。原 consumer 是保留的局部基线，不证明已迁回 Halfcode 或已发布 npm；新增合同未实施，不能因旧 PASS 自动过线。本文“尚未实施”沿用规划阶段措辞时，实际已执行子集以 evidence E092–E100 为准；完整 runtime/distribution/all 仍 UNVERIFIED。

## 执行环境与入口

- 当前宿主：macOS，Bun 1.3.14。使用 `/Users/kongweixian/.bun/bin/bun` 或在单次进程环境设置 PATH，不改用户 shell 配置。
- project 已安装并固定依赖，有 `project/scripts/verify-mission.ts` 和若干真实 scoped 验证；继承失败及最新执行证据见 evidence，不能以规划期未安装状态冒充当前事实。
- 通过 `bun run verify:mission -- <suite>` 调度本节场景。脚本必须执行真实测试/行为并传递失败退出码；不存在的 suite、scope、依赖或验收必须报错，禁止占位 exit 0。
- suite 命名：`architecture`、`consumer`、`workspace-app`、`migration`、`capabilities`、`context-economy`、`distribution`、`all`；新增规划 `serve-placement`，本轮尚未实现。
- `capabilities --scope domain` 是中间节点的明确子集，只测 lifecycle、registry、receipt、archive/sync 与非冲突领域命令；三个暂停入口必须显式 DEFERRED。它不能代替完整 capabilities；报告逐项标记未纳入的 installer/migration 项，最终 `all` 不接受缩小 scope。
- 新增规划 `workspace-app --scope core`、`migration --scope core`：用真实公开 API/非冲突命令在隔离 fixture 验证内部能力，不修改或替代暂停的 init/status/upgrade-workspace。只有显式请求 core 才执行子集；无 scope 仍要求真实产品 CLI 和全部最终合同，不能跳过用户确认门禁而返回成功。
- `all` 调用所有已声明 suite，生成逐项 PASS/FAIL/UNVERIFIED 报告和 evidence 来源。存在 UNVERIFIED 时不能宣称 mission 完成。
- 构建/测试可以写入项目忽略的构建目录和隔离临时目录；consumer/migration 只操作夹具副本；不调用用户真实外部 App、不装全局命令、不发布 npm。

## architecture

检验 package exports 和依赖：contracts 不 import implementation；logic 不 import 具体 filesystem/network/process/clock 实现；通用层不 import domain；无循环、跨 package src/internals 和旧根 src 运行依赖。

静态检查给文件定位，允许合法 support/entry bootstrap 调用 IO；不能简单禁止全部 `fs` 字符串或只扫描 package.json。结合真实 import/type dependency graph、effect port 注入单测、双 workspace 实例隔离测试和 dispose 后资源释放断言。

架构 review 按三个 attractor 的相关不变量给证据。形式扫描通过不替代 owner/transition 的语义审查。

## consumer

本地 pack 所需通用包和真实依赖，在 monorepo 外临时目录安装 notes-cli fixture；只用 public exports，禁止 domain-*、旧 src、Halfcode source path 或 tsconfig source alias。

运行其自有品牌 help、自有资源根 discovery、自有 Kind list/validate、LocalFunction invoke，验证资源/错误/输出；启动本地隔离 server/MCP 通道执行最小调用后释放。

同时覆盖纯 resource-first App 和混合 code-first module，未知/重复 contract 负例。构建包缺 schema/template、workspace:* 未解析、导出泄漏都应失败。

新增 CLI-first 证明：相同公开 tarballs 在无 Serve 的外部 notes-cli 执行 discovery/validate/普通 LocalFunction/SQLite；注入禁止 Serve/Agent/browser/live factory 的哨兵。另用隔离 server/MCP 保留真实 Page/workflow 调用，不能以“没有 server 就少测”降低既有 consumer 覆盖。

## workspace-app

分期：core 通过公开 installer API 创建/重复初始化，使用完全空白隔离目录（含从未有 `.codument/` 的场景）；最终无 scope 在三命令讨论确认后执行下述打包 CLI init 验收。core PASS 不代表暂停的命令已可用。

在空目录用打包产品执行 `codument init`；断言 `codument/SKILL.md`、SkillApp manifest 存在且经过 Host admission，`KindDefinitions` 文件/目录及 manifest catalog 均不存在。

core 和最终阶段都断言正式 App 根精确为 `codument/`：不会出现 `.codument/SKILL.md`、`.codument/manifest.xnl`、第二份正式 Track/Mission/业务 config，薄 Skill 安装目录也无重复 App。私有控制/缓存字段按既有合同保留，不以删除 Host 私有能力满足目录测试。

从 workspace 根和显式 `-w` root 查询同一个 App，资源 IDs/owner 一致；重复 init 保留用户业务与配置。可装薄 Skill、兼容历史 agent 路径、非受管 AGENTS 文本保留。

用产品命令 scaffold Track/Mission/BehaviorPatch，加载 hook/profile/registry；验证至少一个有递归 owner 和 references 的非空 registry。Resource validate 与领域 strict validate 同一集合，无“App 绿但产品资源未读”的空通过。

检查混合 App、重复 IDs、未知/未来 Kind version、schema mismatch、conflicting memberships、目录越界/符号链接、archive 显式查询。无需 browser 的命令不得启动浏览器或 Serve。

## migration

分期：core 直接测公开迁移 API 与非冲突 migrate/upgrade-resource 入口，并在旧 App 无法 admission、无 Serve 的环境测试。最终无 scope 须等三命令讨论确认后补齐 upgrade-workspace 和真实打包 CLI 端到端；不得 mock handler 冒充最终 exit 2 兼容证明。

根据 `design/migration.md` 的历史矩阵，逐夹具执行：inspect/plan→backup→升级→全量 validate→语义字段/引用对照→再次升级。记录业务资源 digests 不变；备份存在且恢复演练可复现。

故障注入：源在 plan 后变化、目标已存在、途中 IO 失败、未知扩展、损坏资源、多个旧 authority、未来版本。预期 review/blocked 与 backup，不得破坏源或假报成功。

语义兜底分两层：自动化测试 receipt/backup/scaffold/re-scan 协议；由当前 Agent 实际按随包 migration Skill 处理一个已知旧 Markdown Decision fixture，再由独立检查验证 owner/options/feedback/ID/原文引用和正式旧 authority 退役。仅 mock 一个 AI 成功结果不能替代此演练。

保持 `upgrade-workspace --json` exit 2 和旧 resource upgrade 命令可用；即使新 loader 尚不能加载旧 workspace，也可启动迁移。自定义 hooks/profiles/agent/attractor、嵌套 mission、ProjectRef、artifact provenance 需有具体断言。

归档和 active/pending 全域纳入升级检查；本产品根 dogfood 先在隔离副本完成上述检查。

## capabilities

基线冻结全部旧 commandPaths、命令选项/JSON/退出码、Skill 路由和能力族→测试清单，逐条对应新 adapter/operation；即使新命令更名也须兼容路径或显式已确认变更。

行为回归覆盖：状态转换的合法/非法路径、DAG ready/gates/round、nested mission/TrackLink/ProjectRef、verification receipt/freshness、BehaviorPatch、decision forest、modeling/engineering 三方 merge/frontier、archive staged transaction、artifact dry-run/conflict/provenance、memory/config 开关、std lint。

Host 回归包含资源与包 materialization、ConfigurationProfile/DatabaseConnection、SOP notebook、Page/PageBundle/Site、LocalFunction、BrowserWebApi/PageWorkflow/PageObject、MCP App/Serve、clone/rebrand 和平台 build asset closure。

优先迁移并适配原有行为测试；不把旧 source import 当回归成功。补上旧测试没有覆盖的实际边界，不机械复制内部实现时序断言。

## serve-placement（新增，尚未实施）

设计合同见 `design/cli-first-runtime.md`，实际源头证据见 `analysis/cli-serve-placement.md`（相对 mission 根）。所有测试只使用隔离 workspace/本地测试 listener/受控 provider，不发送真实 Agent 消息、不操作用户浏览器或全局 Serve。

### policy 子集

1. 从真实 command registry 枚举全部可执行完整路径（含 group 默认执行和 alias），逐一映射 placement；重复、遗漏和未支持的能力失败。help/version、Serve 管理、MCP 长连接分列，不因没有普通 leaf 而漏测。
2. local 矩阵覆盖全部已注册资源 `list/detail/validate`、Resource、SOP、Page definition projection、非冲突领域命令、migration 和 local LF。Serve record 缺失、损坏、stale、健康但属于另一 scope 都不影响结果；注入 record-read/health/start/listen 哨兵，任一触发即失败。
3. 同一 fixture 的 JSON/退出码/字段与基线一致；Page list 保持 entryUrl/build projection，但不伪称 live readiness。检查错误和 strict validation 不能通过省略资源变绿。
4. required 调用在服务缺失、启动失败、错误 instance/workspace/agent 时明确失败；PageWorkflow start 的既有自动启动保持，get/PageObject 不新增自动启动。非法输入应在可行的本地 preflight 阶段拒绝，不启动服务。
5. Server 对确切 operation、descriptor/profile/capability、目标绑定复验；client preflight 后 source/profile 变化则拒绝失效请求。不能通过伪造 placement、传原始 runtime/port、修改 argv root 绕过；不引入通用远程 argv/eval。
6. 三个暂停命令及间接入口做注册/行为 diff：没有组合、重命名或新 host alias；不把原 Host init 绿误判产品 codument/ 初始化绿。

### runtime 子集

1. LF 矩阵：空/五项本地能力组合、configuration/profile 缺失/歧义、SQLite database 的允许 FQN/路径/driver、pageWorkflow 常驻 owner、pageTargets 缺上下文拒绝、合法 Page/MCP allowlist。声明/未声明 capability 不能越权调用。
2. Browser 矩阵：实际各 provider+transport 的 one-shot/external-owned/persistent supervisor+queue；一项一证据，不按名字推测。local 不引入 Serve；Host 持有的长期队列不在两进程中复制；未知生命周期拒绝。debug exec 仍本地，不增加 HTTP eval。
3. 构造计数与真实 IO 分开：catalog/领域 CLI 不装 PageWorkflow/Agent/supervisor、不监听 socket；必要 build/materialization 记录为本地 Effect。Serve 未请求 browser 时不启动 bridge，首次并发请求仅一个长期实例；失败 acquisition 清理已获得资源；close 幂等、拒绝新调用、drain 后仅释放 owned handles，不关闭外部 browser session。
4. CLI LF pageWorkflow start 后退出，后续命令仍向相同常驻 owner 查询 run；服务退出后旧 receipt 不被新 server 冒认。Page endpoints、WS/SSE、allowlist、result、target selection、Agent binding、MCP connection targets/run 隔离及 shutdown 回归完整保留。
5. 两个 CLI 进程同时修改同一 domain resource，验证 lock/CAS/journal 既有保证；Server 开关不影响领域持久化、fresh verifier/receipt/gap/hook 的语义。不要把 single-process capsule queue 宣称为跨进程互斥。

无 scope `serve-placement` 必须同时运行 policy/runtime 和领域本地矩阵；不足的 backend 或功能标 UNVERIFIED 并失败。将完整 suite 加入 `all`，历史 consumer/architecture PASS 不自动覆盖它。

## context-economy

六个固定场景和成本指标见 `design/context-economy.md`。保存旧新读取轨迹、字节/可用 tokenizer token、重复率、source closure coverage 和缺陷检出结果。

前三个常用场景输入量中位数目标下降至少 25%；六场景合同覆盖/检查配置保真 100%。报告标明字节代理或真实 usage，禁止混称。

机制 trace 比较：GapLoop fresh 轮次与 exhausted 分支；Hook 顺序/条件；AttractorCheck 独立 fresh 对象及 GAP 后重检；显式 gate。对过期 receipt、错 profile、漏 hook、源变化、缺 acceptance、未知 migration 字段等故障要求可检出。

默认不进行付费模型基准；语义检查用实施时已有 Agent 能力和受控 fixture。数据不足时精确报告，不捏造 token 数。

## distribution

本地构建和打包所有声明分发目标，校验 assets/schema/templates/dependencies/public exports/版本、LICENSE/来源说明。macOS 本机做隔离安装与唯一 depa-codument bin 的 smoke，确认旧 codument 不被覆盖；不依赖旧 src、源码仓库或 monorepo node_modules。此项按2026-09-07用户要求覆盖原双bin方案。

macOS x64/Windows x64 的 cross-build+artifact inspection 只证明产物，不声称真实平台执行已验证。若最终仍宣称这些平台运行兼容，需要相应环境的 smoke evidence；不可用时记录 UNVERIFIED、明确发布限制，不能伪造通过。

产品版本递增并区分资源版本；旧产品 npm 名保留；新公共包无 scope 且符合 role。顶层 README/scripts 指向 project，源码退役不得删除仍被历史 migration fixture 需要的原始材料。

## 最终验收

`cd project && bun run check && bun run verify:mission -- all` 必须覆盖所有相关 package tests；当前顶层 test 仅包含 cli/mcp-app 的缺口要补齐。

除自动化结果外，回到最终文件/运行态核验三份 attractor、能力清单和字段保真。按明确配置执行 fresh GapLoop/AttractorCheck；独立验收只给问题与证据，修复回到 Applier，重新运行受影响和最宽相关回归。

已记录过的最宽相关回归，最终必须在同一最终源快照过线。仅文档完成、测试文件存在或实现者总结不构成完成。
