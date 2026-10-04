---
envelopeVersion: halfcode.resource-envelope/v1
specVersion: 1
kind: CommandOperation
metadata:
  fqn: Codument.CommandOperation.ImplTrack
spec:
  command: impl-track
  description: "Implement a track task graph with validation and lifecycle hooks."
---

执行位置保持目标项目；@/ 表示项目根。references/std/、operations/、references/ 相对全局 depa-codument Skill（默认 ~/.agents/skills/depa-codument，CODUMENT_HOME 可覆盖 home）；裸 config/、tracks/ 等相对项目 codument/。以下是当前 Agent 要执行的指导，不是已经完成的业务结果。

# impl-track（执行任务）

按 `track.xnl` 的 TaskSpace / Schedule / Hooks / Ports 推进已批准 Track。XNL 是状态 authority；wave、统计、续跑位置均为派生视图，不另建 index.md/state.md。

## 0.0 角色与总纲

track executor 决定状态转换，经 CLI 写回；普通叶任务按边界、文件重叠、上下文连续性、真实并行收益和运行时能力选择 local / delegated，DAG 不强制 fresh-spawn。小任务、顺序依赖、同批文件或无协作能力时优先 local。独立且可并行、大上下文或用户明确委派时可 delegated。

local 与 delegated 均需 acceptance、目标命令、行为基线与 diff 证据。GapLoop、AttractorCheck、depa-codument verify、用户要求的独立审查仍使用 fresh context。不得拿 worker 自述、历史 receipt 或上下文摘要替代当前语义判断。

关键 phase/wave 结论、指标、环境约束、失败归因与机制漏洞追加 `analysis/findings.md`；状态只在 XNL。当前 authoring 用无前缀 XNL、snake_case；legacy 输入先 `depa-codument upgrade-resource <path>`，review 则走 migrate，不在执行器猜版本映射。

## 1.0 前置检查与 track 选择

### 1.1 设置检查

必需项目的 `@/codument/manifest.xnl`、`@/codument/attractors/`，以及全局 Skill 的 `references/std/`。缺项目资产提示 init；缺全局标准提示 init-global，不继续选 Track。

### 1.2 交互边界

提问按 `references/std/protocols/questioning.md`，不为测试工具或每个 phase/wave 例行提问。仅在 Track/phase 选择含糊、HumanConfirm 的 before/after、失败需要用户取舍、独立交互续跑 ACTIVE 任务时询问。能在当前边界安全修复则继续。ACTIVE 的 auto/mission 例外见 §3；不可逆外部动作的权限不被 auto 替代。

### 1.3 选择 track

- 有明确 id（包括交接receipt、Mission TrackLink、已完成/取消/归档的显式续跑）：先 `depa-codument track context <track-id> --json` 只读定位，读取identity、contract及适用来源，再运行 `depa-codument track transition <track-id> in_progress`；CLI 从 pending/active/archived 按资源 id 唯一定位，使用 receipt.directory 重新加载。无匹配或多个 authority 请求澄清，不能创建替代Track。
- 无 id：先读取 `@/codument/tracks/pending/` 与 `@/codument/tracks/active/` 中的 `track.xnl` 身份及根状态；旧 `list --json` 只列active，不是完整候选发现。只有唯一未完成且已获实施批准的候选才能按明确id继续；多个候选按用户/父Mission目标消歧，不能选列表第一项。无可选或全部完成时，独立调用通知用户；mission 子流程返回缺失/完成事实，由父层 reconcile，不自动新建Track。
- phase 参数含糊需用户选择；缺省从首个未完成 phase 续跑。不要手工移动 authority、改根状态或撤回归档已晋升的 durable 产物。

### 1.4 mission 候选激活

candidate TrackLink 由 MissionApplier 先 `track transition <track-id> in_progress`，再 `mission bind-track <mission-id> <task-id> <track-id>`。用成功 receipt 的真实目录并立即实现；只有显式 gate 停在激活点。

## 2.0 加载 track 上下文（step 1）

`track context <id> --json` 给出同一XNL authority的完整合同AST、ready任务及来源位置，可直接读取其当前TaskSpace/Schedule/Hooks；不必为了身份和ready反复完整读文件。它不是完整外部引用闭包，也不是批准或验证成功。sourceRevision仅供当前repository实例CAS，不能跨调用用作缓存key；状态/配置/证据变化后重观察。以下适用伴随文件和引用仍必须读取。

在第一次设计/编码前，读取context.attractors中enabled=true的每个ref正文（`skill://depa-codument/` 指当前global App根）。只读profile配置不等于读过其规范。缺失/未解析引用需先定位或修复，不得延迟到末端AttractorCheck才首次加载；disabled或未引用profile不因此激活。实际hook仍在原生命周期点独立fresh执行。

宣布目标，幂等 `track transition <track-id> in_progress`。完整读取：

- Track 当前完整合同（已完整读取且仍有效的 context AST 可直接使用，否则读 `track.xnl`；需源注释/原文细节时再展开），以及 `proposal.md`、`design.md`（当前 Kind 必需）。不为形式重复装载同一合同的两种表示。
- `analysis/findings.md`、`analysis/knowledge.md`（如存在）；根 `decisions.xnl` 与递归 `decisions/**/*.xnl`（如存在）。
- `references/std/methods/workflow.md` 的“目标—观察—行动”、`references/std/methods/tdd.md`、`references/std/methods/dag-execution.md`。
- 本次实际适用的 input MaterialBundle、前置产物、代码测试、hooks/profile/attractors；按 `references/std/protocols/context-loading.md` 保留来源索引。

必需文件缺失则阻断受影响任务；不能用摘要补造。读取 Track 根 `commit_mode=auto|manual`。知识与源发生变化时重读适用闭包，不因 continuation 有结论就跳过。

启动或续跑时，用原始意图、已确认取舍和当前项目证据校准目标理解，区分已确认约束与实施路线假设；只把实际影响下一动作的理解、关键未知和观察依据记入已有 findings。批准的计划不能替代目标，也不能因实现困难撤掉已确认承诺。

## 3.0 续跑检测 / 中断恢复（step 0）

从 XNL 找 ACTIVE 任务与上一个 DONE 任务；无 ACTIVE 则首个未完成 phase。ACTIVE 时：
- `question_severity=auto` 或 mission 子流程：原地续跑，不提问。
- 其它独立交互：问继续 / 重做 / 跳过。重做经 `track task transition <track-id> <task-id> NOT_STARTED`；用户选择跳过才写 ABANDONED。
- 已有实现但还没 executor verification：第一件事客观复核（§6.4），验证前不得 DONE 或直接前进。

另外检查上一完成节点：`task complete` 已写 DONE、但 task:after 尚无当前有效完成证据时，先补完该 task:after，再运行 ready/推进后继。phase:after 仅在所属 phase 的所有应执行子任务完成调度、实际已到 phase:after 边界时补；phase 内仍有未完成任务则继续其调度，不能提前执行 phase:after。DONE 仅表示完成命令成功，不证明 after hook 已运行；fresh hook 不接受旧文本 PASS。此恢复不手改 DONE，也不新增 hook 状态字段，证据仍放现有 findings/report；无法取得必要依据按 §8 协调。

## 4.0 phase 主循环

按第一层 TaskGroup 的 order 从恢复点执行：phase:before → schedule-level（§5）→ phase:after → Gate。开始实现时运行当前 Track 的 track:before；恢复时依据真实 hook 证据和适用协议，不把过期文本 PASS 当本轮 fresh 结果。

有 Gate 的 phase/嵌套 TaskGroup 选可重复验证命令，运行 `depa-codument track task complete <track-id> <group-id> -- <gate-command>`。CLI 在直接子节点终态且验证有效时勾选 Gate 并写 DONE。多个检查收敛进 verify script 或显式 `sh -lc 'a && b'`，失败走 §8，不创建检查点。

auto 模式门控成功创建 phase 检查点 commit + Git Notes（§9）；追加 findings（门控、spot-check、指标、失败/修复事实），按 knowledge-tiers 判断晋升。所有 phase 通过才执行 §10。

## 5.0 层内调度（顺序 or DAG）

调度只针对当前非叶节点的直接下层。默认按 order 顺序；`child_mode=dag` 才按对应 `Schedule/Dag {for=...}` 的 Node/After 算入度和拓扑 wave，完整规则由 `references/std/methods/dag-execution.md` 拥有。

每批 ready 叶子走 §6，非叶递归本节；遵守 max_concurrent，不能安全并行时顺序执行。收集真实结果并完成验证；spot_check 启用时复核指标、行为基线、diff 和前序 wave 未被污染。无论是否委派，不能用自述放行。成功后 auto 创建任务/wave 检查点；manual 提示适时提交。更新后继入度、追加 wave 小结，继续下一批。全部失败或依赖阻断走 §8。

## 6.0 执行叶任务与状态写回

顺序固定：宣布 id/name、Description、Acceptance → `track task transition <track-id> <task-id> ACTIVE` → task:before → 选择 local/delegated 并实现 → executor verification（§6.4）→ task:after → writeback（§6.3）。

### 6.1 执行策略

按 §0 判断并简述理由，不新增持久化 execution-mode。delegated 只传 track_dir、task id、Description/Acceptance、MaterialBundle 与前置产物路径/引用；worker 自读，不注入实现者结论。

### 6.2 任务执行契约

两种策略都读 input MaterialBundle、前置产物、Acceptance、tdd、findings、根与递归 decisions。按 TDD 实现；重构/类型/迁移先做 characterization 或等价行为冻结。由 Acceptance、MaterialBundle、proposal/design、目标模块和工作区现状推导预期改动面，逐项取证。保留用户及其它工作流改动；外部不可逆操作缺权限按 §8 协调。

在当前合法 ready 任务和授权边界内，依据最新证据选择能证伪关键理解或连接假设的最小观察、隔离实验或连贯实现切片，并在行动内验证。遵循 `references/std/methods/workflow.md` 的“目标—观察—行动”；若观察否定了任务前提或切片顺序，走 §6.2.1 受控修订，不绕过 Schedule、已确认约束或配置 hook。

worker 不写 track.xnl、acceptance checkmarks、findings，不创建 task/phase commit；只返回产物、真实命令、未验证项和 blocker。子流程返回不是父 mission 的停点。

### 6.2.1 Scope drift 协调（开始与收口必做）

预期改动面是可更新假设，不是文件/命令白名单。意外工作分类：
1. 目标内、局部可逆：记录原因、更新范围并继续。
2. 计划/authority 假设失效：读受影响真源，受控 revise 或交 MissionReconciler；验证后继续。
3. 新产品决策、不可逆外部动作、缺权限/输入：HumanConfirm 或真实阻断。

收口读 git status/diff，区分本 Track、用户/其它流程、生成物、无法解释的改动；前三类保留并验证，最后一类先查证，影响验收才升级。不得回退他人工作以清 scope。前两类不增加 mission 返回点；子 Track 返回后 MissionApplier 继续 ready operation。

### 6.3 状态回写

§6.4 成功 receipt 已写 DONE/Acceptance/时间，不重复 transition。运行 `depa-codument track ready <track-id> --json` 观察下一项；无 Gate 的父组由 CLI 汇总，有 Gate 的组经 §4 完成。auto 按 §9 提交并记录 Task.commit；报告验收与 commit 证据后继续，不把报告当停点。

### 6.4 Executor completion verification（所有策略必做）

1. 重读当前 Acceptance、执行证据、git diff；检查范围与每条预期语义。
   按 `references/std/protocols/context-loading.md` 对照本任务适用的原始硬要求与契约示例的原样输入；明确要求保留的测试需检查实际 test collection，未被收集的必需用例不能由其它测试 exit 0 代替。
2. 逐条把本 Task 的实际承诺与 Acceptance 映射到可重复的行为验证命令及断言，再执行：从承诺的合法消费入口施加真实输入或操作序列，观察预期结果与相关状态效果，并检验适用的边界、负例、逐步效果与时序、建立/执行/结束阶段的异常和资源生命周期不变量。只检查当前任务实际承诺，不强加无关场景；一个成功路径不证明所有承诺性质。只检查源码字符串、文件存在、编译成功或内存替身，不足以证明这些运行行为；缺少相关真实验证就是证据不足，应在 DONE 和最终 hook 前补齐。
   真实边界可在授权的隔离环境验证；模拟或替身的通过只证明其覆盖的局部性质，不能代替已承诺真实入口或运行边界的证据。若承诺资源范围/权限隔离，用隔离测试资源验证允许与越界拒绝；“安全/低风险”等承诺需落实到可检查的边界，不扩展为通用安全审计。
3. 确认无无关运行时改动；声称行为不变须逐项核实删除/替换语句等价。worker 声称“旧问题/非我责任”时，以错误性质、HEAD 对照、独立复现、时间或 diff 归因验证。
4. 通过才 `depa-codument track task complete <track-id> <task-id> -- <verification-command>`；CLI 执行或复用同命令且内容前提有效的成功 receipt，原子写 DONE/Acceptance。不得以 `;` 分隔失败检查与完成写入。
5. findings 记录 receipt id/reused、命令、diff、覆盖和未验证项，继续 task:after。失败可修则保持 ACTIVE；不能继续才 `task transition ... REFUSED` 并记录 blocker。Track Task 没有 BLOCKED 状态。

普通本地执行不为形式再派代理；显式独立检查仍必须 fresh。receipt 仅证明确定性命令，不证明 acceptance 语义或 hook 已执行。

## 7.0 生命周期 hook

只执行已配置的 Hook：track:before|after、phase:before|after、task:before|after。匹配 on，按 XNL 顺序逐项执行。嵌套顺序为 phase-before → task-before → task-after → phase-after；未配置则静默继续，不例行提问。operation-hooks.xnl 的显式 operation point 同样按其配置执行，不因成本优化略去。

- HumanConfirm：先做自动检查（测试、覆盖率≥80% 或 workflow 阈值、lint、每条 Gate Criterion），给任务/测试/覆盖率/lint/Gate 报告，再按 questioning 协议等待人工确认；失败修复后重新确认。
- GapLoop：交父层按 `operations/gap-loop.md` 双角色协议执行；实现 agent 不在原上下文自判。
- AttractorCheck：使用 hook.use 指定 profile，完整遵循 `references/std/protocols/attractor-check.md`；PASS 继续，GAP 由 executor 修复验证后新 fresh reviewer，BLOCKED 按 §8。不能与 GapLoop 合并 verdict。

### 7.1 GapLoop 双角色交回

phase:after GapLoop 交父层编排；子 Track 时该父层先是 Track executor，收口再交 MissionApplier。每轮前 `depa-codument track gap-round <track-id> <n>`。按配置 max_rounds/on_exhausted/verify_round：FIX_APPLIED 后新 fresh 轮，NO_GAP 按 verify_round 收口或轻量确认，BLOCKED 交父层协调。完整输入/报告/耗尽语义只由 gap-loop.md 与 validation.md 定义，不改轮数。局部 verdict 不等于 mission 返回；须父 mission 无法重规划或改走 ready 分支才真实阻断。

## 8.0 失败处理

先按 `references/std/methods/workflow.md` 的“目标—观察—行动”判断失败否定了目标解释、实现、观察前提还是交付协议，再由对应 owner 修复；观察条件不成立或证据不足时，不能自动归为业务失败并修改业务实现。复验需有新信息或前提变化，并覆盖原 finding 及受影响范围；无新依据不原样重试。失效 receipt 撤回效力并关联替代证据，保留失败历史，不删除收据或重置轮数。

能在当前任务边界安全修复则继续。mission 子 Track 无法修复时记录 findings 并向 MissionApplier 返回失败类型/原因/建议，由父层重规划、换分支或真实 blocked；不默认向用户提问。

独立交互需要取舍时：
- 任务或完成验证失败：不能继续的分支写 REFUSED，记录 blocker、步骤和日志；询问修复/重试、切换策略、以 REFUSED 跳过、中止。
- Gate 失败：不创建检查点，报告具体阈值与失败项；询问补测试、说明原因后请求豁免、中止。不得自行豁免。
- DAG 阻断：给失败 wave 与后继阻塞链，询问重试/跳过/中止。

### 8.1 回退复盘事件

仅当 agent 因错误假设/路径丢弃自己的实现，且反证/正确路径/预防有复用价值时触发。它不是新 Operation/hook/CLI 状态或停点。普通 rebase/branch switch、用户要求恢复、生成物清理、无语义试验撤销、正常状态恢复不触发。

记录原假设与反证、根因与正确路径、可执行预防；有复用价值才写 `reports/rollback-reviews/<date>-<slug>.md`，满足 knowledge tier 才在归档事务前物化为已有 `memory/<type>/*.md` 候选。之后继续；mission 子流程仅返回证据。

## 9.0 Commit 与 Git Notes

commit_mode=auto 时逐任务 commit+Git Notes、逐 phase 检查点；manual 不自动提交。只暂存归属明确的本任务变更，保留其它来源，不以全目录暂存夹带无关文件。

任务 commit 格式 `feat(<track_id>): complete task <id> - <任务名称>`；Notes 记录 Task、Track、Phase、Priority、Changes、Files Modified、逐项 Acceptance。阶段格式 `checkpoint(<track_id>): Phase <Pn> complete`；Notes 记录 Checkpoint/Track/Phase、Gate Criteria、覆盖率、Tasks Completed 与验证报告。SHA 写对应 Task/TaskGroup.commit。验证不通过不创建检查点。

## 10.0 完成 track

所有 phase 及 Gate 通过 → track:after hooks（包括 GapLoop）→ 对 proposal/track 的每条唯一验证命令 `depa-codument track verify <track-id> -- <command>` → 逐项记录 receipt id/reused、PASSED/FAILED → `depa-codument track transition <track-id> completed`。CLI completion gate 拒绝未完成任务。

统计从 TaskSpace 派生；说明验证和建议 archive-track。若属于 mission，立即交回 MissionApplier 更新真实状态、判定当前 operation 并继续 ready 分支，不能把 Track 完成作为 mission 默认停点。

## 11.0 同步与清理（条件触发）

- 制品与长期知识的晋升规范见 `references/std/spec/folder-manifest.md`、`references/std/attractors/knowledge-tiers.md`；描述/注释/pseudo/mermaid 标签中文，标识符英文。不要直接写 owner registry，也不在本 operation 内另造晋升通道。
- ArtifactSync 仅 operation-hooks.xnl 当前点显式配置才运行；读取 output MaterialBundle 和所引用规则，执行 artifact-sync.md。docs profile 本身不构成隐式同步。
- 实现显著影响产品/架构吸引子时，提出 diff 并明确人工确认后才改 `codument/attractors/`。
- Track 清理交 archive-track（归档/删除/保留），本 operation 不删目录。
