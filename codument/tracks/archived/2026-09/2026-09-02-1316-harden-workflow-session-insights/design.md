# Design: harden-workflow-session-insights

## 1. 事实源与设计边界

本 Track 以当前源码、模板契约测试、Codument Kind 校验和本项目狗粮结果为事实源。历史会话统计只用于发现值得调查的摩擦，不直接证明某个机制应该存在。

设计遵循四条边界：

1. 只有真实 operation 才能出现在 `operation-hooks.xnl`。
2. mission 的返回条件仍只由 `impl-mission.md §2.1` 定义，子流程事件不得新增隐式返回点。
3. track/mission XNL 与 CLI receipt 是状态 authority，过程提示词不发明新状态字段。
4. archive CLI 只消费事务开始前已经存在的 track-local delta、decision 和 memory 候选。

## 2. Scope Drift Reconciliation

### 2.1 预期改动面

执行器在任务开始时，从 Acceptance、MaterialBundle、proposal/design、目标模块和已有工作区变更推导“预期改动面”。它是当前实现假设，不是文件或命令白名单，也不要求额外持久化。

收口时把实际变更分类为：

- 当前 Track 所需变更；
- 用户或其他工作流已有变更；
- 构建/升级生成物；
- 尚无法解释的变更。

不得回退不属于当前任务的既有变更。

### 2.2 漂移分级

发现预期外工作时按语义处理：

1. **目标内、局部且可逆**：记录原因，扩展预期改动面，继续任务。
2. **计划或 authority 假设失效**：读取受影响真源，修订 task/plan 或进入 mission reconcile，验证后继续。
3. **需要新产品决策、不可逆外部动作、缺少权限或输入**：形成 HumanConfirm 或真实 `BLOCKED`。

scope drift 只是 reconcile 信号，不是 stop signal。若当前 Track 是 mission 子流程，前两类处理完成后必须把结果交还 MissionApplier 并继续 ready operation；只有第三类且无法通过其他分支收敛时，mission 才返回。

### 2.3 Mission 状态词汇连通

Mission 受控重规划使用规范已定义的节点状态 `SUPERSEDED`。lifecycle 写回、mission spec、impl-mission 和 validator 必须使用同一词汇；误拼 `SUPERSED` 不具有兼容价值，应由 validator 拒绝。回归测试同时覆盖正反两个输入，保证 authority drift 的修订结果能通过 strict validation。BehaviorPatch 以 nested case selector 更新 `validator-rules-consistency/mission-validation/mission-node-status-enum`，不直接编辑 live behavior registry。

## 3. Rollback Review Event

rollback review 是实现器内部事件，不是 Operation、hook 或新的 CLI 状态。

### 3.1 触发

同时满足以下条件才触发：

- 当前 agent 的实现尝试因错误假设或错误路径被丢弃；
- 反证、正确路径或预防机制对后续执行有复用价值。

普通 rebase/branch switch、用户明确要求恢复、清理生成物、撤销无语义试验和状态机的正常恢复不触发。

### 3.2 处理

实现器简要记录：

- 原假设与反证；
- 根因和正确路径；
- 可执行的预防措施。

只有内容具有复用价值时才写入 `<track-dir>/reports/rollback-reviews/<date>-<slug>.md`；满足 knowledge tier 条件时，再在归档前物化为现有 `memory/` 候选。事件处理后继续当前 task 或 mission loop，不向用户返回，也不新增 question。

## 4. AttractorCheck Protocol

### 4.1 单一协议

`std/protocols/attractor-check.md` 是 AttractorCheck 执行语义的唯一真源。直接创建或执行 AttractorCheck 的 operation 必须引用它；operation 自身只描述触发位置和调用方如何消费结果。

### 4.2 Reviewer 合同

- 每轮使用 fresh context。
- 只读 attractor、目标产物和必要工程事实，不修改文件。
- 可以执行调用方明确授权的只读检查；实现测试仍由实现器或 verify operation 负责。
- 回传紧凑结果：

```text
status: PASS | GAP | BLOCKED
summary: <结论或差距>
evidence:
- <path:line 或稳定 id>
```

### 4.3 调用方职责

- `PASS`：当前 hook 完成，调用方继续。
- `GAP`：调用方修复报告中的差距，再启动新的 fresh reviewer；reviewer自己不修。
- `BLOCKED`：调用方按其所属 track/mission 失败边界协调，不自动外推为 mission 返回。

轮次归调用方所有，协议不自建循环。AttractorCheck 与 GapLoop 职责独立；二者同时配置时按显式 hook 顺序运行，不以 `verify_round` 推导替代关系。

### 4.4 引用闭包

契约测试动态扫描 `std/operations/` 中的 Markdown 文件：任何包含 `AttractorCheck` 的直接调用方都必须引用 `std/protocols/attractor-check.md`。当前预期调用方是 `discuss`、`impl-quick`、`plan-mission`、`plan-track` 与 `impl-track`。

## 5. Pre-Archive Retrospective

archive-track 的主流程顺序固定为：

1. 读取 Track authority、实现证据和未解决 decision。
2. 执行显式 `archive-track:before` hook。
3. 基于 track-local evidence 写 `reports/retrospective.md`，包含改动面、摩擦面和沉淀候选。
4. 将确认合格的 durable decision/memory 内容物化到 CLI 已支持的 track-local `decisions/` 递归 XNL 文件与 `memory/<type>/*.md`；没有候选则明确记录无候选。
5. 运行 `codument validate <track-id> --strict`。
6. 运行 `codument archive <track-id>`，由 CLI 完成 registry transaction、Track move 和 memory promotion。
7. 接受 CLI receipt，再运行显式 after hook；after hook 不得修改已归档 authority。

这样 decision/memory 会进入同一个归档事务输入，失败仍由 CLI 保持原 authority 或执行 rollback。

## 6. Continuation Checkpoint

不提供 standalone session budget 方法。只有以下时机允许写紧凑 continuation checkpoint：

- mission 达到十个 linked track 的合法 invocation checkpoint；
- runtime 真实中断或显式 handoff；
- mission 因 HumanConfirm/`BLOCKED` 返回，但仍有后续恢复入口。

checkpoint 只记录五类信息：当前目标、已完成项、下一 ready operation、真实 blocker、关键证据路径。续跑时从 `mission.xnl` 的 TaskSpace/TrackLink 重建 mission actual state，对关联 Track 使用现有的 `codument track ready <id> --json` 投影，并结合 lifecycle receipt 和最新 checkpoint；chat history 不是 authority。不引用未实现的 `mission ready`，也不假设面向人的根 `codument status` 支持 `--json`。

不使用 token 百分比，不要求逐 phase 摘要，也不新增 `current_state` 字段。

## 7. Verification And Dogfood

验证分三层：

1. **契约测试**：静态断言 operation 配置、AttractorCheck 引用闭包、scope/rollback 连续性、archive 顺序和废弃设计清理；Mission validator 单测断言 `SUPERSEDED` 合法且 `SUPERSED` 非法。
2. **工程验证**：`bun run check`、strict validate、template/current std lint、`git diff --check`。其中 lifecycle 集成测试一个 case 会串行启动最多六个 CLI 子进程，使用文件级 30 秒超时以吸收不同机器的进程启动波动，不改变断言或生产行为。
3. **发布路径验证**：构建 CLI、本地安装、在本项目运行 `codument upgrade-workspace`，重新检查受管理内容，再用 fresh verification command 形成不复用 task receipt 的最终证据。

任何一层失败都不得把 Track 或相应 task 标为 DONE。

## 8. 设计决策

| ID | 决策 | 理由 |
| --- | --- | --- |
| D1 | 删除 standalone session budget | 所需恢复信息已有 XNL/CLI authority；不可观测 token 阈值和逐阶段摘要会增加噪声。 |
| D2 | rollback review 是条件事件 | 它没有独立输入/输出生命周期，不符合 Operation 注册语义。 |
| D3 | scope 使用动态预期面和漂移分级 | 既能识别越界，又不会把正常发现变成默认停止点。 |
| D4 | AttractorCheck 由 reviewer 判定、调用方续轮 | 保持 reviewer 只读，也避免协议与 track/mission 控制循环争夺 authority。 |
| D5 | 复盘先于 archive transaction | CLI 只有在移动前才能读取并原子晋升 track-local decision/memory 候选。 |
| D6 | 狗粮是完成门槛 | 模板变化只有进入本项目受管理 workspace 后，才能证明升级路径没有遗漏。 |
| D7 | Mission 节点只保留 `SUPERSEDED` | 这是 spec 和 lifecycle 已有的 canonical 状态；修正 validator 错拼比兼容两套词汇更能保持单一 authority。 |
