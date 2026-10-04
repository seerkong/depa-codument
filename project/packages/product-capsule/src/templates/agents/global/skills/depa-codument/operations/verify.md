---
envelopeVersion: halfcode.resource-envelope/v1
specVersion: 1
kind: CommandOperation
metadata:
  fqn: Codument.CommandOperation.Verify
spec:
  command: verify
  description: "Use a fresh subagent to independently run checks against acceptance criteria."
---

执行位置保持目标项目；@/ 表示项目根。references/std/、operations/、references/ 相对全局 depa-codument Skill（默认 ~/.agents/skills/depa-codument，CODUMENT_HOME 可覆盖 home）；裸 config/、tracks/ 等相对项目 codument/。以下是当前 Agent 要执行的指导，不是已经完成的业务结果。

# verify（独立验证 · fresh-subagent 实跑）

以**独立验证模式**确认 track 的实现真正达成目标：fresh-spawn 一个独立子代理，**实际运行**应用/测试、复现验收用例，对照 `Acceptance`/`Gate` 从目标倒推，逐条给 PASS/FAIL + 证据，落 `track://reports/verify-report.md`。**只判定不修复**；有 FAIL 则列差距及依据，按失效原因交正确 owner。

> 程序化流程使用 ` ```text ` + `@delimiter: --` 的流程标记块。当前 Track authority 是 `track.xnl`；legacy 输入先交给 `depa-codument upgrade-resource`，verify 不教授迁移写法。

---

## 0. 角色与定位

父层协调者负责选择范围并派发；收到明确fresh verifier任务的子代理已经是本操作的独立执行者，自行读取本正文和适用引用，直接执行目标倒推、实跑及报告，不再次spawn verifier。父层的evidence plan是检查起点，不是只能运行所列命令的限制。

验证选择遵循 `references/std/methods/workflow.md` 的“目标—观察—行动”：独立重建目标与观察覆盖，不仅换会话重跑同一套派生测试。

你是 Codument 规范驱动开发框架的**独立验证代理**。职责是：

- **不参与实现，只做验证**。
- 从目标与验收标准**倒推**，验证实现是否真实成立。
- 按 **issues-first** 输出（先阻塞问题，再非阻塞问题，再结论）。

**verify 与 gap-loop 的区别**：gap-loop 对照"目标 vs 实现产物"做方向/完成度纠偏**并修复**；verify 是**独立运行真实行为**确认可用（跑测试、启动应用、复现用例），**只判定不修复**。verify 必须用 fresh-subagent 执行以保证独立性，且**实际运行而非只读代码**。报告状态对照失败时不轻易判 PASS。

---

## 1. 设置检查

1. **检查以下入口存在：**
   - 项目上下文：`codument/attractors/`。
   - `references/std/methods/workflow.md`（内置工作流规程）。

2. **处理缺失：** 若标准工作流文件或 `codument/attractors/` 缺失，停止并提示：
   > "Codument 未设置。请先运行 `depa-codument init`。"

## 1.1 交互式问答

所有用户澄清、选择、确认问题都必须遵循 `references/std/protocols/questioning.md` 中的 ask-* 协议。问答 ToolCall 只能用于真实问题；禁止为测试运行环境能力发起占位问题。

---

## 2. 验证目标选择

1. **识别 track：**
   - `{{args}}` 含 `<track-id>` → 优先精确匹配；若精确且唯一匹配，直接使用；仅在无匹配或多个候选时请求澄清。
   - 否则从 `codument/tracks/active/` 与各 track 的 `track.xnl` 根 `{ status }` 选第一个活跃 track。

2. **识别验证范围（可选）：**
   - `{{args}}` 可附带 `P{n}`（phase）或某 dag 层的某波次标识；未指定时验证整个 track。

3. **读取上下文文件：**
   - `codument/tracks/active/<track_id>/track.xnl`
   - `codument/tracks/active/<track_id>/proposal.md`
   - `codument/tracks/active/<track_id>/design.md`（如存在）
   - `codument/tracks/active/<track_id>/decisions.xnl`、递归 `decisions/**/*.xnl` / `analysis/`（如存在，迭代期背景）
   - `codument/tracks/active/<track_id>/reports/`（已有历史报告，如存在）

---

## 3. 验证方法

### 3.1 Goal-Backward（目标倒推）

1. 先按输入引用从本 scope 的原始需求、批准取舍和适用吸引子重建目标，再从 `track.xnl` 提取目标 task 的 `Acceptance` 与所属 phase 的 `Gate`，核对它们的覆盖；不以实现者的解释或自带测试定义目标。
   整 Track 验收须覆盖已批准 Track 范围内的全部原始硬要求，不把其它 Track 或未选 backlog 强加到本次交付。原文明确要求保留的测试/接口/文件名要核对实际收集或可达结果，不能因 Acceptance 未写就略过；对照缺口列 FAIL，而不是以已有测试全绿放行。模糊描述存在多个合理解释时记录未决与所缺决策，不把 reviewer 偏好当已确认合同，也不悄悄取消要求；未闭合的目标不能报 PASS。
2. 按 criterion 逐条反推：
   - 需要哪些代码/配置/文件存在。
   - 需要哪些行为可达；按 `references/std/protocols/context-loading.md` 的契约示例规则核对原始输入形状，不以预填字段的fixture替代；当前声明的资源/权限边界须有允许与拒绝的行为证据。
   - 需要哪些测试或其它观察支持：沿承诺的合法消费入口观察真实结果及适用的状态/边界/时序不变量，检查已有测试是否共享实现的错误假设；按具体风险补证据，不强制某种领域、工具或全套测试方法。

### 3.2 三级验证

对每个目标 task 执行以下三层验证：

它们用于发现空壳或未接入等遗漏，不是充分验收条件；每层仍须按该目标的实际语义与约束取证，单个成功路径不证明所有承诺。

1. **Exists（存在性）**
   - 文件是否存在。
     声明某个必需路径缺失前，直接检查该目标路径（如 stat / test -e），区分不存在、访问失败与搜索过滤。默认 `rg --files`、glob 或 Git 清单可能遗漏隐藏/ignored 文件，不能单凭未列出判缺失；只核对范围内目标，不顺带读取其它隐藏私人文件。
   - task 的 `status` 是否与实现一致。
   - auto 提交模式下是否存在对应 commit（如适用）。

2. **Substantive（实质性）**
   - 代码/配置改动是否真正满足 task 的 `<Description>`。
   - 是否覆盖 `Acceptance` 各 criterion。
   - 相关测试是否存在并能支持结论。

3. **Wired（连通性）**
   - 新增能力是否被正确引用/接入。
   - 入口是否可达。
   - 系统路径是否连通（不是"孤立代码"）。

### 3.3 Wave 模式附加检查（如适用）

若目标范围所在层写了 `{ child_mode = "dag" }`（wave = 该层依赖的拓扑分层派生视图）：

- 检查目标波次内各 Task 是否按依赖完成。
- 检查跨波次依赖产物（前驱 Task 的 output）是否被后续波次正确使用。

---

## 4. 独立执行与逐项判定

verify 的核心是**派发 fresh-subagent 实际运行**——不是父代理顺手读一遍代码。父代理只负责收集验证目标、spawn 子代理、汇总其 PASS/FAIL，并据结论决定收口/回退。

父层等待结果遵循全局 `SKILL.md` 的“等待独立任务”；无新结果时不重新派发或预先宣称通过。

```text
@delimiter: --
-- #sequence ?verify
---- #step ?v1
父代理：从 track.xnl 收集所有 Acceptance 与 Gate；对照已批准范围的原始需求，把尚未映射的硬要求也按来源锚点纳入目标集，按范围（整 track / phase / wave）圈定边界
---- /?v1
---- #step ?v2
父代理：建立 evidence plan，把可由同一测试 / 启动 / smoke 命令证明的目标归组；以规范化命令与运行前提作为唯一键，明确每条唯一命令映射哪些 Acceptance / Gate / 原始硬要求锚点；缺映射不从集合删除
---- /?v2
---- #spawn ?run as=fresh-subagent inject="注入本操作入口、fresh verifier执行角色、验证范围、输入路径、输出报告要求和必要禁止事项"
独立上下文：按 evidence plan 对每条唯一命令运行 `depa-codument track verify <track-id> --fresh -- <verification-command>`，实跑测试 / 启动应用 / 复现用例并保存 receipt、退出码与关键输出；同一结果可映射到多个目标，但不得因复用而省略逐项语义判断
---- /?run
---- #loop ?items for="每条 Acceptance / Gate / 尚未映射的原始硬要求锚点"
------ #step ?ex
三级验证：Exists（文件/状态/commit）→ Substantive（满足描述、覆盖 criterion、测试支持）→ Wired（被接入、入口可达、路径连通）
------ /?ex
------ #switch ?verdict on="实跑结果"
-------- #case ?pass when="行为真实达成、证据充分"
记 PASS + 证据（命令输出 / 测试结果 / 复现步骤 / 文件定位）
-------- /?pass
-------- #case ?fail when="未达成 / 行为错误 / 证据缺失"
记 FAIL + 差距（定位、影响、修复建议）；不在 verify 内修复
-------- /?fail
------ /?verdict
---- /?items
---- #step ?report
汇总写报告 → track://reports/verify-report.md（issues-first：阻塞 → 非阻塞 → 结论）
---- /?report
---- #switch ?conclude on="是否存在 FAIL"
------ #case ?allpass when="全部 PASS"
-------- #return ?ok value="PASS：报告可进归档（depa-codument archive-track）"
-------- /?ok
------ /?allpass
------ #case ?hasfail when="存在 FAIL"
-------- #return ?back value="FAIL：列差距及被否定的前提；实现缺陷交 implement/gap-loop，目标冲突交规划/决策，观测或交付故障交其 owner"
-------- /?back
------ /?hasfail
---- /?conclude
-- /?verify
```

**fresh-spawn 注入：** 父代理交接 `depa-codument verify <track-id>` 作为完整指导入口、fresh verifier执行角色，以及验证范围、输入路径、输出报告要求和必要禁止事项；只有需要结构化来源元数据时才加 `--json`。不注入预期PASS或实现者解释；子代理自行取得当前操作与原始依据。具体运行时配置由当前 agent/runtime 自行决定，Codument 标准提示词不承载这类配置。

**证据复用：** “逐项判定”不等于“逐项重复执行”。fresh verifier 对每条唯一命令使用一次 `--fresh`，不消费实现阶段回执；随后在本次报告的多个目标下引用该次结果。只有目标需要不同输入、状态或复现路径时才新增执行。

**只判定不修复：** verify 子代理发现 FAIL 时记录差距及被否定的前提，**不得**在本流程内修改实现。实现缺陷交 `implement`/`gap-loop`；目标/authority 冲突交规划或决策 owner；工具、环境或交付协议问题交其 owner，不仅因观测失败就建议业务修复。原报告和 receipt 保留，失效只追加原因与替代引用；缺少充分证据不得报 PASS。

---

## 5. 输出协议（issues-first）

输出顺序必须为：

1. **阻塞问题（Blocking Issues）** — 会导致验收失败或行为错误的问题。每条含：定位、影响、修复建议。
2. **非阻塞问题（Non-Blocking Issues）** — 质量或一致性问题。
3. **简要结论（Summary）** — 验证范围、通过/失败任务数、是否可进入下一步（如归档）。

报告落 `track://reports/verify-report.md`（=`codument/tracks/active/<id>/reports/verify-report.md`，按需带轮次/范围后缀以与历史报告区分）。模板：

```text
📋 验证报告：<track_id> [范围]

Blocking Issues:
- <问题1>（定位 / 影响 / 修复建议）

Non-Blocking Issues:
- <问题1>

逐项判定:
- <AC/Gate/case id>: PASS | FAIL — <证据 / 差距>

Summary:
- 验证任务数：<n>
- 通过：<n>
- 失败：<n>
- 结论：PASS | FAIL
- 下一步：全 PASS → depa-codument archive-track；有 FAIL → 按原因交实现/规划决策/观测交付 owner
```

> 全 PASS 才可进归档；有 FAIL 则保留原 finding 并交正确 owner，不默认业务重试。报告/状态对照失败时不轻易判 PASS。

---

## 引用

- `references/std/spec/track-xnl-spec.md`（`Acceptance`/`Gate`、phase=第一层 TaskGroup、wave=dag 层派生视图）
- `references/std/protocols/validation.md`（裁决词汇、fresh-subagent 执行约定）
- `operations/gap-loop.md`（FAIL 后的目标对比修复双角色协议）
- `operations/impl-track.md`（FAIL 后补实现）
- `references/std/protocols/questioning.md`（ask-* 协议）
