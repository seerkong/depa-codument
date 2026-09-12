# Evidence: Codument CLI Skill App 与可复用 Host 重构

本文件只追加。记录作废须新增条目并指向旧 ID。建档证据不等同产品迁移完成证据。

- E001 — 2026-09-05 — 读取本轮用户七项需求、depa-expert/cdmt-mission-lite 入口及必要引用、codument/std/AGENTS.md、外部 v0.5.3 用户评审。用户要求本轮完成规划后确认，故保持 pending；不使用 Codument 自身任务执行。
- E002 — 2026-09-05T06:18:35Z — 只读 `git rev-parse HEAD`、`git status --short`，exit 0。根 HEAD `bba44a1ac23cb8d5b2312f3cd0c9f78ddd471a8e`；源 Halfcode HEAD `7a68c36fc79d884f3a34c8c36ebf18b57c7827ab`。初始变更仅 `M src/templates/codument/std/attractors/depa-attractor.md` 与 `?? project/`。源是已明确授权 clone 的 dirty working tree，不以 HEAD 冒充完整 clone 内容。
- E003 — 2026-09-05T06:18:35Z — Bun 只读 fs 统计，exit 0：Bun 1.3.14；旧 src/cli 63 files / 550823 bytes；新 project/packages/cli/src/cli 90 files / 703543 bytes；模板 std 61 files / 354457 bytes；薄 Skills 17 files / 18391 bytes。impl-track 32002 bytes，plan-track 32905 bytes；这些是字节，不是真实 token usage。
- E004 — 2026-09-05 — `env PATH=/Users/kongweixian/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin /Users/kongweixian/.bun/bin/bun test test/cli/commands/migrate.test.ts test/cli/commands/upgrade-resource.test.ts test/cli/commands/upgrade-workspace.test.ts` — exit 0 — 25 pass / 0 fail / 202 expect calls；覆盖旧结构迁移、backup、Decision review、幂等、目标冲突和 lifecycle 布局。测试使用其隔离夹具，不执行真实 workspace 升级。
- E005 — 2026-09-05 — 只读目录 digest，exit 0。算法：递归普通文件（排除 node_modules/.git/dist/.tmp 和符号链接目录），相对路径排序，每项 `relativePath + NUL + sha256(bytes)`，用换行连接后 SHA-256。src：158 files，`c6390722135a5c63eb3d00b5fded4791c81e03a2c2668e8e8cf8b018d1cb6f53`；project：629 files，`7223651946558326a3c19d571329d9ca62a24460b0c69f1c07651e9912860f42`；codument：743 files，`4045db2629e9bb4d52b20aae78d9f5ea447cfa0192b269d76b065faad160ea03`。用于验证本轮未改这三棵树；实施启动前需重观察。
- E006 — 2026-09-05 — 用户既有修改文件原始 SHA-256：`src/templates/codument/std/attractors/depa-attractor.md` = `727c6ed70650a2f695b7018aa0ff5aec4d1da3bcca60d62a23bf96a54deed59c`。外部评审按 E005 单文件目录记录算法摘要 = `0b8f914e180343433b0548bc495b1b23997977a1ce086a1f28b20dc24e4d63e0`；不改两者。
- E007 — 2026-09-05 — 静态代码观测：两产品 compiler 分别 0.2.8/0.3.0；project 无 node_modules；旧 std 要求迁移收据语义 review；Host source 没有 codument；KindDefinitions 当前随模板分发。精确证据见 analysis/current-state.md F1–F14。新 Host 全量测试/依赖安装/迁移/成本优化均未执行，列为后续工作。
- E008 — 2026-09-05T06:44:16Z — `/Users/kongweixian/.bun/bin/bun -e <planning structure/link/DAG/coverage/digest validator>` — exit 0。检查 15 个文件、20 个本地链接、10 个工作节点：引用均存在、依赖无环、7 条期望与 11 条约束有 Acceptance/工作图覆盖、loop pending。重新计算 src/project/codument digest 与 E005 全部一致；`git diff --check` exit 0；status 只额外出现 `.cdmt-lite/`，原用户变更与 clone 保持。
- E009 — 2026-09-05 — 规划自检发现领域迁入节点若执行完整 capabilities 会提前依赖后续 init/migration；已把该节点限定为显式 domain 子集，完整 capabilities 放在集成和最终验收。补充成本 reduction 的逐场景计算口径。仅修改本 mission 文档，不修改产品或测试。
- E010 — 2026-09-05 — E009 修订后运行 Bun inline Markdown link/whitespace/pending/scope 检查 — exit 0 — 15 files / 20 links / PASS / Status pending / implementationStarted false。分析与规划完成，等待用户确认执行。
- E011 — 2026-09-05 — 用户确认实施；Mission 整体移至 active。Bun 显式 PATH 安装 project 依赖并生成 bun.lock。旧版显式 `bun test ./test/`：503 pass / 0 fail / 3652 assertions / 63 files。首次 `bun test test` 意外匹配新旧两树，其失败不归因于旧产品。已冻结 analysis/baseline.json：53 个旧 registry 路径、70 个 Host 路径、17 个 Skills、63 个旧测试文件、4 个历史 fixture 目录摘要、6 个输入字节代理场景。
- E012 — 2026-09-05 — 原 Host 安装无 lockfile 后解析出 bun-types 1.4.2 与 Node types 26.4.1，signal overload typecheck 失败；锁定源项目已安装的 bun-types/@types/bun 1.4.0 与 Node types 26.2.0 后恢复。修复 clone 无连字符 bin 的 snake_case 抢占、测试源 packageName 假设、旧 authority 固定 hash；补全 clone 测试在 Bun isolated linker 下所有 workspace 的依赖闭包。OpenCLI materializer 全量初跑一次 5 秒超时，单独复跑及随后全量均通过，未延长超时或删除检查。
- E013 — 2026-09-05 — 通用 CLI contract/logic/support/capsule/shell 真实切片已接入产品 registry/output；help/version 移到 runtime 构造前。声明布尔参数不吞 positional、-- 停止选项校验、JSON 保留真实 code/ok。project `bun run check` exit 0：typecheck + lint + 334 pass / 0 fail / 1696 assertions / 60 files。该数字是此时快照，不等于后续最终验收。
- E014 — 2026-09-05 — `bun run verify:mission -- architecture --scope cli` exit 0：五包公开依赖/相对私有路径/logic 和 contract ambient effects 检查、8 个 CLI/双 root/lazy/dispose 用例通过。 `consumer --scope cli` exit 0：实际 bun pm pack 五包，monorepo 外安装 tarballs，独立 notes CLI help/JSON/workspace 命令成功且真实依赖路径留在 fixture。未发布包，传递依赖通过 fixture overrides 绑定相同 tarball。这里只验 CLI 切片；完整 consumer/architecture/mission 仍明确 UNVERIFIED，未实现的 suite 返回非零。
- E015 — 2026-09-05 — `bun analysis/probe-compiler.ts`（mission 路径）exit 0。隔离最小 ResourcePackage：0.2.8 接受 apiVersion/version，拒绝新 envelope（RESOURCE_METADATA_FIELD_MISSING）；0.3.0 接受 envelopeVersion/specVersion，拒绝旧 metadata（RESOURCE_METADATA_FIELD_REMOVED），树新增 authored stage。确认升级必须先走兼容入口，不能依赖新版 workspace loader 已接受旧目录。此 probe 不声称所有 9 类领域 AST 已转换；具体保真矩阵仍属迁移节点。
- E016 — 2026-09-05 — SOP 契约/纯协议/Notebook IO、资源 runtime port、PageTarget port 已分别归位到 skill-app-contract/logic/support；原 project CLI 路径保留过渡 adapter/re-export，不保留第二套算法。SOP 目标回归 46 pass / 0 fail。definition 的 Bun Database/MCP implementation 类型依赖改为 contract port；原 Codument global 仅由 product adapter 提供，通用 bundle materializer 不自动安装它。
- E017 — 2026-09-05 — 无 KindDefinitions App 的首个 probe 失败：compiler 在发现阶段报告 KIND_DEFINITION_MISSING，即 runtime 注册不等于 source bootstrap。用 compiler 公开 createDirectoryResourcePackageReadPort/loadResourceTreeFromReadPort 实现内存定义视图，来源是已准入 owner/revision；不复制或修改 vendor/compiler。physical manifest 保持原字节，sourceManifestDigest 与 loaderProjection 独立标明；当前 catalog revision 和 bundle 重新加载校验包含真实 manifest digest。已有 authored Kind catalog 仍走原生精确校验，不掩盖 drift。
- E018 — 2026-09-05 — `bun run verify:mission -- architecture --scope skill-app` exit 0，8 包依赖/私有源码引用/ambient effect 检查及 19 pass / 0 fail / 96 assertions。新增样例包含自定义 Note owner/schema/reader、未知 Kind、无副本 App、缺字段拒绝、多个 root 与保留 catalog id 冲突；未经实现的完整 suite 和未知 suite 的 fail-closed 行为另有测试。
- E019 — 2026-09-05 — `bun run verify:mission -- consumer --scope skill-app` exit 0；真实 pack/install 8 包到仓库外，通过 public exports 发现 Notes App，加载 portable code-first LocalFunction descriptor，执行 isolated-echo，拒绝数字输入，没有写入 KindDefinitions/__host_contracts__。这只验证资源/LocalFunction 混合切片，尚不覆盖完整 host-package lock 协议、外部浏览器、HTTP/MCP consumer。
- E020 — 2026-09-05 — 当前实现检查点 `cd project && bun run check` exit 0：typecheck + lint + 342 pass / 0 fail / 1727 assertions / 63 files。clone 的二次克隆、运行、typecheck 通过；测试 link helper 现在覆盖所有 workspace 的 dependencies 与 devDependencies。最后仅整理两处 import/空白，无行为变更。
- E021 — 2026-09-05 — 重算 E005 同算法：旧 src 仍 158 files / c6390722135a5c63eb3d00b5fded4791c81e03a2c2668e8e8cf8b018d1cb6f53；根 dogfood codument 仍 743 files / 4045db2629e9bb4d52b20aae78d9f5ea447cfa0192b269d76b065faad160ea03。既有用户 attractor SHA-256 与 E006 相同。未回写外部 Halfcode、未切换根产品入口、未发布、未全局安装。成本优化尚未实施，不报告 token 降幅。
- E022 — 2026-09-05 — browser-support 抽取 browser/resource ports、Fetch 转换、Ego/OpenCLI/MDD provider 和 persistent supervisor。首次 typecheck 指出批量身份替换误伤包名前缀及 raw import 类型歧义；改为精确包前缀与 .txt 源资产后 typecheck exit 0。旧浏览器相关测试 20 pass；新公开生命周期/中间 symlink/插件闭包 4 pass。支持 supervisor 排队准备、幂等关闭与准备失败清理，不改变真实外部 task-space 所有权。
- E023 — 2026-09-05 — `bun run verify:mission -- architecture --scope browser` exit 0：9 包静态边界及 23 pass / 126 assertions。`consumer --scope browser` exit 0：实际 pack/install 9 包；插件 5 文件均可生成，request.js 可执行；受控 OpenCLI 调用与双 supervisor 隔离通过；Bun 编译后移开 node_modules，独立运行仍成功。未访问真实浏览器或外部 API，realBrowser=NOT_RUN。产品旧 branded plugin 仍由产品 adapter 显式绑定，不是通用包依赖。
- E024 — 2026-09-05 — `cd project && bun run check` exit 0：typecheck/lint、346 pass / 0 fail / 1757 assertions / 65 files，含再次 clone、隔离构建与既有完整回归。随后仅 simplify 产品 provider adapter 的命名/函数声明；下一次最宽回归需覆盖它。当前节点仍 active，Page/Vue/MCP/Host composition 尚欠完整 consumer。
- E025 — 2026-09-05 — Vue builder 的请求/receipt/observer types 归 skill-app-contract/page-build；builder 与 worker port 归可发布 depa-codument-page-builder-vue-support，默认 worker 从包内解析；产品只绑定 executable-adjacent 布局。typecheck + `architecture --scope vue` exit 0，10 包 / 32 pass / 153 assertions。`consumer --scope vue` exit 0：实际 pack/install 10 包，真实 Vite 直接构建、独立 worker 构建及关闭、App config 不执行均通过。尚未运行整体发行升级，因此不以该 consumer 冒充最终 distribution。
- E026 — 2026-09-05 — MCP 共享 runtime/SOP/schema ports 归 contract；depa-codument-mcp-app-capsule 的连接入口要求显式 transport，默认 stdio 与 console 归产品命令，连接失败关闭服务。typecheck + `architecture --scope mcp` exit 0，11 包 / 50 pass / 231 assertions。`consumer --scope mcp` exit 0：11 个真实 tarball，独立 Notes MCP 握手、SOP、schema 拒绝、App resource、target 隔离/释放及 close；同时覆盖 browser/Vue/SkillApp 切片。
- E027 — 2026-09-05 — MCP 后完整 check 首次 346 pass / 1 fail：release inventory 仍期待旧 private MCP 名称；单独复现相同断言，更新为公开 capsule 0.6.0 和 role 名，未降低业务断言。随后 `bun run check` exit 0：347 pass / 0 fail / 1760 assertions / 66 files。依赖安装进行中并跑的首次 typecheck 出现包链接未就绪，安装完成后复验通过；后续安装和 typecheck 顺序执行。
- E028 — 2026-09-05 — resource/SOP 的组合入口归 cli-host-capsule；Bundle/Profile/LocalFunction ports 归 contract，LocalFunction 派发归 logic，产品保留显式 capability binding。`architecture --scope mcp` 52 pass / 246 assertions；`consumer --scope mcp` 11 个实际 tarball 经 capsule 加载混合 App，通过 LocalFunction、browser compiled assets、Vue 与 MCP。CLI consumer 依赖闭包递归到 8 包。typecheck 通过。并行完整 check 348 pass / 1 SOP timeout，单独 SOP 6 pass / 11 assertions（原超时用例约 27ms），未调整 timeout。
- E029 — 2026-09-05 — E028 后串行完整 check 346 pass / 3 fail / 349 tests；单独两个相关测试文件复现 7 pass / 3 fail。失败原因均为原有 `project/README.md` 与 `project/docs/markdown-step-graph-v1.md` 等文档文件不在原位置，非测试业务断言变化。只读确认 project/docs 整体缺失，本轮未执行删除；已询问用户是否有意移动/删除，保留现状，不重建这些文档或移除断言。当前完整 check 不能报告绿色。
- E030 — 2026-09-05 — PageBuild ports 归 skill-app-contract/page-build，文件代际存储与 platform effects 归 skill-app-support，协调器归 cli-host-capsule/page-build；产品 adapter 绑定 `.codument/cache/page-builds` 与兼容 now 注入。补 pending demand 冲突、shutdown 等待 startup/observer、retirement 排他、关闭失败不删除工作目录、不可再开与资源逐个释放；unavailable watcher 在重开/关闭时也显式 close。发现 portable receipt 写入前未拒绝同名符号链接，提前检查 snapshot tree 并新增保真负例。目标测试 18 pass / 79 assertions；扩展后 `architecture --scope mcp` 59 pass / 277 assertions / 18 files，typecheck 通过。
- E031 — 2026-09-05 — 更新 `consumer --scope mcp`，exit 0：11 tarballs 隔离安装后的真实 Vue worker 通过公共 PageBuildCoordinator 与显式 `.notes` store 发布资产、读取代际、shutdown 清理工作目录，不创建 `.codument`；同时原有独立 LocalFunction/browser/MCP 检查仍通过。真实浏览器仍 NOT_RUN，完整 mission 仍 UNVERIFIED。旧 root src/codument 与用户 attractor digest 复验同 E005/E006，未迁移真实 dogfood。
- E032 — 2026-09-05 — writable workspace 归公共 skill-app-support/workspace，SQLite ports 归 contract/sqlite，连接 scope 归 support/sqlite，Profiled database claim/配置规则归 logic/profiled-database。补根目录删除、符号链接、重叠树拷贝负例；LocalFunction releaseRuntime 在成功、schema/handler 失败后释放 invocation 资源并保留双重错误。首轮旧 profile 回归因诊断措辞改变失败，补 typed SqlitePathError 与原上下文消息后 14 pass / 54 assertions，未改原断言。SQLite typed query/prepare/exec/transaction/rollback、statement 释放、双 root 隔离均有真实执行测试。
- E033 — 2026-09-05 — 隔离打包 consumer 揭示 Bun 1.3.14 的 close(true) 不能释放所有 uncached prepare statement，导致 database locked；未把它当 fixture 噪声。通过 Database 子类只跟踪 query/prepare 获取的 handles，在 scope.dispose 先逐一 finalize 再 close，保持 SQL/transaction 原执行实现。加入 uncached statement 活跃负例，SQLite 3 pass / 20 assertions；consumer --scope skill-app 后重新 consumer --scope mcp 均 exit 0，真实 SQL action 成功/handler 抛错后连接都不可再执行。
- E034 — 2026-09-05 — PageWorkflow/PageObject catalog 归 logic/page-automation；执行队列/receipt owner 归 cli-host-capsule/page-automation；ports 与 platform effects 分别归 contract/support。clock/ids/sleep/workspace 校验显式注入，实例 run ID 碰撞 fail-closed，receipt 外层冻结，close 幂等并处理待接纳请求。旧 PageWorkflow/OWID 回归 21 pass / 97 assertions，新增隔离/碰撞/close 3 pass / 13 assertions。新测试最初在释放 gate 前调用 Bun expect.rejects 导致测试等待死锁，终止唯一该测试进程后改为先注册 promise rejection handler、释放 gate 后断言，未放宽超时。typecheck 后测试 unknown narrowing 错误已补真实 instanceof guard。
- E035 — 2026-09-05 — 本批最终 `architecture --scope mcp` exit 0：69 pass / 341 assertions / 21 files；`consumer --scope mcp` exit 0：11 实际 tarballs，新增 builtin PageWorkflowBundle 与两个独立 coordinator 执行，SQLite success/failure cleanup、Vue publish/close、browser compiled assets、MCP 全部切片通过。串行 `bun run check` typecheck/lint 通过，363 pass / 3 fail / 1846 assertions / 366 tests / 73 files；3 fail 仍是 E029 的 README/docs 缺失，无新的代码回归失败。当前不声称完整 check 通过。
- E036 — 2026-09-05 — Page/Site ports、纯投影、material/asset IO 分别归 contract/logic/support；PageHost capsule 组合 catalogs、workflow、build 与幂等 close。目标回归 17 pass / 83 assertions；architecture --scope mcp 86 pass / 424 assertions / 25 files。consumer 初始 Page/Site 使用 DirectoryResourceCatalog 被内置 Kind 拒绝，纠正为 ManifestResourceCatalog 后，11 tarballs consumer 的静态 Page、资产、Site mount、workflow 和公共 composition 均通过；未降低 Kind 约束。
- E037 — 2026-09-05 — WebAPI instance loader 与 registry discovery 归 browser-support，registry 解析/summary 归 cli-host-logic，产品保留旧 fallback 和 globalThis.client_fetch 显式兼容 adapter。公开 loader lexical fetch 双实例隔离、close 拒绝新调用、编译缓存生命周期测试 3 pass / 10 assertions；产品兼容与 OpenCLI 7 pass / 24 assertions。11 tarballs consumer 再次通过并实际验证 registry/module loader、不污染 globals 和既有各能力切片。
- E038 — 2026-09-05 — E037 后全量 check 366 pass / 4 fail / 370 tests：除 E029 三个文档失败外，发现旧静态 Page 检查误要求 PageWorkflow execution binding。新增公共 inspectPageRegistry/inspectPageAsset，与可执行 catalog 分离；原 page-runtime.test 单独复跑 20 pass / 50 assertions，并纳入 architecture 范围，不修改原失败断言。修复后的最宽 check 正在重跑，尚不报告全绿。
- E039 — 2026-09-05 — Page RPC 与 instruction hub 归 cli-host-capsule，ports/platform/消息解析归 contract/support/logic，产品只绑定时钟和身份。新增 close 释放 pending RPC 与 timers、拒绝新 ingress、失败发送取消 deadline、nonce 碰撞拒绝与 fanout 失败隔离；新测试 3 pass / 16 assertions，typecheck exit 0。HTTP product stop 开始显式关闭所拥有的 hubs；完整 server 资源生命周期切片待继续。
- E040 — 2026-09-05 — E038 兼容修复后串行 check：370 pass / 3 fail / 1875 assertions / 373 tests / 76 files；typecheck/lint 通过，仍仅 E029 文档缺失。随后 HTTP listener ports/support 与 owned Host capsule 拆分，支持 start 失败回收 channels、stop 禁新请求并等待已接纳 handler、关闭 RPC、transport/release 双错保留与幂等释放。目标 HTTP/Page/Serve 30 pass / 99 assertions，architecture --scope mcp 117 pass / 519 assertions；typecheck 通过。
- E041 — 2026-09-05 — 11 tarballs consumer 增加真实 loopback HTTP/WebSocket：两个独立 Host、Page 注册/RPC、逐实例 stop 与 release 均通过。Page/Site HTTP interaction adapter 归 cli-host-shell/page-http，依赖显式 PageHttpRuntime ports；产品绑定 Codex/demo/identity/assets。既有 Vue/Site/workflow 19 pass / 69 assertions，PageShell/LocalFunction/OWID/Google 24 pass / 226 assertions。隔离 consumer 再次通过，新增公共 Page HTTP catalog/asset/Site shell/LocalFunction 执行、allowlist 403 与 schema 400；没有访问真实浏览器。
- E042 — 2026-09-05 — 公共 Page/Site SSE 适配统一 subscription owner：取消/abort 只释放一次、已 abort 不订阅、异步投影完成后不写已关闭连接。初次泛型推断 unknown 导致 typecheck 失败，补 PageBuildEvent 类型后通过；新增 3 个 SSE 用例被最宽 check 覆盖。最终本批串行 check 为 378 pass / 3 fail / 1903 assertions / 381 tests / 79 files，typecheck/lint 通过；三处文档缺失不变，未删除断言。严格 host-package/app-package 本地 registry consumer 尚未执行，下一步补该协议实证。
- E043 — 2026-09-05 — 新 code-first consumer 用本次 contract tarball 的真实 SHA-512 建立只读 loopback registry，通过 Bun 正常安装 exact 2.0.0 与 compiler 0.3.0，执行 App/Module/HostBundle/LocalFunction，删除 fixture lock 中 integrity 后 catalog fail-closed，恢复原始 Bun lock 后恢复。初次 fixture 错把 node_modules 中包自带 Kind 文件当 workspace 拷贝，限定 authored tree 后又暴露 Bun 跨本地 registry 缓存复用；使用 fixture 独立 --cache-dir 后通过，没有手写成功 lock 或降低 integrity 断言。仍不发布包。
- E044 — 2026-09-05 — Profile BrowserWebApi 的 endpoint/origin 规则归公共 logic；Composition descriptor 缓存由 module-global 改为每 catalog 的 source+kind+FQN owner，仅保留最新 material generation，失败不驱逐新 generation。staging 的失败清理纳入既有 finally。缓存隔离与旧 app/module/profile 回归 17 pass / 58 assertions；首次窄 provider port 造成旧 inline literal excess-property typecheck 差异，改为泛型约束保持兼容。architecture --scope mcp 122 pass / 536 assertions。
- E045 — 2026-09-05 — Codex thread/select 规则归 cli-host-logic，desktop/sidecar IO 归 cli-host-support，发送与显式 release 归 cli-host-capsule；产品绑定 BIN/VERSION/env/cwd。新 5 个受控本地 IPC/子进程用例 24 assertions，含 spawn 失败、初始化超时、重入 close、进程退出、desktop ownership miss 才 fallback；旧 Codex/Google 回归 9 pass / 109 assertions。测试 Buffer chunk 的 string union typecheck 修正后通过。11 tarballs consumer --scope mcp 再次通过，包括真实 code-first registry、公共 Codex client 双实例与模拟 peer；realMessagesSent=false。完整 CommandRuntime owner 和 detached service supervisor 仍待接入，不把这些切片算整个节点完成。
- E046 — 2026-09-05 — 服务记录/reuse/restart 规则归公共 supervisor，detached spawn/stop/health/port 归 support。记录写入失败回收已启动进程，停止失败保留 PID authority 并拒绝 restart；旧输出与产品身份仍由 adapter 绑定。目标 process/service/HTTP/Serve：13 pass / 67 assertions；完整 check typecheck/lint 通过，390 pass / 3 fail / 1962 assertions / 393 tests / 84 files，仍仅 E029 文档缺失。Registry 排队是实例内保证，不宣称跨进程互斥。
- E047 — 2026-09-05 — shutdown signal contract/support/capsule 已拆分；重复信号只触发一次 stop，解绑和停止双错仍回传。CommandRuntime.close 显式释放 PageHost/Codex/自有 browser；HTTP stop 先拒绝 ingress 再 drain/release。新 shutdown + 产品 HTTP lifecycle：4 pass / 12 assertions，随后 typecheck 通过。CLI main 尚未自动关闭接受 turn 后的 Codex sidecar，需复核长期任务所有权，不擅自终止已接纳任务。
- E048 — 2026-09-05 — consumer 59427 与 30459 均 exit 1；Codex/service/resource/Page HTTP/HTTP 切片已通过，但前者只读 registry 的 10 秒 listener 超时，后者 Bun 请求上游报 UNKNOWN_CERTIFICATE_VERIFICATION_ERROR。用 curl 的系统信任链对同一上游只读检查成功；probe 改为 HTTPS 白名单 curl、45 秒期限、60 秒 listener idle timeout，未关闭 TLS/改 integrity 断言。安装命令补 180 秒失败期限。第二次安装曾长于六分钟，准备终止所观察 PID 时它已经退出，未实际杀进程；本轮 consumer 结果仍待重跑，不算 PASS。
- E049 — 2026-09-05 — HostPackage 构建返回独立 artifact handle（value 为纯 receipt、close 为所有权接口）；portable staging 和 authoring descriptor 共享精确 temp-directory owner，失败立即回收；materializer close 等待在途加载再释放代际。Definition catalog 按实际 snapshot revision 复用最新 index，close 不释放借入 registry。ResourceHost/product runtime 显式串联释放。首次新 fixture 缺 HostBundle.sources 被 Kind schema 拒绝，补真实来源声明后 2 个 support lifecycle 测试 / 13 assertions 通过；2 个 capsule resource 测试 / 15 assertions 验证真实生成目录、多实例隔离及 authored files 保留。原 package-host/page-site/http 三文件 18 tests 全通过（首次合并命令另含失败 fixture，整条命令仍 exit 1），最宽回归待重跑。
- E050 — 2026-09-05 — architecture --scope mcp exit 0：137 pass / 612 assertions / 38 files。新 resource test 直接调用宽 HostRuntime handler 引起 typecheck 错误，改走真实 LocalFunction catalog 的 capability binding 后通过。owned browser bridge 改为 TERM 后有界等待、KILL 后确认退出，未停止其他实例；新受控进程测试通过，未启动真实浏览器。
- E051 — 2026-09-05 — consumer 15248 的所有切片和安装最终成功，但中间上游 TLS 请求抛到 Bun server 顶层，使进程 exit 1（即使末尾打印 PASS 仍不算成功）。改为显式 502 registry 响应，让安装器决定重试/失败，随后 consumer 26000 完整 exit 0，11 tarballs 与 code-first real integrity、关闭后的 resource catalog admission 均通过。HTTPS 校验保持；不是把失败强行改为成功码。
- E052 — 2026-09-05 — 最新串行 `bun run check` exit 1：typecheck/lint 通过，398 pass / 3 fail / 2001 assertions / 401 tests / 88 files。失败仍是 E029 三个 README/docs 缺失断言。没有新增代码回归；没有移除失败断言或恢复疑似用户删除文档。包隔离 consumer 已通过，但当前完整项目不能报告全绿。
- E053 — 2026-09-05 — 通用 text-template 安装、来源递归检查和 managed instruction 投影归 cli-host-logic/install，窄目的地 ports 归 contract。所有模板先读取再 reset，路径逃逸/来源消失先拒绝，产品目录与 marker 内容保留绑定。首次误用了现有 WorkspacePort 不具备的 writeBytes，typecheck/目标测试明确失败；恢复既有 text port（不扩大本次安装语义）后 10 pass / 57 assertions。architecture --scope mcp：141 pass / 631 assertions / 40 files。原 install 的 helper 和 support walker 已委托同一公共实现。
- E054 — 2026-09-05 — 编译 debug bundle 命名 exports 与 eval 归公共 browser-support/debug-code；同步 registry helper 不改为 Promise，异步 fetch 按实例 lexical binding，close 后禁止新调用。产品保留显式 legacy globalThis.client_fetch adapter；新 generic+WebAPI 4 pass / 16 assertions 后，兼容断言移至产品专属测试，不让 generic test 私下 import 产品。consumer 52681 exit 0：新增真实 tarball 模板安装/受管块幂等、debug exports 与同期既有 11 包切片全部通过。
- E055 — 2026-09-05 — MCP 的成功 connect 与命令终态拆开：createMcpAppConnection 提供 closed/close，原 serveMcpApp 保持委托包装；产品 MCP command.wait 等待 EOF/显式 stop 并解绑 signals，CLI main finally 释放 runtime。只读调用点检查确认 Codex send 仅属于仍在运行的 HTTP 服务，不为普通 CLI 暗留 sidecar。真实 stdin/stdout 子进程握手、保持在线、EOF exit 0 与旧 MCP 协议 11 pass / 36 assertions；另 3 tests / 11 assertions 验证 stop 先发 close 事件后仍抛错的传播与 legacy debug 成功/失败恢复。typecheck 通过；最终本批完整 check 在 session 79353 运行中。
- E056 — 2026-09-05 — session 79353 完整 check 为 402 pass / 6 fail / 2026 assertions / 408 tests / 92 files；除三处文档缺失，出现三个真实 OpenCLI/MDD debug 回归。只读复现定位为 bundle.js 的相对 import 在 virtual namespace 无法解析；第一次增加 onResolve 未修好，改为真实 file entry 的 source override 与跨模块 lexical define 后，原 6 条 command integration 及 4 条 generic debug/WebAPI 回归均通过（10 pass / 35 assertions）。含 import 的 module 不再只凭 entry digest 复用缓存，避免 helper 修改未失效。没有删除原断言，完整 check 将继续重跑。
- E057 — 2026-09-05 — 全局安装的备份/restore 归 cli-host-support/file-backup，显式冻结 root 与 managed paths，拒绝重叠、逃逸及 symlink ancestor，备份保留；产品只传入安装目标并映射旧错误。9 个 backup/install 回归 / 54 assertions 通过。此接口是本地失败回滚，不提供 crash atomicity 或跨进程锁，不代替后续业务 migration ledger。最新 architecture --scope mcp：152 pass / 676 assertions / 44 files，typecheck 通过。
- E058 — 2026-09-05 — 实现完整 generic `consumer` gate（不再必须带 scope），补独立 Notes CLI 自有 Note Kind 的 list/validate、typed reader、unknown/schema/conflicting authority 负例。首跑 fixture 缺 CommandDoc 被正确拒绝；补完整 command contract 后 session 45125 exit 0：11 tarballs、模板+backup restore、custom Kind、resource/code-first、Codex/service/HTTP、debug 相对 import、Vue/MCP 均通过。MCP server version 由调用者注入，产品绑定 VERSION；保留原 serveMcpApp 包装。整个 mission 仍 UNVERIFIED。
- E059 — 2026-09-05 — session 37570 串行完整 check exit 1：typecheck/lint 通过，407 pass / 3 fail / 2044 assertions / 410 tests / 93 files。E056 的三个真实代码回归已归零；当前仅 E029 三处文档缺失断言失败。Host 公共闭包可用性由 E057/E058 证明，文档相交问题仍是最终完整 gate 的未解决项；不得把本记录表述为整个 check 成功。
- E060 — 2026-09-05 — 重新按 E005 算法只读计算：root src 158 files / c6390722135a5c63eb3d00b5fded4791c81e03a2c2668e8e8cf8b018d1cb6f53；root codument 743 files / 4045db2629e9bb4d52b20aae78d9f5ea447cfa0192b269d76b065faad160ea03；用户 attractor SHA-256 727c6ed70650a2f695b7018aa0ff5aec4d1da3bcca60d62a23bf96a54deed59c。无基线漂移。实现者自检已写 verification/host-boundary-review.md，不冒充 final independent review。依 E058 接口可用性按 D11 开始领域节点的只读观察；Host 收口仍 active，发行不能绕过它。
- E061 — 2026-09-05 — 新增 domain-contract/domain-logic 公共闭包：Track/Mission 完整 AST 状态提案、TaskGroup Gate/roll-up、DAG ready、archive/reopen、ProjectRef 绑定与 gap round；clock 为输入，原树不变。首次 fixture 的 XNL 结束符错误修正后，DAG 测试暴露 Task 与 Schedule Node 共用 ID 被误判冲突；改为类型限定查找，保留重复 Task 拒绝。最终 14 pass / 166 assertions；typecheck（23798）exit 0。未改旧 src 或产品命令绑定。
- E062 — 2026-09-05 — 验证收据 processor 经 workspace/receipt/execution/digest/clock ports 工作；保持旧 receipt key 和命令后 fingerprint 观察，fresh 不读 cache，失败不写成功证据。新增 malformed/命令变化/内容变化/双 runtime/输入变异负例。`bun test ./packages/domain-logic/test` exit 0：20 pass / 200 assertions / 2 files。新增 architecture --scope domain-core 只声明这两个领域包的局部证明，完整 domain/capabilities/mission 仍 UNVERIFIED。
- E063 — 2026-09-05 — architecture --scope domain-core（88751）exit 0：当时两领域包 + 11 Host 包，172 pass / 876 assertions / 46 files；typecheck（3956）exit 0。后续增加 domain-support/capsule，因此需要在最终快照重跑，此条不覆盖其后新增代码。
- E064 — 2026-09-05 — domain-capsule 拥有单实例 admission、同资源顺序、in-flight drain 与显式 release；domain-logic/operations 统一验证→CAS 提交编排，格式保留旧 receipt。新增 source 在验证期间被改、Gate 未就绪不启动、失败不提交、关闭/多实例隔离。三文件 27 pass / 225 assertions。CAS 目前由注入 test repository 验证；生产 repository 未实现，不能称文件事务已完成。
- E065 — 2026-09-05 — domain-support 实现真实 workspace-bound verification effects，经公共 Workspace 原子写 receipt，不重复 Track 发现。Git tracked/dirty/untracked/ignored/missing 与非 Git fallback、symlink path 拒绝、双 workspace、真实失败 executable、fresh/cache/content invalidation 目标测试 exit 0：6 pass / 29 assertions。没有写正式资源或用户项目；typecheck（10188，新增 effect 初版）通过，最新补充测试与 consumer 的 typecheck 正在重跑。
- E066 — 2026-09-05 — `consumer --scope domain-core`（43865）exit 0：真实打包四领域包及公共依赖，共 8 tarballs，仓库外真实 verifier、缓存复用、fresh、源变化失效、失败不提交和关闭 admission 通过；明确 productionRepository=UNVERIFIED。generic Notes consumer 未增加 domain 依赖。最新 typecheck 61841 通过。simplify 仅整理局部命名/控制流/排版，不更改验证强度。
- E067 — 2026-09-05 — 四领域包加入 architecture gate 后（3377）exit 0：185 pass / 930 assertions / 48 files。串行完整 `bun run check`（45770）exit 1：typecheck/lint 通过，440 pass / 3 fail / 2298 assertions / 443 tests / 97 files。失败仍为 E029 三处原 README/docs 缺失。此快照尚未包含随后的 registry/merge 新增代码。
- E068 — 2026-09-05 — 递归 registry 的 source/index/owner/ancestor/path 契约与纯构建器归 domain-contract/logic，filesystem snapshot 归 support；保留完整原文，包括无效文件。初次新测试 6 pass / 2 fail：路径反斜杠判定转义错误已修；注释 roundtrip 暴露 xnl-core 0.1.12 parser 本身丢弃源码注释（parser.ts skipWhitespaceAndComments，无 preserve 选项）。没有以删除原文解决：source map 保留精确字节，文档明确 AST formatter 不是保真 patch writer；生产 writer 的注释保真仍待解。singleton slot collision 阻止发布丢失子节点的解析树。修正后 8 pass / 45 assertions，typecheck 11096 exit 0。
- E069 — 2026-09-05 — 纯 XNL node merge 归 domain-logic，类型归 contract；保留原三类冲突和 human/ours/theirs/base 策略，新增 identity-less 输入拒绝、结果树独立副本，以及数组位移导致双序不收敛时保持冲突。原三个用例和新增负例共 7 pass / 22 assertions。这是 selected-node 合并，不是整个源文件 writer；不允许因此丢弃文件注释或未选节点。完整回归与外部 consumer 将对新 registry/merge 重跑。
- E070 — 2026-09-05 — 新 registry/merge 外部 consumer（58222）exit 0，8 tarballs，真实 recursive source/owner 与 selected merge 通过；architecture domain-core（48350）exit 0：200 pass / 997 assertions / 51 files。完整 check（71453）exit 1：typecheck/lint 通过，455 pass / 3 文档缺失 fail / 2365 assertions / 458 tests / 100 files。该快照先于下面 Kind 实验。
- E071 — 2026-09-05 — 9 类内置 Codument Kind 的 owner/revision/structural schema 归 domain-contract，typed reader/writer bindings 归 domain-logic，稳定大小写/FQN 保留，暂标 experimental/validationLevel=structural；不冒充完整语义验证。首次实测 0 pass / 3 fail 揭示通用 builtin renderer 禁止合法下划线；按 xnl-core 的 identifier grammar 修正而非改历史 ID。次轮 5 pass / 3 fail 揭示 requiredFiles 放在普通属性但 compiler 从 DescriptorContract.RequiredFiles 读取，修正为正式结构；另修 test 把 ReaderProfile.readers Map 当数组的错误。之后 8 pass / 52 assertions：九类非空资源、forest、未知扩展、源码未写入 KindDefinitions、缺 required file/schema/旧 envelope 拒绝均通过。新型跨资源 semantic validation 和 production writer 仍待做；新 consumer/check 将重跑。
- E072 — 2026-09-05 — 新 Kind consumer 首次因嵌入脚本重复声明 snapshot 失败，改名 builtinSnapshot 后 session 98622 exit 0；完整 generic consumer（48767）在 underscore/RequiredFiles 两修复后 exit 0，11 个公共包和既有 Notes/AppModuleHost/HTTP/browser/debug/Vue/MCP 闭包通过，无 domain 依赖泄漏。真实浏览器 NOT_RUN、外部消息未发送。
- E073 — 2026-09-05 — 新 patchLifecycleSource：原文 token 定位 + xnl-core 前后语义判定，仅允许生命周期 scalar 属性和 ID 更新。8 pass / 28 assertions，包括 CRLF、注释、文本块伪节点、匿名 Criterion、ProjectRef/TrackLink、元数据碰撞、源漂移和结构修改拒绝；typecheck 35261 exit 0。更新后的 8 tarballs consumer（65431）exit 0，sourcePreservingPatch=true；生产 repository 仍 UNVERIFIED。结构变更/迁移 writer 不在此证明范围。
- E074 — 2026-09-05 — architecture --scope domain-core（43967）exit 0：212 pass / 1071 assertions / 53 files，覆盖 15 个公共包依赖及新 Kind/source patch。下一步串行完整 check 后推进真实 repository；不把局部 architecture 当成全部产品收口。
- E075 — 2026-09-05 — 串行完整 check（49801）exit 1：467 pass / 3 fail / 2439 assertions / 470 tests / 102 files，typecheck/lint 通过。失败仍仅三项 E029 README/docs 缺失断言。此快照包含 source patch/Kind，不包含随后 production repository。
- E076 — 2026-09-05 — 生产 FileLifecycleRepository 首次 11 tests / 62 assertions 通过；补独立 Bun 进程锁、最终写前源变化保留、同 workspace ProjectRef 和非法 UTF-8 拒绝后，与 lifecycle/capsule 合跑 35 pass / 264 assertions / 3 files（repository 14 tests）。文件事务通过显式 codec/归档命名/mutation bindings，不反向 import logic。真实目录移动、mode/字节保真、重复 authority/占位/requiredFiles/symlink 拒绝、绑定 receipt/故障回滚实测；回滚失败保留 lock/journal，成功后的 cleanup 故障返回 maintenanceWarnings。非协作编辑最后 rename 竞态、多文件 crash atomicity、跨 workspace 分布式锁不在保证内。初次 typecheck 26206 因 Object.freeze 丢 contextual typing 报两个 implicit any，改泛型后重跑 6623 中；外部 consumer 已改真实 repository，尚待执行。
- E077 — 2026-09-05 — typecheck 6623 exit 0；外部 8 tarballs consumer（93994）exit 0，已替换模拟仓库为 production-filesystem，真实 verification→收据→CAS→原文 patch，验证期间改源后不覆盖真实文件。architecture domain-core（56534）exit 0：226 pass / 1144 assertions / 54 files。随后自检补 XML/XNL shadow authority 拒绝，接下来完整 check 覆盖；完整 domain/capabilities 仍 UNVERIFIED。
- E078 — 2026-09-05 — 完整 check（65402）exit 1：481 pass / 3 fail / 2513 assertions / 484 tests / 103 files；typecheck/lint 通过，仍仅 E029 文档缺失断言。覆盖 production repository 和 XML/XNL shadow authority 拒绝，不包含下面新的 semantic validator。
- E079 — 2026-09-05 — 从旧 commands/validate.ts、mission/validate.ts 读取实际规则，新增纯 AST Track/Mission semantic validator 与显式 profile context，未读 fs/cwd、未转 XML 或改写未知字段。首次 10 pass / 74 assertions；typecheck 66086 exit 0。补结构+语义 codec 组合、上下文快照、集中 root/task 状态 vocabulary 后，领域 logic 全测试 + repository/Kind 目标合跑 70 pass / 481 assertions / 8 files（semantic 11 tests）。保留 root/task/DAG/Ports/Hook/GapLoop/ActorSet/ProjectRef/selected-task 规则；额外拒绝重复 Schedule 声明、未知 MissionLink ProjectRef，并把未观测 profile 明确标 warning/strict error。未减少任何 hook/verification 执行频率。外部 consumer 改为 strict semantic codec 待重跑；完整领域 graph/Behavior/Decision/modeling/engineering 仍未迁完。
- E080 — 2026-09-05 — strict semantic codec + production repository 的 8 tarballs consumer（3129）exit 0，semanticLifecycle=true；typecheck 9869 exit 0。architecture domain-core（19816）exit 0：237 pass / 1223 assertions / 55 files。只读 inline differential check 对旧 GOOD_XNL_MISSION 原夹具和 16 个故障变体共 17 项运行新旧 Mission validator，error/no-error 判定一致；不等同全部历史迁移。已把重放逻辑保存为 verification/lifecycle-parity.ts，下一步运行该文件和完整 check。
- E081 — 2026-09-05 — `bun .cdmt-lite/missions/active/codument-cli-skill-app-refactor/verification/lifecycle-parity.ts` exit 0：17 项新旧 Mission 验证判定一致。完整 check（39130）exit 1：492 pass / 3 fail / 2591 assertions / 495 tests / 104 files；typecheck/lint 通过，仍仅 E029 文档缺失断言。该快照在新增 Behavior 代码之前。
- E082 — 2026-09-05 — 新增 Behavior/BehaviorPatch 纯语义检查与完整树的 checked native mutation 提案，提案类型归 contract。保留 Requirement/Statement/KnowledgeHint、operation/selector/single Upsert target 规则；未知 portable properties 不经过旧 XML DTO。与 lifecycle semantic 合跑 16 pass / 100 assertions（Behavior 5 tests）。整理共同只读树遍历到 logic 内部 validation-tree，不增加跨包私有依赖。尚未实现 BehaviorPatch selector 应用/源文件结构 writer/归档晋升，不能把提案当正式资源落盘。typecheck 81190 在跑，consumer 已加公共包 Behavior 用例待运行。
- E083 — 2026-09-05 — 只读保护范围摘要再检查，exit 0：src 158 files / c6390722135a5c63eb3d00b5fded4791c81e03a2c2668e8e8cf8b018d1cb6f53；codument 743 files / 4045db2629e9bb4d52b20aae78d9f5ea447cfa0192b269d76b065faad160ea03；用户 attractor 727c6ed70650a2f695b7018aa0ff5aec4d1da3bcca60d62a23bf96a54deed59c。均仍同初始基线；git status 仅原 attractor 修改、.cdmt-lite/、project/，未变更真实 dogfood 或外部 Halfcode。
- E084 — 2026-09-05 — Behavior public consumer（13227）exit 0，8 tarballs 与完整树 mutation 提案实测；typecheck 81190 exit 0，architecture domain-core（19381）exit 0：242 pass / 1245 assertions / 56 files。该快照先于新 Decision 部分。
- E085 — 2026-09-05 — 读取旧 commands/decisions.ts 1–770 行与 decisions/registry.ts 后，将纯 records/option-answer/hierarchy/reference/cycle 规则迁到 domain-logic，数据形状/已解决状态词汇归 contract；source map 显式传入，正常 admission 改为新 envelope/spec，legacy Markdown/兼容 metadata 未混入。新增 8 pass / 45 assertions：完整反馈/推荐选项、pending/strict/durable、嵌套路径、跨文件引用、隐式 parent 环、malformed/duplicate/旧 envelope/slot-collapse 拒绝。未实现 frontier/晋升或写入，Kind 仍 experimental。typecheck 10214 与新 Decision tarball consumer 将继续核验。
- E086 — 2026-09-05 — typecheck 10214 exit 0、Decision public consumer（21959）exit 0；随后 source mode 自检发现 umask 可收紧临时文件 mode，补 chmod 恢复精确原权限并将测试由 0640 改为 0666，repository 14 pass / 74 assertions。architecture domain-core（31964）exit 0：250 pass / 1290 assertions / 57 files（先于 frontier 新增）。
- E087 — 2026-09-05 — Decision frontier 迁为纯来源→投影；复用相同 parsed refs，保留 pending/parent/depends_on/priority/来源字段，修复旧 frontier 把 decision:// 引用当 literal ID 而错误阻塞的问题（validator 已支持该 URI）。新增父层、deferred、优先级、URI、损坏图拒绝后 Decision tests 10 pass / 51 assertions。未新增激活式调度语义，仍保留原 frontier 的依赖/父层门控范围；晋升与 legacy 兜底待后继。consumer、architecture、完整 check 将在当前快照串行重跑。
- E088 — 2026-09-05 — 包含 mode 修正与 Decision frontier 的最终本批 consumer（99148）exit 0：8 tarballs，production-filesystem/strict semantic/Behavior/Decision validation/frontier 通过。全 mission 仍 UNVERIFIED。随后阅读旧 modeling/schema.ts 与当前 depa-expert tao/dimension-data.md、fact-source-truth.md，确认旧必填 fact_grade/封闭七级集合不能直接成为新作者规范；将兼容读取与新 DataTopology authoring 分开设计，历史字段保留，无法确定 role/model/owner 的转换进入 review，不臆造等价 mapping。
- E089 — 2026-09-05 — 最终本批 architecture domain-core（95994）exit 0：252 pass / 1296 assertions / 57 files。完整 check（73516）exit 1：507 pass / 3 fail / 2664 assertions / 510 tests / 106 files，typecheck/lint 通过，仍仅 E029 的 README/docs 缺失。包含 source mode、strict lifecycle、Behavior 和 Decision frontier 的当前代码；未更改或删除那三条断言。之后只读旧 modeling registry/validate/config，为 D12 与后续迁入补观察，不把未开始的 modeling 代码算已完成。
- E090 — 2026-09-05 — 用户增量目标触发 design-only 重规划：三命令 init/status/upgrade-workspace 暂不合并，正式目录 codument/ 固定，大部分能力 CLI-first。完整读取 cdmt-mission-lite/depa-expert 入口与必要 Data/Effect/runtime/Actor/package-role 协议；只读 Omni 指定 mission 三文件及实际 serve-command-transport.ts，发现实际 LocalFunction openApi/database local 策略已不同于其初版 design，不机械移植。只读本项目 resource/LocalFunction/Page/browser/MCP command→runtime 路径：大部分资源命令已 local，聚合 runtime 与 LF pageWorkflow 进程内 owner 是新增重构重点；当前 database 为 SQLite。新增 analysis/cli-serve-placement.md、design/cli-first-runtime.md；同步 MISSION、architecture、migration、analysis manifest、loop、acceptance。原三命令自动组合方案由 D13–D16 覆盖，不改产品源码、外部 Omni/Halfcode 或真实 workspace。
- E091 — 2026-09-05 — 规划验证 exit 0（inline Bun read-only assertions + `git diff --check`）：8 份本轮设计/计划文档、29 个相对文件链接存在、15 个 Work graph 节点依赖有向无环、8 个期望与 14 个约束均被 Covers 引用；最终发行必须经过三命令讨论与确认后接入节点；无尾随空白。源码保护前后以 `git ls-files --cached --others --exclude-standard -z -- src codument project` 排序，逐项 hash 字节（symlink 为 link text，missing 为标记），再对 path+NUL+hash 的换行序列做 SHA-256：1203 项，两次均为 42cf3e196a3ff6a5bf4c9c9a8d00b76d41da81ff115f918e74553b656b928a12。该摘要只覆盖 Git tracked/eligible source，与 E083 递归算法口径不同。git status 仍仅原用户 attractor 修改、.cdmt-lite/、project/。本轮未运行产品测试/build/Serve/browser，新增 serve-placement 与 core suites 均 UNVERIFIED；本轮规划完成后等待确认，不将 mission 标 completed。
- E092 — 2026-09-05 — 用户授权继续更正后的规划，Round 9 恢复实施；读取 Mission Lite / DEPA / simplify 与必要协议，保持三命令合并冻结。新增 generic CommandExecutionPolicy、精确叶子 resolver/validation，产品每个 executable（包括 serve 默认入口）显式声明 policy；不继承父组，不接受未知 policy。首次窄测试 exit 0：9 pass / 59 assertions / 2 files；typecheck 38929 exit 0。
- E093 — 2026-09-05 — production CLI 按 policy 组合 runtime；local catalog/普通 LF 无 PageWorkflow、Codex、HTTP Server/Serve process；PageProjection 与 live PageHost 拆开，Serve manager/child/MCP connection 独立。LF 纯 capability placement 在 skill-app-logic；新增 pinned prepare API 与 host-admitted profile，pageWorkflow 走窄 typed Serve ingress，workspace/agent/instance/source/profile proof 复验，拒绝裸 CLI pageTargets、未知字段/能力与失效来源，不自动 start/retry/fallback。Page/MCP 原 allowlist 共用 catalog 操作，旧 workflow 注入测试改为明确 host API，并新增 CLI 私有 owner 拒绝断言。未改三命令 handlers、src、真实 codument/ 或外部仓库。
- E094 — 2026-09-05 — 首轮新真实夹具测试 8 pass / 2 fail：预期错误文案大小写不符、SOP FQN 缺 canonical SOP 段，均修夹具未放宽产品判定。重跑 96202 exit 0：10 pass / 177 assertions / 2 files。增加 Host-owned browser binding/lifetime fail-closed 与 Serve/MCP ownership 后，serve-placement --scope policy（63557）exit 0：20 pass / 258 assertions / 4 files；该 gate 明确 runtimeLifecycle/fullMission=UNVERIFIED。typecheck 55832 报测试 fetch stub 缺 Bun preconnect，已改真实形状，正在完整 check 12093 重验。simplify 仅整理本轮 Page runtime 条件组合，避免普通命令获取 Page build factories；仍需完整 lifecycle/真实 transport/外部 consumer 验收，不能将 policy PASS 等同 runtime 节点 done。
- E095 — 2026-09-05 — 完整 check 12093 exit 1：typecheck/lint 通过，515 pass / 3 fail / 2855 assertions / 518 tests / 108 files；仍仅 E029 三处 README/docs 缺失。architecture domain-core（18691）exit 0：254 pass / 1306 assertions / 58 files。此快照先于后续 PageWorkflow preflight/profile/pinned close 补充。
- E096 — 2026-09-05 — PageWorkflow start 补本地 definition/schema/selector preflight，未知 FQN 不触达原自动 start 路径。生产 CLI→真实临时 loopback HTTP→已有注入 Workflow owner 的 LF 调用通过，JSON result 保留，调用一次且 CLI 退出后 owner 仍可用；未启动真实 browser/Agent。policy gate 13964 exit 0：22 pass / 264 assertions / 4 files。Notes 外部 11 tarballs consumer（93012）exit 0，新增 public PageProjection 与 prepared LF 用例，原 resource-first/code-first/custom Kind/HTTP/browser/Vue/MCP 闭包通过；realBrowser=NOT_RUN，realMessagesSent=false。
- E097 — 2026-09-05 — 新 profile drift fixture 首次失败因显式 KindDefinitions catalog 缺 ConfigurationProfile 定义，补 fixture declaration 后实测通过；这是旧显式 catalog fixture，不是新版 workspace 复制 Kind 的设计。profile digest 变化、已 admission profile 固定、未知 selector 拒绝均通过。LF public close 新增 admission/drain，prepared handler 在源换代后仍固定但 close 后不能继续执行；产品先 drain LF 再释放 Workflow 和 module。12 pass / 210 assertions / 2 files（36571），typecheck 46054 exit 0。完整 check 49036 正在覆盖最新代码，之后重跑 consumer。
- E098 — 2026-09-05 — 再次只读根保护摘要：src 158 / c6390722135a5c63eb3d00b5fded4791c81e03a2c2668e8e8cf8b018d1cb6f53；codument 743 / 4045db2629e9bb4d52b20aae78d9f5ea447cfa0192b269d76b065faad160ea03；用户 attractor 727c6ed70650a2f695b7018aa0ff5aec4d1da3bcca60d62a23bf96a54deed59c。与 E083 相同，git status 仍为原 attractor 修改、.cdmt-lite/、project/。无源 Halfcode/Omni、真实 workspace 或全局安装写入。
- E099 — 2026-09-05 — 本批最新完整 check（49036）exit 1：typecheck/lint 通过，519 pass / 3 fail / 2874 assertions / 522 tests / 108 files，仍仅 E029 三项 README/docs 缺失。最终 policy gate（80443）exit 0：23 pass / 268 assertions / 4 files；完整 Host consumer（13474）exit 0：11 tarballs，含新增 Page projection/prepared LF/关闭后拒绝，其他既有闭包保留。policy 节点 done，runtime 节点 active；完整 runtime/fullMission 仍 UNVERIFIED。新增 verification/cli-first-progress.md 记录未完成范围，不把分面原型算整个生命周期验收。
- E100 — 2026-09-05 — 最新 architecture domain-core（2269）exit 0：255 pass / 1315 assertions / 58 files，包含 pinned LF close 新测试。本批最终 git diff --check 通过；只读 mission DAG 检查初次脚本遗漏 After 的中文分号分隔符，修正校验脚本而非改工作图。当前实现/未完边界已同步 loop、MISSION 与 progress；整体 mission 保持 active，不请求或暗中执行三命令合并。
- E101 — 2026-09-05 — 用户要求通用包归回 Halfcode，采用无 scope halfcode-cli-lite-* 公共包，由 Halfcode/Codument/第三 CLI 消费；本轮要求深入架构设计，未要求立即搬包或发布。读取 depa-expert 与 Mission Lite，创建 analysis/cross-repo-host 的 package/deep dated 分析，按 skill 要求启动三路独立证据盘点。MISSION 期望-3、约束-1/6、AT1 与旧设计入口已修订；旧 D7 的全部 depa 前缀和临时不回写约束被新方向覆盖，历史测试保持原证明范围。
- E102 — 2026-09-05 — 跨仓 inventory 三路独立落盘：33 个物理 manifest（30 非生成）、18 facts、28 路径步骤、12 provenance/distribution 行、9 incident/observation 行；各主题重叠不相加为缺陷总数。fresh 复核 1 FIX_APPLIED（补 custom Kind consumer 正面证据、收窄 Data 判据），fresh 复核 2 NO_GAP，九份叶文档摘要一致；见 cross-repo-host/reviews。仅表示分析证据充分，不证明实现符合或发行完成。gen-architecture-diagram 产出五个现状图，结构/链接检查通过，Mermaid parser/render 未运行。本轮未执行产品测试/build/Serve/browser/install/publish。
- E103 — 2026-09-05 — 独立收敛产出 10 决策/6 候选、33 manifest 逐项处置（RETAIN14/RELOCATE10/SPLIT6/REMOVE3，REMOVE 仅指未来派生 recipe）、14 目标公共包；已有 native/product 身份保留窄例外。四条首批建议、五闸、冲突/依赖/回滚合同与九项后继义务已落盘；工作图改为 23 节点/30 边、无环、8 期望/14 约束全覆盖。新源码 owner 使三个原 active 节点变为 pending/Resume，已有 scoped 证据保留但不替代新验收。fresh 建议复核 1 FIX_APPLIED：修正两处仍只指向 project 旧实现的 Verify，要求上游新包及打包独立消费者；第二轮待完。保护快照前后两次一致：root src/codument/project eligible 1207 项 SHA256 607bcf383a027dce766b4a78057a92fe8b5e5a610e21dd78b6a0cfc1c57bc5c8；Halfcode 全 eligible 658 项 SHA256 74d89ec71de2e202b0b1e1be91101e29b9d510fe0f4e7ba6b23c43cdeb4f0065。算法为 Git cached+others exclude-standard 路径去重排序，逐项 bytes（symlink 用 link text，missing 标记）hash，再 path+NUL+hash 换行合并 SHA256；不含依赖/忽略生成目录。
- E104 — 2026-09-05 — fresh 建议复核 2 NO_GAP，16 份 convergence/recommendation 设计正文与第一轮摘要一致（d6359b4781079177a783f526ca5dafaf6d84c117119f1ff9e08d6b328214f816），确认上游 Verify 修正与阶段门成立。最终父层只读规划校验 exit0：50 文档/214 相对链接，无缺失或尾随空白；23 节点/30 边无环，8 期望/14 约束全覆盖。git diff --check 通过；root status 保留原用户 attractor 修改与未跟踪 project/.cdmt-lite，Halfcode status 为空；两树 source guard 见 E103。cross-repo-host 分析与“设计跨仓公共包归属与消费协议”节点 done，mission 仍 active，下一节点等待用户确认。本轮只改 Mission Lite 文档，未迁包、未改源码、未跑产品测试/build/Serve/browser/install、未发布 npm；设计 NO_GAP 不表示产品 PASS。
- E105 — 2026-09-05 — 用户确认跨仓设计并明确开始实施；Round 11 启动。rec-01 实际 capture/check：H 658 / 74d89ec71de2e202b0b1e1be91101e29b9d510fe0f4e7ba6b23c43cdeb4f0065，C 1207 / 607bcf383a027dce766b4a78057a92fe8b5e5a610e21dd78b6a0cfc1c57bc5c8，与 E103 相同。verification/cross-repo-baseline 保存逐文件 hash/mode、可恢复压缩 bytes、原 lock、HEAD/status；check 验证恢复字节且两树零变化。cross-repo-reconciliation.md 逐能力/identity/recipe 记录来源、暂缓和回退边界。来源节点 done；三命令/发布 gate 未通过。
- E106 — 2026-09-05 — 仅上游新增 T01–T05：56 文件按精确 CLI npm specifier 迁回；T04 只保留 command/shutdown/service/codex 真实组合，T05 只保留 argv，去除 Skill App/Hono production 边；未选资源/live/HTTP 文件保留待后继。新库独立本地版本 0.1.0。receipt 为 verification/cross-repo-cli-relocation.json；H 原私有产品与 C 全部源码不动，未 npm publish。离线 ignore-scripts install 只更新 H lock/依赖链接；上游目标 tests 30 pass / 148 assertions，typecheck 80697 exit0。
- E107 — 2026-09-05 — 上游 verify:public-cli 真实 pack 5 包→封闭 loopback registry（无 npm proxy）→临时 Notes 只声明 capsule/shell/support 三项→contract/logic 按包名传递解析；没有 transitive overrides，实际安装恰好五包，公开 exports 可读、无源码 symlink，CLI JSON/review exit2/lazy help/owned close 通过。首次 fixture 缺 doc 被原 validator 拒绝，补完整 fixture 而非放宽产品规则后 exit0。仍不证明资源身份/最小 Bun/产品采用/full mission；完整 H check 34255 在跑。
- E108 — 2026-09-05 — H 完整 check 34255 为 355 pass/1 fail/1829 assertions：公共包新增使旧 clone 把共享 npm 名称当产品身份替换，且 clone fixture 仅链接原三 workspace。增加显式 halfcodeClone.identity=shared、共享源码/精确包名保护，保留 H 原 allowlist/旧产品身份计划；fixture 链接实际克隆的共享包。clone+clone-safety 重跑96058：8 pass/190 assertions。没有完成 full/source-only/scaffold 三模式，不能提前关闭后继 clone 节点。
- E109 — 2026-09-05 — T06 采用 C 扩展 ports 与 H 原 resource.ts/test 语义基线，暂置 H packages/skill-app-contract-public，旧 scoped source 保留至采用门。T07/T08/T12 归回：13 tests/69 assertions、16 tests/109 assertions及 typecheck通过。按 DEPA 把纯 reader descriptor/registration 构造移入 logic，support 只组合 compiler registries/AJV。compatibility capsule 使用消费方可信 release profiles；两族原完整 lock digest 4765c666f35f1669ca6343bc9607f544393e2f47a1d17c8456222449768b442d / 8edca54643a6d0ee54f883ca2e71a1f48f59012842bdc3db3abe1bbfd31b79a3 精确重现，resolved Page reader、重复 owner/未知profile/name/version/integrity/API/lock drift负例4 tests/20 assertions通过。profile artifact observation 此时是 synthetic effect double，不冒充真实旧制品认证；旧 exact-name code-first 明确要求迁移，无 alias bypass。
- E110 — 2026-09-05 — verify:public-resources 92758及logs/round-11-verify-public-resources.log exit0：9 公共包+9必要vendor的真实隔离安装，无 transitive overrides；resource-first/custom Kind/unknown Kind/作者bytes保持/禁止网络/close通过，实际闭包无Hono/Vue/browser/MCP。vendor因既有发布manifest含workspace devDependencies，在临时目录重包installed production payload，未改node_modules；输出明确不是原registry integrity。H check日志round-11-check.log为389 pass/0 fail/2034 assertions，typecheck/lint通过（先于可选三包新增）。
- E111 — 2026-09-05 — T09/T10/T11 归回，共12 public包；C public ports/browser修复/MCP显式connection沿用，H Vue两组Symbol key保留，builderVersion改由自身manifest派生为0.1.0。MCP product-private Google集成留原产品测试，不搬进通用包。可选tests78950：29 pass/140 assertions+typecheck通过。verify:public-optionals72830/35281打包12包，browser plugin/双实例/debug/编译后detach node_modules、Vue真实worker、MCP内存transport协商/schema/资源读取/关闭通过；使用tarball overrides，不等同普通optional传递解析。simplify整理reader factory，并补worker close幂等性：同一Promise、打包worker重复close通过。realBrowser NOT_RUN、realMessagesSent=false、未发布。最新完整check/四组gate日志由run-upstream-check.ts写独立round-11-final标签，正在运行。
- E112 — 2026-09-05 — run-upstream-check.ts round-11-final 全部 exit0：H check 418 pass/0 fail/2174 assertions/90 files；CLI、resources、optionals 实际打包消费通过。日志 round-11-final-*；这是桥接/legacy capture 前快照，不覆盖后来源码。
- E113 — 2026-09-05 — 显式 global/Vue 单 implementation bridge 6 tests/26 assertions，冲突 preflight、accessor 不执行、无 import-time global writes、重复调用和 Vue app 隔离通过。round-11-compatibility-check.log 424 pass/0 fail/2200 assertions；optional probe 初次因 fixture 漏声明 skill-app-support 失败，补 consumer 自身依赖而非给 Vue 公共包增加依赖。后续 round-11-captured-legacy-verify-public-optionals.log / round-11-closure-final-verify-public-optionals.log 均 exit0，真实打包桥接通过。产品尚未采用这些桥。
- E114 — 2026-09-05 — legacy-public-fixtures.json 来自两族冻结的完整旧 locks；实际 pack H scoped/C depa 旧 contract，再由正常解析安装的新公共 capsule 执行精确兼容 admission。round-11-compatibility-verify-public-legacy.log exit0：完整旧 lock/reader 重现，损坏 archive、伪 alias 拒绝，旧 exact-name code-first 明确 LEGACY_PACKAGE_ENTRY_REQUIRES_MIGRATION，不静默放宽 loader。SHA512 来自实际本地 archives；这是本地发行 fixture receipt，不是历史 npm 发布者认证，真实产品迁移/旧名发布 gate 留在后继节点。
- E115 — 2026-09-05 — R04 legacy 分支修复：catalog 和 materializer 使用同一 captured static relative module graph digest，入口/依赖字节暂存在 owner generation 后执行；5 tests/33 assertions 验证无变更、admission 后入口/依赖变更执行原bytes、snapshot 后依赖变化拒绝、unsupported closure 拒绝、close 清理而不动作者文件。新增实际 public resource consumer 也通过 dependency mutation。明确不冻结任意 handler IO，不宣称 package metadata/node_modules 已解决；R05 和 rec-03 组合 receipt 仍欠，rec-04 保持 active。round-11-captured-legacy-check.log 首次 typecheck 因测试比较 optional digest 失败，显式断言已存在 digest 修复；未删测试。
- E116 — 2026-09-05 — 最新 H source 最宽验证：run-upstream-check.ts round-11-closure-final exit0，check=429 pass/0 fail/2233 assertions/93 files，typecheck/lint 通过；verify public CLI/resources/optionals/legacy 全部 exit0，完整日志 round-11-closure-final-*，public pack integrity 在各日志中。verify-minimum-bun.ts round-11-minimum-closure 三组 exit0：下载固定 @oven/bun-darwin-aarch64@1.3.0 tarball并验证SHA512，二进制SHA256 ce7b4f94a13ee0f881b06cfb4e428a017ddc69c3307dae0cb86709042fe0c058；Bun1.3.0运行CLI、resources+legacy+captured dependency、browser/Vue worker/MCP/bridges。仅Darwin arm64；无全局安装改动，临时下载清理。可选依赖仍使用overrides、realBrowser NOT_RUN、未发送真实消息/发布npm；不代表三消费者或完整产品验收。
- E117 — 2026-09-05 — 最终来源保护复核：H 867 eligible files，digest 905619bf90928b1b4ad32ce80b58c1e49cf4d559f10ce1d3d99a2b3c7b283533；相对基线214个变更路径、无移除，逐路径输入来源/当前SHA256见cross-repo-output-round-11.json。H tracked仅bun.lock/package.json/clone.ts及两项clone tests变化，其余为新增public源码/验证；git diff --check exit0。C src/codument/project共1207 eligible files零变化，digest仍607bcf383a027dce766b4a78057a92fe8b5e5a610e21dd78b6a0cfc1c57bc5c8。rec-01/02 done；rec-04仅legacy分支已有证据，R05/T13/T14/两产品采用及完整mission仍未完成。长回合中途交接，状态active，未归档；全部测试进程已结束。
- E118 — 2026-09-06 — 用户同意继续，Round 12 恢复。H 重新观察仍为 E117 的867项/digest905619bf…；C status仍仅用户已有attractor修改及project/.cdmt-lite未跟踪目录。按DEPA与Mission Lite继续rec-04，不更改三命令、产品采用、真实workspace或发布gate；Weaver策略两Git根均excluded。
- E119 — 2026-09-06 — R05 deterministic capture/build barrier 复现：初始6项测试2pass/4fail；修改已安装依赖bytes或exports时旧实现实际返回unadmitted-local，package.json变更被复制进stage，source变更旧实现明确拒绝。修复为T08捕获source/package.json/本地config与已解析production dependency payload+resolution edges，T06提供captured-package/v1 receipt，build只读取独立generation内材料；不再链接原node_modules。原精确contract/package/lock/integrity校验保留，另加capture前后metadata复验。不是npm发布者认证或任意handler IO沙箱；tsconfig extends、依赖包内部symlink显式拒绝。
- E120 — 2026-09-06 — 新package-closure.test.ts最终单测1320 exit0：11pass/0fail/41assertions，覆盖六种capture后变化、catalog失效、双实例释放、复制bytes不可反改、越界导入拒绝/cleanup/修复后重试、close等待capture并携带receipt、unsupported closure及exact版本负例。过程中修复macOS realpath(/var与/private/var)导致误拒绝；Bun AggregateError吞诊断改为保留typed boundary failure，测试依据code而非消息片段；两次中间负例失败不冒充通过。真实public-resources 60592 exit0，新增codeFirstCapturedPackage=true：从封闭registry正常安装真实public contract/compiler后，移走原node_modules且改写原manifest/lock，仍从captured closure构建执行。第一次fixture嵌套安装未产生独立lock被原validator拒绝，改为独立consumer目录+save-text-lockfile，未放松产品校验。全量及最小Bun最终复验进行中，不提前判rec-04整体完成。
- E121 — 2026-09-06 — run-upstream-check.ts round-12-package-closure 全部exit0：H check=440pass/0fail/2274assertions/94files，typecheck/lint通过；CLI/resources/optionals/legacy四组真实pack消费通过，日志round-12-package-closure-*含制品hash。verify-minimum-bun.ts round-12-minimum-package 的CLI/resources(含legacy与captured package)/optionals三组均Bun1.3.0 exit0；下载SRI和binary digest同E116，不更改全局安装。rec-04 case1–3已有有界证据，case4仍需与rec-03的server receipt合流，所以该节点保持active。可选依赖仍用overrides，不声称普通optional解析/三消费者/产品采用/fullmission已验收。
- E122 — 2026-09-06 — rec-03 T06/T07/T12公开execution接缝：BundleDefinitionCatalog.resolve一次返回handler+material receipt；旧custom catalogs可维持原API，但新admission对缺少atomic receipt明确拒绝。runtime-first准入、profile单次捕获、local/live决策、窄request及server identity/profile/material复验、executor drain已实现。7tests/52assertions通过；真实public-resources90504 exit0，localWithoutLive/liveReadmission=true，无Hono/live强依赖。初始typecheck的implicit-any/unknown narrowing和profile夹具缺appConfigurationRefs分别显式修正；未放松原业务校验。
- E123 — 2026-09-06 — 上游新增T13 live-host-capsule与T14 http-shell，共14目标公共包；从冻结C精确归位13个Page/HTTP源码及测试，原C不改。首轮机械import变换受shell插值影响产生非法specifier，未运行/验收该状态；重读每份原始文件，经安全参数传递和精确npm specifier变换重应用，再通过typecheck。Page contracts归T06，Page workflow关闭先于projection；惰性Page owner并发single-flight/实例隔离/取消前dispatch/关闭时acquire回收/依赖逆序释放，HTTP窄入口Origin/JSON/fields/诊断保密测试共23pass/100assertions。首次新测试遗漏dev dependency且误用Workspace factory名，补测试依赖、真实公开factory与完整typed double后通过。public optional真实新live组合63824尚失败RESOURCES_NOT_READY，已补catalog diagnostic观测；不得将T13/T14存在或旧17项迁入测试当完整runtime PASS。
- E124 — 2026-09-06 — E123 diagnostic定位为fixture XNL exports列表误用逗号（RESOURCE_XNL_SYNTAX），修正成原XNL语法而非改validator。随后public optionals51919 exit0：14真实公共tarballs，HTTP shell→公共server re-admission→LF→真实PageWorkflow coordinator→受控browser port执行、同root双实例、并发single acquisition、source变更拒绝和关闭隔离通过；Vue真实worker经T13 PageBuildCoordinator/T08 file store发布可读取asset并关闭，MCP独立transport回归仍通过。code-first公共receipt组合18269 exit0，actual package dependencyDigest随LF admission携带，合法server调用一次成功，移走原依赖及改manifest/lock后server明确拒绝，而captured artifact仍执行原bytes。realBrowser NOT_RUN；HTTP只loopback，不代表产品采用或全部backend placement。
- E125 — 2026-09-06 — run-upstream-check.ts round-12-live-final五组全部exit0：H check470pass/0fail/2427assertions/102files，typecheck/lint通过；四组public pack消费通过。verify-minimum-bun.ts round-12-minimum-live三组Bun1.3.0 exit0，含新公共LF/code-first/server/Vue-coordinator/live-HTTP组合。日志保持不可覆盖。随后边界自检补scoped dependency name中dot segment拒绝与失败provider cleanup不可重试负例，当前最终源码需round-12-audit-final复验，不能拿本条470pass代表后来两项修改。
- E126 — 2026-09-06 — 最终H源码run-upstream-check.ts round-12-audit-final五组全部exit0：check472pass/0fail/2439assertions/102files；typecheck/lint及CLI/resources/optionals/legacy全部通过。source保护check：H899eligible/digest77c0becf0e57cb37568291a776c98e471a5dfc09d552f3c7ec23ae9589a5c4b0，相对初始5tracked修改+241新增、无移除，cross-repo-output-round-12.json含246路径hash与来源。C保护1207文件无改动/无新增，digest仍607bcf383a027dce766b4a78057a92fe8b5e5a610e21dd78b6a0cfc1c57bc5c8；两Git diff --check通过。实际runtime边界与未完成项见round-12-conformance.md。
- E127 — 2026-09-06 — 最低Bun最新复验遭遇运行时下载瓶颈：fetch60s Timeout；换curl同URL60s exit28，仅收到1105321/23047454bytes。两次都在consumer启动前失败、临时目录finally清理；失败日志round-12-minimum-audit-download.log及round-12-minimum-audit-curl-failure.log保留。只读缓存搜索没有发现所需版本；镜像HEAD得到302有效artifact地址，因此第三次使用--curl-mirror，仍必须匹配既有固定SHA512后才执行，绝不接受不同Bun版本或无校验包。该恢复尚在运行，不提前宣称最低版最终状态通过。
- E128 — 2026-09-06 — 镜像60s收到7298525/23047454bytes仍timeout，保存mirror-failure.log；仅延长下载到240s（测试180s不改）后runtime下载成功，SHA512仍WeXSaL29…、binarySHA256仍ce7b4f94…，与E116精确相同。round-12-minimum-audit-mirror-long的CLI、resources(含旧profile及code-first/server实际receipt)均exit0；optionals子进程180s超时exit137。只读ps/lsof证实停在Bun1.3.0 install --offline --ignore-scripts，仍有registry HTTPS连接，尚未执行browser/Vue/MCP/live测试；这是当前安装/外部依赖缺口，不能冒充产品测试失败或最低版全绿。该版本此前E125的optional同组已通过，但不替代本次结果。所有测试进程已结束，失败日志保留；后续需真正受控包源/可复现安装，不以延长测试超时或删断言解决。
- E129 — 2026-09-06 — 只读结构复核：14公共包role后缀均合法、production依赖图无环、基础CLI五包只依赖本闭包、live无Hono/browser/Vue/MCP具体production依赖。Mission工作图23节点30边无环，期望8/约束14覆盖不变。rec-04四组受限材料合同由E121/E124/E126及最低Bun最新resources通过闭合，节点done；完整runtime节点仍active，剩余public client transport/backend placement/aggregate lifecycle、两产品采用等见round-12-conformance.md。本轮长回合中途交接，不归档、不宣称mission完成；C源码保护仍成立。
- E130 — 2026-09-06 — E128超时后确认所有相关测试/安装进程已结束；只删除本轮拥有的216KB临时optional fixture目录halfcode-public-optional-ORObGj（已确认非symlink），原H/C源码与持久日志未删。中途交接已同步loop的Actual/Last/Next和conformance限制；未创建Codument原生track/mission，未改三个暂停命令/真实workspace/全局Bun安装，未发布npm。
- E131 — 2026-09-06 — 用户同意继续执行后，按Mission Lite与DEPA重新读取mission/吸引子/编码协议及两仓说明，cross-repo-baseline.ts check exit0：H899项digest77c0becf…与E126一致，C1207保护项零变化/digest607bcf38…。两Git根均命中Weaver infra-dev排除策略，不调用MCP采集。选取rec-03公共client/runtime与E128安装缺口，未重做已完成材料捕获或改三暂停命令。
- E132 — 2026-09-06 — optional安装改成本地封闭registry、独立cache/user npmrc、真实public name/version依赖解析，不再依赖--offline或transitive overrides。保留round-13-optional-first.log（缺root级vue，改从实际依赖图定位）、second.log（CLI shell并非已声明消费依赖，补真实CLI capsule/shell消费）、optional-client.log（新命令缺doc被现有validator拒绝，补doc）三次失败。中间run-upstream-check round-13-client-check中public CLI/resources/optionals/legacy全部exit0；check因测试Response.redirect传URL而非string失败。另两次typecheck暴露Bun fetch.preconnect与RequestInfo类型边界，改为准确的fetch调用签名而非放宽检查。
- E133 — 2026-09-06 — 公共client精确record/probe/root/agent/instance/receipt复验、JSON payload固定、无start/retry/redirect，及T14只读实例probe已实施。随后T04 opt-in invocation runtime scope通过目标测试；run-upstream-check round-13-scoped-final五组exit0：H487pass/0fail/2528assertions/105files；public包consumer包含真实CLI→公共client→HTTP→PageWorkflow。verify-minimum-bun round-13-minimum-client固定Bun1.3.0及原SHA512校验后CLI/resources/optionals三组exit0，E128安装缺口在本平台受控材料下已恢复。不把此结果外推到随后新增重入关闭/phase cleanup/backend组合源码。
- E134 — 2026-09-06 — 编码复核发现invocation factory同步重入dispose可能先于inFlight登记，改为先登记后microtask执行并加负例。新增T01/T04显式owned runtime lifetime，停止admission/drain后按execution→live（Page/Codex）→providers→resources关闭，各阶段失败仍继续，重复ownership拒绝、borrowed不关闭；9目标tests/36assertions通过。实际packed live fixture采用该聚合关闭。再加入叶子policy与admitted capability/backend lifetime纯组合及T09已观察one-shot bindings，未知backend/伪造lifetime拒绝，entrypoint保持独立。最终round-13-final与round-13-minimum-final已启动，尚待观测；详细职责与未完成合同见round-13-conformance.md。
- E135 — 2026-09-06 — 最终源码验证：run-upstream-check.ts round-13-final五组全部exit0，H check494pass/0fail/2557assertions/108files、typecheck/lint通过；public CLI/resources/optionals/legacy全部通过，含按调用runtime、真实公共CLI→精确record/probe client→HTTP→PageWorkflow与聚合释放。verify-minimum-bun.ts round-13-minimum-final --curl-mirror固定1.3.0（原archive SHA512与binarySHA256 ce7b4f94…不变）CLI/resources/optionals三组全部exit0；optional现在使用受控loopback registry、正常name/version传递解析、无overrides，E128缺口已在该测试平台恢复。vendor包为已安装材料重打包，不宣称原publisher认证/跨平台/产品采用。所有成功日志和先前失败日志保留。
- E136 — 2026-09-06 — 最后源保护：H910eligible/digest a34275c2e6f4dd6f396bf8e882fd8dd15bfd6dfd248748f6fd0f599c0b55f5f4，较Round12共28路径变化、11新增、无移除；cross-repo-output-round-13.json保存来源/hash。C src/codument/project仍1207项零变化/digest607bcf38…；两Git diff --check exit0。只读公共manifest审核14包role合法/生产依赖无环/基础CLI五包闭包不含live或domain。所有本轮验证进程已结束，隔离fixture由验证脚本finally清理，没有删除用户文件。按depa-expert与simplify本地复核收敛了effect/owner边界和inFlight登记，不冒充fresh最终验收；rec-03保留active，具体后继runtime capability acquisition已写Next。长回合中途交接，不归档、不改三命令、不发布npm、不触碰实际workspace。
- E137 — 2026-09-06 — 用户纠正控制器执行纪律后，完整重读Mission Lite及cybernetic-loop、DEPA、MISSION/三个attractor，按实际态继续而非按批次交接。只读重观察H910项hash a34275c2…、C1207保护项hash607bcf38…仍同E136，两Git根仍命中Weaver排除策略。选取rec-03实际capability acquisition（冻结C runtime/local-functions.ts）；不改期望态/三命令gate，不重做已过线材料捕获。
- E138 — 2026-09-06 — rec-03通用能力构造已归T06窄context/effects、T07 grants/profile投影、T12真实SQLite composition；无私有CommandRuntime依赖，按需acquire/partial rollback、profile一次选择、配置白名单/数据库object-identity claims/Page target借用保留。初始typecheck暴露Object.freeze callback implicit-any及测试receipt/target/valueFrom字段不完整；初始测试5pass1fail源于夹具漏appConfigurationRefs。修正完整类型与声明后目标6tests/37assertions exit0，真实SQLite跨调用隔离与validation/handler/output失败释放通过。公共pack消费者已改接真实bindings，最宽及pack复验将运行；不将该局部结果标成rec-03完成。
- E139 — 2026-09-06 — round-14-capabilities五组exit0，check500pass/0fail/2594assertions/109files；公共resources/optionals实际绑定已迁capability acquisition，无T12到live/browser依赖。随后继续实现T09真实one-shot provider映射（四组合实际effects，2tests32assertions），T12 descriptor/request现成组合与不依赖builder的Page/Site只读投影。Page初始fixture误用DirectoryResourceCatalog被内置Kind拒绝，改成真实ManifestResourceCatalog而非放宽Kind后1test10assertions过线。request facet8tests过线。新pack矩阵覆盖同一CLI叶子四个真实provider（子进程IO替身），live聚合加入真实受控Codex协议子进程并把provider释放移至Page/Codex之后；round-14-runtime最宽五组正在验证，不用E139前半代替后续源码的最终证据。
- E140 — 2026-09-06 — round-14-runtime五组全部exit0：H503pass/0fail/2636assertions/110files，typecheck/lint及CLI/resources/optionals/legacy过线；四个实际backend经同一公共CLI命令与Page/Codex/provider聚合关闭通过。round-14-minimum-runtime固定Bun1.3.0，CLI/resources/optionals三组exit0，原SRI和binarySHA256不变。只读57叶子inventory无漏/重复，H尚未接policy；C1207保护项无改动，H917项hashad966d09…；两Git whitespace检查过线。rec-03五case与公共抽取满足前置门，见round-14-conformance.md；立即推进B01 Halfcode自消费，不把公共门或完成批次当作返回条件。
- E141 — 2026-09-06 — B01已开始实际修改H产品，而非仅新增public primitives：H cli依赖CLI五包/browser-support，parser/output/resource/Codex/IPC/provider types/OpenCLI/plugin/MDD改用public API；产品session/plugin payload/cache/default identity保留。目标旧测试15pass93assertions+27pass87assertions，typecheck通过。进一步观察Ego旧marker/global不能直接换成generic默认，T09补显式software binding，H三个Ego adapter保留旧marker/taskspace/global；新增产品protocol三例与public backend两例共5pass55assertions。bun install --ignore-scripts --offline仅更新H workspace lock，未全局安装。接下来运行round-14-adoption-effects最宽五组；B01仍active，resource legacy profile/full product-capsule/cli-shell/runtime尚未采用，不冒充自消费完成。
- E142 — 2026-09-06 — round-14-adoption-effects五组exit0：H506pass/0fail/2659assertions/111files，typecheck/lint及四public pack gates通过。随后继续B01，把实际browser/Codex/resource组合归H product-capsule（product身份，不属于14共享包），H runtime/effects转调公开product exports。首次typecheck指出新Codex组合漏显式socketPath，补defaultIpcSocketPath后exit0。新增--halfcode-product受控registry安装与actual product effects消费：预期旧协议marker/plugin、source/embedded资源、真实受控owned sidecar reaped及borrowed不关；尚待round-14-product-effects六组证据，完整product command/template/runtime/legacy闭包未完成。
- E143 — 2026-09-06 — round-14-product-effects六组中四public门与新增product-effects均exit0；product tarball实际消费旧marker/plugin、source/embedded资源、owned Codex子进程回收及borrowed不关通过。check=505pass/1fail，失败为clone fixture仅链接shared包，新增product包缺link，真实clone另有新product包未遵从--package-name scope的命名缺口（原hardcoded8包表不覆盖新增product身份）。不同恢复路径：扩展显式product身份的包名前缀映射，并让fixture按克隆后manifest链接product；不改shared身份、不删clone断言、不提前实现B05完整scaffold/full-snapshot。修复与复验尚待后续证据。
- E144 — 2026-09-06 — clone修复后目标8tests/194assertions exit0；round-14-clone-recovery六组全部exit0，H check506pass/0fail/2663assertions/111files，四public gates与product-effects真实pack消费均通过。scoped首次clone及再次clone的新product包都按package前缀命名，shared依赖仍不重命名。继续B01真实registry与runtime采用；该结果不代表whole product已打包或Codument旧命令已迁完。
- E145 — 2026-09-06 — H真实registry的57叶子接公共definition/policy/dispatcher，旧registry7tests49assertions过线；新增product CLI shell保留产品参数/help/identity，index转实际invocation-scoped公共Host。基础profile仅workspace/resources，help/version不构造runtime；非basic仍显式legacy composition，不冒充完整CLI-first。MCP已转公共connection并返回closed作为wait，实测SDK不把stdin EOF转onclose，产品stdio边界补EOF→close；owned runtime聚合Page/build/Codex/provider关闭并复用public shutdown。三旧目标15tests88assertions/typecheck过线。新增shell夹具初次4pass2fail系漏createArgvSchema第三个options参数，补完整调用后6tests92assertions过线；追加真实MCP握手→tools/list→EOF正常exit0，无强杀/真实browser/Codex消息，production三例78assertions过线。验证命令曾因PATH仅作用第一条命令导致bun/bunx not found，改成每条显式PATH后typecheck exit0；不变更全局运行时。
- E146 — 2026-09-06 — round-14-product-shell六组全部exit0，check509pass/0fail/2741assertions/112files，新增product shell实际tarball经公共Host普通解析与关闭过线。观察到root test显式目录列表尚未收录新shell四例（这四例此前独立通过），已补聚合入口；随后继续SOP/Workspace/definition-global实际采用，不能把509pass当作这些后续改动的证据。SOP纯projection收窄到validated snapshot，不再借用不需要的reader/materializer owner；旧SOP协议/命令与shell四组35tests88assertions、typecheck过线。SOP及Workspace实现改为public消费，产品仅保留privateDirectory/cwd兼容默认；script global正接单一public definition API，未改旧Kind identity/精确包协议或伪造legacy artifact observation，完整资源兼容门仍待。
- E147 — 2026-09-06 — SOP/Workspace/global/schema实际采用后，resources-install/sop-notebook/LF/kind-native/MCP五组31tests197assertions与typecheck过线。产品runtime拆分basic/catalog/page-catalog/browser/serve-client/serve-manager；真实Page list/Resource.validate无live owner、空root不生私有文件，连同OpenCLI6例共11tests137assertions过线。随后LF descriptor/capability acquisition改用公共catalog与Bun bindings，product只转换显式runtime并保留clock/ID默认；LF/profile14tests54assertions和typecheck过线。新增实际product adapter SQLite成功/输出失败均释放、注入clock/ID生效及catalog close拒绝用例，与shell/runtime共10tests145assertions通过。LF动态HTTP placement、完整资源materializer与product包闭包仍欠；不将局部拆分称完整B01。
- E148 — 2026-09-06 — H原host reader算法改调public logic/support，product-capsule仅固定原semantic owner/profile数据；默认native reader binding不宣称认证旧artifact，也未修改/放宽旧code-first package protocol。对照不可变legacy-public-fixtures完整KindContractLock逐字段相等，digest仍sha256:4765c666f35f1669ca6343bc9607f544393e2f47a1d17c8456222449768b442d，新增15个内置Kind source投影不写workspace。初始tests/typecheck抢在异步install完成前启动导致module missing；观察install13.16s成功与真实symlinks后重跑，13tests35assertions/typecheck过线。新product tarball fixture将直接验证reader旧lock/global同实现；config catalog也正转public。正式旧artifact映射/产品code-first桥或明确迁移仍须独立准入证据，未造假receipt或以native绑定关闭兼容门。
- E149 — 2026-09-06 — round-14-product-readers六组中五个public/product pack gates exit0；check515pass/1fail，clone两种类型入口对JsonSchema的星号导出不一致产生TS2308。没有放宽typecheck或移除clone断言；旧/公共contract的resource入口都明确从shared重导出同一JsonSchema，保留所有入口。随后实际clone两例141assertions exit0。后续最宽重验待新label，不以局部修复覆盖失败日志；B01仍active。
- E150 — 2026-09-06 — round-14-reader-recovery六组全部exit0，H516pass/0fail/2808assertions/114files；public CLI/resources/optionals/legacy/product-effects正常tarball消费均过线。之后继续B01资源装配，以下新增源码不由该证据覆盖。
- E151 — 2026-09-06 — 公共包协议新增显式software-owned authoring name绑定，默认仍只接受public精确名称；H固定原scoped名称且保留版本/compiler/lock完整tuple校验，不做alias、不把installed目录hash冒充publisher认证。H catalog/Bundle/Page/Site/materializers实际转共享实现，产品resource capsule持有单一resource/definition生命周期。最初typecheck发现漏binding参数/fixture新增字段及beforeLoad返回类型，目标测试暴露Page/Site漏传policy、cleanup漏空阶段；修正后26tests213assertions/typecheck通过。HostBundle旧“捕获后拒绝symlink变化”改验更强的captured bytes合同：准入时symlink仍拒绝，捕获后把source移走并改内容，实际产物仍执行原值且close删除自身产物。该语义遵循已批准rec-04，不删除安全检查。产品capsule新增依赖曾在install异步完成前typecheck报module missing，观察install完成后typecheck通过。正式legacy artifact映射/whole executable闭包仍待，B01不标done。
- E152 — 2026-09-06 — round-14-product-catalog五个pack gates均exit0，新增actual product resource host→builtin Kind→LF execution→close通过；check515pass/2fail。一个失败是残留检测仍只扫描旧private目录，已把扫描与唯一rejection sentinel断言移到实际public owner；另一失败为静态闭包把正式API runtime.resources.databaseConnections.require误当CommonJS require。仅豁免该已定义的完整能力路径，不放行一般property require；新增globalThis/module/import.meta/bare/alias/computed require与createRequire/getBuiltinModule负例。profile/HostBundle/残留检测/新词法回归18tests84assertions通过。完整作者包默认/原native exactname负例和公共材料/executor四组31tests143assertions此前通过。继续最宽复验，不以public pack绿遮掩实际产品失败。
- E153 — 2026-09-06 — round-14-catalog-recovery六组exit0：H check518pass/0fail/2830assertions/115files，public CLI/resources/optionals/legacy/product-effects正常tarball消费全部通过。该证据覆盖资源采用与require窄修复，不覆盖随后LF与PageWorkflow接线。
- E154 — 2026-09-06 — H实际LocalFunction CLI接公共typed executor/client，普通调用无Page/Codex/Serve owner，缺live record不自动启动；真正PageWorkflow经当前服务HTTP与公共coordinator执行。隔离loopback测试覆盖实际CLI子进程、服务端source/instance/root/Origin/未知字段负例和错误agent record，未启动真实浏览器或发送消息。PageWorkflow原450行实现替换为公共adapter，保留root overload并显式转移definition close责任。初轮20pass/1fail发现list wrapper失去async拒绝合同；恢复async后目标三组21pass/0fail/78assertions（692e2c），typecheck此前4398 exit0。继续B01构建与常驻生命周期采用，不以局部过线关闭节点。
- E155 — 2026-09-06 — H PageBuild/store/diagnostic、Ego supervisor、PageWorkflow/targets/hubs、Vue worker port、HTTP listener/owner及Page HTTP路由均转公共包实际消费；产品保留cache目录、native worker路径、协议marker及Agent路由。构建首轮18pass/1fail为旧测试预期异常worker句柄永不释放；按已批准owned-close合同改验先close再restart及幂等shutdown，后续PageBuild/Ego/实际LF20tests96assertions通过。worker/Page/Serve31tests87assertions和typecheck通过；实际Serve listener+CLI local/live、真正Vue build/Page/Site/旧HTTP兼容五组20tests136assertions通过（7985）。未丢最后成功产物或更改作者文件；native builder实现归位、完整product capsule/发行闭包仍待。
- E156 — 2026-09-06 — round-14-product-live六组全exit0，H520pass/0fail/2852assertions/116files；四public与product-effects actual tarball gates通过。后续新增源码不由此证据覆盖。重新观察来源保护：C1207项零变化，hash607bcf383a027dce766b4a78057a92fe8b5e5a610e21dd78b6a0cfc1c57bc5c8；H938项hash859b17ebe972147b562d3a4de56b2935830e743617815426d5071a308c209eff为原生适配后的中间快照，原恢复材料完整。
- E157 — 2026-09-06 — H registry/compiled invoke/exec/run-web-api转公共reader与instance loader；删除唯一未再引用的private target-runtime全局client_fetch注入器（可由Git/rec-01恢复），同名CLI能力保留，13tests70assertions/typecheck过线。原native Vue与MCP及scoped authoring入口改为公共机制转发；发现公共MCP硬编码Codument URI/页面名，修为显式product URI/appInfo，公共默认neutral，H原URI保持；新增错误URI/HTML脚本边界及真实MCP子进程资源读取断言。旧contract/Vue/MCP+公共MCP+真实产品50tests342assertions/typecheck通过。随后clone+package矩阵22pass/2fail：纯contract转发遗漏clone可配置semantic authority；恢复仅product identity+公共descriptor派生wrapper，不恢复schema实现副本，准备重验。
- E158 — 2026-09-06 — clone authority窄绑定修复后8tests194assertions/typecheck通过；产品compiled/debug/Web API新增并发双fetch/源变化/global descriptor不变回归，与实际local/live共3tests25assertions通过。完整CLI首次normal registry pack受Bun不允许filename+destination阻止，改用绝对filename（避免scoped与unscoped tarball名称碰撞）；随后92305 exit0：20自有包+vendor闭包普通安装，停registry后仅运行已安装CLI的demo/isolated init-workspace/Resource validate/LF/Page HTTP/Serve graceful exit，无source alias。未运行global init或真实browser/messages。增加原生Vue与MCP实际CLI覆盖后需要新最宽及最低Bun复验，先前成功不覆盖新增断言。
- E159 — 2026-09-06 — round-14-native-adoption七组中六个public/product tarball gates全部exit0，完整安装CLI新增nativeVueBuild/nativeMcpIdentity/Serve graceful exit均通过；check514pass/9fail，仅旧code-first app/module和Page/Site测试在聚合进程失败（public contract app/vue源文件报EISDIR，实际为普通文件）。同源码新进程两文件15tests57assertions exit0，排除稳定单用例失败，正在缩小跨测试状态影响；不降低断言或分拆全量来掩盖回归。round-14-minimum-product固定Bun1.3.0与原binarySHA256，CLI/resources/optionals（包含完整CLI）三组exit0。该最低版及pack成功不能替代失败的最宽source check；B01继续active。
- E160 — 2026-09-06 — E159以原native契约预加载+code-first作者包同进程缩小为20tests/9fail；仅CLI301tests与仅public support组合52tests通过，说明不是原生Vue watcher引起。Bun descriptor build改为统一显式file-input onLoad，保持原解析/版本/lock/path校验；同一失败组合20tests92assertions通过，预加载而跳过契约test body的最小组合也从fail→pass。原失败被保留，未把拆开测试作为修复。H Serve supervisor转T04实际controller，保留product record/thread/health协议；原8tests49assertions和新增product停不掉拒绝restart/record写失败rollback两例8assertions通过。新fixture首次用spread丢失Workspace prototype导致1fail，改为明确继承测试port后通过。typecheck/whitespace过线。
- E161 — 2026-09-06 — B01证据复核发现legacy-public-fixtures中的packageRoot是活动源码：H native契约转发后，后续旧名pack不能再证明原冻结版本。E148的旧完整lock仍有效，E159及后续live-source legacy probe仅证明当前同名制品，不再据此声称旧payload兼容。新增freeze-legacy-artifacts.ts从rec-01两份不可变gzip校验archiveSHA256与每文件SHA256，重建隔离pack输入，生成legacy-frozen-fixtures.json与content-addressed两个tgz（H77496265…、C25444961…），原恢复材料未覆盖。仅为本地冻结源码制品，不宣称历史npm发布者认证。接下来让legacy verifier消费此固定archive并验证实际native转发映射。
- E162 — 2026-09-06 — round-14-native-recovery七组全exit0：H525pass/0fail/2882assertions/117files，全部public/product pack门通过。minimum-recovery镜像SSL timeout后改原npmURL，同原SRI与binarySHA256的1.3.0三组全exit0；不是降低最低版本。新增release tooling后H check53023再次525pass/0fail/typecheck/lint通过。冻结两旧tgz→public映射14135 exit0。prepare-release-set71210生成14shared+6product+vendor共180制品，set digest7cadb628cdc10a12b74ce6ee9160db026284e1baabb1f8159714d6e5a945a973（24MB，不发布）。首次nativeproof因fixture production安装不写lock、Bun lock trailing commas、XNL末尾漏根闭合三次失败，均修fixture不改validator；87462/round-15-halfcode-release-manifest最终exit0：停registry后实际旧名code-first App/HostBundle执行、精确SRI/API/旧完整lock/profile及错误身份负例、同一public function、完整CLI/Vue/MCP/关闭均通过。B01 done，立即B02。最近源保护：H944项digest7df4fb7e…，C1207项零改动hash607bcf38…；C旧src/codument继续冻结，project进入已授权依赖采用。

### E163 — B02 首次 Codument 制品消费行动及 pack 反馈

- Observer：四 domain 包仍在 C，新的 host-adapter/product-capsule/cli-shell 尚未证明可消费；B01 固定公共 set `7cadb628cdc10a12b74ce6ee9160db026284e1baabb1f8159714d6e5a945a973` 不重打包。
- Applier：迁 domain 的公共 import/精确版本；增加领域 ready/资源身份适配及显式本地 owner 构造、关闭、CLI shell。此切片不注册三个暂停入口，不代表其他旧命令迁完。资源根固定 codument/，内置九 Kind。
- 首次 `bun verification/verify-codument-release.ts` exit 1（afdce9）：新增 workspace 包尚不在旧锁中，Bun pack 不能解析 host-adapter workspace 版本。不是运行能力过线。改为给新产品依赖精确 0.6.0 版本；不借跨仓 source alias 解决。
- 当前复验 label `round-15-codument-release-pins`（35386）。隔离消费脚本先 pack C 七包，受控源仅添加 product 制品且拒绝覆盖公共 set，正常传递安装后关闭 registry 再实际运行。失败保留 logs 与各次制品；最终信号待观察。

### E164 — Codument 七包固定公共制品消费通过，继续骨架采用

- `verify-codument-release.ts round-15-codument-release-runtime-type`（47032）exit 0：公共 digest 仍为 `7cadb628cdc10a12b74ce6ee9160db026284e1baabb1f8159714d6e5a945a973`，C 七包 product digest `c6bdd966350f5b7090a06a7eea0d4aadd1e9ab4dc8a6121cc9e18452a92013fb`。正常 registry 传递安装，无 overrides；关闭 registry 后运行，不从两仓导入产品实现。
- 实际领域查询、两个 root、owner close/closed admission、源字节不变、codument/ 内九 Kind 无定义副本通过；领域已存在的 13 文件回归 **99 pass / 0 fail / 613 assertions**。独立安装内容 strict typecheck exit 0；编译工具链使用本机既有 TypeScript/Bun 类型，仅工具链路径，不是产品运行 source alias。
- 中间失败均保留各 label failure log：ports 缺失、错误预期把 dispatch rejection 当 result、fixture catalog 字段名错误已修夹具；typecheck 发现 capsule runtime 泛型丢失 close，又发现 schema 泛型不变，已把 adapter 做成显式受限泛型后复验。未弱化校验或绕过关闭。
- B02 仍 active：当前 CLI 骨架未完成公共依赖/产品身份采用。开始替换 CLI 62 个文件的通用 imports；旧 Codument authoring contract 转为公共单实现 forwarder，保留产品语义身份。后续需旧制品/identity 与完整 CLI 证据后再退役其余通用副本；三命令冻结仍在。

### E165 — Codument 实际 CLI 的同 set 消费、public execution 与剩余根回归

- `verify-codument-release.ts round-15-codument-whole-cli --full-cli`（69417）exit 0：同公共 set `7cadb628…` + C 十一包 product digest `aa3dc1c632a3e02cc179e1c59bac817466de6f7bd09fc4ff39d23234ada260ee`，正常解析、registry 关闭后运行实际安装 CLI，模板、Resource、LF、Page HTTP、实际 Vue build、MCP 原 URI、Serve graceful exit、99 domain 回归、strict typecheck 通过。只运行隔离目录现存 Host `init-workspace`，不是 Codument 三命令合并或正式新 workspace installer 的验收。
- 新 product/Host adapter 的 authoring policy 保留 `depa-codument-skill-app-contract` 旧入口，native contract/Vue/MCP 已改成 public 单实现封装；MCP URI `ui://codument/pages/app.html` 与 HTML identity 保留。Vue receipt 如实使用公共 builder 0.1.0，不伪称产品封装 0.6.0 是构建器版本。
- CLI read surface 保留 standalone App 根读取，同时增加正式 codument/ source；这是兼容发现，不创建第二份正式 App。当前 init/upgrade 注册及实现没有领域合并。首次根回归的 inherited README/docs 缺口已补实际说明，未通过删断言解决。
- public execution：capability grant/SQLite、材料准入/profile proof、typed HTTP ingress/client、四 backend 绑定、owned shutdown 均委托公共机制。local 不读 Serve；basic/纯管理不建 catalog；Page projection 不建 builder。`round-15-codument-preflight-preserved`（88427）14pass/0fail/211assertions；`round-15-codument-optionals-types`（41958）typecheck0。
- 保留 C 独立于 H 的 PageWorkflow start 本地 preflight，新增精确 `serve-client-preflight` profile；其它 Serve client 不为此常驻构造资源。HTTP 的 Page Origin 拒绝对齐 public typed ingress 403，仍拒绝且检查 typed code；mutation POST 一次，新增一次身份 probe，不把 probe 当第二次 mutation。profile/缺 live record 的产品错误提示保持可操作性。
- `round-15-codument-native-optionals`（42716）28pass/1fail：唯一差异是旧测试把产品版本当 builder 版本，已改为公共制品真实版本，待复验。
- `round-15-codument-adoption-check`（25688）typecheck/lint0、520pass/2fail：profile 错误提示和 clone 测试 linker 未接精确版本的新增 workspace 包。已保留 typed code 并恢复产品提示；fixture linker 增加 exact-version 匹配，仍明确不是 registry 安装证据。下一步复验及 frozen C 旧身份证明，之后退役已被 public 制品替代的通用副本。B02 active，不以这些窄门宣称 mission 完成。

### E166 — 冻结旧身份通过、通用副本退役及 canonical scope 纠偏

- `round-15-codument-native-compatibility --full-cli`（76455）exit 0：同 H set，C 十一包 digest `4b4de1f2d373e3a79e4f3b923c39a601bd7e15660cb92ddd9a073b06ed14d15f`；旧 C 冻结制品的精确 profile/SRI/API/语义身份与完整旧 lock、旧 code-first App 和实际 CLI 通过。当前产品 lock 保留全部旧条目但增加九领域 reader，不能称当前产品整个 lock 与旧版相同。
- 删除前验证 C 恢复 gzip SHA256 `f8047d21b08a18cf8c4078ba580d18341d6c56f51ec595073f00d88b64897cdd`，153 文件当前 bytes 与原快照相同且没有新增 eligible 文件。退役八个通用包的内容；逐文件清单 `verification/round-15-retired-generic-files.json`，全部可由原 gzip 恢复。原 src/codument/用户 attractor 未编辑。
- 固定源重新安装（66539）exit 0，Bun 移除八个 workspace 包。`round-15-codument-retired-architecture`（93157）exit 0，212pass/1236assertions：新十一产品包的依赖方向、公开制品解析、无双源码、领域与可选能力通过。
- `round-15-codument-retired-check`（73491）typecheck/lint0，442pass/1fail：仅 SOP 残留测试仍期待旧副本文件，改为检查产品无副本且实际安装公共包保留拒绝 sentinel。测试减少来自八包回归归上游所有，并非删除产品能力；上游525回归另有E162。
- canonical scope probe（50784/60453）失败：首个夹具直接 symlink root 被既有安全策略拒绝，调整为允许的父级 alias 后真实 live 调用仍 exit1。实际问题是客户端 canonical root 与服务端原始 root 不同；产品 HTTP 只在 exact LF ingress 惰性规范化并固定 scope，不改公共协议或放宽校验。`round-15-codument-canonical-identity`（48029）11pass/198assertions exit0，普通与 parent alias 两实际 CLI loopback 均成功，旧 instance/profile/source/Origin 拒绝保持。
- HTTP 产品源码改动使此前 whole-CLI pack 不再代表最终源码。立即重跑 `round-15-codument-final-adoption-check` 与 `round-15-codument-final-adoption --full-cli`，成功后再关闭 B02，尚未将其标 done。

### E167 — B02 关闭并立即推进三消费者

- `round-15-codument-final-adoption-check`（19727）exit0：typecheck/lint、444pass/0fail/2518assertions/78files；SOP 与 parent alias 回归已包含。
- `round-15-codument-final-adoption --full-cli`（69072）exit0：公共 set 不变，最新 C product digest `13feae1a8fd2ea77747888b0015ffdfddee792e4b84911ae9f53f7a6226220bd`；99tests/613assertions、独立类型检查、冻结旧身份/实际 CLI/Vue/MCP/Serve 关闭通过。见 codument-adoption-conformance.md。
- B02 done，B03 active；后续源变更需相应失效。当前真实 npm/全局安装/三命令合并/旧src退役均未执行。下一差距是第三消费者与发行配方以及旧 consumer harness 的已失效来源，不重复实现公共包。

### E168 — 同一制品三消费者与最低版本、发行配方反馈

- `verify-notes-release.ts round-15-notes-same-release`（66867）exit0：H digest7cadb628…；Notes CLI-only 正好五包，完整扩展仅公共14包，无产品包/私有源/overrides，关闭registry再执行。custom Kind CLI/schema/unknown/conflict、resource/code-first、材料mutation、local/strict live、双实例Page/Codex/HTTP关闭、四browser binding、编译后原始插件资产、Vue worker/coordinator、真实MCP协商均通过；不使用真实browser/messages。
- `verify-minimum-bun.ts round-15-same-release-minimum --curl --same-release-set`（3362）exit0：固定Bun1.3.0 archiveSRI和binarySHA256 ce7b4f94…，Notes/Halfcode/Codument三消费者均复用上述公共制品，C使用fixed product set13feae1a…而非重包。3组日志保留于logs/round-15-same-release-minimum-*。本地测试runtime下载后删除，不改本机安装。
- 发行配方观察：原nested builder package可能残留workspace:*；package files白名单漏现存worker-port/build-diagnostic；依赖比较受JSON属性顺序影响。已改两产品stageReleaseBuilder只输出生产metadata并pin实际公共builder版本，六native清单新增公共builder依赖，检查使用结构相等和产品实际bridge文件闭包。只改recipe并在临时目录测试，不构建/切换最终C发行入口。
- C recipe窄门1pass/15assertions。H release-set新增内容寻址SHA256核对；3tests22assertions初次通过，随后新增source-dependency负例待最宽复验。临时registry拒绝base名称覆盖、shared扩充、重复identity、index/payload/manifest篡改与未知包。
- 两根初次回归失败保留：H测试metadata类型unknown使typecheck失败；C443pass/2fail是六native依赖清单测试未包含新增公共依赖。修具体类型和预期，不取消旧身份/版本断言。最新 `round-15-recipe-recovery`（17644）和 `round-15-recipe-recovery-codument`（92528）正在复验。
- 产品root/CLI/native MCP的旧Bun>=1.0声明与实际公共>=1.3不一致，已改>=1.3.0；不改变public14包实现。因为H/C产品metadata发生变化，正在生成新候选release `host-release-round-15-recipes`（52259），旧set及其成功证据保留；须重新验证当前产品metadata，不能只靠旧包证明最终源码。

### E169 — 三消费者/配方与产品验证入口收口

- 新set `host-release-round-15-recipes`（52259）digest `6e5bc29f3de89b1cb88b128f3c5debbd7534b15bd2641a138c3a87c2ebe0f8e4`，180项。逐项比较14公共SRI均与旧set完全相同；产品engine和重新包装vendor有变化，旧set未覆盖。
- 当前Bun1.3.14：Halfcode（34549）、Codument（72004，新C set digest719031d5733b13005c71534c55416957072680b9915fbc2b923bc699130f1752）、Notes（9449）都在同新set exit0。三者实际运行范围见three-consumer-conformance.md。
- `round-15-engine-release-minimum --curl --same-release-set --release-set …recipes --product-set …engine-release-artifacts`（55132）exit0：上述同一制品在固定Bun1.3.0 Notes/Halfcode/Codument三者均过线，无重包替代。
- 两仓发行recipe真消费（54046）exit0：两个nested bridge正常传递安装，真实public Vue worker各构建/close一次；不含产品binary。首轮62261失败因fixture把同步bunExecutable错误写成Promise，修契约调用后过线。三原生平台名/格式声明未扩展，不声称其它OS native smoke。
- C `verify:mission consumer` 改为显式immutable set、本地无proxyregistry、正常传递安装后关registry；原各能力probe保留。首次15881被legacy裸bundle里的package import准入拒绝；改fixture用显式Notes global API绑定（code-first仍独立真实包/锁/SRI测试），不放宽loader。完整入口13816及最终39470 exit0，cli最小闭包44375 exit0。
- C `consumer --scope domain-core` 最终28954 exit0：实际四domain tarball、真实verifier/receipt/fresh/CAS/递归registry/语义验证/九Kind/保守merge/Behavior/Decision均通过，未冒充完整领域命令迁移。`architecture --scope domain-core`35662 exit0，213tests/1240assertions；根30454 exit0，typecheck/lint/448tests/2561assertions。H根17644 exit0，529tests/2923assertions。
- C原src/codument保护检查：664文件相对rec-01 bytes零变化，含用户原有attractor。仅project和M持续修改。B03 done，立即进入clone三模式B05；三命令/最终C发行/旧src退役/真实升级/外部发布继续冻结。

### E170 — Clone 快照合同首切片

- Observer：旧clone仅allowlist且跳过bun.lock、nested Git回退FS、默认全文rebrand；对应B05实际差距。新合同见design/clone-modes.md，T01合同/T02选择及控制流/T03Git与stage effect，不增加公共包。
- 首次 `H: bun test packages/cli-host-support/test/clone.test.ts` exit1：6pass/2fail，两个失败都是测试把macOS /var临时路径与真实 /private/var路径作字符串比较；实际snapshot返回canonical路径。修fixture期望为realpath，不放宽源/目标边界。其余source-only锁保留、漂移拒绝、非Git拒绝、目标冲突和stage清理已通过；尚不据此关闭B05或宣称新公共set已验收。
- 后续 typecheck 暴露测试把 Uint8Array 直接传给 Buffer 泛型 expect；改显式 Buffer.from，运行值语义不变。根 clone 脚本曾缺 T01/T02/T03 可见依赖，新增 root devDependencies 后 bun install --ignore-scripts exit0。最终定向命令（2166）exit0：15tests/1691assertions，包含H实际source-only/full逐文件字节比较与默认两产品包脚手架。原clone测试里“更换所有FQN/Kind owner/丢lock”预期与新合同冲突，改由相反保真断言及新模式覆盖；原CLI/SOP/Page/MCP/native产品行为仍由B03实际产品消费者和原专项回归负责，不当作删除功能。
- H typecheck46921和lint32753 exit0。新候选host-release-round-16-clone（28039）180项digest3204fcff…，旧set未覆盖；公共仍是尚未发布的初始版本候选，内容以set digest/SRI区分，不把相同npm草案版本当相同制品。
- 真实scaffold消费者17048失败于Bun全局metadata cache保留旧临时registry端口；隔离 BUN_INSTALL_CACHE_DIR 后21827正常安装两代36包，但实际about命令暴露生成器漏了必需doc合同。补生成器doc，不放宽command validator；第二次制品候选须重新pack并验证。两个失败日志均保留，B05仍active。

### E171 — 两代脚手架实际消费与工作区开发闭包

- 候选 `host-release-round-16-clone-docs`（84057）digest c761ecf74089b16bb6e0ae047fa189fc84445042ecfec5ecf31e9a2fe4b72339。`verify-clone-release.ts round-16-clone-docs-consumer <set>`（84278）exit0：正常安装两代各36包，第一代通过已安装公共clone入口生成第二代；关registry后两者实际about/resources、HTTP禁止哨兵、精确close、strict typecheck及skill-creator quick_validate全部过线。此证据在后续metadata-rebrand新增后需复验新set。
- Codument工作区重新解析锁前备份原字节到各label-before.bun.lock。68426因发行set不含开发工具失败并恢复原锁；23545尝试限定vendor外部metadata回退遇gzip/本机固定开发版本差异，作废该恢复路径；20542本地工具打包因为初始source是symlink失败；84706实体路径后因base只有ajv8而eslint需要ajv6失败。现已改仅本地工具闭包、实体路径、vendor按version并集且base同版本优先，不使用外部回退，不覆盖公共包。
- `round-16-codument-clone-tool-versions`（19991）exit0：正常安装、原锁恢复材料保留，全部14公共SRI与c761候选相同；未知OS optional404不表示host平台缺失。该安装是开发环境恢复，不混作纯发行消费者证明。后续rebrand API未包含在此set，C待新set采用后再跑根回归。
- 元数据变换范围与安全约定在design/clone-modes.md；显式--rebrand-metadata只改root manifest两个字段+producer identity四常量，另存原字节/独立receipt，并标required-before-build/review-required；不是全产品自动重命名。H相关7tests/649assertions（28512）、纯计划负例2tests/12assertions通过；shared包/含糊binding/非法名字拒绝，FQN/global/public包/lock原样保持。旧XNL验证计划改用source-only保留生产者身份，完整native验收仍NOT_RUN，不用计划单测替代实际发行。

### E172 — 最新clone候选及实际安装内容核对

- `host-release-round-16-clone-metadata`（51117）digest 2ddfe9eb352efb0bc4d6110ca13320005dd2e0e96a62504b2c2fb6e9cff2a44e；包含metadata API及生成器校验，180项。H根32255 exit0：typecheck/lint/539tests/5052assertions。
- 同set实际H产品21997、Notes4428、C产品45432全部exit0；C product set digest仍719031d5733b13005c71534c55416957072680b9915fbc2b923bc699130f1752（此次产品运行源码未改，clone位于repo脚本及public包）。三者都无源码别名、正常传递安装、运行前关registry，C含99领域测试和原native身份兼容。H两代scaffold12112 exit0。
- C安装43704虽生成了新SRI锁却沿用同版本旧node_modules，实际Croot71485与clone39690均失败（旧clone export不存在及Hono残留两版类型冲突）。因此锁文件匹配不算安装payload过线。安装器新增fresh-lock时强制重新安装，并核对实际T01/T02/T03 manifests的clone export；30656 exit0，502包刷新，原锁备份仍保留。Croot/clone正重新验证，未据前一次锁PASS标完成。
- `architecture` 无scope误调用退出UNVERIFIED，日志round-16-codument-clone-architecture保留；完整领域/发行门仍未实现。下一动作使用现有 `architecture --scope domain-core`（扫描全部产品依赖，领域行为子集），不把scoped PASS称全mission已完成。

### E173 — Gitignored 原锁是显式保留输入

- C强制安装后，C两代scaffold72657过线；architecture scope domain-core74546过线（213/1240）。旧set2dd…最低Bun1.3.0三产品+两clone生产者71088均过线，仍不覆盖后续修正。
- C根77194 typecheck/lint通过，但445pass/3fail：本项目bun.lock未tracked且被Gitignore忽略，因此clone仅Giteligible时把锁漏掉，违反“原锁保留”。不放宽测试，T03显式追加原bun.lock/bun.lockb，receipt标additionalSource=original-lock；其它ignored仍不采集，symlink锁只保链接并标symlink-only。新10tests/77assertions通过（59751），其中两例专验nested Git+ignored锁与ignored秘密文件排除。
- 新set需重pack/采用/回归。verify-clone-release增加已安装公共API的source-only/full/metadata-rebrand真实fixture，含dirty tracked、tracked ignored、ignored原锁、其它ignored排除、独立before/after回执，最低Bun将一并执行。simplify用于收拢identity校验、分开锁状态分支，未削减验收。

### E174 — Clone 三模式最终候选闭环

- 固定set `host-release-round-16-clone-lock` digest 3e28f0c8207d19076ba2c26c48034e02202c1d8c68ce8aec6359bfee1675524c。H根13920 exit0（541/5060），H两代clone23711、H产品77275、Notes40323均exit0。C强制采用35434 exit0，实际clone exports核对通过，原锁保存在round-16-codument-lock-install-before.bun.lock。
- C根63355 exit0（448/3699/typecheck/lint）；C两代clone47060、C实际产品61072 exit0（同public set与C product719031d5…，99domain及native兼容、实际Page/Vue/MCP/CLI）。最低Bun3243 exit0，Bun1.3.0 SHA256 ce7b4f94a13ee0f881b06cfb4e428a017ddc69c3307dae0cb86709042fe0c058，三产品+两clone生产者全部通过，隔离runtime清理。
- `run-codument-check.ts round-16-lock-architecture run verify:mission -- architecture --scope domain-core` 79608 exit0（213/1240）。只读重hash664个src/codument原文件，零变化（2b183f）。符合性与未测边界见verification/clone-conformance.md。B05 done；进入领域命令，不等待批次确认。当前无npm发布、真实browser、暂停三命令合并或真实workspace升级。

### E175 — 生命周期入口的第一轮真实反馈

- 新adapter统一Track/Mission transition、task transition、gap-round、bind-track、Track ready/verify/complete，旧小写与Kind大写共享同一owner。实际CLI装配local/domain，在catalog/Page/Serve分支之前返回；产品formatter保留原始JSON。未注册mission archive：旧命令还有promotion/link检查，不能拿已有简单archive操作冒充全迁移。
- 首次domain CLI测试081d43/94e81d失败于夹具缺TaskGroup/Ports；补齐非空合法夹具而不改validator。第二次52aae0暴露captured verifier输出错误写stdout；对照旧src确认应写stderr，修产品绑定，保留stderr诊断。主入口help扫描限定--之前，防止验证子命令的--help触发Host帮助。
- `bun test packages/cli/test/cli/domain-commands.test.ts` 23248 exit0：2tests/82assertions；真实子进程证明原始JSON、文本、argv透传、失败不提交、未知扩展和伴随文档保留、无Serve/私有目录。typecheck62260在新增测试前exit0，不代替后续根回归。准备根check与public set不变的产品重pack验证；领域节点仍active。

### E176 — 配置观测与新版真实产品候选

- 根80722 exit0（450/3815）；补每调用profile观测后63817 exit0（5/103），最新根33135 exit0（453/3845/typecheck/lint）。配置读取在support，current-envelope/profile身份判断在logic，产品显式组合；未观测profile不默认通过，旧格式仅引导migration，disabled身份仍保留不替Hook决定激活。
- 新C产品set `round-17-lifecycle-product-artifacts` digest 00e605933211d46d3a19895d5b816ddb364fcedd27bf28aacb8bf673b259f6da；public仍3e28f0c8…。49618首轮失败不是安装/runtime错误，而是旧consumer固定根命令仅track/Track，未纳入新mission/Mission及domainJson载体字段。更新精确期望并显式补三个暂停命令缺席断言；重跑使用同一C产品set，不覆盖失败日志、不重pack来隐藏结果。

### E177 — 已安装生命周期 CLI 过线并进入 registry 切片

- `verify-codument-release.ts round-17-lifecycle-product-recheck --full-cli --product-set <round-17-lifecycle-product-artifacts> --release-set <host-release-round-16-clone-lock>` 57281 exit0。同3e28…公共set与00e60593…产品set，普通传递安装、关registry后101domain tests/624assertions、strict TS、两workspace隔离与close、9内置Kind、原native合同、Page/Vue/MCP/LF、真实已安装生命周期CLI均过线。
- installedLifecycleCli 真实命令验证原始JSON、成功文本、verify argv含--help/--json/-w透传、失败不提交、未知源字段/伴随文档、无私有state目录。未合并暂停命令，未升级真实workspace。观察到剩余旧命令仍有registry、create、archive、artifact与migration，领域节点保持active，下一切片先接decisions validate/frontier的读取/输出合同。

### E178 — 决策查询本地垂直切片

- decision source port负责显式文件/目录/进程ID观测；domain logic每次源只解析一次生成findings/frontier，owner统一admission/close；adapter输出旧数组JSON或错误{frontier:[],findings}及exit1。domain-read profile不读取无关Attractor config、不获取Serve/Page。没有缓存fresh verdict或更改authoritative source。
- `bun test packages/cli/test/cli/domain-commands.test.ts packages/domain-support/test/decisions.test.ts packages/domain-logic/test/decisions.test.ts packages/domain-capsule/test/owner.test.ts` 35674 exit0（22/193）；覆盖递归跨文件依赖、环、pending warning、缺文件、原文本、显式文件/目录/Track ID、同名进程歧义、symlink拒绝和原字节保留。typecheck51768 exit0（新增测试前），根回归与后续打包待做；00e60593产品set仍只代表Round17源码，不声称包含本轮变更。

### E179 — 决策查询回归与创建提案

- `round-18-decisions-root`90777 exit0（455/3882）；architecture第一次b67164拒绝cli-shell新增直接公共CommandResult类型依赖。DEPA判定：shell消费public contract做产品格式适配合法，不需绕道类型推断或复制类型；仅把该contract加进明确allowlist，保留IO/私有import/反向依赖拒绝，并将真实domain CLI测试纳入scoped gate。`round-18-decisions-architecture-contract`22826 exit0（220/1399）。
- 新decision创建纯提案使用现有source-span编辑器的一次插入并以canonical parser比较完整前后AST；不重写原注释/文本/未知字段，nested只继承顶层envelope。26ef1d exit0（10/43），同时保留原lifecycle patch负例。当前生成资源用envelope/spec，创建文本的版本说明由旧apiVersion改为specVersion:1，这是资源版本合同变化，不伪造旧apiVersion。
- 新单文件Decision写port有opaque handle、source/mode/inode比较、cooperative lock、new-file no-clobber link、stage/lock成对清理；成功发布后的清理异常另报maintenanceWarnings，不将已写成功冒充失败。CLI/port/proposal联合9689 exit0（9/153），包括同文件双写竞争、非法UTF-8、symlink、foreign/stale handle与重复ID。typecheck73402暴露readonly数组push，改为显式复制；45745暴露map contextual typing丢失，补CommandDefinition<R>返回注解；复验72740待取。simplify把domain placement/presentation识别收敛到产品同一descriptor，未改变检查强度。

### E180 — 决策创建与查询的真实发行消费闭环

- typecheck72740 exit0。`round-18-create-root`85606 exit0（461/3950/typecheck/lint）。`verify-codument-release.ts round-18-decisions-product --full-cli --release-set <host-release-round-16-clone-lock>`45086 exit0：新C产品set `round-18-decisions-product-artifacts` digest dbc76f346f2461c310abb43ae6e9f116a35ddae419b0bf86bfe0121c5dd7a372，public仍3e28f0c8。正常安装、关registry、strict TS、107domain tests/672assertions、真实已安装生命周期与决策create/parent/validate/frontier/duplicate-no-write均过线，Page/Vue/MCP/native兼容同过。
- Observer发现下一实际接缝：产品createCodumentDomainRuntime尚未读取 `codument/.local/workspace-bindings.xnl`，已有repository.projects仅在library fixture注入。因此新CLI的external ProjectRef bind-track尚不能算已迁移。下一优先接project bind/bindings/unbind与显式bindings观测/提交前漂移保护，继续同一repository authority；不等待用户补本地已有的配置格式信息。旧list/show/validate/scaffold/archive/artifact/migration仍未完成。

### E181 — 最低 Bun 复验与 ProjectRef 来源守卫

- `verify-minimum-bun.ts round-18-decisions-minimum --curl --same-release-set --release-set <host-release-round-16-clone-lock> --product-set <round-18-decisions-product-artifacts>`63557 exit0：同公共3e28f0c8及C dbc76f34，Notes/H/C在Bun1.3.0通过，二进制SHA256 ce7b4f94a13ee0f881b06cfb4e428a017ddc69c3307dae0cb86709042fe0c058；临时下载关闭后清理。此证据不覆盖后续Round19源码。
- Round19产品在调用前观测profiles和机器本地bindings，显式注入repository；写入前重读配置，变化则拒绝提交。外部Track使用目标workspace自己的profile配置与守卫，不沿用host的profile名单。40009 exit0（23/216）覆盖跨根真实CLI、验证期间来源变化、repository回归与纯bindings解析。
- 复用有sourceRevision/opaque handle的单文件写port，新增project bind/bindings/unbind。本地WorkspaceBindings保持原私有格式而非新增portable Kind；source-span插入/移除后canonical AST全量比较，保留其它源字节。typecheck12040发现空receipt推断为unknown，改用undefined分支和明确可选receipt。23478 exit0（10/153）验证首次写、重绑、最后一项移除、注释/未知字段、原CLI回归；随后新增真实三个project命令闭环及extended配置拒绝，复验另记。领域节点仍active，不把本切片当完整能力迁移。

### E182 — ProjectRef CLI 过线与隔离负载复验

- 42708 exit0（12/182）：真实project bind/bindings/unbind→external Mission bind-track，目标自身profile、portable receipt、不修改目标、解绑后拒绝且不改变Mission。架构39522 exit0（231/1500）。根28059 exit1（464pass/2timeout/1late error）：OpenCLI materializer与transport超过5秒后产生跨测试晚到断言。并行重型验证是待证假说；停止其它重型验证后，不改断言/时限，64816 `round-19-bindings-root-serial` exit0（466/4010/typecheck/lint）。后续重型验证串行，保留失败log。
- 首次产品验证因把release-set.json文件传给要求目录的参数而ENOTDIR，已产候选保留；更正参数，87445 `round-19-bindings-product-directory` exit0。同公共3e28f0c8，新C候选`round-19-bindings-product-directory-artifacts` digest77a96ed724547a339691edf5ad12a3d95e4024e5a1cd139f75de00600c0804f1，正常安装/断源、strict TS、110domain tests/691、真实已安装生命周期/Decision/Project CLI及Page/Vue/MCP/native兼容通过。原始JSON数组、相对workspace路径绑定、空bindings无文本和无残留锁有实际证据。
- 继续Round20只读query切片，不暂停。旧src只作为行为对照，list/show的filesystem snapshot、pure projection、presentation分别归support/logic/adapter；不为了status复用而提前解冻status入口。新的query源码不由77a96ed7候选证明，后续须新回归/pack。

### E183 — 只读 list/show 垂直切片

- typecheck44466 exit0。63790首次CLI fixture失败于手写Behavior未闭合Suite，不改parser；修正为规范非空树。1496 `round-20-query-fixtures` exit0（5/54），覆盖旧Track metadata/summary状态计数、活跃范围、include-content精确保真、递归Behavior及canonical优先、Decision URI/parent/owner/path、无配置激活/私有目录、缺初始化/无效source/双authority/symlink/越界拒绝。
- query是读取投影而非Hook/fresh verdict，不调用验证进程；Task完成性/统计不反写source。相比旧list静默忽略坏Track或给坏Behavior零计数，新链fail closed并保留迁移提示；不把旧XML/md直接塞进新normal reader。递归Behavior ID按portable相对文件位置扩展，保留旧叶子filename ID及绝对display path。普通列表不读取Track companion内容，show仅在--include-content读取内容，Decision全文仅在show显式输出。
- 仍欠完整validate/scaffold/modeling/engineering/archive/artifact/migration。下一步根check、scoped architecture与新产品pack串行，不把窄测试算成领域节点完成。

### E184 — 已安装只读命令过线，继续脚架创建

- 72426 `round-20-query-root` exit0（471/4084/typecheck/lint），18312 `round-20-query-architecture` exit0（236/1556）。33708 `round-20-query-product` exit0：同public3e28f0c8，新C set95532581ae9944dc97d6ec3802f4d5d4789ac4030dbf317187c90b353d2dd896；安装113domain/705、真实list/show的Track summary/explicit contents/Decision hierarchy与此前CLI/Page/Vue/MCP/native均通过。候选仅覆盖Round20，不覆盖后续scaffold或query比较器等价整理。
- Round21补Track/Mission/BehaviorPatch create。遵循DEPA，clock/Git HEAD为显式观测，logic产出new-envelope待编写骨架，support独占创建与源比较，owner统一admission，adapter沿用旧参数及文本（版本行明确变为specVersion）。空TaskSpace/Mutations故意不当作完整语义验收通过。行为补丁可保留目录内notes等用户文件，不复制Kind定义。
- typecheck78720 exit0（测试加入前）。`round-21-scaffold-narrow`9832a2 exit0（5/52）：纯模型/未完成状态、完整三文件closure、opaque handle、并发仅一成功、失败只清理owned staging/reservation并可重试、patch保留notes/拒绝漂移、歧义与symlink。支持层和生命周期共享cooperative lock，不宣称crash-atomic或对任意外部editor最终rename的原子CAS。实际CLI72388待收结果，随后根/架构/pack串行。

### E185 — 创建命令真实产品闭环

- 72388 exit0（1/57），实际Track/Mission大小写入口、stage、BehaviorPatch两入口、重复/越界不写、生成draft不通过ready、无Kind定义副本及私有目录。44789根check exit0（477/4222/typecheck/lint），39579架构exit0（242/1673）。29936 `round-21-scaffold-product` exit0，C set688d13edd20579afab9764502dc89aefb99265b07d856809fd078782c9ca1ac6；公共仍3e28f0c8。普通安装断源后118domain/757、完整产品CLI与实际三scaffold、native/Page/Vue/MCP兼容通过。未全局安装或升级真实workspace。
- Round22继续validate差距。只读旧validate实现确定其JSON特例：诊断文本+尾部findings数组（空scope为原文本），设计中明确保持；新domain API返回结构化findings，不以清理输出为由改变旧stdout。现有create skeleton需要补作者内容的事实得到CLI证据，不降低后续validator。

### E186 — 全量校验本地组合切片

- typecheck9915 exit0。纯组合9e9c8e exit0（2/11）；实际CLI94834 exit0（2/35）。source port观测pending/active Track、pending/active/archived Mission和递归Behavior；logic组合current envelope、既有领域semantic、companion、非空BehaviorPatch、canonical/working Decision独立forest、profile来源与strict提升，owner不执行Hook也不缓存fresh verdict。
- 实际CLI覆盖正常warning→strict error、丢失required file、空patch、旧Decision/旧XML、无效UTF-8、symlink拒绝、空workspace原文本、原JSON诊断排列、只读源保留。相同Decision ID出现在canonical和analysis各自forest不误判重复；同Kind全局重复resource identity明确报错。后续根check/架构/新pack尚未运行，本切片不足以关闭领域节点。

### E187 — 校验根回归与受保护来源复核

- 80823 `round-22-validate-root` exit0（481/4284/typecheck/lint）。针对cross-repo-baseline/C.json中src/与codument/条目，逐项以lstat kind/mode、SHA256内容（symlink则目标文本）重观察：d87cea exit0，664文件，changed=[]。原用户attractor已包含在冻结baseline，未替换为git HEAD；没有真实dogfood升级或旧源码退役。
- 读取旧std lint完整13规则与排除范围，确定后续可直接迁同一纯规则+显式Markdown source port。Modeling旧schema仍固定FACT_GRADES/single_writer，与D12当前DataTopology边界尚需单独收敛设计；不凭片段阅读机械复制成新标准。领域节点继续active，未绕开核心后三命令gate。

### E188 — validate 制品通过，权限负例推翻局部完成假说

- 23754架构exit0（246/1720），38627 `round-22-validate-product` exit0；新C set39d3b5e54ed5799746c3597cbb1cd1824e4ebe09b8d16d4820cb3f6de124d856，public3e28f0c8不变。普通安装120domain/768与真实混合JSON validate、空draft/patch拒绝、其它产品CLI/native/Page/Vue/MCP全部通过。
- Observer检视新发布路径发现尚未覆盖权限：scaffold staging由mkdtemp创建，rename后变成0700；新Decision/source writer无条件chmod0644绕过进程umask。新增实际子进程umask077与默认目录权限断言，d881d9 `round-22-source-permissions-red` exit1（4pass/2fail），证明两处偏差，不凭此前绿测试宣称完全兼容。修正为新文件保留创建时umask，已有文件恢复其观察mode；正式目录采用独占reservation实际mode。随后green/最宽回归/新pack与最低Bun需重新执行，39d3b5e仅保留为历史范围证据。

### E189 — 权限纠偏闭环

- 398983 `round-22-source-permissions-green` exit0（6/40），同新增负例不改断言。73220 `round-22-permissions-root` exit0（482/4288/typecheck/lint）。39848 `round-22-permissions-product` exit0：新C setf9dbb845cf60c1005a30114c1b821d028d152b9740a3dcc7296b3a8d44b99cf0，同public3e28f0c8，已安装121domain/772包括子进程umask、目录权限、原有mode保留；完整产品与真实非冲突CLI全部已有探针通过。
- 下一步以精确f9dbb845 C候选进行最低Bun三消费者复验，源码与消费夹具暂不变化，避免把新测试复制到旧候选后误判；期间只继续读知识registry上下文。磁盘仍有约6.2GiB，隔离临时资源由现有验证finally清理，不清理用户数据或旧证据。

### E190 — 最新领域候选的最低运行时通过，进入文档 lint

- 55846 `round-22-domain-minimum` exit0，同公共3e28f0c8与C f9dbb845候选，Notes/H/C三组在Bun1.3.0通过。下载二进制SHA256 ce7b4f94a13ee0f881b06cfb4e428a017ddc69c3307dae0cb86709042fe0c058，与先前可信runtime一致。完成前未改source/consumer测试；此结果不覆盖后续Round23源码。
- Round23按旧完整std.ts实现13条纯规则，support显式Markdown观测，owner admission/close，adapter保持默认src/templates/codument/std、原数组JSON与退出码。本功能不要求初始化workspace。排除路径选择作为纯策略注入reader，避免读取历史compat/spec/迁移文档造成误报；选中源的symlink/非法UTF8拒绝而非部分PASS。typecheck59109先发现测试假owner未实现新增lintStd，已补测试接口，不放松DomainOwner合同；79066窄测试正在运行，尚不计通过。

### E191 — std lint 回归与知识 owner 方案细化

- 79066窄测试exit0（10/178）。根94163出现两项失败：旧完整命令树缺新增std/lint，以及OpenCLI既有inventory篡改测试5000ms timeout。补精确命令树；`round-23-std-root-failures` chunk39cdc5 exit0（11/57），原篡改断言不改，单独11.67ms通过；未确定超时根因，不声称已修复OpenCLI。根3196 `round-23-std-root-recheck` exit0（485/4340/typecheck/lint），架构75877 exit0（250/1758）。原失败日志保留。
- `design/knowledge-resource-contract.md` 根据已完整读取的两套registry/schema/validate/config/lint/scaffold/CLI和DEPA Data原文细化：两聚合owner Kind、递归source provenance、显式legacy profile保留历史规则、新作者开放DataTopology、无自动七级语义映射；先真实compiler探针再接命令。属于获准资源/架构目标的实现细化，不升级真实workspace或新增用户gate。Resource完整语义集合仍需后继App集成，不把结构reader称全量PASS。
- 新std产品候选验证命令 `verify-codument-release.ts round-23-std-product --full-cli --release-set <host-release-round-16-clone-lock>` 已启动；完成前冻结产品源码和consumer夹具。当前f9dbb845仍只证明Round22。

### E192 — std lint 已安装制品过线

- 59722 `round-23-std-product` exit0：新C set1917975e772350c28f193c37c2ea44518758bfa6b054b8958fcc53dcdbcb321e，public3e28f0c8不变。正常安装/断源、strict TS、123domain/787及真实std lint空数组/非空finding/exit1/只读原文，与既有CLI/native/Page/Vue/MCP一起通过。最低Bun最新仍R22，不声称覆盖本新候选。
- 继续Round24知识owner。观察到现有九Kind的ownerPackageFingerprint绑定整个Kind列表；直接扩列表会无必要改变所有旧contract身份。实施须保持九个既有owner/revision/reader指纹，两个新增owner独立计指纹；用旧锁/新锁消费测试证实不影响原身份，而不是简单改期待数字。

### E193 — 知识 Kind 垂直探针与递归发现缺口

- 新ModelingRegistry/EngineeringRegistry聚合Kind、结构reader和members path/parent投影已在四领域包内接入。修改前从实际九Kind代码冻结完整owner/revision/reader JSON fixture，新增后逐项deepEqual仍一致。全部产品合同11Kind，但旧九身份未漂移；正式Kind定义仍不复制给App。
- `round-24-knowledge-owner` chunk503c91 exit1（8pass/1fail）：nested知识源存在但浅Catalog返回0条。读取compiler catalogFiles证明single-file不递归，不能仅凭ready当发现完成。保留浅root零条断言，并用精确深层Catalog验证owner闭包；`round-24-knowledge-owner-explicit` fc70d6 exit0（9/92），两Kind、nested路径定位原spec、父身份、catalog source/SHA、profile/重复id/旧envelope拒绝、源保真均过线。产品递归membership projection仍待后继App实现，已记入设计，不把显式Catalog证明扩称自动递归PASS。
- 新知识业务schema/CLI尚未迁入；当前结构reader不是完整知识语义校验。下一步按显式profile实现纯schema与source index，再接只读命令；完整capabilities仍UNVERIFIED。

### E194 — 知识 schema 与递归源索引

- 纯modeling/engineering schema迁入domain-logic；旧representation规则保留，七级限制仅在显式legacy profile分支，新DataTopology接受自定义标签、多个有向关系与value无owner。indexKnowledgeSources在单次解析中保留owner/path/原bytes，拒绝未包裹旧forest、重复slot/id/URI/owner身份与未知profile；validateKnowledgeIndex复用该snapshot进行schema、跨文件引用、路径与plane检查。没有写知识文件或改变Hook判据。
- `round-24-knowledge-schema` c72ce1 exit0（6/94）：新旧schema隔离、局部override、原八种engineering表征、nested provenance、跨文件URI与delta路径、未初始化空registry警告、坏源不准入。typecheck18834失败是JSON冻结fixture的字符串类型宽于品牌hash/Kind literal，测试改用unknown值deepEqual而非更改fixture；49753 `round-24-knowledge-typecheck` exit0。随后补reader显式ancestorIds/references，根 `round-24-knowledge-root`正在运行，尚未计通过。

### E195 — 知识本地回归通过，制品消费进行中

- 10681 `round-24-knowledge-root` exit0（491/4468/typecheck/lint），44077 `round-24-knowledge-architecture` exit0（256/1862）。包括九旧合同完整JSON冻结对照、新Kind不复制、显式ancestorIds/references、原有所有领域与Host测试；仅当前本机证据，最低Bun/新候选仍待复验。
- `verify-codument-release.ts round-24-knowledge-product --full-cli --release-set <host-release-round-16-clone-lock>`已启动。consumer的新增ModelingRegistry fixture显式当前profile，旧native完整lock条目逐项比较保留，并将新产品domain reader数量扩到11；不是删除历史锁校验。期间冻结产品源码/consumer夹具，下一读命令实现待其结束再开始。

### E196 — 十一内置 Kind 的已安装产品兼容

- 73726 `round-24-knowledge-product` exit0，新C set2d3630141d8521a47447f9e4d094e2d25864c6c65389cea6475d15ca49ba34d3，公共3e28f0c8。正常安装断源、strict TS、129domain/889、两知识Kind实际compiler/nested reader与旧九指纹对照、原native完整lock及所有已接CLI、Page/Vue/MCP通过。知识validate/lint/scaffold CLI尚欠，不将库级schema过线算命令已迁。
- 精确同候选的最低Bun复验 `round-24-knowledge-minimum --curl --same-release-set` 已启动，source/consumer夹具继续冻结至其完成。之后直接进入knowledge source/config ports与只读CLI，领域节点仍active；磁盘约6.2GiB，临时验证自动清理，不删除历史恢复材料。

### E197 — 最低 Bun 通过并接入知识只读命令

- 18580 `round-24-knowledge-minimum` exit0：公共3e28f0c8与C 2d363014同一候选，Notes/H/C在Bun1.3.0通过；二进制SHA256 ce7b4f94a13ee0f881b06cfb4e428a017ddc69c3307dae0cb86709042fe0c058。源码在此结束后才进入Round25；新命令不由该候选证明。
- 四个modeling/engineering validate/lint叶子已接同本地domain owner，sources/config Effect显式，settings/index/schema/lint纯逻辑。保留modeling默认on/engineering默认off、显式目录或deltas绕过validate配置、lint始终观测自身配置；lint从同一source统计顶层业务节点而不是重复读文件或只算wrapper。已观察旧engineering validate与两lint忽略--json，adapter保留其文本特例；只有modeling validate输出原findings数组，disabled仍原文本。严拒旧config/source、非法UTF8、symlink、歧义Track与非法阈值；无写入。
- 35333 `round-25-knowledge-read-typecheck` exit0（测试加入前）；32009 `round-25-knowledge-read-narrow`正在运行。后继scaffold/merge/archive和自动membership仍欠，领域节点不关闭。

### E198 — 知识只读 CLI 本机回归

- 32009 `round-25-knowledge-read-narrow` exit0（4/46），真实CLI覆盖default/explicit/deltas、ModelingConfig禁用与lint继续工作、旧EngineeringConfig不参与显式目录validate、legacy JSON文本特例、阈值错误、无私有目录、source bytes、非法UTF8/symlink/双Trackauthority/悬空引用拒绝。52865 `round-25-knowledge-read-root` exit0（495/4535/typecheck/lint）。
- 架构 `round-25-knowledge-read-architecture`进行中，actual packed CLI fixture已加四叶子与默认gate/原JSON特例检查，架构后运行新pack。即使此前2d363014已最低Bun通过，也不能代表本轮27叶子已安装完成。下一source-aware scaffold切片须复用注册源快照与单文件写边界，并在提交前检查Track/registry漂移，不直接沿用旧appendFileSync。

### E199 — 知识只读架构过线

- 38209 `round-25-knowledge-read-architecture` exit0（260/1914）；随后 `round-25-knowledge-read-product`已启动，source/consumer测试冻结至完成。未把只读命令接到Serve，也没有把多个read-only投影变成写authority。
- 下一写入切片的观测注意点：共享DomainSourceWritePort仍有Decision命名残留，且observe目前只拒绝directory，lstat后未明确isFile；知识source reader已拒绝特殊文件。迁入知识写能力前应给共享writer补特殊文件拒绝测试与检查，不能让FIFO被当普通XNL内容阻塞。此为待验证风险，不把当前无该负例的绿测试解释成已覆盖。

### E200 — 四个知识只读命令已安装验证

- 26736 `round-25-knowledge-read-product` exit0，新C set1618f5facdd8cdc7090674e9b46d9092dee39fb7d3358f52b6b4f0f603b43f26，公共3e28f0c8。正常安装/断源、strict TS、131domain/907、真实四knowledge叶子及原JSON例外/默认gate/只读与既有CLI/native/Page/Vue/MCP全通过。最低Bun最新是Round24 E197；新命令后续随下个候选重验。
- Round26继续知识scaffold前先对共享writer补实际FIFO子进程负例，读取超时会杀掉仅测试子进程，不让宿主测试挂死；`round-26-source-special-red`正在运行。未放宽原文件保真/权限/CAS检查，未改用户任何真实source。

### E201 — 特殊文件纠偏与知识创建提案

- 49707 `round-26-source-special-red` exit1（3pass/1fail），隔离子进程在FIFO read阻塞1500ms后被fixture杀掉、exit137；未影响宿主或真实文件。加lstat.isFile拒绝后080918 `round-26-source-special-green` exit0（4/27），同断言57.84ms拒绝FIFO，原文件模式/CAS/竞争/UTF8测试不变。
- 知识scaffold新增纯请求/快照合同及source-body插入提案；旧五种modeling和五种engineering表征模板迁入pure logic，新modeling主体明确data-topology profile与TODO角色/authority说明，不猜测其真实owner。字段/状态/路径输入拒绝文本闭合符注入与越界；对完整registry ID/URI和目标source AST比较，不用appendFileSync。新logic typecheck正在执行；filesystem写port、CLI与测试尚未完成，不提前算功能可用。

### E202 — 知识 scaffold 写入与 CLI 负例反馈

- 71887前轮pure typecheck、35577 effect/owner/product typecheck均exit0；46851 `round-26-knowledge-scaffold-narrow` exit0（13/160）：十模板、开放schema与显式legacy profile共存、源注释/扩展保留、重复ID/owner/旧forest/注入拒绝，以及真实文件opaque handle/一次性提交、umask和existing mode、整体registry漂移、Track source/stage漂移、双authority/锁拒绝。
- 95855 `round-26-knowledge-scaffold-cli` exit1（3pass/1fail）：失败仅为recursive readdir相同文件集合顺序不同，输出diff指向断言39。改为排序后比较同一集合，未删除无额外写入断言。其余default/explicit/deltas/read-only及CLI scaffold原文本协议通过；待修正后重验与新pack，不复用旧候选宣称29叶子完成。

### E203 — 知识 scaffold 全仓本机回归

- 75164 `round-26-knowledge-scaffold-root` exit0：typecheck/lint和504tests/4700assertions/101files通过，包含先前失败的CLI文件集合断言及两种Track delta路径、legacy flat registry拒绝且源不变。新两叶子保留原--json文本例外，正式root仅codument/；默认scaffold要求已有formal目录，不创建半初始化workspace，TODO仍是待语义审阅的草稿。
- 下一步架构→新制品→最低Bun串行。归档只读观察已确认还需行为patch、两知识three-way merge、决策晋升、memory profile、Track/Mission移动与失败恢复的同一事务，不能把已有basic mission-archive绑定为完整旧命令。旧merge两份同义算法已由domain mergeXnlNodes承接，后续补知识owner/source与Git baseline边界。

### E204 — 知识创建两叶子已打包验证

- 55563 `round-26-knowledge-scaffold-architecture` exit0（269/2061）；70776 `round-26-knowledge-scaffold-product` exit0，公共3e28f0c8，新C set7a5bc664c01b61ee734604f9f65bcd46a328b857a82b3bda75828d789561c5b3。138installed domain tests/1025assertions/28files、strict TS、正常registry安装后断源、完整旧lock/11内置Kind、nativeCodeFirst、Page/Vue/MCP/close均通过；真实CLI新增两scaffold对同owner追加、原--json文本、重复拒绝和字段选项通过。合计29个非冲突旧叶子，不含未迁archive/artifact等或三暂停命令。
- 对同一public/product set启动 `round-26-knowledge-scaffold-minimum --curl --same-release-set`，保持source/tests/consumer fixture冻结。下一ready切片选artifact sync，其范围与完整archive未完项见design/archive-and-artifact-boundary.md；不把该设计文档当第二工作图。

### E205 — 最低 Bun 同候选通过，进入制品同步

- 62122 `round-26-knowledge-scaffold-minimum` exit0：Bun1.3.0（固定二进制ce7b4f94…）Notes/H/C同公共3e28f0c8和C 7a5bc664全部通过。此后才改变产品源码；新artifact代码不归于此前验证。
- Round27按当前领域节点补artifact sync。本次请求显式source/target，纯logic形成changes与dry-run/conflict决策，support持有二进制和可恢复文件发布；不引入Serve，不读取Codument领域profile。不依赖旧src。21814 `round-27-artifact-typecheck` exit0；新fault-injection测试待执行。原archive事务全部能力仍保持未迁入。

### E206 — 制品同步负例驱动的所有权纠偏

- 4aadae `round-27-artifact-narrow` exit0（8/56），覆盖原dry-run/conflict/force协议、二进制、目标额外文件、mode、source/target漂移、N-th写失败及写后抛错回滚、独立编辑阻止回滚时保留backup/journal、符号链接/FIFO/目录冲突。
- 随后3d1685 `round-27-artifact-ownership-red` exit1（6pass/2fail）：实测本机case-insensitive文件系统下source与SOURCE/nested未被识别重叠；成功发布后替换锁目录的fixture也未产生清理警告。补physical nearest-existing-path关系检查与清理前inode/dev身份检查；不把初次窄绿当完整安全证明。待相同负例重验。

### E207 — 所有权负例及实际制品 CLI 通过

- 7cef94 `round-27-artifact-ownership-green` exit0（10/61），同case-alias与替换锁负例均检出；替换目录的独立文件保留，已发布结果携maintenanceWarnings，不递归清理不属于本次操作的目录。
- 6321 `round-27-artifact-cli` exit0（9/62）：真实CLI原JSON/text、dry-run、conflict exit2、force、幂等unchanged、参数拒绝与无初始化/Serve通过，包含source support回归。随后又补no-op source重查、发布期间新增源文件触发回滚、restore Effect本身失败保留材料的测试，待全仓验证；其结果不借前述绿测试宣称。

### E208 — 回归类型门反馈

- 65017 `round-27-artifact-root` 未进入lint/test，typecheck exit2：新测试changes数组的status被TS推断为string而非字面量联合，生产实现无该报错。测试期望添加as const保留字面量；以新label `round-27-artifact-root-green`重跑完整check，不把之前Bun test绿替代类型门。

### E209 — Artifact 全仓回归与原源保护

- 35671 `round-27-artifact-root-green` exit0：typecheck/lint及517tests/4805assertions/104files。新增no-op、发布中source membership漂移、restore失败材料保留负例全部通过；真实artifact CLI与原命令注册全覆盖过线。
- edf878独立重hash冻结基线C.json中的664个src/codument条目，kind/mode/hash changed=[]（exit0）；用户既有attractor在基线内原样保留。只读Git状态仍仅原tracked改动及project/、.cdmt-lite/未跟踪目录。
- 接下来 `round-27-artifact-architecture` → `round-27-artifact-product` 打包安装，source与consumer fixture不再改动直至验证结束；归档下一切片为读取不可变Git baseline及纯晋升提案，不切Git分支、不创建真实workspace。

### E210 — Artifact 架构门通过

- 42866 `round-27-artifact-architecture` exit0（282/2145/57files）；实际artifact CLI已纳入scoped domain-core架构回归。`round-27-artifact-product`已启动，冻结产品源码和consumer夹具；尚不报告新候选可安装，等待进程退出与日志。

### E211 — 显式 artifact sync 已打包安装验证

- 69659 `round-27-artifact-product` exit0；公共3e28f0c8，新C setb0fa4bd7dacbc91c4de5e2eb4947810872fadf0eaabbfb5680378a10f76fd1bf。150installed domain tests/1095assertions/30files、strict TS、正常registry安装后断源、原完整native lock/11内置Kind/Page/Vue/MCP/close均通过；实际artifact CLI原JSON、exit2、force、binary以及原29叶子回归通过，合计30个非冲突旧叶子。不包含archive、migration、三冻结命令或完整能力gate。
- 同候选最低Bun复验 `round-27-artifact-minimum --curl --same-release-set`正在启动，继续冻结source/consumer夹具。归档baseline的历史语义读取与当前可写authority分离，读Git不得更改HEAD或真实workspace。

### E212 — 制品同步最低运行时通过，开始归档基线

- 75367 `round-27-artifact-minimum` exit0，固定Bun1.3.0、公共3e28f0c8与C b0fa4bd7的Notes/H/C全部通过。此后才进入Round28源码；旧src/codument没有写入。
- 归档基础新增KnowledgeBaselinePort（explicit root/env）、直接读取commit/tree/blob并验证Git blob hash，不checkout、不materialize临时registry。纯selectKnowledgeArchiveBaseline保留“无base且现有registry非空拒绝”的旧规则；原历史字节保留，legacy转换是后继migration边界而非reader行为。三项测试待执行，未接完整archive入口。

### E213 — 历史基线与源字节负例纠偏

- 30444 `round-28-archive-baseline-narrow` exit0（3/30），nested workspace、固定commit/blob、dirty source与HEAD/status保留、legacy XML原文、非法refs/link/UTF8检查通过。
- 72795 `round-28-archive-baseline-env-red` exit1（2pass/1fail），继承GIT_DIR/GIT_WORK_TREE/GIT_OBJECT_DIRECTORY确实读取了第二仓的foreign.xnl而非显式workspace的own.xnl。清理repo-routing与环境内临时Git config覆盖，保留显式workspace裁决和只读Git参数。
- 84667 `round-28-source-bom-red` exit1（5pass/3fail）：新增BOM/CRLF原文断言揭示Git source decoder和共享DomainSource writer都会剥离BOM，另一个失败为前述尚未修的env。统一严格UTF8 decoder加ignoreBOM:true保留字符（并不忽略字节），同步修knowledge/validate/std source观测，加入真实knowledge bounded insertion的BOM/CRLF断言。source变化使此前artifact/knowledge支持包候选不再代表当前源码；后续必须新pack。

### E214 — BOM 解析边界反馈与安全收敛

- 86018 `round-28-source-baseline-green` exit1（11pass/1fail）：Git env隔离与原字节保留已经通过，但xnl-core0.3对保留下来的BOM报 `Expected '<' to start a node (at 1:2)`，并非所有合法UTF8都属于被接纳的XNL语法。原测试“带BOM也可直接正常追加”的假说不成立。
- 不修改vendor parser、不恢复隐式剥离BOM；明确测试源观察保持BOM、propose拒绝且真实源/锁均不变，交由显式migration/review决定字节规范化。普通CRLF owner仍验证成功追加且尾部字节保持。共享文件port与Git历史读取可以原样保存BOM，不冒充正常XNL语义admission。此处保真约束未降低，禁止以修改测试删除原文保留或失败零写断言。

### E215 — 基线与源保真复检通过

- 14926 `round-28-source-baseline-reconciled` exit0（13/90），包含Git跨仓env反例、BOM/CRLF原字节、knowledge不支持语法时零写以及source writer/FIFO/CAS回归。继续全仓check后补Decision晋升的纯提案；完整archive事务和CLI仍未接。

### E216 — 基线/保真全仓通过，补 Decision 晋升提案

- 42411 `round-28-archive-source-root` exit0：typecheck/lint及523tests/4859assertions/106files；这是Decision晋升代码加入前的验证。磁盘曾观察为4.5GiB，保留全部历史证据，不删恢复材料。
- Decision晋升新增pure proposal及由canonical parser复核的root source fragment定位；保留完整durable祖先闭包、业务owner路径、现有owner/source、unknown扩展与内层注释，不做Markdown投影。跨根durable、部分identity重叠、不同树、悬空依赖、隐藏owner拒绝；三测试待运行。完整进程源、配置、Git base与多registry发布仍由后继archive事务组合，不提前绑定CLI。

### E217 — Decision 晋升提案窄验证

- 189124 `round-28-archive-decisions-narrow` exit0（3/19）：原source fragment、nested/text/comment定位、完整durable祖先闭包、依赖/activation与未知payload保留、重复幂等及已有异路径owner不复制通过；root durable/隐藏owner/部分重叠/不同树/悬空依赖/重复源ID拒绝。
- 全部变化将进入 `round-28-archive-foundations-root`，之后架构与新pack。此为归档内部foundation而非完整archive功能；原Track/Mission archive CLI仍不绑定，knowledge three-way owner/source写入、行为晋升、memory及多registry事务仍欠。

### E218 — 归档基础全仓与 Git 隐式补拉负例

- 52711 `round-28-archive-foundations-root` exit0：typecheck/lint及526tests/4884assertions/107files，包含新增Decision source/promotion基础。之后补只读边界负例，故该绿结果不覆盖后续改动。
- 39006 `round-28-archive-baseline-lazy-red` exit1（3pass/1fail）：仅隔离本地file:// partial clone，在fixture证明blob缺失后，原Git reader确实通过promisor隐式补拉并成功返回，与“观察不访问远端”承诺冲突。没有访问用户远端。绑定GIT_NO_LAZY_FETCH=1且GIT_ALLOW_PROTOCOL为空（所有transport拒绝），缺对象显式报错，待同fixture重验；不把GIT_TERMINAL_PROMPT=0误当禁用网络。

### E219 — 基线观察禁止隐式 Git transport

- 96236 `round-28-archive-baseline-lazy-green` exit0（4/24）：同partial clone fixture在读前/失败后blob均保持缺失，未checkout文件；普通历史读取和repo-routing env隔离仍通过。绝对workspaceRoot为构造必要条件，不从隐式cwd补全。
- 下一步 `round-28-archive-foundations-final-root` →架构→新pack，验证本轮foundation与UTF8保真变化；完整archive仍未接。后继knowledge merge必须显式保留源profile解释、owner身份、未知字段、冲突政策与历史baseline来源，不允许聚合wrapper整体替代业务节点合并。

### E220 — 归档基础最终源码与架构验证

- 77070 `round-28-archive-foundations-final-root` exit0：527tests/4888assertions/107files，typecheck/lint通过。98465 `round-28-archive-foundations-architecture` exit0：292tests/2207assertions/60files。
- 32337 `round-28-archive-foundations-product --full-cli --release-set host-release-round-16-clone-lock` 新pack执行中，source/consumer夹具继续冻结。源码证明覆盖Git禁隐式补拉、BOM原文保留及Decision纯晋升提案，不代表完整archive已接入。

### E221 — 归档基础真实安装验证

- 32337 exit0：C set `c55da87d9e7a3bf1da6dca83cabbda4150a06b4b8b603eb3b642c9f56470dcd0`、公共3e28f0c8；160installed domain tests/1157assertions/33files及strictTS、原30非冲突CLI叶子、native/Page/Vue/MCP/owned close通过。候选路径 `verification/round-28-archive-foundations-product-artifacts`。
- 继续同候选最低Bun1.3.0验证，之后解冻源码补知识合并。新增foundation仍未冒充完整archive产品操作。

### E222 — 最低运行时通过，继续源保真合并

- 12512 `round-28-archive-foundations-minimum` exit0：固定Bun1.3.0，Notes/H/C同公共3e28f0c8及C c55da87d全部通过；解冻源码进入知识合并切片。旧src/dogfood/三个暂停命令不动。
- Writer继续让xnl-core解析/格式化/复核语义；本地source token索引只定位改动。匹配的原token与全部语法外注释保留，改动后完整AST不等价则拒绝。当前owner及未变主体优先原字节；不把重新serialize整份registry当保真。完整归档仍未绑定。

### E223 — 知识 owner/source 三方合并切片与反馈

- `round-29-source-tree-narrow` af8135 exit1（10pass/1fail），一律加空格破坏#identity；`round-29-source-tree-spacing` dc1b21 exit0（11/45）。`round-29-knowledge-merge-narrow` 0f3fca exit1（3pass/4fail），测试误写旧fact_grade和缺engineering必填块，按既有schema修正fixture而非放宽校验。`round-29-knowledge-types` 20863 exit0。
- `round-29-knowledge-schema-fixture` 0c4698 exit1（6pass/1fail），差异为已改值的空格，不是业务值；单token替换保留原间隔。`round-29-knowledge-source-closure` f9e0d9 exit0（7/47），body按原成员fragment组装，保留canonical header、完整新主体原文与显式profile。legacy bare forest只在Git历史adapter里机械包裹并验证旧schema，不在normal reader接受；XML/BOM/未知语义需migration review。
- `round-29-large-source-red` 8f00a1 exit1（3pass/1fail）：900字段只改首尾也触发原N*M表的人为限制。改为Hirschberg线性行存储，不降低合法资源规模；`round-29-linear-source-green` f12bb5 exit0（16/77）。
- `round-29-source-combinations` d90b76、diagnostic 44163b exit1：64种确定性组合的variant16删除节点后拆开#word；改为不可分token，`round-29-source-identity-token` 6a865d exit0（18/211）。`round-29-presentation-merge-red` 09106a exit1（12pass/2fail）：同理<Tag不能拆开，且不同文本delimiter/属性顺序会产生假same-field conflict；只对语义diff去掉presentation marker，保留原source，`round-29-presentation-merge-green` 436738 exit0（19/209）。
- 紧接新增archive级文本marker/幂等断言并进入完整check；未接完整archive事务/CLI，未用pure helper证明整条能力。

### E224 — 知识合并全仓与文本 delimiter 纠偏

- 9434 `round-29-knowledge-archive-root` exit0：540tests/5089assertions/109files、typecheck/lint通过。随后对formatter代码观察补了正文包含旧closer的负例：893ce8 `round-29-text-delimiter-red` exit1（6pass/1fail）。新正文中的旧delimiter不能直接沿用；以显式确定性factory选择未出现在目标树中的marker，只在rendering副本调整，不修改语义输入。b57eea `round-29-text-delimiter-green` exit0（13/192）。
- ed2d24只读重hash：原src/与真实codument/ 664文件kind/mode/SHA256对C基线changed=[]，exit0，用户既有attractor包含在原基线中且保持。
- 继续 `round-29-knowledge-archive-final-root`、architecture、新pack验证最终源码，当前冻结source/consumer夹具；R28 c55da87d仍是最近完整安装证明，不覆盖本轮改动。此处不暂停mission。

### E225 — 知识合并最终源码全仓通过

- 38612 `round-29-knowledge-archive-final-root` exit0：541tests/5092assertions/109files，typecheck/lint通过；包含最终安全delimiter修复。继续 `round-29-knowledge-archive-architecture`，随后同公共R16新C pack，source/consumer保持冻结。
- 已只读对照旧Behavior archive/selector/DTO/native mutation闭包，接续实施细节进入 `design/archive-and-artifact-boundary.md`；没有另建工作图，没有修改旧src。

### E226 — 知识归档架构验证

- 22769 `round-29-knowledge-archive-architecture` exit0：306tests/2402assertions/62files。继续 `round-29-knowledge-archive-product --full-cli --release-set host-release-round-16-clone-lock` 新pack，保持产品源码/夹具冻结。
- 旧spec.md归档支路仅打印“would apply”而不真正晋升，不能把它当完整历史迁移能力：新版正常归档遇未迁移材料应明确migration/review，不沿用假成功。后继migration负责兜底转换与用户语义确认。

### E227 — 知识归档新候选安装通过

- 59513 `round-29-knowledge-archive-product` exit0，C set `085f593364b1c1db55063c8b17a3f25f9b04dc347c38439ed7967075852de310`，公共固定3e28f0c8。正常registry安装后断源、installed domain tests、strictTS、原30非冲突CLI叶子、native/Page/Vue/MCP/owned close全部通过。产物 `verification/round-29-knowledge-archive-product-artifacts`。
- 接同候选最低Bun1.3.0验证，期间继续冻结源码/夹具；之后直接进入BehaviorPatch晋升切片，不等待用户确认局部节点。

### E228 — 知识晋升最低运行时与下一切片

- 38528 `round-29-knowledge-archive-minimum` exit0：固定Bun1.3.0下Notes/H/C同public3e28f0c8及C085f5933通过；59513完整日志补确认174installed tests/1352assertions/35files。
- 解冻源码进入Round30 BehaviorPatch native晋升。完整archive仍未绑定；源码锁/summary/memory旧实现缺口已写入archive设计，不把现有lifecycle单资源commit误认为多registry归档事务。

### E229 — BehaviorPatch native晋升与 memory/summary 提案

- 88206a `round-30-behavior-archive-narrow` exit1（4pass/1fail）：只读extend的collection漏掉合法body collection；补两种结构位置的同一selector解析，235159 `round-30-behavior-archive-collections` exit0（10/54）。54188 `round-30-behavior-types` exit0。870d0a `round-30-behavior-ordered-batch` exit0（6/37），覆盖按文件确定顺序、多mutation最终验证、原Move覆盖目标语义和无patch时不读取无关旧registry。
- 新logic直接在native AST上保留复合扩展，逐级解析Requirement/Suite/Case与别名；支持新capability、缺省target ID、跨capability Move；重复owner/重复target/缺失/不安全路径/移入自身后代/无Requirement最终树拒绝。所有变化只形成纯提案，原source输入不变；没有恢复XML DTO读写链。
- d33941 `round-30-memory-archive-narrow` exit0（10/65）：显式memory boolean启用、错误config不静默关闭；四类明确候选、原文缩进/CRLF、URI编码、本地calendar命名、同内容幂等/异内容冲突、嵌套Decision summary有序派生/人工summary冲突均通过。summary单数标题修正旧summarie拼写，不改变类型路径；未绑定发布。
- 接完整 `round-30-promotions-root`，仍是内部晋升closure，完整archive源观测、锁/备份/回滚及CLI还待组合；不标领域节点done。

### E230 — 晋升闭包全仓通过

- 11561 `round-30-promotions-root` exit0：551tests/5169assertions/111files、typecheck/lint通过。BehaviorPatch、memory/profile/summary新增代码尚未新pack，R29已安装候选仍为085f5933；待完整archive组合后的新pack覆盖，不能据此声称archive CLI可用。
- 继续完整archive的contract/observation/transaction实现：不同writer的真实锁协议、summary/memory冲突和外部ProjectRef的只读guard必须进入同一失败恢复边界。当前没有用户gate，继续执行。

### E231 — 完整归档规划与文件事务故障验证

- 99547 `round-30-archive-contract-types` exit1：局部registryUpdates误用readonly接口作可变构造容器；改局部类型，公开输出仍readonly。a20f93 `round-30-archive-planner-narrow` exit0（6tests/30assertions），证明完整纯规划的确认/源身份/目的地/ProjectRef观测覆盖/旧spec review/显式memory/失败不发布。
- 0ad1cf `round-30-archive-transaction-narrow` exit1（0pass/7fail）：macOS临时根经/var符号别名，严格源检查拒绝。fixture先取物理根，不放宽源内symlink约束；c39e1d `round-30-archive-transaction-physical-root` exit0（7/55）。覆盖多registry+完整binary/空目录/mode移动、旧快照拒绝、write-then-throw、move-then-throw、独立修改/新增保留和journal/backups、foreign lock不窃取。
- 这些是内部支持层证明；完整观察器/产品owner/旧archive CLI仍未组合。继续把既有生命周期discovery抽成共用只读effect，避免archive复制出第二套authority查找；随后重新跑原lifecycle回归及typecheck，再补真实归档source port。

### E232 — 真实 archive source port、owner 与 CLI 组合

- c1bff4、4cd846 typecheck exit0。b67ad3 `round-30-archive-port-and-lifecycle` exit1（24pass/1fail），共用读取器改变了invalid UTF-8提示；恢复原兼容文字且仍fatal decoding，d8a21e `round-30-archive-port-compatibility` exit0（32/183）。
- source port持有私有bytes/目录identity/全部registry+config/bindings与外部Track观测；反复guard目标身份及ProjectRef来源，调用者修改Map/AST或foreign handle拒绝。源内binary/空目录/mode整体移动，不把它们当待解析XNL。lock协调+全输入复检+只恢复己方写入；恢复不全保留journal/backups。清理进一步只删除已验证identity的己方recovery files，foreign新增保留并区分“发布成功但需维护”。
- 0c2cc9 typecheck exit1：新增DomainOwner.archive后旧测试mock缺方法；补显式unexpected stub，42a805 exit0。d35b1c CLI验证exit1（8pass/1error）：CLI测试不应增加领域私有依赖，改用真实create命令造fixture；8ce513 exit1暴露archive命令缺doc元数据，补完整公共command contract。3a0146 `round-30-archive-cli-contract` exit0（11/92）。
- a35a6b `round-30-archive-promotions-and-discovery` exit0（23/137），覆盖真实Behavior+modeling+Decision+memory+summary晋升，以及原lifecycle和新CLI。把结构identify与目标semantic inspect分开，合法但未完成的兄弟draft不再阻断目标；目标自己的semantic错误仍拒绝。使用simplify只收拢重复discovery与嵌套条件，不缩减验证。
- 新root `archive` 与 `mission archive`/`Mission archive` 已组合本地domain owner，支持旧--yes/-y/--skip-specs、源updated_at本地日历命名、完整移动及恢复。JSON receipt为明确新增能力；三个暂停入口仍未合并。尚未新pack，不提前算installed兼容已过线。下一步冻结源码/consumer fixtures，运行完整root→architecture→新pack→最低Bun。

### E233 — 完整归档首轮全仓反馈

- 82738 `round-30-full-archive-root` exit1：typecheck/lint通过，573pass/1fail/5329assertions/115files。唯一失败为公共commandPaths快照尚未声明新增的archive、mission archive、Mission archive；真实CLI与事务故障用例均通过。不删除快照检查，更新新增叶子后重新完整验证。

### E234 — 归档全仓过线与架构反馈

- 11795 `round-30-full-archive-final-root` exit0：574tests/5351assertions/115files，typecheck/lint通过。039723只读保护复检664项src/codument kind/mode/hash相对冻结基线changed=[]，exit0。
- af412f `round-30-full-archive-architecture` exit1：纯logic的局部变量process触发ambient-name约束（并非实际全局IO），改明确authority命名；support的XNL类型经未声明transitive import获取，改从领域契约的root类型取得，不给Effect层增加parser依赖。不修改架构门禁以跳过检查；重新architecture及完整root，成功后新pack。

### E235 — 完整归档架构过线

- 48218 `round-30-archive-boundary-architecture` exit0：339tests/2622assertions/68files。按包层次的直接依赖、无ambient IO、32领域叶子本地组合及既有Host/Page/Vue/MCP回归通过。继续最终同源root，不解冻consumer fixtures；随后新C pack和最低Bun，不暂停mission。

### E236 — 完整归档最终源码全仓通过

- 69629 `round-30-archive-boundary-root` exit0：574tests/5351assertions/115files，typecheck/lint通过。当前最终源码与E235架构一致；保持冻结，执行 `round-30-full-archive-product --full-cli --release-set host-release-round-16-clone-lock` 新pack，随后同候选最低Bun1.3.0。

### E237 — 隔离归档候选首轮与验收脚本校正

- 96886 `round-30-full-archive-product` exit1：已生成C候选02b3c5eaf1b65e765c8f31b350a9addbaeada83b6d91f98c0b80fd6b9a27a628并正常解析安装，consumer.mjs仍断言旧根命令列表，漏archive。补验收脚本显式新增叶子；产品源码/制品不变，下一次以--product-set复用同一个候选。失败日志保留，不以新pack抹掉失败轨迹。

### E238 — 完整归档隔离安装通过

- 39312 `round-30-full-archive-installed` exit0：同C02b3c5ea/public3e28f0c8，204installed tests/1536assertions/40files，strictTS、普通包源解析后断源、32非冲突旧CLI叶子及native code-first/旧完整lock/LocalFunction/Page/Vue/MCP/owned close全部通过。制品为 `round-30-full-archive-product-artifacts`，不等于npm已发布。
- 继续 `round-30-full-archive-minimum --curl --same-release-set`，以同产品/公共候选验证Bun1.3.0 Notes/H/C；期间保持源码/consumer冻结。之后进入领域capabilities子集的逐项合同收口，再按工作图推进workspace App，不在此返回用户。

### E239 — 完整归档最低运行时与领域子集门禁

- 72651 `round-30-full-archive-minimum` exit0：Bun1.3.0（既定binarySHA ce7b4f94…）Notes/H/C同public3e28f0c8、C02b3c5ea过线。解冻验收脚本，产品制品源码不变。
- 新capabilities --scope domain按冻结0.5.4基线53paths中的41可执行叶子逐项映射：32有本地owner与具体真实CLI测试；6迁移叶子明确后继DEFERRED；3用户暂停入口单独DEFERRED。无scope/fullMission/workspaceApp不冒充通过。be5c35 `round-30-domain-capability-gate` exit0（3/23）：遗漏、重复、remote、暂停入口暗中合并和未实现整体验收均fail closed。接实际domain suite和最终root。

### E240 — 领域 capability 子集真实执行

- 56572 `round-30-domain-capabilities` exit0：225tests/1931assertions/48files。报告包含全部41旧叶子，32本地领域命令COVERED及9项明确DEFERRED，fullMission/workspaceApp不通过。不是只做注册枚举：实际执行完整logic/support/capsule和逐族CLI行为用例。
- 接 `round-30-domain-gate-root` 最宽回归；本次仅验收scripts/test变化，产品包src仍等于C02b3c5ea已安装及最低Bun候选。领域节点待本门过线再done，之后立即推进App节点。

### E241 — 领域节点子集收口，继续App工作图

- 5288 `round-30-domain-gate-root` exit0：575tests/5367assertions/115files，typecheck/lint通过。与E235架构、E238安装、E239最低Bun及E240逐项domain suite闭合；新增验收scripts不改产品包src。领域节点done；仅限32领域叶子与其业务closure，六迁移叶子及三个暂停入口仍后继，不宣称全产品完成。
- 自检索引 `verification/domain-capabilities-round-30.md` 分列范围、DEPA边界、原文/并发保证与限制。进入Round31 workspace App：已有代码实测compiler浅Catalog缺递归（E196），须观察Host loader/read-port与来源血缘扩展，先投影设计再实现，不让empty resources冒充通过。
- 重新完整读取depa-expert入口/AGENTS/DataTopology基础；halfcode-cli-lite-authoring目前仅“待补充”，明确以已批准设计+实际公共契约+示例App代替该占位规范，不据此暂停。

### E242 — App 递归成员公共切片

- 完整重读 cdmt-mission-lite/控制循环及三吸引子；读取实际 compiler 0.3.0 catalogFiles 与公开 read-port，确认没有递归枚举原语。设计落 `design/workspace-membership.md`，不复制第二 compiler 或反写物理 manifest。
- 通用递归投影在 H 的 skill-app-logic/support；契约只增加 loaderProjection 标记，C 尚未消费新公共制品。d4d68a `bun test packages/skill-app-support/test/recursive-catalog.test.ts packages/skill-app-support/test/catalog.test.ts` exit0：9tests/48assertions，非空嵌套、动态成员、原路径/摘要、空未知 Kind、schema/重复/链接负例、owner 边界及旧浅语义。
- 7010 typecheck exit2：wordToString 可返回 undefined；修正为显式空 ID 拒绝并检查重复 ID，避免投影重命名掩盖作者冲突。继续上游完整 check，不能以局部绿标 App done；后继仍需正常 registry 消费新公共候选、产品孤儿审计及内部 installer/Skill。

### E243 — 递归投影复检与诊断纠偏

- 42024 `round-31-recursive-host --check-only` exit0：typecheck/lint、548tests/5100assertions/122files。此后新增嵌套扩展拒绝与strict UTF-8/BOM/重复声明测试，旧门禁不冒充最终源码证明。
- 77bf38 最窄测试exit1：实际已拒绝嵌套扩展，但compiler safeReadBytes吞下具体错误。Host读端口保留首次源诊断，加载失败时上抛原诊断，不绕开compiler。451109同最窄命令exit0：12tests/56assertions。
- 按simplify仅整理新增条件与类型，不降级行为。继续 `round-31-recursive-final --check-only`，过线后新公共release set及三消费者，当前C还未切换。

### E244 — 公共最终源码回归

- 3786 `round-31-recursive-final --check-only` exit0：typecheck/lint，551tests/5108assertions/122files，见同label-check.log。公共生产源码冻结，新增独立Notes递归消费fixture只作验收，不改变已测包payload。
- 当前磁盘只剩约749MiB；只读检查未定位可确认归本轮所有的大型临时残留，不删除其它任务/历史材料。公共pack与开发采用串行进行，完整隔离消费按实际空间继续，不用源码证明冒充安装验证。

### E245 — 递归投影公共不可变候选

- 39066 `H/scripts/prepare-release-set.ts V/host-release-round-31-recursive` exit0：digest185f8d37152f2b41b1db6dcd3c2f357dcae47babca67e43aedf73d0116928bfb，14shared+6product+160vendor=180制品；未发布。此前public3e28f0c8保留为已验证回退材料。
- 开始C开发采用 `install-codument-release.ts ...host-release-round-31-recursive round-31-recursive-install --development-tools --fresh-lock`：旧lock保存独立before.bun.lock，正常版本/传递解析+精确SRI检查，失败恢复旧lock。其后必须运行C测试及安装消费，不以install本身宣称兼容。

### E246 — C 新公共候选采用与非空知识验证

- 4e5e32 因安装脚本位置参数顺序错误在任何写入前exit1；按实际签名改为label在前。85407 `round-31-recursive-install <absolute-release-dir> --development-tools --fresh-lock` exit0，502packages正常解析安装，旧lock独立备份、14公共SRI逐项通过；可选非本机platform404明确未提供，不声明那些native通过。
- 3369dc `round-31-recursive-codument` exit0：1test/27assertions，C通过新公共制品自动发现深层ModelingRegistry/EngineeringRegistry，保留旧浅模式零行对照，并验证真实路径/原manifest不变/reader递归成员、语义负例。
- 15736 独立递归consumer先exit1：测试将manifest-only DatabaseConnection误声明为directory，真实compiler正确拒绝。改为公开注册的Note single-file（不放宽Kind），12185 `round-31-recursive-custom-consumer` exit0：普通registry+精确SRI后断源，公共185f8d37真实独立非空递归通过。范围仅recursive-catalog；三消费者完整回归仍UNVERIFIED，不替代后继门禁。

### E247 — C 公共采用回归与正式 App 首片

- 61440 `round-31-public-adoption-root` exit0：typecheck/lint、575tests/5369assertions/115files。仅证明此前C源码采用public185f8d37；以下App新增生产源码使此门不再代表最终源码。
- 0072e1/580eaf renderer夹具先后拒绝SkillApp未知description属性与Track非合法done状态；没有放宽公共/领域schema，分别修正新作者renderer和夹具completed。432290 `round-31-formal-app-current` exit0：1/10，正式codument/、递归知识/归档Track与无KindDefinitions通过。
- 新产品App inspector通过既有领域ports观察聚合closure，以manifest/资源hash和前后观测比对检查orphan/source drift，再复用完整知识、决策及strict生命周期validator。47f57a exit1暴露不当提升知识warning，恢复原validator分级（不改validator、不删诊断），a14c58 `round-31-app-inspector-severity` exit0：3tests/49assertions；disabled知识仍校验，Host结构ready但漏收/语义错误产品拒绝。
- 48990 typecheck exit0（增加测试前）。接新增漂移负例、受影响领域回归与架构检查；App节点active，installer/Skill及CLI Resource validate接入尚未完成，不能按内部read API宣称core通过。

### E248 — App 领域 closure 与实际 Resource 命令

- 56132 `round-31-app-domain-regression` exit0：206tests/1563assertions/41files；包括原领域全套和新成员/source drift断言。领域registry普通读取改严格UTF-8/BOM保留，App观察额外拒绝legacy XML；没有增加第二递归扫描器。
- 4332d1 CLI测试exit1：新测试越过产品capsule直接导入未声明领域包；改为产品公开workspace blueprint/result type，不引入隐式transitive import。81774 `round-31-app-cli-public` exit0：3tests/37assertions，真实Resource validate在-w和cwd入口执行同一产品检查，拒绝结构绿的孤儿与知识错误，根目录仍仅codument/、无Serve写入。
- 后续把非空SKILL.md加入正式App必需读取和前后源一致性，不把它当结构Kind；正在复跑 `round-31-app-entry`。接架构/full root验证，installer/Skill实际分发仍未完成；新C生产源码尚未pack，不复用R30安装证明。

### E249 — App 接入过线范围与模板迁入

- 51122 `round-31-app-entry` exit0：3/37。d88336 无scope architecture按既有门禁exit1/UNVERIFIED；实际当前可执行最宽架构子集是domain-core，76253 `round-31-app-architecture-core` exit0：339/2624/68files。没有把无scope改成假PASS；后续将新App两文件纳入该scoped回归。
- 模板经apply_patch从旧src/templates复制83个新资产到product-capsule/src/workspace-assets（排除manifest及全部std/kinds）；仅四业务config转换为已验证的当前envelope。旧src未改，用户DEPA attractor原文保留为输入副本。新增正式codument/SKILL.md及静态Bun text imports索引，c43753运行读取84项/255108字符、KindDefinitions=0。无需从已安装产品反查旧源码或CLI私有模板路径；尚未完成旧规范版本/引用修订和installer，不能宣称模板已可发行。
- skill-creator已完整读取并用于新App路由：业务协议仍只在std，Skill不复制操作正文或降低检查。当前源模块静态text imports预备compiled binary闭包，真实编译/安装仍欠证据。CLI App结果只投影成员/附件计数及完整findings，不默认输出所有路径；内部inspection保留可展开的完整集合。

### E250 — 内部 installer 垂直片与失败反馈

- 新 domain install Data/port、纯流程/受管块合并、filesystem staging/guarded publication/recovery，产品 capsule 独立 workspace-install export 组合静态资产；未注册三个暂停命令。既有 App 整体只验证不覆盖；薄 Skill 冲突预检，AGENTS 未受管内容保留；隐藏 staging 不进入 Catalog。
- a5b4d4 `round-31-internal-install-first` exit1：4pass/1fail，rename-then-throw 恢复实际已执行但误保留恢复目录。依据观测补恢复动作后的 inode/bytes 判定，没有吞未恢复错误。0c273b/1dff42 `round-31-internal-install-recovery` exit0：5tests/38assertions，包括 fresh/repeat、legacy、symlink/Skill冲突、源漂移、publication失败、独立编辑保留。
- 587fc8/3b1e7c `round-31-internal-install-types` exit2：静态资产同名 .d.ts 被 TypeScript 遮蔽；改为独立 text-assets.d.ts，并由索引显式 reference。c09900/c44491 `round-31-internal-install-types-fixed` exit0；3d0763 skill-creator quick_validate 对正式 App SKILL exit0。后继增加目录闭包/backup原字节/权限守卫，新源码仍需重验。
- 新模板 normative envelope/spec 转换（不改历史 migration 输入说明）、Kind 内置引用、ModelingRegistry/EngineeringRegistry owner、新 DataTopology/显式legacy边界修订。依据实际 archive-knowledge.ts 更正 delta 为 owner 目标快照，防止遗漏base节点被误当删除；旧文件与校验机制未削弱。全部模板链接和示例、agent多目标/配置、编译制品闭包仍待验证，不能凭当前5测试将App节点标done。

### E251 — Agent 兼容目标、混合资源与模板闭包

- a0ad6f/606eb3 `round-31-internal-install-targets` 5/38过线。新增原默认Claude、全部六Agent目标/CLAUDE指针、保存cli-tools配置及workspace-local自定义目录；配置/显式App身份变化保留既有源并要求review，不暗中升级。a04294/051470 `round-31-workspace-mixed` exit0：9tests/81assertions；真实CLI从正式codument App执行code-first LocalFunction，同时校验非空递归知识，未知Kind即使空集合也失败且无Serve。
- 986270资产检查先把有效目录URI误当文件，按真实blueprint目录合同修正；36abcb揭示旧用户DEPA载体的三个相对链接在分发后失效。保留旧src载体，新的产品模板仅调整链接并内置所需package role文档，未弱化不变量。9d7004发现另外10处历史@codument链接，改为真实相对引用。9970c1 `round-31-assets-links-fixed` exit0：2tests/254assertions，85资产索引一致、薄路由/配置引用闭合、current std lint以及两知识owner示例使用同一完整语义validator通过。
- fecc03 skill-creator校验因旧archive-mission description含尖括号被拒绝；只修新分发description，保留协议正文。39373d再次运行bundled quick_validate，16个App/操作Skill全部exit0。此项不冒充fresh语义评审。

### E252 — 编译安装器与宽回归前提

- 2b154b/8abbe1 `round-31-workspace-core` exit0：13tests/360assertions；Bun编译338modules，隔离工作目录和最小环境实际新建/重入App，模板文本随binary闭包，无Kind副本。scope明确 finalCliIntegration / installedTarballConsumer / fullMission 为UNVERIFIED。后续移除无必要的HOME环境覆盖，增加源打开no-follow、完整stage closure/backup/mode guards和staging漂移负例，需新core证据。
- 7a1b03/a1da4f `round-31-app-install-check` exit2：新资产test的Map键推导过窄，改为显式Map<string,string>而非放宽生产类型。712bb3/d5f59c `round-31-app-install-check-fixed` exit0：typecheck/lint、589tests/6036assertions/119files，73.83s。运行期间又完成显式App ID/已有App缺Agent配置守卫，故此结果只记录前提快照，不算最终宽回归；生产源码现在冻结，接新root/core/architecture。

### E253 — 当前 App 源验证与磁盘故障

- 7b9719/fc6e59 `round-31-app-frozen-check` exit0：typecheck/lint、589tests/6037assertions/119files，79.03s。随后0d6d89/ab06d1 `round-31-app-frozen-core` exit0：14tests/365assertions与真实编译installer新建/重入通过。6360df对immutable C基线逐文件比对旧src/真实codument，664路径bytes/mode零变化，包括原用户attractor。
- a6a57d/db6f49 `round-31-app-frozen-architecture` exit1：244pass/109fail，首个故障为Vue输出mkdir ENOSPC，之后大量fixture目录创建失败。不能把这些fail算PASS；磁盘由约492MiB降至188MiB。当前App/installer所有14测试在此run中亦通过，但完整架构欠证据。
- 安全恢复观测：本次新App/compiled/install fixtures已清理，无对应temp目录；日志确证的Vue故障残留cWsHp8/Mg0r87仅4KiB/0B，清它们不能解决空间，不删未知/历史用户目录。实质不同恢复路径：复用已有scripts/test.ts，将原架构所有target逐个隔离TMPDIR运行并在每组退出后清理己方scratch；不减少任何测试或放宽判定。接 round-31-app-architecture-isolated；跨仓三消费者/最低Bun仍未重验。

### E254 — 架构恢复路径与发行验证接续

- 7a9811/787582 `round-31-app-architecture-isolated` exit0：原target集合完整执行，静态包依赖/effect边界及所有行为测试通过；没有把磁盘故障降为skip。运行期间重新观测可用空间2.2GiB（未删除用户或其它任务目录），故不存在继续阻塞条件，恢复此前因空间推迟的真实制品消费。
- 产品README更新为实际内部API边界；未改冻结的执行源码。V/verify-codument-release.ts新增安装后的product-capsule三测试、真实CLI App/mixed测试与公开installer新建/重入；消费运行前关闭本地包源，测试文件只是验证输入，生产源来自tarball。计划固定公共185f8d37与新C候选，按C→Notes→H→最低Bun串行验证；原R30产物与recovery保留。

### E255 — 当前公共 set 三产品实际消费

- 41cba6/daa318 `round-31-workspace-product --full-cli --release-set ...host-release-round-31-recursive` exit0：C十一产品制品digest ad5883f9c09bd6d80eab64828e56a00e8b873c3ec0057848e5249accee7e4e72；218tests/1903assertions/44files及installed tsc，32旧领域CLI、mixed App/LocalFunction、公开installer新建88writes与重入0writes、原生制品/旧lock/Page/Vue/MCP/close通过。
- 48d303 `round-31-workspace-notes` exit0；bb0d97 `round-31-workspace-halfcode` exit0。同公共digest185f8d37152f2b41b1db6dcd3c2f357dcae47babca67e43aedf73d0116928bfb，正常registry解析，无transitive overrides/两仓source imports，运行前关闭包源；Notes非空递归、自定义Kind与可选执行闭包，H真实产品模板/CLI与历史code-first能力通过。
- 本机Bun1.3.14；最低Bun和新set clone仍待随后命令。未运行globalInit、realBrowser、realMessages或npm publish，不覆盖最终三命令USER gate。E254全target架构汇总353pass/0fail/2989assertions（21dd60）。

### E256 — App 节点闭合，转入历史迁移

- 735c1e/4aa843 `round-31-workspace-minimum --curl --same-release-set ... --clone-producers` exit0：固定校验过SRI/binarySHA的Bun1.3.0，同公共185f8d37与C ad5883f9依次Notes/H/C、H-clone/C-clone全部exit0；日志在verification/logs/round-31-workspace-minimum-*.log。隔离下载与scratch清理，不改全局Bun，不发布。
- 新App节点的源/编译/真实普通安装/最低runtime/跨产品范围已过线，done；最终CLI init与全局skill目标兼容仍保留USER gate。按控制循环立即Round32历史迁移active，没有以节点完成作为回合返回条件。
- 只读旧迁移代码发现：部分XML转换器通过filter/Object.fromEntries丢弃未知或重复字段；旧upgrade-track sequential/wave转换会删除不能解析的依赖。新实现必须保真或review，不以复制这些风险换兼容名义；旧实现作为来源不修改。

### E257 — 确定性计划与备份事务首片

- 6f7b52新测试误用了JS注释和文本起始语法，1pass/4fail；改为真实XNL语法后a21639显示当前parser不接纳BOM。未隐式改编码或放宽parser，BOM输入明确保留review；e68c48 `round-32-migration-plan-admission` exit0：5/61，版本桥仅改显式metadata、完整AST相等、注释/嵌套Decision/知识森林原body保留、未知/歧义/ownerless拒绝。
- e616a7 `round-32-migration-transaction-first` exit0：12tests/97assertions，filesystem独立bootstrap、转换前backup/append-only ledger、完整codument隔离验证视图、source/context/stage漂移、合作锁、失败恢复/独立编辑保留、空forest安全退役、重复零业务写入通过。此时验证函数由测试注入，不等于真实产品完整迁移；六CLI、XML、全workspace事务与语义兜底仍UNVERIFIED。
- 复核发现rename与独立编辑同时发生时，原finally只能识别完整新字节，可能未明确标注不确定提交。已补uncertainPublication边界并将该负例要求升级为recovery错误；接重验和类型检查，不把前述PASS当修改后证据。

### E258 — XML 迁移族、公开验证闭包与五条 CLI

- 562e43事务漂移复验12/97通过；004727 typecheck暴露format字面量拓宽，修正显式联合后fedf40通过。8373a8 `round-32-xml-relocation` exit0：16/171，XML Track/Mission/四config/Behavior/BehaviorPatch显式目标、引号/实体/CDATA保真、重复/混合内容/未知扩展拒绝；XML→XNL先验证后安全发表/退役，目标冲突review、rename-then-throw回滚过线。受限XML reader无DTD/entity expansion，不引用旧src/parser runtime。
- 73a7fa产品组合首次少一闭合括号，16pass/1error，不算PASS；修正后804eaf `round-32-migration-product-composition` exit0：3/18，真实内置Kind经公共Host/原compiler准入，加既有完整领域validator；缺required docs、Track语义、错误config类型和跨文件Decision重复明确review。
- cb50da `round-32-migration-verify` exit0：3/20，verify使用受控瞬时视图，结束无新增持久backup记录；随后增加assertCurrent，防止验证期间源漂移。818b64类型检查仅fixture元组literal拓宽错误，修为as const；d4f23f `round-32-migration-cli-types` exit0。
- 7df11a/d820e0 `round-32-migration-native-cli` exit0：4/45，五原叶子migrate inspect/plan/apply/verify与upgrade-resource通过实际新CLI，旧配置无需manifest/std启动，raw JSON/相对或workspace内绝对路径/exit2 review/backup/重复/noServe通过；三个暂停入口未改变。整workspace升级、upgrade-track、bootstrap Skill兜底、最终pack仍未完成。
- 按simplify仅整理新命令分派和产品组合/rollback缩进；接新窄回归与当前root check，不借整理降低恢复或语义验证要求。

### E259 — 最宽回归的已识别 surface 漂移

- 722fa5/4b191d `round-32-migration-root` exit1：typecheck/lint通过，607pass/2fail/6276assertions/124files。两个失败均为新注册五迁移叶子后未更新的精确命令树预期（command-registry.test与domain-commands.test），无业务执行失败；更新预期只增加已由E258真实CLI证明的五叶子，不改原命令列表、暂停门或比较强度。接修正后完整root复验。

### E260 — 当前根回归与真实旧材料差距纠偏

- d96b90 `round-32-migration-root-surface run check` exit0：609tests/6298assertions/124files，typecheck/lint通过。该快照尚不含后续owner/path修复，不把历史PASS当最终完整迁移验收。
- 4d3386只读真实codument：740可见文件（含基线未收集的ignored历史），226候选中14个已在显式process-local decisions目录却误报ownerless；旧src/cli/migrations/index.ts:599实际仅审直接decisions.xnl。修复采用该边界，兼容bool/string及旧hyphen字段，保留真正未归属durable review。旧Modeling平铺registry迁至context/index.xnl，delta路径不变，未知knowledge version仍review。
- f3904a `round-32-owner-path-migration` exit0：18/144/3files；b3d8fe只读复观测226planned/0review，60/61旧std与当前旧模板相等；未知depa-attractor正文保留。这只证明确定转换计划，不证明226资源全量语义通过。无真实workspace或旧src写入。
- DEPA调和：互相引用的Track/Patch必须在同一隔离候选中转换并全量验证；逐个正式提交不能解开旧格式校验依赖。接多源App事务与公开内部workspace migration组合，不注册或绕过三个暂停入口。

### E261 — App 多源事务、历史布局与独立启动协议

- 9a9e88首次事务测试5pass/1fail：负例第二次写入已存在的相同内容，未形成漂移；改成唯一新路径，另补迁移目标mode继承后196f1b exit0，14/83。整个App字节/目录/模式快照、opaque附件、原件备份、全候选验证、stale/context/stage/lock拒绝、两rename后故障恢复原inode与独立编辑保留通过。目录切换明确为可恢复事务，不声称OS原子交换。
- 470c4f完整App首次3pass/1fail只是测试把合法empty-registry warnings误作空结果；保留warnings并按severity判定，76645a exit0，10/75。产品实际compiler/membership/全domain validator接入，互相legacy Track/Patch同候选过线，自定义profiles/hooks/attractors/agent-config/manifest保存，未知managed/Markdown/Kind定义review且精确backup。
- 本地v0.5.2/v0.5.4及受保护0.5.4模板的管理文件fingerprints内嵌产品；不把用户attractors列入覆盖授权。已知旧Kind文件退出App前先备份；旧平铺track/archive连二进制附件迁到active/archived，碰撞review。783650/5e478b暴露fixture把completed Track仍留ACTIVE组，真实validator正确拒绝；修fixture状态而非弱化校验，bf30fc exit0，8/102（含六旧CLI入口真实运行）。
- `upgrade-track`保留id/archive-id、mode和workspace-local backup-dir入口；早期plan.xml语义无法证明则backup+exit2 review，明确不丢依赖。`--no-backup`按使命强制备份约束明确拒绝，App内/外部backup路径拒绝；不将此兼容变化隐藏为完全逐字兼容。a4a235 root typecheck通过。
- 87c513 `round-32-guidance-surface-assets` exit0：26/573/5files，增加只读migrate guide，空workspace也可取包内协议，原命令树/多Agent installer/完整86资产索引和路由过线；af61a5 skill-creator quick_validate通过。工作区operation与Skill均路由到同一bootstrap，三暂停入口不可旁路。
- 当前Agent读取五个完整历史Decision材料并作语义裁决，见verification/migration-semantic-review.md。aa420b真实产品接口演练exit0，1/34：唯一archive根完整恢复到业务owner，AST全字段等价、version由CLI生成、原备份/已验证旧Markdown退役/目标验证/noop；缺源、多候选、目标冲突、Markdown多选择单URI四组明确review，所有原文不变。不是通用自动Markdown转换器，也不声称整个历史workspace已升级。

### E262 — 真实历史副本、core 门与最宽源码回归

- 24e079 `verify-workspace-history.ts round-32-workspace-history` exit0：本地v0.5.2（491文件）、v0.5.4（506文件）、真实dogfood隔离副本（743文件含隐藏项）均完成计划/全量验证/精确backup；均有review，原件字节和mode不变，真实dogfood只读保护通过。v0.5.3本地tag不可得，不以相邻tag冒称实测。完整diagnostics在verification/logs/round-32-workspace-history.json。
- 旧材料未被强制“修绿”：已观察缺design、完成状态与未勾选criterion不符、旧JSON ports、新App全局资源ID下Track/Behavior同名冲突等。前四条compiler错误使catalog整体拒绝，后续membership为连带diagnostics，并非数百个独立来源丢失。源ID不擅改、不会补造历史验收或正文；这些是需语义裁决的真实历史输入，不将preservation PASS称作全量迁移成功。
- 5bba3c `round-32-migration-core` exit0：38tests/652assertions/9files，并实际compile无Bun PATH运行migration consumer，包内bootstrap文字可用，旧XML→正式codument SkillApp、backup和重复noop通过。六旧非冲突迁移叶子均registry-local；新guide只读。最终workspace命令/agent refresh USER gate，pack尚未证明。
- d669fb `round-32-migration-complete-root run check` exit0：625tests/6524assertions/127files，typecheck/lint通过。随后simplify只抽出重复plan状态判定与展开managed分支；源变化触发38项core复验和新十一C包制品验证，不复用旧R31包证明新源码。

### E263 — 迁移当前源码与不可变安装产物复核

- 808c2f simplify后migration core exit0，38/652及compiled consumer；ec7fd9架构全部原target隔离执行exit0。
- 8f1439和3edb7b安装验证exit1，分别发现consumer仍限定旧命令树与旧runtime keys。更新精确期望，不移除既有断言；没有重打包或改生产候选。07f039 `round-32-migration-product-runtime-surface` exit0，254tests/2301assertions/52files、installed tsc、native/mixed/Page/Vue/MCP/32领域及新migration CLI、installer89writes→0通过。
- 同公共185f8d37152f2b41b1db6dcd3c2f357dcae47babca67e43aedf73d0116928bfb；新C十一制品digest4bc586d8bf4572753cd944b5a4a0640fd0d2dfa8ae8aafdd58428c63f674f372，正常registry解析，无source alias/override，运行前包源关闭。最低Bun与最后完整root接续，不以旧R31 C证明迁移。

### E264 — 历史迁移 core 收敛，立即上下文循环

- d92841 `round-32-migration-final-root` exit0：625/6524/127及typecheck/lint。dae6a7 `round-32-migration-minimum` exit0：校验SRI/Bun1.3.0 binarySHA，同公共185f8d37及C4bc586d8的Notes/H/C隔离普通安装均成功。迁移core节点done；final upgrade-workspace/Agent受管刷新及真实历史语义裁决不冒称已完成。
- Round33观察：impl-track同一规则以散文和flow重复维护；§1.2和§3 flow的ACTIVE提问未显式带auto/mission条件。以既有§3文字为准澄清条件，不新增停点。现有verification effect排除整份Track，目标/Acceptance/Hook改动亦不影响receipt，是准确性失效缺口；补绑定的纯合同投影而不是新缓存体系。原状态更新/gap_round仍允许同命令复用，fresh语义判定仍独立执行。

### E265 — 上下文闭包与回执失效纠偏

- c890c4 `round-33-receipt-obligation-red` exit1：6pass/1fail，真实Goal变更后错误reused=true。9311e7首修exit0，16/339；8e2f9b加入evidence/环境/成员变化及真实CLI后exit0，24/500。纯投影在logic，support只读文件/注入projector，product组合；不增加logic→IO依赖。v2指纹令旧键保守失效，JSON字段/退出码不改。
- Track合同保留目标/Acceptance/Gate/Schedule/Hooks/未知扩展与人类注释；仅受控节点的status/updated_at/commit/gap_round/revision/checked进度不影响命令复用。直接support消费者未注入projector时按raw bytes保守失效。analysis/report证据不再整体排除，只有verification receipt储存目录不自激失效；环境/runtime版本和成员增删参与指纹。仍不把命令成功当语义或fresh审查结果。
- 独立context_protocol_review三轮只读比较及四场景推演：先发现design必需与DONE后after-hook恢复两个继承问题；修复后第二轮检出phase未调度完即after的反例；再修复，最终PASS。完整范围/hash见verification/context-protocol-review.md；没有把推演伪称真实业务运行。
- 35a023类型检查exit2为测量Map键literal推导过窄，显式Map<string,string>修正。6b03f6 `round-33-context-frozen-gate` exit0，46tests/763assertions；五份TDD/DAG/GapLoop/AttractorCheck/控制论协议与冻结旧hash完全一致。六场景逐次读取计数、缺文件/成本膨胀负例、不截必要迁移bootstrap已入门禁。
- db2414最终协议字节代理：quick11258→11580（增加2.86%），track/resume各43763→27112（下降38.05%），mission30067→30389（增加1.07%），strict44818→28167（下降37.15%），migration16755→35941（增加114.51%）。前三reduction中位数38.05%。口径严格为冻结declared-entry-reading proxy，双方运行期选择业务来源均未计；不是实际token/费用节省。migration新增包内独立bootstrap+Decision+xnl协议均计入，不隐去增加。

### E266 — 上下文节点收敛并进入核心验收

- bba6ba `round-33-context-frozen-root` exit0：629tests/6575assertions/127files、typecheck/lint。a26ab3 `round-33-context-product` exit0：C新digest21f3dc8364f2605107e2573540296780ce7cb44090677ca2524525ea5d11ff78，installed257/2337/52、tsc、实际CLI/旧JSON/installer90→0/Page/Vue/MCP通过。
- `round-33-context-minimum` 同公共185f8d37+C21f3dc83，Bun1.3.0 Notes/H/C全部exit0，日志已落盘；下载SRI与binarySHA均核对，未改全局安装。e3113b逐个验证11个冻结旧阅读来源SHA256，无变化。context节点done，不以节点完成结束，立即Round34核心验收。
- 下一差距是验证入口装配：serve-placement现有无scope仍报UNVERIFIED，既有policy/runtime行为已散落实现。将实际隔离consumer与产品矩阵汇入非占位full gate，再做当前core整体审计；不据历史通过文本直接改PASS。

### E267 — Round34 当前快照核心整体验收

- ca895c `round-34-final-root run check` exit0：629tests/6587assertions/127files，typecheck/lint通过。R34修改验证脚本/fixture与测试，不修改生产包源码；当前C制品仍为E266的21f3dc83…，公共set仍185f8d37…，不拿旧C制品证明新生产源。
- 26fafa `round-34-full-placement run verify:mission -- serve-placement` exit0：162tests/1237assertions/32targets。新增完整门聚合现有policy与产品执行矩阵，并从固定公共set普通安装14包，关闭包源后运行公共consumer；未设置set时仍明确UNVERIFIED。四真实provider factory以IO test doubles运行，另实际loopback HTTP验证LF/PageWorkflow、跨instance/root/agent/profile/digest重准入拒绝、懒加载一次获取、多实例隔离与owned-close；受控Codex peer子进程已回收。未调用真实浏览器或外部消息。
- 3f176d `round-34-full-consumer run verify:mission -- consumer` exit0：同公共set下模板、备份、自定义Kind、实际detached service、SQLite/SkillApp/PageWorkflow、Page/Site/HTTP、旧code-first lock、可选browser、Vue worker和MCP协商通过。运行期不读取两仓私有源码；full-host范围不冒充full mission。
- 482f77 `round-34-core-architecture run verify:mission -- architecture --scope domain-core` exit0：380tests/3268assertions，全部原target隔离执行与AST依赖/Effect边界扫描通过，无Codument通用实现副本或跨仓source alias。
- a81934 `round-34-core-app-migration-domain` 顺序执行四门全部exit0：workspace-app --scope core为14/371并实际compiled installer；migration --scope core为38/655并实际compiled migration consumer；capabilities --scope domain为252/2198、32领域叶子；context-economy为46/763、冻结来源/六场景/负例。六迁移叶子另由migration core证明，三个USER入口仍未接入。
- 原始输出保存verification/logs/round-34-{final-root,full-placement,full-consumer,core-architecture,core-app-migration-domain}.log。上述套件有重叠，不把数量相加当独立测试总数。

### E268 — 原件保护、最终门保持未完成与明确 USER 停点

- 48d649重新逐项比对不可变输入：664个原src/codument路径的bytes/mode不变；基线HEAD bba44a1ac23cb8d5b2312f3cd0c9f78ddd471a8e。e3113b的11个旧阅读来源SHA亦不变。真实dogfood只读，未升级或退役旧src。
- e02158 skill-creator quick_validate对分发codument-impl-track返回Skill valid；C与H的git diff --check均exit0。独立协议检查及声明范围见verification/context-protocol-review.md；不得将有限推演扩为全部Agent准确性保证。
- 4da029 `round-34-all-user-gate run verify:mission -- all` exit1，明确UNVERIFIED：最终完整门尚未实现。保留此信号，不把核心验收改写为整个mission完成。历史副本review、最终三命令、发行切换、真实dogfood和最终独立验收均未冒称完成。
- 已只读比较三个暂停命令的旧实现、克隆入口及现有产品底层，形成design/three-command-integration.md。建议产品优先init且无隐式全局安装、产品进度status、保留review exit2的可恢复多目标upgrade；force/path/JSON及组合别名行为明确等待用户决定。
- MissionLite循环的安全替代路径（独立内部installer/migrator、打包消费者和全部非冲突core验证）已完成。MISSION约束12、D13及工作图User gate明确要求核心完成后再讨论三命令，禁止其它入口绕过；余下节点均依赖此决定，没有未受暂停影响的ready动作。故Status设blocked、目录留active，精确需要用户确认上述方案；不归档、不变更期望态，也不以普通节点结束为返回理由。

### E269 — 新版 bin 隔离：用户目标更正与测试纠偏

- 2026-09-07用户明确要求新版构建/安装仅depa-codument，去掉codument以免影响旧session。约束9、最终发行Acceptance和后续方案据此更正，新增独立节点；不是对三命令合并的授权。
- 实际观察：project原BIN=codument，默认build和源包/三native manifest/lock均旧名；WORKSPACE_DIR与SKILL_DEMO也从BIN派生。按DEPA身份边界拆开，只改可执行身份，保持.codument私有目录、codument-demo资源身份和正式codument/。构建默认路径继续由BIN单点派生；安装查找/release-targets自然消费新值，不加兼容alias。
- a94e89 scripts窄回归21pass/1fail，发现独立integration verifier仍硬编码旧bin；修正目标名。ff9ed8首轮root623pass/7fail，均为release路径、BIN/source bin、MCP server identity/config的旧名称预期；逐条更新预期，不改子命令或降低断言。未改变三个暂停命令绑定。
- 新binary-identity测试锁定唯一bin、三平台files、安装候选、lock无旧映射；同时断言workspace/demo身份不漂移，安装计划不卸载旧根depa-codument包。simpify自检不新增抽象，旧root/package/src和真实codument未改。

### E270 — 新版唯一 bin 构建/隔离安装/最宽复验通过

- 3a78f4 `cd project && bun run build` exit0，实际dist/depa-codument包含97BunFS资源，无dist/codument。c07520 `bun run build:release` exit0，macOS arm64/x64及Windows x64三产物分别仅bin/depa-codument或bin/depa-codument.exe；跨平台构建不冒称Windows/x64 native运行。
- cfcbc6 `verification/verify-bin-isolation.ts` exit0：实际compiled binary通过隔离npm prefix安装，help/version使用depa-codument，原codument sentinel字节不变且可执行；真实/Users/kongweixian/.local/bin/codument的SHA256与mode前后一致。三实际native包npm pack --dry-run清单均仅包含新bin。报告verification/logs/round-35-bin-isolation.json含binarySHA、scratch与原件hash。
- 安装测试范围明确是bin层：使用真实native bin映射和实际编译文件，测试包省去依赖以离线验证安装映射；完整发行依赖闭包本轮NOT_RERUN。不把该测试当作新全量发布set、全局安装或最终mission完成。当前版本号仍克隆0.1.0，最终版本切换待原后继节点。
- d29d7d `round-35-bin-final run check` exit0：630tests/6617assertions/128files，typecheck/lint通过，完整日志verification/logs/round-35-bin-final.log。git diff --check通过。新bin的生产变化使E266旧C制品仅保留历史用途，后继完整发行需重新pack与验证。
- 未运行install:local/init-global、未npm publish、未改本机旧安装或真实workspace。独立bin隔离节点done；其它剩余节点仍依赖用户三命令决策，按MissionLite返回条件回blocked、目录留active，不归档。

### E271 — global 单入口新方向的只读观测与身份决策

- 当前重新完整读取新版MissionLite、scaffold/cybernetic-loop/attractor-guidance/scaffold，depa-expert及Data/authority判据，skill-creator，Halfcode runtime Skill及freeform SOP合同；authoring Skill只有待补充，实际代码作补充证据。不把旧版本Skill规则当本轮预检标准。
- a56379枚举src/templates/skills：15个产品模板name/description；4b4290/a56379/c7175a核对workspace-install、workspace-app source、runtime sources与global-install：当前仍分发std与多Skill、强制workspace SKILL.md；global安装并未证明global业务SOP在任意cwd可发现。上游catalog明确拒绝workspace外root，不能简单追加绝对路径绕过安全边界。
- 安全替代观察比较了两条路径：保留workspace技术App但只暴露global Agent入口；或仅global保留SkillApp、workspace改业务资源树。两者都保持codument/数据，但改变不同的authority/发现/迁移契约。此前用户“每workspace都是App”是显式要求；需明确本次是否覆盖该身份，而非猜测。
- `python3 /Users/kongweixian/.agents/skills/cdmt-mission-lite/scripts/check_mission.py <本mission> --phase preflight` exit1：旧表格Acceptance不符合新checkbox格式、节点blocked枚举与当前blocked生命周期。业务文件尚未修改；harness可修，不能用预检错误本身充当阻塞理由。
- design/global-skill-app.md已记录确定方向、15名称库存、三组投影、技术证据与后续顺序。当前Status保持blocked，所缺输入精确变为workspace SkillApp身份选择，不再询问原三命令方案；未运行安装、未改变旧session、旧src或真实workspace。

### E272 — 两类 App 身份明确与 CommandOperation 设计修正

- 用户明确workspace codument/继续是项目资产SkillApp；global depa-codument拥有CLI操作指导，并要求Halfcode公共包新增CommandOperation Kind，在顶层help直接出现plan-track/impl-track等。E271的身份缺输入现已解除；不删除workspace SKILL/manifest，不将global理解成唯一所有资源App。
- ac92fb只读核对实际CLI入口：rootHelp/COMMANDS为静态共享注册树，必须在树构造/准入处投影，而非打印一份额外命令清单；f17e39定位host-adapter/validate.ts与migration.ts，validate/migrate已经是原生命令，操作指引不得静默接管其旧执行语义。
- global-skill-app.md已按新方向修订；新增design/command-operation.md明确Kind/顶层命令/正文authority、包职责、显式暴露、同名冲突及非Codument消费者负例。description仍必须列旧15Skill名和功能，用户要求优先于默认简短列表建议。
- 本条仅证明设计与用户澄清已记录，无CommandOperation源码实现或运行PASS。Mission状态恢复active，后续先更新新版harness并通过preflight，再实现公共Kind、global指导App/std迁出与三命令。

### E273 — CommandOperation 公共首切片与真实资源准入

- f081e8及恢复执行adf96f：新版MissionLite preflight exit0；源头/转换/暴露投影及checkbox已具备。用户允许撞名自主改名，当前validate-operation/migrate-operation，原生validate/migrate不变。
- Halfcode canonical公共contract内置CommandOperation schema/source/reader描述；logic纯投影将显式准入资源转换为本地命令，不隐式扫描授予暴露、不运行AI。返回status=guidance不冒充业务完成；闭包保存冻结值快照，拒绝重名/FQN重复/非法命名。
- 4f5420逻辑3pass/15assertions；d57087真实catalog1pass/7assertions：Markdown无实例KindDefinition即准入，真实record投影命令成功，非法command与未来specVersion被拒绝。8fa74f早期typecheck通过，最终宽回归尚待新源码重跑。
- std/operations正文采用Markdown资源envelope本身作为唯一authority，避免descriptor与operationPath形成双正文。公共pack/Codument采用/global聚合尚未完成；当前节点保持active。

### E274 — 扩展兼容纠偏、制品采用与15顶层入口

- 5c1ab8最宽H check出现7fail：新增Kind污染旧owner cohort与历史lock；没有重写冻结锁或放松mismatch。改为旧v1 owner cohort保持原fingerprint，CommandOperation独立增量cohort；legacy compatibility显式选择legacy-v1 builtin集合，不按失败锁自动降级。8a02aa历史完整锁与实际Kind准入10pass/40assertions；fefd79宽回归555pass/5142assertions（其后新增read-port loader测试，需最终再跑宽回归）。
- 新public support读口与文件系统共享authored-loader→compiler→reader准入，无临时目录或跨cwd扫描。02a455真实read-port与catalog一致1pass/9assertions。
- f8846e构建不可变host-release-round-38-command-operation，digest15ff6913c526f4f61f6b4ddaa60eca1656c3e72e57a8f4e7f756794d45ad4824，14共享+6H产品+160vendor；未发布npm。4b95e2 C通过正常registry精确版本/SRI重新安装，保留此前lock。20aa5a实际CLI -h展示15顶层入口，validate/migrate仍原生命令。
- 803d44 C 3pass/201assertions：15旧Skill名+简介在global frontmatter；实际global资源App无复制Kind，15操作准入；同一实际help/dispatch树返回guidance、参数与FQN且全部local/basic。
- skill-creator独立前向验证实际执行迁移guide，发现旧Skill导航/std目录与动态bootstrap旧bin两处缺口；已据此修正projectGlobalGuidance及migration-guidance，新增裸项目路径与global路径说明。fresh检查/GapLoop/AttractorCheck协议仍完整，不以guidance成功代业务完成；最终复检尚待。
- 新workspace安装停止分发std/薄Skill，保留codument/manifest与项目SKILL；未知修改std在迁移中保留并review，不偷偷删。宽C check执行中日志将写round-38-global-initial.log；本条不把该未完成命令或三命令绑定算PASS。

### E275 — 全局聚合批次收敛与后继接入

- ff5343 H最宽check exit0，555tests/5147assertions；2edd7a C最宽check exit0，635tests/6963assertions/131files，日志round-38-public-final-check.log与round-38-global-final.log。全局缺标准恢复句在C检查期间细化，后继最终回归仍须覆盖最新快照，不扩称最终mission验收。
- 684b1d隔离native实际构建→新global App安装→15真实操作调用、本机旧Skill哨兵保留，以及新workspace标准迁移，共8pass/168assertions。已知旧std逐文件完整backup后退出App发现，配置指向global URI，再跑noop；未知/修改std保留review。74bcec installer/global/迁移23pass/307assertions。
- skill-creator独立前向复检以纯内存安装验证62files、67条相对Markdown链接无缺失，7条配置global引用都有目标；旧Skill路由和动态迁移guide旧bin已修。剩余仅全局标准缺失时的恢复提示歧义已修为init-global/项目init/旧项目migrate-operation三分；没有删减fresh/GapLoop/AttractorCheck。
- 15映射中唯一冲突为validate/migrate，处理为validate-operation/migrate-operation；旧原生命令未覆盖，其余去codument-前缀。公共Kind/聚合节点收口，按用户此前明确顺序进入三命令产品接入；不结束自主循环，不运行真实安装或改旧src/dogfood。

### E276 — 三命令接入与恢复负例（Round39）

- init保留global→workspace组合，init-workspace只创建项目codument/ SkillApp，不分发std/薄Skill；status使用领域读投影而非Host初始化摘要；upgrade-workspace以App迁移和辅助指导两个独立守卫阶段组合。明确拒绝init --force覆盖未知authority，存量agent配置不静默重选。
- 501f10 typecheck通过，c81767实际CLI+installer+workspace迁移18pass/214assertions。退役逐文件精确匹配，备份保留；修改旧Skill要求review；rename后异常恢复原件；重复执行无写入。b6725b实际CLI正负例通过，新增status单测有夹具闭合符错误（已修，待最终check），不记该组整体PASS。
- bc9863宽check通过638tests/6998assertions/132files（round-39-three-commands-initial.log）；检查期间仍补充status/CLI负例与harness，因此此条不是最终快照验收。后续宽check执行中。
- skill-creator独立forward复检：62全局文件、67静态相对链接无缺失；15名称描述及实际操作完整；隔离19tests/276assertions，未修改真实global。发现std/AGENTS仍有旧三命令集成门暗示，已修；bootstrap明确两阶段和review，实际CLI返回一致。
- MissionLite最新preflight f1495d与edcbbf通过。能力库存由32已接+9暂缓更新为35已接+6迁移另门；不把source测过冒充最终发行或所有历史语义已解决。旧src、真实dogfood、旧全局安装不变。

### E277 — 本批最终快照与独立制品消费

- 04f7c0最终C check通过639tests/7018assertions/132files及typecheck/lint，round-39-final-snapshot.log。ba7baa最终native/global测试3pass/198assertions；c1b4d6实际构建dist/depa-codument，1808a3实际help列15操作且旧本机codument SHA256保持05206bf…c3f8。没有真实全局安装。
- 7b16ec workspace门17pass/413assertions并编译installer实测；d9d338 migration门40pass/742assertions及compiled backup/bootstrap/noop；ca29c0 capabilities门254pass/2230assertions/53files。这些是scoped gate，不冒充无scope全量mission gate。
- 初次打包验证157519失败于旧夹具把新reader总数仍当历史+11；冻结旧lock逐项精确相等检查保持不变，仅补新CommandOperation reader的独立计数/存在断言。7edbd2复用同一C制品成功：普通registry解析、263tests/2556assertions、typecheck、installer19→0，历史锁/旧code-first精确兼容、实际15操作/三命令、LF/Page/Vue/MCP/Serve关闭和领域CLI全部过线。C制品digest4a0777c53daf778f527f1c9fe02a97df5bf48910fb3bff97d08e902679451871；日志round-39-command-operation-replay.log。
- b92971 Notes独立消费者同H制品正常安装成功，实际compiler准入CommandOperation并经公共host shell执行help/dispatch，碰撞拒绝，不复制Kind或import Codument；同时原core/customKind/browser/Vue/MCP演练通过。日志round-39-notes-command-operation.log:146记录新Kind成功。86f897最新MissionLite preflight通过。
- DEPA吸引子负例：公共机制无产品导入、显式选择而非workspace自动覆盖、同一help/dispatch树、旧锁拒绝伪造；workspace吸引子负例：未知std/Skill保留review、备份/恢复与幂等；准确性吸引子：fresh/Hook/GapLoop/AttractorCheck仍分列，guidance不是业务PASS。skill-creator独立检查发现的最后旧集成门文案已修；simplify将安装投影与固定workspace说明分离，未删功能。
- 用户要求“本批完成后总结重名方案”：完整映射见command-operation-conformance.md，仅两冲突另名。本批功能交付不标长期mission completed；三命令完整旧receipt兼容、最终版本/无scope发行gates及真实历史语义仍列Next，不把未决项伪报完成。

### E278 — Round40副本边界与首次完整观测

- 最新用户要求已写约束16；preflight 5e552d、0746bd通过。仅副本升级，原codument目录指纹b631c71946ecff6cba752ee096bcec1b24b195d24b9d16fddf2deb1eab3bd11f；旧global二进制SHA256仍05206bf05959d0b10420a6cc5b5e6d2d67a5ba5cadee5f46ec1c178d69ddc3f8。
- 准备器初次遗漏完整目录、package node_modules先失败，修复后CHdswa副本含12204文件；报告verification/logs/round-40-isolated-project-dependencies.json。ax6ewc后续失败发现隐藏文件guard拒绝DS_Store退休，修复只允许std下最终DS_Store删除，未知指导仍review。
- 1da30f在CHdswa副本通过migration测试13/154；51e4f0副本CLI测试1/27，review-required资源实际升级数/删除数归零，计划数单列。3份std新增指纹来自已提交HEAD模板逐字节验证，不推断自定义文本可删除；Finder原始二进制备份测试通过。
- e7bdd0实际copy upgrade exit2，完整报告/private/tmp/depa-codument-verification-CHdswa/upgrade-review.json，593诊断含级联，缺design/重复ID/历史Gate字段/领域JSON与引用等仍需调和，不自动补勾或宣称成功。
- 3cfcc6副本全量check exit1：639pass/4fail，typecheck/lint通过；日志同临时目录check.log。4fail为3个clone缺独立Git边界和binary identity缺被忽略bun.lock，尚不能用此轮作完整PASS。
- 3fe577新global实际源字节代理：quick -51.0%、track/resume +25.3%、mission -19.3%、strict +23.5%、migration -148.2%。正数为减少，负数为增长；不是实际token或费用测量。三常用场景中位25.3%，不得沿用旧入口38%作当前结论。新增测量代码待补负例及最终重测。

### E279 — 独立Git/锁修复后完整副本回归

- 20205c与9eb4a0准备副本成功，分别nKY0sr与a8g10W。后者源清单digest c03c3523863aa2f4f61e69fc486ee31574817c956ed78f71fe1eca2463b18745，12205文件；原codument及旧global保护指纹均未变。原.git未复制，独立空仓仅用于clone发现，原锁字节显式复制。
- f8a226观察a8g10W/check.log完整结束：640pass/0fail/7038assertions/132files，含新增global测量缺失源/通胀负例及三种clone工作流；typecheck/lint通过。此后仅新增Finder路径拒绝测试与准备器HOME，待最终重测。

### E280 — 最终副本回归、成本门与历史政策停点

- fa75c1最终副本KiiTC7，源清单digest ec5836e370f8870da7582b5f7f364f6ed81bbf4378734bc4bc1640a13a5eae9f。e4b098与83e508：check exit0，641pass/0fail/7046assertions/132files、typecheck/lint通过，含Finder四项越界负例；日志/private/tmp/depa-codument-verification-KiiTC7/check.log。
- 683ff1 context-economy exit0，46pass/763assertions；实际global来源字节代理中位25.30448%。quick/mission/migration增长仍报告，不声称真实token节省；fresh语义独立验收仍属最终门。日志同目录context-economy.log。
- 83e508验证后原codument指纹仍b631c71946ecff6cba752ee096bcec1b24b195d24b9d16fddf2deb1eab3bd11f，旧global字节SHA256仍05206bf05959d0b10420a6cc5b5e6d2d67a5ba5cadee5f46ec1c178d69ddc3f8。未升级原件或全局安装。
- d52b6e/b8e5c7检查原始历史记录：DONE Gate缺checked、durable decision缺Reversibility；前者现行strict validator拒绝，后者原答复并无可逆性事实。已先用已提交模板精确hash解决机械误拦，再用完整App及原件阅读验证语义问题，不能靠同一失败动作重试解决。
- 按MissionLite §6/§7，在需要扩展历史兼容语义的政策选择处blocked，而非标mission完成。建议保留“历史声明完成但未重新验收”的独立表示，不补造历史证据、不豁免当前资源；尚未实施该建议。详细问题及残余见verification/round-40-isolated-history.md。
- fc96f3停点结构复核仅报preflight要求Status active：检查器默认preflight，不提供blocked审计阶段；保留合法的active目录/blocked状态，不为通过执行闸门伪改回active。恢复实施时须在输入明确后重跑preflight。最近实际写入前预检6f1fcd已通过。

### E281 — 用户确认历史声明兼容，Round41恢复

- 用户明确同意保留旧归档完成状态和原文，标记未按新版重新验收；不作为新版PASS，新建当前任务仍严格。MISSION Notes和design/historical-completion.md固化，f5977a preflight通过后实施。
- 361d45 nusxoA副本定向20pass/176assertions：历史正文AST/status保真、幂等、来源摘要、显式false/current envelope/active路径/内容漂移负例通过。原件保护指纹未变，来源清单a26135d848c44726a8d9be962899f3daad7e1751fdf0d2c77be8344a52d6d7d8。
- 新只读投影与CLI notice明确not-reverified；校验成功不等于历史验收完成。普通写入口拒绝历史标记资源。XML分支、真实CLI与宽check随后补验，不把首轮单测当最终证明。

### E282 — 归档查询缺口纠偏与实际CLI证明

- e6310c首次实际CLI测试失败：旧默认validate只查活动Track，输出No tracks；不是历史标记已被验证。新增明确archived/<相对目录>选择到query/validation support，不改变默认list/status活动范围，也不按短ID静默选择归档。source观察、领域声明投影、CLI格式仍分别归support/logic/adapter。
- 8b1960 ycoSFI副本typecheck通过；后续归档选择器代码需最终check覆盖。643cc2最终本轮副本XrSVT0源清单ce6998ab0bbadb46b758d60041fd94aa30670dd44f8f66e15007e8b41ac3acc3，原件保护指纹不变。
- 62495e XrSVT0实际CLI+历史测试6pass/69assertions，含XML来源、旧保留字段拒绝、strict JSON notice、show显式未重验，以及既有领域严格/异常回归。日志/private/tmp/depa-codument-verification-XrSVT0/history-cli.log。宽check和成本门执行中。
- 63c08a剩余21条未勾选诊断均来自add-wave-execution同一历史Track中的显式checked=false；新策略没有将其改成true，也没有抹掉其它语义问题。531/532级联诊断数不代表独立缺陷计数，真实App升级仍exit2而不是成功。

### E283 — 历史完成兼容最终副本快照

- a16cb0/2d1c69：5n3Hrk最终check exit0，645pass/0fail/7089assertions/133files，typecheck/lint通过；日志/private/tmp/depa-codument-verification-5n3Hrk/check.log。98b0e7最后定向6pass/72assertions，含缺归档/越界/默认范围不变负例；history-cli.log。
- 新实现来源绑定的legacy-declared/v1，不改原正文和完成状态、不补勾、不作为当前完成证据；带标记的正常写命令拒绝，查询保留status并显示not-reverified。CLI validate保留原数组JSON协议，历史声明增加notice，不改变普通warning的strict提升规则。明确archived/<目录>选择只扩展只读能力，不污染默认活动list/status。
- 620ed5/66e0e2当前global成本门通过46/763；中位仍25.30448%（静态读取字节代理），新历史协议使migration场景读取增加155.06%，如实保留。XrSVT0之后只增归档不存在目标负例，不改变计量来源或检查机制；没有真实token/费用结论。
- 7ff186原codument目录指纹仍b631c71946ecff6cba752ee096bcec1b24b195d24b9d16fddf2deb1eab3bd11f；旧global SHA256仍05206bf05959d0b10420a6cc5b5e6d2d67a5ba5cadee5f46ec1c178d69ddc3f8。没有真实全局安装或原workspace升级。
- 98b0e7最终副本实际upgrade仍532诊断（226membership级联、84旧domain词汇、21显式unchecked等，含warning重复），0业务提交。E282的531记法纠正为本轮实际532；不能把数量下降当作完整迁移PASS。当前特性通过不标整个mission完成；最终制品、无scope gates、其它历史语义与独立验收仍未完成。

### E284 — Round42全局SkillApp讨论纠偏与目标修订（2026-09-11）

- 来源：本会话用户对资产完整目录、安装复制/升级替换、项目std清理、固定位置加载Effect、动态CLI发现及compact/operation-alias.md的连续明确修正。最后请求仅“完整记录到mission”，本轮不进行产品实现、删除或安装。
- 完整发现与被否定方案存于design/global-app-layout-correction.md；MISSION新增期望9、约束17…20及三组验收；loop新增两个pending纠偏节点，并重开“全局指导聚合与标准迁出”。目录/status保持active。
- 前轮读取的实现证据：global-guidance.ts从workspace-assets抽取/替换并生成文档和内存VFS；installGlobalSkills只写当前文件；workspace-install/migration及标准来源仍有std路径合同。实际global有std/operations索引、std/commands三文件、kernel-pointer及std/skill两指南。这些观察支持“当前结构有差距”，不是新设计已完成的证据。
- 用户最新指定目录为compact/operation-alias.md；与references/std/compat/README.md不同。前者旧skill到操作的按需映射，后者历史路径/协议兼容说明。SKILL引导动态CLI获取能力，不复制当前操作注册表；旧description发现要求不擅自取消。
- E275–E277仍证明当时范围下聚合及命令投影通过，但不再能证明新固定根完整App、文件直接复制、global整包替换、项目std彻底退役合同完成。旧证据不改写，新目标待重新验收。
- 安装状态按会话已有工具记录补充（本轮未重新运行产品）：全局0.6.0版本曾成功覆盖，旧codument SHA256为05206bf05959d0b10420a6cc5b5e6d2d67a5ba5cadee5f46ec1c178d69ddc3f8；英文help/带agent示例/移除demo后来在/tmp/depa-codument-verification-8bHSMb验证、C8+H12测试通过及C lint通过，但未覆盖全局。用户已明确要求未来覆盖bin+skill。合同0.1.1/2.0.0混用的typecheck失败是后续重观察项，不能引用旧全量check作当前PASS。
- 本轮遵循cdmt-mission-lite的harness修订流程，读取SKILL与mission-scaffold；仅用apply_patch写本mission文档。结构预检结果随后追加；该预检不证明业务、迁移或安装成功。
- 结构验证：`python3 /Users/kongweixian/.agents/skills/cdmt-mission-lite/scripts/check_mission.py .cdmt-lite/missions/active/codument-cli-skill-app-refactor --phase preflight` → exit 0，mission check passed。仅证明harness结构过线，所有新增业务验收仍未勾选。

### E285 — Round43授权恢复、固定资产根首轮反例

- 用户将别名文件最终修正为references/std/compat/operation-alias.md，并明确开始控制循环实施。更新harness后8e7978 preflight exit0；E284中的compact仅是历史讨论，不再是实施路径。
- 使用Halfcode公共ResourceEffect的源码/embedded读取机制，产品资产固定根为product-capsule/src/templates/agents/global/skills/depa-codument；不扫描当前workspace或agent目录决定全局指导。CLI读取发行App与安装复制的字节同源；首次init不依赖已有global安装。独立已安装App也须经公共catalog正常加载。
- RGoOIe副本来源digest1ca3686226fd99af7fee5f8701d2eb467caa30be28a9af06752a4ccf6194f937；保护原codument和旧bin指纹不变。18pass/2fail：固定根资源变更/缺失损坏/独立App/文档链接通过；失败为旧分形指南URI迁移缺映射和native嵌入文件重命名失效。
- resource-name-probe独立native实验发现Bun的new File([embeddedFile],newName)保留原嵌入name；改用slice Blob显式name视图，不改源字节。补两类历史分形URI映射，接着准备round-43-global-app-second重验，不原样重跑失败假说。
- 当前typecheck仍因合同0.1.1与2.0.0的unique-symbol类型身份不一致失败；这与本批前已观察的问题一致，不伪称全量check绿色。未改他session依赖锁或降低类型检查。

### E286 — Round43全局App与隔离复制/替换、成本及迁移核心

- 详见verification/global-app-round43.md；最终源码基线sg3oN5及单测试修正SHA已明确，未将不同副本结果拼成一个虚假全绿。
- 真实固定资产App及动态准入通过；native全部15操作、缺损/无关App负例、链接闭包及安装替换恢复4tests/359assertions。独立资源first App准入与旧名简介发现2tests/140assertions。SKILL结构验证通过，15个旧名不依赖加载正文才能发现。
- 实际init、upgrade-global、upgrade在隔离home均支持claude,codex,eidolon，全部exit0；三份59文件与源码逐字节相同，项目仍为codument/且无std。错误root/tmp软链接路径被安全拒绝后改用realpath，未放宽路径保护。
- migration core 41/752及生产BunFS打包的standalone迁移consumer通过；成本46/763通过，中位26.57%字节代理下降，含新SKILL与alias完整读取；quick/mission/migration增量明确披露，真实token未测。
- 独立前向审查发现validate/workflow仍以旧codument命令判断可用性，已修。GapLoop、AttractorCheck、hook、fresh、历史声明与备份review边界保留。以运行反例修复Bun命名、配置URI、agent schema、compiled migration资产缺失，不删除检查机制。
- 原真实codument/与旧bin指纹不变；没有全局安装或npm发布。一次误cwd的只读根lint不纳入候选验收，已在最终/tmp/project重跑；没有根构建/升级/写入。
- 公共合同0.1.1/2.0.0造成4处类型错误和code-first准入拒绝仍未解决；直接统一安装版本不能解决源码中package-major=protocol校验（0!=2）。未回滚用户版本或重写既有制品内容。最宽最终回归结果与需要的跨仓兼容决策在后续证据记录。

### E287 — Round43最终宽回归与公共兼容合同阻塞

- sg3oN5的最终同源测试修正后，bun run test → exit1，625pass/26fail/7569assertions/136files/135.36s。日志full-test-final.log；本批发现的description文本同一性误断言已纠正，2/140复验通过，未将英文完整summary复制回短SKILL来迎合测试。
- lint-final.log exit0；typecheck exit2仅剩4个0.1.1/2.0.0 unique-symbol冲突。26项失败包含公共package准入版本不一致，以及serve/profile的错误文案合同漂移；不宣称全量通过，不进行发行或实际global覆盖。
- 实质不同的安全恢复分析：node_modules/lock准确显示两版合同同时解析；上游packages/skill-app-contract-public/src/shared.ts仍为2.0.0/protocol2，support的package-protocol.ts:274–275要求精确版本且major==protocol；新增0.1.1/protocol2即使单版本安装仍不符合该合同。回滚用户0.1.1、覆盖同版本制品、强转brand或修改protocol为0均不是被默许的安全恢复。
- loop标blocked并明确所需输入：建议保留0.1.1，在Halfcode显式解耦包版本与协议版本，新增一致的本地公共制品闭包，不发布npm；需确认这个公共兼容合同变更。等待不影响已验证App/布局/隔离安装/迁移核心成果。
- 最后复查旧bin SHA05206bf05959d0b10420a6cc5b5e6d2d67a5ba5cadee5f46ec1c178d69ddc3f8、新bin仍7b5abdf078cd211e3e56630e978be016814fc51ea08e6ee4f1453e89e2503d90；本次未实际安装global，不触碰原workspace。所有本轮命令已完成，无需续轮询。
- blocked后调用preflight明确拒绝（只允许Status active）；这是禁止继续业务写入的预期闸门，不改回active伪造通过。执行期间preflight已通过；获得兼容决策恢复active后必须重新预检。

### E288 — Round44公共合同0.1.1与真实制品消费验收

- 用户要求公共包版本改为0.1.1，恢复active并通过preflight。Halfcode公共合同常量/manifest、受影响公共依赖闭包及Codument消费要求统一0.1.1；不受影响的通用包保持0.1.0。资源协议保持2，包发布版本与协议身份分离；精确包/lock/descriptor负例保留，Vue builder复用公共版本常量，不用强转消除品牌类型问题。
- 初次制品打包发现workspace依赖被旧锁序列化为2.0.0，拒绝使用host-release-round-44-contract-011；修复显式依赖与workspace锁投影，生成新不可变set host-release-round-44-contract-011-final，digest df3ed2435b3a7ba68f7fd6325af5ad3718ed24914f6eb17652b65456e12d4f71，14 shared/6 product/180 artifacts。检查实际tarball依赖全部指向合同0.1.1。
- 合同0.1.1沿用已有相同内容制品5d21560557fcdbf95fee66a1330e71ad16e194d6d569cb0b34891c55c97489a8.tgz；未改通用包与旧set哈希相同。旧2.0.0制品保留，未覆盖已有制品或发布npm。
- /private/tmp/halfcode-contract-011-DGYQox/check-verified.log：check exit0，556pass/0fail/4818assertions/125files，含typecheck/lint。隔离副本含完整独立compiler分发，不共享可写源码。
- /private/tmp/depa-codument-verification-eF1WjC/depa-codument/project实际安装新set后：tests.log 651pass/0fail/7637assertions/136files；typecheck.log及lint.log均通过；context.log通过，migration.log核心41/752及compiled consumer通过。原历史dogfood仍review-required、0upgraded/226unchanged/0removed，不计作整个历史升级成功。
- 验证后源project安装同set，lock无合同2.0.0残留，实际import为合同0.1.1/protocol2。原lock备份见verification/round-44-contract-011-source-before.bun.lock；安装日志见verification/logs/round-44-contract-011-source.log。本地制品进程PID52171保留，入口http://127.0.0.1:49165；不是npm发布。

### E289 — Round44已授权实际global安装与保护验证

- 隔离candidate构建通过，覆盖/Users/kongweixian/.local/bin/depa-codument，SHA42258885927e4175e41132dd1fea90ca1e84df0b29bce8d4022d7bc57ddb90b9；产品版本仍0.6.0，公共合同版本不是产品版本。安装receipt见verification/logs/round-44-global-install.json。
- upgrade-global --agent=claude,codex,eidolon exit0，177文件；.claude/.agents/.eidolon下的depa-codument各59文件与canonical App逐字节相同。别名位于references/std/compat/operation-alias.md。实际安装后-h exit0，init示例含三个agent，无demo，operation说明英文。
- 新bin旧件备份/Users/kongweixian/.local/bin/.depa-codument-install-WS2JyO/depa-codument.previous；global目录备份/Users/kongweixian/.tmp/depa-codument/upgrade-global-JiQg9U，可恢复。
- 旧/Users/kongweixian/.local/bin/codument保持原链接及SHA05206bf05959d0b10420a6cc5b5e6d2d67a5ba5cadee5f46ec1c178d69ddc3f8；原codument/指纹仍b631c71946ecff6cba752ee096bcec1b24b195d24b9d16fddf2deb1eab3bd11f。用户原src修改保留，没有原workspace升级。
- E287公共版本阻塞解除；本批版本/实际global安装完成不代表长期mission全部历史兼容、发行和无scope gate已通过，mission保持active。

### E290 — Round45真实E2E框架初步与环境观察

- 用户授权六步真实Terra E2E；期望-10/约束-21进入同一mission，preflight通过。旧e2e业务需求逐字节复制进project/e2e/cases，业务脚本正本只改project/e2e。
- 隔离副本AUuuts，source digest ec3c3e5c1d244d89cb6f1f890fc1d642350dcc500d0c216a3bd65f902dfb6e5c，12450files；原codument/及旧bin指纹不变。candidate由副本project构建，156BunFS资源。
- 初步runtime测试3pass/10assertions；smoke /private/tmp/depa-codument-e2e-61NGZd实测无模型安装、59文件global布局、workspace App无std、help及动态指导、未知命令非零、旧bin拒绝、外层sandbox写入拒绝及允许、超时124。此前U1rTV6中Bun受拒绝写入未返回非零但文件实际未变，改用系统touch做拒绝退出断言，没有放宽文件保护。
- 初次真实probe DqsSjg模型为Terra/medium但嵌套macOS sandbox_apply被拒绝；Agent只报告无法执行，原框架仅看exit0的判据已作废并补实际命令断言。保留外层全进程sandbox，内层不重复应用Seatbelt，GF9rEg成功执行实际Skill及CLI检查；认证临时副本结束删除，无全局修改。
- Todo首跑j4zhPE正在真实规划，非完成证据；日志/result路径见loop Last action。其余独立验收器还在实现，不能将现有smoke/probe宣称六步真实通过。

### E291 — E2E runner纠偏、独立审查与真实Todo继续

- j4zhPE规划成功产出pending Track且strict/knowledge通过；默认list和show仅暴露active是既有查询合同。runner误判pending缺失，停止错误纠偏并将该trial标harness-invalid，保留全部成本。新verifier使用真实Track路径+公共lifecycleSourceCodec根节点+精确validate，不修改产品查询语义。
- OWXOhA早期plan-0中断后，以同目录恢复session38711；plan-1实际完成且三组校验exit0，implementation-1正在实现并运行fresh子代理。此时不能声明Todo通过；恢复/框架基线变化须显式报告，不重置为first-pass。
- fresh Terra审查指出CLI setup/query未完全受Seatbelt、resume重新信任可写需求、线程身份未校验、报告可任意分类、UI仅HTML、child成本遗漏。已逐项加固前五项中的执行/数据部分，UI实际浏览器门仍待落实，不拿HTML作完成证据。
- 当前unit 9pass/38assertions，typecheck和e2e lint exit0。新smoke UtEpOq exit0、modelCalls0，setup与全部CLI调用受外层Seatbelt；额外负例拒绝原个人home读取。网络为真实模型/依赖安装保留；同一可信Codex宿主仍需读取其临时auth，不能宣称工具与宿主之间有独立凭证隔离。
- 需求与acceptance基于父持有case源核对，恢复不重新信任工作区；active PID锁防并发；thread identity要求各phase不同。恢复历史attempt合并，恢复不自动从统计分母消失。classification只可带原因作废harness，不能将FAIL升级PASS。
- 成本新增raw token_usage_record per-response去重，包含中断与child sessions，不重复求和累计计数；仍不把token估价冒充账户账单。公共domain解析器以workspace devDependency引用；源和副本bun install经现有49165本地制品源成功，没有npm发布。副本tsconfig/eslint及默认test/lint包含e2e。

### E292 — 校准结束、真实缺陷、最终框架与新候选R3

- cS2ETJ真实probe成功：Terra/medium，实际成功执行CLI，模型审计有真实turn_context。收紧home读取后Node需要祖先目录metadata读取，增加仅metadata允许；真实home内容仍拒绝。eazEEK保留此环境失败，不算模型业务失败。
- 外层Ego Browser专用TaskSpace3，127.0.0.1:45781的临时Todo已实际注册、创建含状态/日期/tags的任务、筛选、删除。标题 `<span data-e2e-injection="yes">Literal title</span>` 被渲染成真实元素，DOM检查true；证据OWXOhA/external-feedback.json。这是实际缺陷，内部NO_GAP不能覆盖。
- OWXOhA计划及实现实际过strict/knowledge、HTTP oracle和应用scripts；内部GapLoop三轮修正文档路径/authority占位，最后NO_GAP。AttractorCheck两次执行通道停滞被内层主代理中断并重试；相同只读命令外层187ms exit0，不是据此删除检查。后续coding check和Track 7/7 completed真实达成。
- 外层fresh Terra review明确FAIL：缺真正浏览器测试、fresh验收receipt未成功闭环、Engineering仍有虚构模块/方法。此review与外层HTML注入发现并行、互不替代。旧worker已进入attempt2后于04:06前后定向停止，不再花旧候选纠偏预算；auth已删除。classification标harness-invalid是因为runner/binary基线迭代，不能抹去实际业务失败，原JSONL/receipt完整保留。
- 真正产品缺陷：init将已迁走std/skill路径宽泛前缀替换为不存在global URI；README已canonical还被再次替换为references/skill://。已共享精确历史重定位表（含中间references/std旧目录URI），init保持canonical README，migration保留anchor/标点、不改xskill伪子串；新增所有profile目标存在/README不破坏及中间版本备份迁移幂等负例。19个定向测试212assertions曾过，后加边界测试已进入最终完整回归。
- 最终当前源在/tmp副本check：663pass/0fail/7749assertions/138files，typecheck/lint exit0。日志/private/tmp/depa-codument-verification-AUuuts/e2e-r3-full-check.log。此前一次完整回归的OS进程负例触发5s测试默认超时，保留失败日志；改为小fixture脚本（不覆盖Mach-O副本）、30s有界OS测试，全部拒写/拒读断言保留，最终已过。
- R3候选/private/tmp/depa-codument-verification-AUuuts/depa-codument-candidate-r3由最终副本构建，156BunFS资源；XYxh6l smoke实际exit0、modelCalls0。框架现在含固定配置/需求、全CLI sandbox、model/thread身份、source/ignored dist漂移、并发锁、resume原attempt保持、parent-owned强schema浏览器gate、per-response含child/中断成本、按case及基线报告。UI实际操作由外层可信controller签证，生成应用无权写receipt；外层编排模型自身成本不包含于native Codex日志计数。
- 原codument指纹b631c71946ecff6cba752ee096bcec1b24b195d24b9d16fddf2deb1eab3bd11f、旧binSHA05206bf05959d0b10420a6cc5b5e6d2d67a5ba5cadee5f46ec1c178d69ddc3f8仍相同；没有global覆盖。框架节点完成，业务节点仍active；接下来冻结R3正式Todo→stream→blog→ecommerce→nested→Todo/stream独立重复。

### E293 — R3正式Todo首轮完成与真实浏览器验收

- /private/tmp/depa-codument-e2e-bvTcgN/result.json：passed、attempt0、firstPass=true、resumed=false，1555865ms。exec46332 exit0；模型审计含9个真实parent/child sessions，全部gpt-5.6-terra/medium。固定R3 SHA8fdf75af54b2f64a026db4cfee743ee027e8bf82456eedd0a3841492aeee9931及harness06b0e66ba2672a9dd576125732c552ca8b7bb33ad49727c5495b5b4708f0cc2b，需求/配置/global Skill守卫通过。
- plan经strict/modeling/engineering三门；实现11/11任务完成，应用test/type/build及外层随机HTTP oracle通过。内部fresh reviewer曾明确发现Track声明浏览器测试但实际仅HTTP，Playwright安装尝试遭活跃锁冲突及PTY权限错误；相关日志保留。外层fresh Terra独立执行真实tests/HTTP并PASS，但其浏览器自动化未运行，不以其源码检查代替UI证据。
- 外层Ego Browser TaskSpace3/p1独立操作127.0.0.1:49699：注册、错误密码拒绝、正确登录、创建doing/date/tags任务、Mark done、doing零结果及done+tag+date包含边界筛选、删除、logout/login保留任务。输入span标记实际literalRendered=true/injectedElement=false。ui-receipt-0.json记录6组实际动作；测试前与gate源码指纹同为d661638946376b27816c0674f1e1de41aa13827e65e2cbfecb725690fca522a3，最终无漂移。UI controller92406已精确停止；Ego空间保留给后续用例。此UI外层补充并不把失败的Playwright安装改写为成功。
- 当前报告原始响应去重：input7189494，其中cached6728960、非缓存460534；output59941，160responses/9sessions。原生日志含内部失败/子代理，不含外层控制器自身token，不推算账户账单。这里firstPass指首次外部attempt完成，并非内部无纠偏；校准样本成本仍单列、不混入正式成功率。
- 继续同R3和harness跑stream-pipeline-ai-agent→blog→ecommerce→nested→fresh Todo/stream重复；本分支未完成，不归档mission。

### E294 — stream运行时发现问题与不重置试次的恢复

- stream root OQoacs的plan0已过三门；implementation0创建代码及依赖后遇到Python3.9不符合原需求、pip下载超时，内部fresh reviewer也保留缺目标运行时。没有业务PASS。
- 外层只读uv python list --only-installed确认现有/Users/kongweixian/.local/share/uv/python/cpython-3.12.7-macos-aarch64-none/bin/python3.12以及/Users/kongweixian/.local/bin/uv；当前sandbox允许这些路径，但隔离PATH未暴露。问题是测试运行时发现，不是本机没安装Python。
- 05:05UTC精确验证PID95046命令后SIGTERM停止原controller，exec38555 exit1，result保留infrastructure-failed/attempt0/1756163ms。没有classify-invalid或删日志。external-feedback.json只提供绝对运行时路径及恢复约束，既不改业务答案也不降低requires-python/测试；同R3/harness用--resume恢复为exec20875/attempt1，保留首次失败和全成本。下一独立重复需要显式解释运行时发现差异，不追溯冒称首次通过。

### E295 — stream正式首轮失败收口，保留全部纠偏与成本

- OQoacs最终result=failed、resumed=true、firstPass=false、attempt0/1/2全部保留；exec20875 exit1，3951273ms（含先前中断耗时）。不继续第四次、不重置预算、不classify-invalid。测试运行已完成，但长需求交付未通过。
- attempt1：真实Python3.12.7/SDK/RxPY安装及14tests、outer随机pipeline/lexical/loop全部通过。controller将已有只读Python3.12包装入口补入run/bin，并记录runtime-recovery.json，避免outer重复下载解释器；候选与harness未改。reviewer在workspace创建.review312-venv.kUXQ58，触发严格全文件指纹漂移；这属于评审scratch位置问题，不冒称业务源文件被修改。与此同时reviewer发现任意文件读取；外层以真实工具请求/etc/hosts复现outside_workspace_read_succeeded=true（只输出布尔，不输出内容），日志outer-tool-boundary.log。
- attempt2：实现者读取真正review报告，自主把危险任意路径工具换为安全get_streaming_tip；原需求只举read_text_file_head为例，要求两个低风险工具，未删除必需功能。15tests与新GapLoop/AttractorCheck过线；outer随机桥接再次过线且review未触发源码漂移。
- 最终fresh reviewer实测FAIL：src/ui/readline_shell.py先等待loop.run_user_message全部结束再print累计projection，实测loop-return先于shell-print；违背原始实时流式终端目标。tests/test_readline_projection.py仅测内存projection，未测终端输出时序。原完整request不变，未把内部NO_GAP当最终PASS。
- 去重raw parent/child成本：input12952296，cached12166656，非缓存785640，output96196；259responses/12sessions，top-level completed usage不完整（中断），raw计数仍含中断已观测响应。币值未知、不含outer控制器自身成本。失败后另外运行auditModels核对真实上下文，auth最终删除。
- 下一个可做用例为blog；随后ecommerce/nested和Todo/stream独立重复。最终报告必须保留stream首轮0%/0%及具体剩余缺口；独立重复不是修订此失败结果。

### E296 — Blog真实质量循环与重连判定纠偏

- I5ZuWb的plan0三门通过；implementation0完成9/9任务，内部fresh验证先发现非实质typecheck脚本并修复；GapLoop三轮实际修复作者PATCH status绕过发布权限、明文密码、过宽编辑状态转换；coding attractor修复路由直接访问store内部map、评论缺pending-only审批守卫，并fresh复验。最终实际test/type/build/live HTTP通过，仍未进行outer验收。
- 一次工具结果配送延迟约5min，底层同命令outer隔离复现407ms退出1（最后Resource缺子命令的正常错误），日志outer-command-replay.log；原session随后自行继续，未被controller中断。
- exec68492最终退出1是runner误判，而不是实现进程失败：implementation0实际exit0、turn.completed完整，日志仅有两条中间error=Reconnecting... 2/5及3/5。旧readEvents把任意error永久判failed，故result=infrastructure-failed、3192895ms；原文件完整保留。
- 修复仅针对已观测Reconnecting通知：保留reconnect诊断，要求真实当前turn.completed；unknown error、turn.failed、无completion或后续未完成turn仍fail。源与/tmp副本e2e定向11tests/56assertions+全typecheck/lint通过。当前harnessSHA66116139579a4577f4e3189693b3de7da387c401e1ba15a6a124f5873ce546f6，产品R3不变；旧证据只对应旧harness，不追溯改写。
- external-feedback.json明确仅恢复已完成实现的外层验收，不要求重做已完成工作；将同root --resume到attempt1，保持firstPass=false及前次成本。后续汇总需指出首次未到outer是runner误判，不冒称博客业务首轮验收已失败或已通过。

### E297 — Blog归档观测与验收器生命周期修复

- 恢复exec13011的implementation1主动归档add-content-cms并晋升知识。旧runner取dated目录basename当ID，strict输出No tracks or missions to validate而退出0，modeling --deltas因ID格式拒绝。attempt1保留失败，自动进入attempt2；模型通过CLI重开Track以继续验收，未靠复制制造双authority。此错误属于runner对合法归档生命周期覆盖不足。
- 修复范围仅e2e：公开codec读取authored ID，active/pending强校目录一致；归档严格校验使用精确archived/<month>/<dated-id>选择，避免空集合假成功。知识增量CLI确实只接active/pending，归档时用公开pure index/validator按deltas模式检查保留源，并另跑CLI验证真实晋升registry且要求非空，行为owner也要求非空。不为了测试要求改变产品生命周期，不修改产品API。
- 12tests/64assertions+全typecheck/lint exit0；新harness141bb423db9aaa7eeae43fe8197e29f0a0b5916276673a14b42921c66db46120。当前活跃blog worker仍为此前66116139基线，不热加载；新逻辑供后续用例/最终回归使用。
- 外层Ego space3/p1先在127.0.0.1:65061实际注册作者/编辑、创建带字面HTML标记的草稿、发布、按tag/category筛选、下线，literalRendered=true/injectedElement=false。完整页面无评论创建/展示入口、无待审核评论列表、无既有草稿编辑UI；记录ui-observation-before-final-review.json。该观察后实现/证据仍有变化，不能充当最终fingerprint-bound UI PASS；旧UI controller17258已精确停止，等待最终版本重新验证。
- attempt2内部检查另发现作者仍可编辑published/offline文章并修复，attractor又发现隐式runtime依赖和过期Modeling maps，当前继续修复/复验。不得因部分API通过而认定Blog完成。

### E298 — Blog最终失败与独立浏览器复核

- I5ZuWb最终failed、firstPass=false、resumed=true，4321832ms；exec13011 exit1。attempt2实际应用3tests/53assertions（不是53tests）、type/build/outer随机HTTP、strict/knowledge通过；CLI归档因缺可信Git基线安全拒绝后保留active/completed，未伪造baseline。
- 最终fresh Terra独立执行tests及HTTP并FAIL：src/ui.ts缺作者草稿编辑入口/PATCH；Modeling UserAccount.passwordHash与src/cms.ts丢弃密码且不存hash冲突。前两次runner重连/归档缺陷见E296/E297，不将它们偷换为业务验收失败；最终真实质量缺口仍成立。不追加第四轮或将此trial作废。
- 外层Ego在最终52502端口再次注册author/editor、创建含字面HTML的草稿、发布和读取。全页确认无草稿编辑、评论创建/展示及待审核内容列表；ui-observation-final.json绑定最终指纹1ac5c303c03cca575ab4df910175b6f7a2925266eaa5209efe6fa81431a69b61。因semantic review先失败，没有伪造UI-gate PASS。
- raw去重input18039875、cached16867328、非缓存1172547、output129504；394responses/20sessions，20真实上下文全部Terra/medium，auth结束删除。成本保留框架误判导致的恢复开销，不能将这些消耗归因于业务单一缺陷。
- 当前继续ecommerce lztBFk（exec98713），R3不变、harness141bb423…；其余nested及独立重复尚未完成。

### E299 — stream重复前运行时预检与评审scratch边界

- 源和/tmp harness加入preparePython：只读发现本机现存managed Python3.12，uv禁止下载；在实际sandbox运行--version，固定解释器/uv SHA；仅在各run/bin创建wrapper并传入UV_PYTHON。恢复检查相同runtime，不用主机全局安装或个人配置作兜底。
- /private/tmp/depa-codument-e2e-OJNy9N连续两次预检及sandbox wrapper真实执行exit0/modelCalls0；13个E2E定向测试68assertions通过。新harness a95823869fec52851f1c5434aa43e95dfebbea610782c187133f5353a1433fe8；R3未重建。stream首轮人工环境恢复仍原样记录，不追溯为自动预检通过。
- 外层fresh reviewer提示把新scratch放隔离HOME/tmp，仍保留完整source/依赖/build指纹守卫，不再鼓励在被审工作区创建临时venv。依照simplify仅整理新增runtime helper的路径/版本/receipt顺序，不扩张业务范围。
- 当前ecommerce运行中基线仍141bb423…；新预检逻辑用于后续独立stream重复。最新完整check正在exec91128，不提前声明通过；MissionLite preflight已通过。

### E300 — fresh验收器复核与运行数据/source边界

- exec91128最终666pass/0fail/7773assertions/139files，typecheck/lint通过，对应a958基线。该宽回归不覆盖本条后续改动。
- fresh Terra reviewer指出归档只检查非空registry可能假PASS、business执行后才冻结源码、持久化数据误入source指纹、curl --version也可能满足review实际运行条件。已增加singleton fresh archive的ID/owner/semantic内容关联与Behavior重放no-op；多个已归档交付明确报Harness unsupported并计infrastructure，不把正常历史演进错误宣判业务失败或PASS。历史逐次merge重建不是当前oracle支持范围。
- app mutable state按模型phase、scripts、HTTP、nested和UI分配至隔离HOME/tmp；E2E_DATA_DIR/DATA_FILE显式传入。UI请求及最终receipt绑定同一dataDirectory。源码/ignored dependencies/dist仍全部受指纹守卫。Python测试环境安装明确发生在冻结前，venv移到HOME/tmp；应用scripts/business前后比较冻结源码，再进入fresh reviewer和UI门。
- reviewer命令门不再接受任意curl/fetch子串，实际test/build/typecheck/pytest/node --test调用才满足最低执行证据；独立语义判断仍必须PASS，未用正则冒充完整业务验证。
- 当前16tests/89assertions+全typecheck/lint exit0；新harness8957dc3665987ad1e963e6bd3cdd2844e9df6b8ec752dcb686f193f6886a7dc4。独立review第二轮发现共享agent数据目录及归档scope未代码约束，已修正并请求最终bounded只读复查。Ecommerce活跃worker仍141bb423…，不热加载、不追溯宣布这些门已覆盖它。
- 再次只读验证原codument fingerprint b631c71946ecff6cba752ee096bcec1b24b195d24b9d16fddf2deb1eab3bd11f、旧global codument SHA05206bf05959d0b10420a6cc5b5e6d2d67a5ba5cadee5f46ec1c178d69ddc3f8不变。本轮无global安装或真实项目升级。
- fresh Terra最终bounded复核返回NO_GAP：singleton guard正确计infrastructure，新模型phase/脚本数据隔离，UI请求/服务/receipt存储目录匹配；在已声明范围内未见新增实质false-PASS/isolation/selector缺陷。此结论只覆盖8957增量，不替代真实业务用例与最终宽回归。
- 8957最新完整/tmp回归exec55042 exit0：669pass/0fail/7795assertions/139files，typecheck/lint通过；完整日志/private/tmp/depa-codument-verification-AUuuts/e2e-harness-8957-check.log。这次宽门覆盖全部新增harness，R3产品仍不变。
- 最新U9xwUM无模型smoke exit0，modelCalls0；安装/布局/路径/错误退出/sandbox/timeout/旧命令拒绝全部通过。

### E301 — Ecommerce真实GapLoop耗尽，保留工作流block而非绕过

- lztBFk plan0通过三门；implementation0实际3/3 tests、独立进程HTTP e2e 2/2、build及声明typecheck（实为node --check语法检查，不能冒称强类型检查）通过。多次fresh及5轮GapLoop依次修复模块映射、持久化价格/折扣快照、领域映射、已付款订单接受别单paymentId、金额安全整数溢出。
- 第5轮仍FIX_APPLIED；配置明确max_rounds=5/on_exhausted=block，故implementation0正确停止且Track保留in_progress。没有后继AttractorCheck或完整最终验收PASS；尝试根状态blocked被CLI拒绝，不造状态。report gap-track-5.md和.e2e-implementation-0-last.md保留真实阻塞。
- 旧runner把未completed当普通外层纠偏并自动启动attempt1，存在绕过block风险。controller核对实际配置/报告后精确SIGTERM PID42941（exec98713 exit1）。raw result仍infrastructure-failed/attempt0+中断attempt1/2688950ms；terminal-policy.json明确真实终因configured-workflow-block，不改raw日志，不将该业务未交付从分母中排除，也不允许generic resume或增加轮数。当前effective status=blocked，first/final均不通过；UI及outer最终业务验收未完成，不虚构其失败或成功。
- 计数包含无效attempt1的已花费成本：raw input9890833、cached9248000、非缓存642833、output95660；231responses/14session日志，16个模型上下文全部Terra/medium；auth结束删除。
- 新runner要求implementation以schema给出delivered/blocked，block立即终止case且写parent stop receipt；外层三次预算不覆盖hook耗尽策略。report保留rawStatus和terminalPolicy，blocked计入业务分母。17tests/96assertions+全typecheck/lint过，新harness4a2b828e4070527cf382d9cdb8aebe19fa450038c64add063a3ad5f8f84a77bc，R3不变。该增量请求fresh只读复核。
- 同turn继续下一ready分支nested XiBVUg（exec36456），随后Todo/stream独立重复；不因一个case工作流阻塞结束整个批次。
- fresh stop-policy审查指出仅信model blocked字段仍可能被错误delivered绕过；已补CLI gap_round+配置+终轮report独立守卫，在delivery判定前及generic retry前执行。真实Ecommerce目录机械复查返回exhausted FIX_APPLIED/block，delivered误报负例及NO_GAP/未知判定负例通过。17tests/99assertions+type/lint过，harness f8b543c3c7e8b50d47e71ac9a24d5c730334c872c644c422c06775c444594234；nested活跃worker仍4a2b基线。新guard待bounded复核，不追溯覆盖活跃任务。
- 成本聚合限定五个正式业务case，成功probe/smoke不得进入通过率分母；校准费用仍可聚合。DqsSjg依据E290补harness-invalid标记，不覆盖早期错误raw PASS；其token账保留。
- bounded复核指出resource-global gap_round不能唯一识别多个scope。最终671c5540…版本对多scope mixed/missing证据返回Harness unsupported/infrastructure；只在singleton明确耗尽时宣告业务block，完整明确NO_GAP不误阻断。该负向守卫不是hook完成证明；产品缺scope-bound机器receipt的限制写入README。独立复核确认此前false-business-block已消除；17tests/101assertions和type/lint通过，旧活跃worker不热加载。完整check另跑exec20601。

### E302 — Nested规划纠偏与最后试次进入实现

- XiBVUg plan0因Missing modeling_deltas失败；plan1补建模后仍因Missing engineering_deltas失败；plan2补工程知识后通过两仓规划校验并进入implementation2。三次outer预算共同覆盖规划和交付，因此只有最后一次实现机会，不会给该试次重置预算。
- 规划器的nested专用提示没有像普通Track提示一样显式列出建模/工程增量，但外层门检查所有实体Track（含child未选backlog）。这会增加规划纠偏成本；保留为本harness条件，不把缺增量自动解释成CLI功能损坏。后续报告明确此限制。
- 实际候选仍R3、worker为4a2b基线，cross-repo服务与独立最终验收尚未完成。当前选中INV-G1-T1，child保留INV-G2-T1；不要求未选child backlog完成来凑root成功。

### E303 — 最终runner基线宽回归与保护边界复核

- 671c5540…第一次完整check（exec20601）为669pass/1fail/7807assertions：clone consumer测试耗时8661ms超过既定5000ms，typecheck/lint通过。未调大timeout或删失败记录。
- 相同测试文件单独复跑exec33565为3pass/1487assertions，原超时测试本次13.93ms；同基线完整重跑exec47539为670pass/0fail/7807assertions/139files，typecheck/lint通过。前次超时保留为观测到的回归不稳定性，不冒称首次全绿。
- 原codument/使用既定算法（包含root目录行）fingerprint仍b631c71946ecff6cba752ee096bcec1b24b195d24b9d16fddf2deb1eab3bd11f；旧global codument字节SHA仍05206bf05959d0b10420a6cc5b5e6d2d67a5ba5cadee5f46ec1c178d69ddc3f8。一次临时复核漏计root行产生不同hash，按同算法重算后完全一致，不涉及目录变更。R3 SHA仍8fdf75af54b2f64a026db4cfee743ee027e8bf82456eedd0a3841492aeee9931。
- 最新671c基线无模型smoke RifTBP（exec84015）exit0/modelCalls0，10项全部通过：isolated-install、global-layout、workspace-app、help、guidance、unknown-command、sandbox-denial、sandbox-write、timeout、legacy-rejected。

### E304 — Nested正式失败与不改结论的补充HTTP诊断

- XiBVUg三次outer预算结束，result=failed/firstPass=false/resumed=false/1923797ms（32.06min），exec36456 exit1。前两次规划缺增量见E302。implementation2完成两仓实际服务、tests/syntax-check/build、内部GapLoop与AttractorCheck及fresh检查；GapLoop修复inventory标识映射，确认轮NO_GAP。父Mission completed、selected leaf DONE、child active且保留维护backlog，两仓strict及外层关联状态检查通过。
- 最后失败发生于nested-verifier读取e2e-server.json：两仓产出{"argv":["node","src/server.js"]}，runner只接受command。原acceptance使用“command argv”描述、没有普通HTTP用例那样的明确JSON样例；此处既有交付边界未匹配，也有测试合同清晰度问题。raw AssertionError false==true保留，不扩充预算、不把它说成业务HTTP已失败。正式HTTP及最终outer fresh review未运行，不能判整体通过。
- 为区分接线与业务，verification/nested-r45-diagnostic.ts在controller只读采用实际argv，仍使用原sandbox和独立运行数据目录，未修改源、descriptor或候选。真实双服务随机请求：库存预留、库存不足拒绝、支付重复只扣一次、待支付取消释放/已付款拒绝取消全部通过；descriptor-diagnostic.json标明notAcceptancePass/formalResultUnchanged。source fingerprint前后一致cba898723302cdc4450e4c9dc3c9e70f881ccb30508a8817aa235b4003e9bae7，服务器已精确清理。这不是第四次模型尝试或完整交付证明。
- raw去重input12699385/cached11953152/非缓存746233/output99408；274responses/14session日志，14观察模型上下文全部Terra/medium；auth最终清理。新Todo2 Yg2OnD/exec20069已开始，随后Stream2；不恢复Nested原试次。

### E305 — 两个独立重复的启动与可恢复观测

- Todo2 Yg2OnD（exec20069）plan0通过；implementation0通过默认status判断“没有Track”，随后另建add-todo-application，原implement-todo-application仍pending。此为新会话承接pending计划的真实可发现性/恢复摩擦；controller不替模型修改状态或传递答案，等待正常outer门反馈。
- Stream2 dIrjAv（exec46282）在Todo2启动后独立启动。五个首轮已全部终态，两个重复无业务依赖，允许并行等待以减少墙钟耗时；不同run-root、temp HOME/数据/auth副本、fresh Terra上下文，相同冻结R3与671c harness，不共享业务代码、结果或纠偏提示。各自仍最多三次outer尝试。总用时报告区分各run elapsed之和与并发墙钟，不能把相加当批次墙钟。
- preflight再次通过。候选/验收合同未因重复运行修改；Stream2自动Python预检与Stream1人工恢复的基础设施差异仍在报告中披露。
- Stream2实际Python预检记录3.12.7、现有uv和解释器SHA，未下载解释器；plan0通过。内部GapLoop发现真实SDK工具循环缺assistant tool_calls与assistant回复入history、桥接脚本忽略conversation所以旧测试没捕获。模型已补conversation-contract断言并fresh复检，当前coding AttractorCheck，不提前当outer PASS。
- Todo2 implementation0内部两轮GapLoop NO_GAP，coding AttractorCheck修复runtime-injected service与纯校验/投影分离及建模字段一致性后复检过线。独立内部验证通过不等于整体：outer实际拒绝原规划Track的new状态（Track root must actually be completed）；自动进入implementation1继续原Track，首次通过已为false。没有删除原计划或重置试次。

### E306 — Stream独立重复在真实第五轮GapLoop耗尽后正确停止

- dIrjAv正式结果blocked/firstPass=false/resumed=false，只有outer attempt0，elapsed1680473ms（28.01min），exec46282 exit1。configured max_rounds=5/on_exhausted=block；新runner接受结构化blocked结果，保存terminal-policy.json并直接终止，没有Ecommerce旧worker的自动attempt1绕过。不恢复或补第六轮。
- 内部纠偏已修复assistant tool-call/history缺失、错误事件分层传播、SDK缺失ID场景；最终14tests、三种桥接模式与strict通过。但最终fresh gap-P4-5.md实际复现client_stream_escaped RuntimeError connect failed与agent_loop_escaped RuntimeError provider failed：官方SDK create或注入provider.stream同步抛错发生在iterable创建之前，未进入LexicalError→syntactic_error→semantic_error/mainline。现有测试只覆盖迭代过程中异常。因此内部测试通过不能完成交付。
- 最终外层business/fresh review未进入，不把其未执行说成通过。原需求与候选未变，环境预检成功并不解决这个实际实现缺口。
- raw去重input7801775/cached7321088/非缓存480687/output64658；166responses/8session日志；8观察模型上下文全部Terra/medium，auth最终不存在。较Stream1用时和token较少，但这里提前停在内部hook且最终同为未交付，不能宣称同质量成本改善。
- Todo2继续原Track的P4独立hook，是当前唯一活跃worker。整体真实E2E验收节点仍未全过线，不能关闭mission。

### E307 — Todo复跑真实浏览器阻止内部与外部文本审查的假通过

- Todo2 attempt1完成原Track 9/9任务，GapLoop修复真实日历日期校验、确认NO_GAP；AttractorCheck修复不存在.ts code maps并对齐实际.js结构，fresh复检。外层strict/knowledge/app脚本/随机HTTP全部过，fresh Terra review verdict PASS（3tests/21assertions、独立21项HTTP/UI/API检查、源码指纹未变）。此时仍须真实Ego浏览器门，不能凭上述文本审查或HTML连线宣称UI成功。
- UI请求attempt1绑定source cf7e4445ee6d92d244e21dfa23453026bcf50613f66599888cc6c3ef68172c46、dataDirectory home/tmp/app-state/ui-1。Ego space3/p1在55153端口实际注册成功；填写有效title/doing/2026-10-01/tags后Add task，出现Cannot read properties of null (reading 'reset')且列表不刷新。等待li超时后按skill先观察，确认不是选择器猜测或无效日期。public/app.js在await API后使用event.currentTarget，此时为null。
- 点击Filter后真实已存任务出现；页面内观察确认id=e2e-literal的B元素实际存在，而非字面文本。title `<b id="e2e-literal">Repeat task</b>`被innerHTML解析；title/tags插值未经文本化，属于实际DOM injection。没有使用可执行攻击载荷，也没有绕过UI使用API替代交互。
- parent写ui-receipt-1.json status=failed及两条精确findings；旧UI controller PID19660核对命令后TERM，exec38762结束。runner按原budget进入最后attempt2，不重置firstPass、不给第四试次，不修改harness/candidate。后继UI必须重启新ui-2数据目录并绑定新source fingerprint，不复用本次失败回执。
- 六个已终态业务root及校准/probe账目另经fresh Terra只读审计，成本和归类完全一致，NO_GAP仅针对报告快照；Todo2待定，不冒称最终全通过。

### E308 — Todo第二次在最后有界纠偏后真实通过

- Yg2OnD runner exec20069 exit0，result=passed/firstPass=false/resumed=false，attempt0/1失败保留，attempt2通过；elapsed4534898ms（75.58min），没有第四次尝试。最终21个观察模型上下文均gpt-5.6-terra/medium。
- implementation2修复await后currentTarget失效，保留form引用；title/tags改为文本DOM创建并增加回归。GapLoop沿原计数进入round3，fresh发现PATCH JSON null逃逸为TypeError/HTML500，增加对象校验与负例；round4 NO_GAP，单独AttractorCheck通过，没有重置round。
- outer fresh review2 PASS：实际5tests/31assertions、独立19项HTTP断言；strict/modeling通过，engineering为0errors/2已说明warnings。其typecheck脚本实际为Bun build与tests，不称为强静态类型检查。最后源码保持不变。
- UI2 parent receipt绑定source f59c6830e08506fc2b4e5e2eed93db07a79adade8d5e9189cd7d3455246036e8（精确值以run-root/ui-receipt-2.json为准）及home/tmp/app-state/ui-2、Ego space3/p1、port59984。真实注册、立即创建/列表刷新/表单清空、title/tag字面文本无注入元素、doing→done、组合筛选、未匹配tag、日期范围1→0→1、删除、退出、错误密码拒绝、正确登录与删除持久化，共12项记录PASS。未用API替代浏览器交互，失败UI1回执保留。
- raw去重input16643342/cached15419136/非缓存1224206/output169763；389responses/21session日志文件。最终auth和runner-lock不存在。UI controller42470核对精确命令后TERM，exec10418结束；Ego task.finish({keep:[]})恰好一次关闭space3和p1，无遗留tab。浏览器提示有更新，但本批未升级。

### E309 — 七次有界测量结账与未通过边界

- 正式Todo×2、Stream×2、Blog/Ecommerce/Nested各1次均终态；outer首次1/7=14.3%，累计有界最终2/7=28.6%。Todo最终2/2，其余未过线；Ecommerce和Stream2的真实业务block留在分母，不当基础设施失败排除。没有继续任何耗尽试次。
- verification/terra-e2e-round45-results.json从13个原始root聚合。正式input85217000/cached79704320/非缓存5512680/output715130；另校准与probe已知input13201601/cached12438528/非缓存763073/output102236。合计观察input98418601/cached92142848/非缓存6275753/output817366；1个probe usage未知不按0，外层controller/报告审计成本不含在此。金钱/账户账单未知。正式elapsed相加20657088ms，不是并行批次墙钟。
- 最终保护复核：原codument/ fingerprint b631c71946ecff6cba752ee096bcec1b24b195d24b9d16fddf2deb1eab3bd11f、旧global codument SHA05206bf05959d0b10420a6cc5b5e6d2d67a5ba5cadee5f46ec1c178d69ddc3f8、R3 SHA8fdf75af54b2f64a026db4cfee743ee027e8bf82456eedd0a3841492aeee9931均不变；原/副本harness同为671c554008dc9c8500a1e2902822e71fe15cc2769147b19fd41ac2ddf976ce1b。七个run auth/lock均不存在；用户原src修改保留，未写真实global/原codument，49165 registry保持。
- 完整最终报告见verification/terra-e2e-round45.md。测量已结束不等于业务全通过；按MissionLite保留业务节点blocked、长期mission active/未归档。下一修复候选和fresh测量批次需要明确决策，建议不增加既有hook/outer限额，不修改或恢复旧失败run。最终报告审计和preflight结果在下文追加。
- 记录勘误：E308手录fingerprint中`d5e9189`为笔误，实际UI2回执精确值为f59c6830e08506fc2b4e5e2eed93db07a79adade8d5d9189cd7d3455246036e8；原始回执未改。E309上一条的“节点blocked”是阻塞语义，不是合法节点枚举。首次preflight明确拒绝该枚举后已修正节点Status为active、独立Blocked on字段保存政策边界；长期mission未完成，不修改检查器或伪装done。
- 最终fresh Terra报告审计NO_GAP：直接核对Todo2 result/UI1失败/UI2通过/usage，与六个已审计终态root重算；七试次分母、首次1/7、最终2/7、formal/calibration/combined totals、unknown counts及非晋升诊断全部一致。NO_GAP只针对结果报告，不是业务全验收结论。
- 修正节点枚举后最终MissionLite preflight exit0，输出mission check passed。未执行completion或归档，因为业务验收未全过。此后只追加本检查结果，不改工作图/产品/harness。

### E310 — 五类E2E的编码能力下降归因分析

- 基于七个正式run的result/JSONL/外层review/UI/gap证据和旧e2e verifier源码完成只读归因，落verification/terra-e2e-coding-capability-analysis.md；没有修改产品代码、候选、测试case或任何/tmp业务workspace。
- 结论区分三层：旧新验收不等价造成的表观下降；pending Track发现/跨fresh handoff/文档型CommandOperation造成的真实有效交付能力下降；Stream/Blog/Ecommerce真实last-mile实现缺口。Nested主要是planner/validator与descriptor合同不对称，补充HTTP通过不晋升正式结果。
- 七run命令观察为508条，其中371条含depa-codument、284条为显式find/rg/sed读取；正式输入85217000中cached79704320（93.5%）。这些量支持控制面负担与重复上下文假说，但不单独作为因果证明或账单。
- DEPA裁决：Track XNL是versioned authority，默认list是省略pending的derived observation；impl consumer把局部projection用于完整发现。CommandOperation完成了入口标准化但workflow Processor仍由自然语言Actor重建。优先修receipt交接、精确resolve、task ContextView、合同schema与external oracle前移；不删除质量机制、不回退多Skill、不增加轮数伪造提升。

### E311 — 优化实施授权与检查点

- 用户明确要求先使用163.com author提交，再依据分析自主迭代；已创建ce0f2cb，author/committer均为kongweixian <kong_weixian@163.com>，无push。保存project源码、MissionLite记录及原有DEPA attractor改动；忽略的依赖/构建包不纳入。检查点保留既有空白格式警告，不冒称全量新验证。
- Round47工作图和design/execution-handoff.md记录先行垂直切片，MissionLite preflight exit0。新候选fresh测量已获授权，旧七个试次/失败/轮数不得改写或恢复。
- E310工具数量统计是已记录顶层成功phase receipt的可观测样本，不保证包含中断phase/所有子代理；不能据此宣称完整工具总量或净因果。旧/新仍无等价A/B。

### E312 — 精确交接切片验证

- 实现及设计见design/execution-handoff.md，完整过程见verification/terra-e2e-round47.md。两项fresh reviewer恢复P2均修复并复检无新问题；身份观察不替代正常严格状态/合同准入。
- 最终隔离副本完整check：typecheck/lint通过，672pass/0fail，7842assertions，141files；之前命令树期望遗漏的1fail保留记录。新candidate SHA61766e3625ec514d5b77dad671a24e60b88aec62ba7577e0b1b14f39e7e18334；harness a0e0c742cad1878e78f5c548c3a47ced062ffc069a343fabea852ea5facb6cd3。
- qlU8hG smoke十项PASS/modelCalls0；原codument和旧global指纹不变。实际Native Codex0.154.0，旧批次0.150.1差异已记录。无真实业务新PASS或token节省声明；下一节点新fresh todo/stream按原限额运行。

### E313 — 首个新Todo试次的基础设施中断

- qUXNoE的plan-0、implementation-0及外层HTTP/fresh review通过；同一add-todo-application身份成功交接。GapLoop纠正UI编辑与非法日期，AttractorCheck后置发现runtime/effect耦合并返工；由此追加前置正文引用优化。
- Ego TaskSpace4/p1真实注册、创建及literal输入观察成功；编辑prompt操作反复Runtime.evaluate超时，底层CDP拒绝dialog、reload后重试仍失败。只读CUA看到另一任务窗口，未操作。无完整UI PASS。Ego0.5.0.28更新需用户授权，不影响其它任务。
- UI15分钟deadline触发不恰当的业务纠偏implementation-1，控制器随后SIGTERM精确runner79915；子进程15176/15183及server2789已退出，run内复制auth已由finally清理。最终原result为infrastructure-failed，原日志和计数不改写；此trial不计作产品PASS或明确产品失败。补充typed infra分类防止同类无谓模型纠偏。

### E314 — 引用前置与infra分类切片收口

- 最终源码及负例经独立复检；修复正式Task后代profile漏读与坏controller receipt误入业务修复，两者不削弱hook/验收。simplify仅展开新增遍历以便审阅。说明与测量见verification/terra-e2e-round47.md。
- /tmp最终完整check通过typecheck/lint及677tests/7871assertions/142files；独立build156resources，candidate dad6afd6，harness dd530052；qFekDc smoke10PASS/modelCalls0。
- 使用原isolated-project.ts目录/权限/字节算法复核原codument仍b631c719，旧global字节仍05206bf0。另一个仅文件字节treeHash算法产生03a880ff，并非原件变化；与临时副本逐文件比较也无差异。
- 仅这两个源码切片验收通过，不代表经济性或真实业务验收完成。下一步新候选stream，不恢复旧run，也不等待浏览器故障阻塞无浏览器工作。

### E315 — 新Stream实际失败与下一轮调和

- aTb63U终态blocked，attempt0缺原始指定测试，attempt1在gap_round5仍缺原始B/C及三内容片段流测试，按配置停止。原result/terminal-policy保留，认证副本已清理。没有以内部8/13tests或NO_GAP覆盖外层实际失败。
- 新run成本及过程见verification/terra-e2e-round47.md：全可观测session输入18732405/cached17696512/output87752，不冒称输入下降或净改善。父session57次短wait及Python PATH偏差是新观测，支持新增源码切片。
- 原始需求对照、较长有界等待和已准入Python交接已实施；独立正反情境复核通过。新规不增加hook/owner/轮数或扩大到未选backlog。Skill结构校验通过；完整followup check还在运行，不能提前标源码切片done。

### E316 — 原始需求完整读取与低摩擦执行切片验证

- 最后EOF读取修正后的完整check exit0：typecheck/lint及678pass、0fail、7878assertions、142files、122.18秒，T日志.tmp/round47-followup-final-check.log。独立前向情境涵盖613行只读260行、明确批准章节范围、缺失原始测试、批准取消、聊天输入及局部backlog，复检通过。
- build156resources；最终closure候选SHA256 37eb59960d55aa3e6b6927861bd4e193198a33036a15f0bcae4acfafdb3b9db1；harness d8963ceafe72dcdc4f137fd6904b31e165c64c396d9be65beaddad420ed96f7c。kg6lrr无模型smoke十项PASS/modelCalls0。之前followup候选仅中间验证，不冒充最终源。
- 显式Python交接、较长有界等待、原始需求对照三个源码节点据此done；业务交付率与成本改善仍未证明，继续新冻结候选真实测量。原失败、预算、候选保留；无global安装、原codument升级或发布。

### E317 — closure试次暴露验收写边界缺口

- 9JWDGk完成原始测试收集16项及bridge、fresh review返回PASS，但review运行pip install "$PWD"后交付hash从742e9122…变为a3130fa7…；现有guard拒绝，不能晋升PASS。未保存逐文件before清单，具体变化集合不能仅凭两hash确定；review的build步骤是明确可见污染路径。
- 原runner错误把reviewer污染送入implementation1。父层观察后精确SIGTERM84459，22514退出；14857/14858也退出，复制auth不存在。原result终态infrastructure-failed，attempt0失败和attempt1中断原样保留；不恢复/重置。不把此trial当业务PASS，也不把验收者违规归为业务编码失败。
- DEPA调和：交付source/build/dependencies是冻结输入authority，review只产出观察。新增显式只读执行权限、把review输出置于已有隔离tmp；保留hash守卫，污染归typed基础设施失败而非业务纠偏。不通过扩大忽略范围或降低验收解决。

### E318 — 验收只读边界过线

- 实际Seatbelt拒写src/build/node_modules/新增交付文件，允许home/tmp/cache/.codex；fake Codex通过实际agentTurn将最终输出写入home/tmp，交付hash不变。污染类型命中infra分支，普通缺失测试仍为业务失败。定向3tests/12assertions通过。
- T最终完整check exit0：typecheck/lint及681pass/0fail/7891assertions/143files/115.30秒；ouOdBf smoke十项PASS/modelCalls0。日志.tmp/round47-review-isolation-{check,smoke}.log。harness4818dce278cf67b92d4a26cade4d6f7f7587e8d2bffad95fc364099e8d9e62f1，产品closure37eb5996未变。
- 该源码节点done；真实E2E及等待协议实际经济性仍未完成。新fresh测量保持Terra/medium和原限额；旧污染试次不恢复、不追认。

### E319 — 真实安全FAIL被命令识别错误遮蔽

- Jd0Vqx attempt0外层bridge0真实失败（SDK metadata省略未适配），attempt1修复后确定性验证通过。review1在只读源上跑原始测试，并复制到HOME/tmp验证editable install；没有交付hash污染，证明E318真实可用。
- review1实际返回文件工具越界读取的安全FAIL，但runner先执行isExecutedTestCommand。它只识别简单裸/绝对命令，不识别环境赋值和quoted变量venv路径，因此将有效pytest执行误报缺失，并在读安全结论前启动implementation2。原生session CommandExecution含精确argv与exit0，支持修复命令观察来源。
- 父层停止27451，runner86744退出；子52699/52700退出，auth不存在。原result=infrastructure-failed；两个实际观察到的业务缺陷及失败原样保留，不能把中断后的未知最终结果说成业务PASS或抹掉首次失败。
- 下一改向：同fresh线程原生argv观察；有限、无求值的常见命令识别与负例；先保留真实FAIL，无法准入PASS执行证据时typed infra停止，不让业务实现者修验收器。旧trial不恢复。

### E320 — 执行证据与实际入口协议切片过线

- 新观测器只读取已选fresh线程匹配session_meta/thread_id的原生argv/exit；有界词法识别quoted venv与环境前缀，不求值shell。字符串伪命令、查询、控制流、pipe、其它线程及缺失/失败执行负例通过。真实FAIL先保留；缺证据或矛盾PASS停止为infra。只读回放Jd0Vqx review1识别8条原生命令中的2条成功测试块，正确保留安全FAIL；不修改旧结果。
- 等待规范从未展开引用移到实际先读的SKILL入口，各operation仅路由；原样获批示例、已声明权限边界及完整当前AST避免强制重复装载。skill-creator独立Terra/medium前向情境通过：60秒/8秒deadline/timeout不计GAP/目标变化失效；原始缺省输入、非约束草稿、allowedRoot与明确无限目录需求正确区分。不新增hook/轮数/安全范围。
- T完整`bun run check` exit0：684pass/0fail/7929assertions/144files/105.66秒，typecheck/lint通过；Skill quick_validate通过；build156resources；SGP4yl smoke十项PASS/modelCalls0。日志.tmp/round47-entry-final-check.log、round47-entry-build.log、round47-entry-smoke.log。
- 新候选dist/depa-codument-r47-entry SHA5134e21d6253b29719c031664ce670d1c4b0fdb88eb59d8a911216ebfa02ad1b；harness c136de6df19158c1f471f8fd08fbf51109aacbad0cfdad3c52793226c0c877f0。旧候选不覆盖，旧bin哈希05206bf…保持，codument/无diff。
- Jd0Vqx终态成本补齐：input15,431,527/cached14,297,600/output109,752，313responses/18sessions；elapsed2,229,774ms。最终infra排除但成本保留，attempt0已知业务失败不抹去。两源码节点done，真实通过率/等待与成本改善仍须新候选测量，不由上述绿色推断。

### E321 — 脚手架模板子集可发现

- nMEIGO在读scaffold help后重现component模板拒绝，与9JWDGk一致。新增产品domain-contract不可变KNOWLEDGE_SCAFFOLD_KINDS；help及既有准入/错误投影使用同一词汇，renderer实现由十类生成测试约束。不是资源Kind清单，不收窄完整知识schema、不加side effect或运行时owner。
- S=/private/tmp/depa-codument-verification-TxnM9H/depa-codument/project，独立准备器复制12,487文件；原codument指纹b631c719…及旧bin05206bf…不变。复制dogfood升级仍review-required、0升级/226unchanged，不能冒称历史整体升级PASS。
- 定向8tests/155assertions；完整check exit0含typecheck/lint、685pass/0fail/7942assertions/144files/109.64秒。native build156resources，两类scaffold help显示模板子集；gjYZfF smoke十项PASS/modelCalls0。日志在副本父目录scaffold-{check,build,smoke}.log。非法component不写入、帮助无workspace副作用、历史stdout兼容、不可变合同均覆盖。
- 新binary ec81db745fce2ac812b5642625de24f5f70f91f016dbdcff8e1aea4e1e0906d9；活动nMEIGO仍冻结entry5134e21d…/harnessc136de6d…，不将其行为归因于新help。源码节点done，不宣称模型已因此少犯错或省token。

### E322 — 入口规则采用、提前检错与验收传输终态

- nMEIGO plan0完整读取原始需求；implementation0的独立verify在外层之前捕获最小SDK输入/主线消费缺口，后续还捕获重入事件顺序问题并复检；14tests、内部fresh verify/AttractorCheck及GapLoop1 NO_GAP后完成同一Track。原生记录8次wait_agent均60000ms，未再10秒短轮询。这证明采用和提前检错，不等于最终业务PASS。
- 外层确定性业务检查通过；review0实际pytest14通过，但所处同一执行块的后续诊断失败，其他成功块是循环/导入而非可准入测试调用。review返回PASS，strict执行证据guard正确拒绝；新infra分类立即终止，没有implementation1。原result=infrastructure-failed/单attempt，68037 exit1、auth不存在；不恢复、不追认。
- 最终elapsed1,587,676ms；全父子input8,837,949/cached8,176,640/output79,952，154responses/9sessions。费用是观测token不是账单；不以低于另一失败试次的总量宣称净经济性改善。原日志及T的.tmp/round47-stream-entry-report.json保留。
- 调和：producer未事前得到observer支持的执行形态要求；不扩大词法解析或接受失败块，改为只读agentTurn统一明确独立成功exec义务。先新增review-probe小型隔离fixture校准同一链，再运行完整E2E，避免用整次业务规划实现来反复调试验收传输。

### E323 — reviewer协议校准过线

- read-only agentTurn统一前置REVIEW_EXECUTION_GUIDANCE：单独test exec成功，不把随后诊断失败的混合块作为PASS证据；识别依赖文件中的本地/editable安装写入边界。原有词法负例、exit0、同fresh线程、只读source guard均不放宽。fake agent验证实际调用收到提示；定向6tests/48assertions通过。
- S完整check exit0：typecheck/lint、685tests/7944assertions/144files/112.56秒；RelwM7最终smoke10PASS/modelCalls0。日志父目录reviewer-protocol-{check,smoke}.log。冻结harness cf696740cec6c333c9a336099894c30eb42242455c1e49cfa03675ab73e40fdc，产品沿用E321 scaffold binary ec81db745f…。
- 新独立review-probe X01WIQ真实Terra/medium，54.638s，native-session观察到单独环境前缀/quoted venv pytest call exit0；source不变、实际model审计通过、auth清理。fixture为1个pytest测试包含空列表/带负数求和断言，不是Stream或其它业务验收；没有复用旧试次源码或晋升历史结果。
- 校准观测input96,610/cached76,544/output1,201、6responses/1session，单独报告并计入成本。此源码与传输节点done；仍需完整fresh业务测量，不能把小fixture通过率当产品交付率。

### E324 — fresh执行角色的操作加载边界

- 新94Yims冻结ec81db745f候选/cf696740 harness。plan0成功，implementation0内部12pytest、GapLoop2 NO_GAP、fresh verify PASS，但外层bridge-0以最小SDK envelope失败；保留原attempt0，implementation1按原预算继续。未修改运行中源码或模型交接。
- 原生session 01a0969e-b5ab-7a13-bdfa-d0df79d266e1（acceptance_verify）实际读取全局SKILL、项目AGENTS/SKILL，调用track verify并写报告；完整CommandExecution清单无verify操作正文或context-loading读取。父session 01a09694-921f-73a2-979d-d70df2e1a48b有depa-codument verify读取。spawn消息在原生日志中为encrypted_content，因此不能证明父层是否转述过具体规则，亦不能把此次漏检全部归因于路由。
- 源码verify同时面向父层与执行者，但fresh注入清单只列范围/路径/报告/禁止项，没有明确交接操作入口和当前角色。调和为窄修复：入口按角色自行加载对应操作；verify执行者不再递归spawn。规则仍由单一操作正文拥有，不在SKILL重抄最小输入规则，不新增检查或轮数。

### E325 — 独立执行角色入口切片通过

- 全局SKILL按需路由收到委派的子层读取当前操作；verify显式区分父层和fresh执行者，交接操作入口但不注入预期PASS。evidence plan是检查起点而非只准跑所列命令。只改两份指导资产，无新增资源/状态owner/检查/轮数；现有适用合同仍为authority，父层摘要不替代它。
- skill-creator授权的独立Terra/medium verify_child_entry_forward实际调用候选源码CLI `verify --json`并读取context-loading等适用引用；对ingest-record情境保留省略record_id原始硬要求，不以预填字段pytest全绿证明省略语义。区分父层spawn与已委派子层实跑。该测试只请求接手动作、未执行fixture或给业务PASS；不扩大其证明范围。
- 新隔离U=`/private/tmp/depa-codument-verification-9UW083/depa-codument/project`完整check exit0：typecheck/lint、685tests/7944assertions/144files/116.67秒。Skill quick_validate过线、git diff --check过线。simplify自检保留两文件窄路由，不复写完整规范或另添抽象。
- 原codument/及旧global codument指纹不变；U复制12488文件，复制后的历史升级仍review-required/0升级/226未变，不算迁移完成。构建156BunFS资源，bin SHA32d55b127b6dca2771b4bf66c8771e46a7fce471112526df0ba8f2cefe4da57f；harness沿用cf696740cec6c333c9a336099894c30eb42242455c1e49cfa03675ab73e40fdc。PqxplB smoke10PASS/modelCalls0，日志U父目录child-contract-{check,build,smoke}.log。后继真实业务测量仍独立，不追认94Yims旧attempt0。

### E326 — 过滤发现清单造成独立验收误报

- 94Yims implementation1完成原GapLoop5 NO_GAP、15pytest和外层bridge0…7；review1实际pytest/bridge通过，但最终唯一FAIL为“必需.env.example不存在”，声称内部报告不实。runner依法保留FAIL并进入原预算内implementation2，没有控制器改判。
- 只读重观察推翻该缺失归因：implementation0 item9有.env.example创建事件；原文件birth/mtime为2026-09-12T17:07:28.497Z，早于review1，文件在原workspace存在。review1用默认`rg --files`过滤清单，未直接检查目标路径；implementation2自行`ls -la .env.example`并读取原文件，无需补造。控制器先前即时评论称“新的真实缺口”不成立，已明确更正；不能拿这次误报支持编码能力下降。
- 调和：发现用清单是衍生观察，不拥有文件存在性裁决权。内部verify/外部review在声明某路径缺失前须直接核对该路径，区分ENOENT、权限和清单过滤；不扩大读取其它隐藏私人文件。不让机器启发式自动否决真实FAIL，不重置原attempt预算。下一切片先小fixture真实校准再测完整业务。

### E327 — 94Yims完整Stream终态通过，保留真实失败与验收误报成本

- 64549自然exit0，result.status=passed/firstPass=false，elapsed2,708,443ms。冻结ec81db745f…产品/cf696740…harness；不包含后来的f517710角色入口或路径观察切片，不能把当前成功归因于那些未加载的改动。
- attempt0最小SDK输入真正失败；attempt1代码修复后15pytest与全部外层bridge通过，但review1误报已存在的.env.example缺失（E326）。attempt2自行确认原文件、重新验收后通过，最后fresh review/source不变/model审计/需求与Skill指纹检查均过线；没有第四attempt、没有重置GapLoop5，auth已移除。
- 全父子观察usage：input15,879,199/cached14,606,848/output126,453；324responses/20sessions，均有usage。原始结果与失败不改；S父目录stream-calibrated-report.json保留。此候选单样本首次0/1、最终1/1，不推断总体通过率、与旧Codex不同版本的严格A/B或净token节省。
- 调和：质量机制实际捕获代码缺口且最终闭环有效；同时内部漏检及外部误报造成真实额外成本。继续验证窄边界修复与Nested，不删除fresh/hook来消除这部分开销。

### E328 — 文件存在性观察切片与真实校准过线

- 内部verify Exists及外部review producer明确目标路径直接核对义务；过滤发现清单不是不存在的证明，权限错误不能伪装缺失；仅检查已在scope中的目标。不增加状态owner、不机器改写模型verdict、不取消真正缺失的FAIL。
- 独立Terra/medium verify_path_existence_forward在/private/tmp/depa-codument-path-review-2o44Zf按现有操作的Exists子步骤实际检查：隐藏.example.conf存在PASS，usage.md不存在FAIL，未修改任何交付。这个情境验证存在/确实缺失，不声称覆盖所有权限错误。
- 新V完整check exit0：typecheck/lint、685tests/7944assertions/144files/109.97秒；Skill quick_validate、diff whitespace检查通过。simplify自检只扩展既有producer义务和小fixture，无额外通用层或语义guard启发式。
- V native156资源，SHA1f881714cd8930fdbbfb1a87708bdd2b75cd17bf598f3f85fa6a6ee33ade3059；harnessd8e0025d6519490666a451135815e0ee4d2a2e0ba69e77fbf27561fcf63a11a2。真实probe f1qOnJ PASS/native-session：直接核对.env.example、独立环境pytest成功、source不变、model审计通过、auth清理。55,067ms，usage89,844/78,592/1,573，5responses/1session；不是业务PASS或零成本smoke。
- xmbVos最终smoke10PASS/modelCalls0；日志V父目录path-observation-{check,build,probe,smoke}.log及probe-report.json。V复制前后原codument/与旧global bin指纹未变，副本历史升级仍review-required。后继fresh业务测量才能判断实际误报/漏检与净成本，旧试次保留。
