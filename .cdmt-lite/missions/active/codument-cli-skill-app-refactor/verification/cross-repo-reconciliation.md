# 跨仓实施来源账（Round 11）

用户已确认跨仓设计。执行状态仅在 loop.md；本页是来源选择和回退边界，不是第二工作图。

## 不可变输入

`cross-repo-baseline/{H,C}.json` 列逐文件 hash/mode，匹配 E103 的 658/1207 文件摘要；相邻 `.json.gz` 保存全部 eligible bytes、symlink target、缺失标记、HEAD/status。原始 lock、dirty tracked 与 eligible untracked 均在其中。`cross-repo-baseline.ts check` 验证恢复字节并报告后来变化，绝不自动恢复。原 dirty clone 的历史 filewise base 仍 unknown，不伪造三方 merge。

H=Halfcode 当前源树，C=project 当前抽取树；C 快照还保护旧 src/codument。每个下表输入路径都通过 JSON 中同一路径的 hash 精确定位；目标实际输出只在对应移植 receipt 生成后记录。

## 逐能力来源选择

| 目标/单元 | 来源及处置 | 不可丢失的独立变化 / 验证 |
|---|---|---|
| T01 CLI contract | 采用 C `packages/cli-host-contract`；H 同义输入 `packages/cli/src/cli` 和 `packages/cli/src/platform` 保留 | ports/execution metadata；所有导出文件逐项 receipt，H 产品未切换 |
| T02 CLI logic | 采用 C `packages/cli-host-logic` | parser/options/dispatch/placement/install 纯逻辑；迁回所有该包 tests |
| T03 CLI support | 采用 C `packages/cli-host-support` | ResourceEffect 路径安全、嵌入文件、backup/process；支持层仅借公开纯 codec，不复制 codec |
| T04 CLI capsule | 人工拆分 C `packages/cli-host-capsule`：index/shutdown/service/codex 留 T04 | retry/drain/all-owned-close；resources/sop→T12，Page/live→T13，HTTP组合→T14；未选文件不丢失 |
| T05 argv shell | 人工拆分 C `packages/cli-host-shell`：index 留 T05 | page-http/event-stream→T14；安装闭包不能保留 Hono/Skill App |
| T06 resource contract | 人工组合 C/H `packages/skill-app-contract`，先暂缓覆盖现有 H 目录 | C 23 exports/H 7；同 2.0.0 不同 owner；distribution rename 不改 resource.ts owner/subject/hash。先定义可信 profile，再迁源码 |
| T07 resource logic | 采用 C `packages/skill-app-logic`，对照 H `packages/cli/src` 同源规则 | 本地 capability placement、Kind renderer/schema/reader；公共 consumer/负例 |
| T08 resource support | 采用 C `packages/skill-app-support`，对照 H `packages/cli/src` | C SQLite closed-state、catalog-owned cache、LF pinned close 保留；captured closure 修复后继 rec-04，不假装已修 |
| T09 browser support | 采用 C `packages/browser-support`，对照 H `packages/cli/src` | web-api loader/debug 接缝、backend fail-closed；测试不打开真实 browser |
| T10 Vue support | 人工组合 C `packages/page-builder-vue` 与 H `packages/page-builder-vue` | C public ports/worker diagnostics；H page-sdk-vue 的两组 injection key 原字节保留；其他 legacy bridge 待验 |
| T11 MCP capsule | 人工组合 C `packages/mcp-app` 与 H `packages/mcp-app` | C 显式 transport 与 connection close/failure 协议保留（close 会释放已连接 transport，并非不关闭它）；H stdio default 留产品层；不自动变 HTTP |
| T12 Skill App capsule | 拆分 C resources/sop 与 private runtime 的资源/按调用闭包 | 不依赖 T09–11/13/14；Kind/loader admission 与 close 测试 |
| T13 live capsule | 拆分 C Page capsules/private runtime，当前暂缓至 rec-03 | first-use concurrency、drain、失败释放；不做空 placeholder |
| T14 HTTP shell | 拆分 C page-http/event-stream/http capsule/private typed LF ingress，当前暂缓至 rec-03 | server 重新 admission、identity/digest/Origin、无通用 argv RPC |
| 产品/领域/模板 | 保留各仓自身来源，暂缓至产品采用节点 | C 4 domain 包不迁上游，正式 codument/ 不变；3 暂停命令不动 |
| clone | 人工组合 H/C `scripts/clone.ts`，暂缓至专属节点 | H allowlist 保留；C replacement precedence 保留；新增 full eligible 模式不漏原 lock |
| release/build/test | 人工组合两仓 `scripts` 与 manifests，按库 gate 分批 | structural metadata equality、builder 实际资产/嵌套 workspace 问题不得靠删断言；native 产品名不重命名 |

## 身份值账

现有 C `depa-codument-skill-app-contract@2.0.0` 与 H `@halfcode-cli-lite/skill-app-contract@2.0.0` 的原 package.json（包括 exports）、resource.ts、package-protocol.ts、host-resource-contracts.ts 均保存在各树快照。`Halfcode.ResourceKind.*` subject 与 compiler/schema/owner 指纹保持原字节来源；`globalThis.Codument` / `HalfcodeCliLite`、Vue Symbol.for key 是另外的 API 轴。不得借 CLI 五包（无语义 owner）的 import rename 扩大为 resource 身份替换。

新 CLI 五包使用独立实验 library 版本 0.1.0；这是本地待验证制品版本，不是 Codument 产品 0.6.0 或已发布版本。后续资源 package 版本及兼容映射必须单独验证。

## 写入前与回滚

- 每批新增路径先检查不存在；已有路径对照 snapshot hash 后才改。遇新修改只阻断相交单元。
- 每批移植 receipt 记录 C 输入 path/hash、H 目标 path/hash、精确 import/exports/依赖变换。不是整树覆盖；未移植能力继续留在快照/旧源供后续迁移。
- 采用前 H 原私有产品实现和 C 全部旧通用源保持不动；新公共实现只在 H 演进。不得在 C 再实现同义功能。
- 回滚需要对本批 output hash 复验后撤回本批新增/修改，或留实验代码；若有随后用户改动先人工调和，禁止 reset 工作区。不会自动恢复真实 workspace，也不会改全局安装。
