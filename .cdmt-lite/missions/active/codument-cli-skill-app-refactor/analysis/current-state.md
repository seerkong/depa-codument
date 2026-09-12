# 当前事实与迁移边界

证据定位默认相对仓库根，建档基线见 `../evidence.md`。以下都是当前检视结果；目标设计另列。

## 两套实现

- 根产品 `package.json`：`depa-codument@0.5.4`，两个 bin 指向 `src/cli/index.ts`；compiler `0.2.8`。`src/cli` 63 文件、550,823 bytes。
- `project/package.json`：克隆骨架 `depa-codument@0.1.0`、private workspace；compiler 在 CLI/Skill App contract 包使用 `0.3.0`。`project/packages/cli/src/cli` 90 文件、703,543 bytes。
- 克隆总计 629 文件，来源是明确授权的 dirty working tree；不应再次 clone 覆盖本地。源 HEAD 仅是参考，不能代表完整快照；clone tree hash 见 evidence。
- 根有 node_modules，`project/` 尚无 node_modules。克隆基线未经 install/check；不能假设新旧两个 compiler 直接可互换。
- 根既有修改 `src/templates/codument/std/attractors/depa-attractor.md` 来自用户/其他工作，本次不覆盖。

## 关键证据

| 编号 | 证据 | 事实与影响 |
|---|---|---|
| F1 | `src/cli/utils/index.ts:9`、`:14` | workspace 为模块可变值且 `process.chdir`；嵌入多 workspace Host 前需显式 root/runtime |
| F2 | `src/cli/runtime.ts:5`、`src/cli/commands/upgrade-workspace.ts:61` | 已有 effect 注入起点，但升级命令仍直接备份、读写、移动并输出；应沿既有边界拆分 |
| F3 | `project/packages/cli/src/cli/contracts/command.ts:1`、`:98` | contract 引用 runtime/effects 内部类型，且含 argv parser；公开契约与处理实现尚混在同文件 |
| F4 | `project/packages/cli/src/cli/runtime.ts:36`、`:49`、`:108` | 组合 root/installed sources、browser、page builds、workflows；没有 codument source 配置，需应用传入发现策略 |
| F5 | `project/packages/cli/src/cli/command-registry.ts:1`、`:127`、`:482` | 品牌、产品命令集合、分发和 runtime 创建集中；可复用 engine 应接收命令集合和 identity |
| F6 | `project/packages/cli/src/cli/resources/workspace-resource-catalog.ts:1`、`:419`、`:526` | 文件扫描、资源解析、App/Module package materialization 混合；需要 ports + logic 分离，保留 membership/fingerprint 检查 |
| F7 | `project/packages/cli/src/cli/resources/host-resource-contracts.ts:43`、`:135`、`:148` | Host 内置 Kind/reader composition 已存在，但集合固定为通用 Kinds；产品扩展要贯通 registry/profile/catalog/命令而非仅扩展 union |
| F8 | `src/templates/codument/manifest.xnl:1`、`:6`、`src/cli/kinds/registry.ts:5` | 当前为 ResourcePackage 且分发 KindDefinitions，CLI 从模板生成 registry；目标要改变 schema authority 方向 |
| F9 | `src/cli/migrations/index.ts:92`、`:181`、`:240`、`:363` | 已有 migration registry、inspect/plan/apply/verify 和语义 review receipt；有旧 XML/XNL/Markdown 入口 |
| F10 | `src/cli/track/verification.ts:28`、`:40` | 按 command/workspace fingerprint 缓存成功 receipt，已有 `fresh` 旁路；优化不能再建无来源缓存 |
| F11 | `src/templates/codument/std/operations/impl-track.md:94`、`:19` | 实现入口要求多份上下文；普通实施自主，但 GapLoop/AttractorCheck/verify 保留 fresh 要求 |
| F12 | `src/templates/codument/std/protocols/attractor-check.md:7`、`:36`、`:46` | 每次 fresh；GAP 修复后新 reviewer；同一 hook 点两种机制按配置顺序独立执行 |
| F13 | `project/packages/cli/src/cli/install.ts:24`、`src/cli/commands/upgrade-workspace.ts:76` | 骨架默认只装 Codex；旧产品保留历史 agent 配置。直接替换 installer 会丢旧安装目标 |
| F14 | `project/package.json` test script | 默认 test 只涵盖 cli 和 mcp-app；skill-app-contract、page-builder-vue 自有测试不能因沿用顶层脚本漏验 |

## DataTopology

| node | semantic_role / authority_model | owner / transition | relation 与迁移要求 |
|---|---|---|---|
| Track/Mission 正式资源 | current_authority / durable filesystem authority | Codument 领域生命周期规则；CLI 是写入边界 | ready/wave/status 是派生读视图，禁止回写替代正式资源 |
| behaviors/modeling/engineering | canonical semantic/structural authority | 相应领域 owner；registry 校验/merge/promote 边界 | AI 编候选；CLI 确认结构与事务，不替人裁决产品语义 |
| decisions/memory | 决策记录与知识 authority | decision owner/知识晋升规则 | 保留 stable IDs、业务 owner、嵌套关系与来源 |
| 内置 Kind schema/readers | contract authority / versioned package | Codument/通用资源包的版本发布与 Host admission | workspace 声明实例；不能靠复制定义授予信任 |
| SkillApp manifest | authored resource membership authority | workspace author，经 writer/validate 边界 | catalog、resolved tree、界面和 ContextView 从它派生 |
| receipt | historical_record / sealed verification observation | 实际命令执行 + receipt 封存 | 可核验 freshness；receipt 不等于语义验收 verdict |
| backup/checkpoint | recovery_material | migration/transaction support | 完整备份用于恢复；是否属于 authority 必须由恢复阶段明确 |
| ContextView/continuation | derived_observation | 由正式资源、当前代码与有效证据产生 | 带来源与版本；失效重建，不可成为第二可写真源 |
| 本 Mission Lite | desired authority / versioned files | MISSION+attractors；循环只改 loop/evidence | 与产品 mission.xnl、clone 自带 dogfood 隔离 |

physical write site ≠ transition entry ≠ authority owner。多个受控写入入口不自动构成多 owner；文件落盘也不意味着已经获得领域语义授权。

## 不得遗漏的能力清单

| 能力族 | 旧入口/材料 | 新归属与验收主题 |
|---|---|---|
| init/upgrade/skills/AGENTS | commands/init、upgrade-*、utils/install、templates/skills | 产品 workspace installer；保留多 agent 配置和非受管正文 |
| list/show/status/strict validate | commands/list、show、status、validate | 单一 resource/领域 read model；旧 CLI JSON 契约回归 |
| Track/Mission scaffold/lifecycle/DAG/gates | kinds/registry、resources/lifecycle、commands/scaffold/lifecycle | domain contract/logic/support；无第二执行状态 |
| 嵌套 mission、TrackLink、ProjectRef | mission/nested、project/bindings、commands/project | 跨 root 显式 runtime；不破 owner/reference 解析 |
| Behavior/BehaviorPatch | behavior/*、archive | 增量、提升、冲突拒绝和归档后行为可读 |
| Decisions/modeling/engineering | decisions/*、modeling/*、engineering/*、xnl/merge | 递归 registry、三方合并、frontier、来源与未知字段 |
| 验证、GapLoop、Hook、AttractorCheck | track/verification、std/operations/protocols、config | 执行顺序、fresh、round/exhaustion、receipt、失败路径 |
| archive/artifact/std lint/memory | archive/staging、commands/archive/artifact/std、std 操作 | staging/提交/恢复与显式同步，知识提升开关 |
| Host 通用能力 | project 的 Resource/SOP/LocalFunction/Page/PageBundle/Site/BrowserWebApi/PageWorkflow/PageObject、MCP App、Serve/config/install/release | 抽成包后保留资源发现、动态 bundle、配置及运行通路 |

上述为族级分析清单。实施基线节点还须导出完整 commandPaths、选项/JSON/退出码、Skill 路由与测试对应表，防止只按命令名粗略认定等价。
