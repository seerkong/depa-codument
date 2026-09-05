# 变更：harden-workflow-session-insights

## 背景和动机

历史会话蒸馏提示了上下文超限、实现回退、范围漂移和审查口径分散等摩擦。第一次规划把这些信号直接映射成了独立的 session budget 方法、可配置 rollback Operation、命令白名单和额外分析能力；实现后复核发现，这些映射缺少运行时事实支撑，且部分规则会制造新的停止点：

- `rollback-review` 并不是 Codument Operation，却被写入 `operation-hooks.xnl`，已经触发现有契约测试失败。
- scope 检查使用“白名单 + 越界即停”，与 mission 连续执行和受控重规划相冲突。
- AttractorCheck 的 verdict、调用方职责和 GapLoop 关系在协议与 operation 中不一致，且“唯一协议”尚未覆盖所有直接调用方。
- `session-budget.md` 引用了不存在的 `track.xnl.current_state`、不可可靠观测的 token 水位和未经实现验证的消费能力。
- archive-track 在 CLI 归档事务之后才要求生成复盘，而 decision/memory 候选必须在事务开始前成为 track-local 输入。
- 先前任务全部标为完成，但验证主要是文本匹配；全量测试实际存在失败，也没有构建、本地安装和 workspace 狗粮证据。
- fresh verification 进一步发现 Mission validator 仅接受误拼的 `SUPERSED`，与 lifecycle、mission spec 及执行提示词使用的 `SUPERSEDED` 不一致，会让受控 replan 的状态写回无法通过 strict validation。

本次 revise 以这些反证为新事实源，重新设计并执行该 Track。

## 目标

- 把 scope 从静态命令白名单改为执行中的预期改动面与漂移分级；可在目标内协调的变化继续推进，只有真实决策、权限或外部依赖才形成返回点。
- 把 rollback review 定义为 impl-track/impl-mission 内部的条件事件，而不是独立 Operation 或生命周期 hook；仅在错误假设导致实现尝试被丢弃且有复用价值时记录。
- 建立单一 AttractorCheck 协议，统一 fresh 只读角色、`PASS | GAP | BLOCKED` 回执和调用方续轮职责，并让所有直接 author/execute AttractorCheck 的 operation 显式引用它。
- 将归档复盘放到 CLI archive 事务之前；先产出复盘并物化合格 decision/memory 候选，再 validate、archive，归档后不修改 archive authority。
- 仅在 mission 合法返回边界或真实 handoff 时写紧凑 continuation checkpoint；续跑从 mission/track XNL、CLI 状态和最新 checkpoint 恢复。
- 对齐 Mission 节点状态的单一词汇：validator、lifecycle、spec 和 operation 都使用 `SUPERSEDED`，使 authority drift 可以修订、写回并验证后继续。
- 用契约测试、全量检查、构建、本地安装、`codument upgrade-workspace` 狗粮和最终独立语义复核证明改造有效。

## 非目标

- 不新增 standalone session budget 方法、token 百分比阈值、逐 phase 强制摘要或新的持久状态字段。
- 不新增 `rollback-review`、`impl-mission` 等伪 Operation 配置，也不把自然语言事件注册成 hook。
- 不引入命令白名单，不以 scope drift 本身作为 track 或 mission 的停止条件。
- 不让 Codument 读取或分析外部 session store。
- 不改变 CLI 的 archive transaction、Track/Mission Kind 或 workspace 文件结构；`SUPERSEDED` 只是修复 validator 对既有规范词汇的错拼。

## 变更内容

- 重写 `std/operations/impl-track.md` 与 `impl-mission.md` 的 scope drift、rollback 和 continuation 规则。
- 重写 `std/protocols/attractor-check.md`，并补齐 `discuss`、`impl-quick`、`plan-mission`、`plan-track`、`impl-track` 的协议引用。
- 重排 `std/operations/archive-track.md` 主流程，使复盘和候选物化发生在 validate/archive 之前。
- 恢复 `config/operation-hooks.xnl` 和 coding attractor profile 的合法最小配置，删除 `std/methods/session-budget.md` 及相关 README 口径。
- 新增模板契约测试，覆盖非法 Operation、停止点、AttractorCheck 单一协议、归档顺序和废弃设计清理。
- 修正 Mission validator 的节点状态词汇，添加 `SUPERSEDED` 合法、`SUPERSED` 非法的回归测试，并通过 BehaviorPatch 更新既有 `validator-rules-consistency` 行为真源。
- 为会串行启动多个 CLI 子进程的 lifecycle 集成测试设置文件级 30 秒超时，保留全部行为断言，避免默认 5 秒预算在高负载机器上造成假失败。
- 构建并本地安装当前 CLI，运行 workspace 升级，使本项目 `codument/` 中的受管理内容与模板一致。

## 成功判据

- `operation-hooks.xnl` 只包含真实 std Operation，现有 operation hook 测试恢复通过。
- scope drift 的三类处理和 mission 连续执行语义有明确文本契约；不存在命令白名单或“越界即停”的默认分支。
- Mission 节点的 `SUPERSEDED` 可通过 validator，旧误拼 `SUPERSED` 被拒绝，BehaviorPatch 同步修正已有行为真源，与 lifecycle 和 mission spec 保持一致。
- rollback review 不再是 Operation/hook，排除普通 rebase、用户要求的恢复和生成物清理；事件处理后继续当前控制循环。
- 所有直接 author/execute AttractorCheck 的 operation 引用同一个协议，协议和调用方只使用 `PASS | GAP | BLOCKED`。
- archive-track 的复盘与候选物化严格先于 strict validate 和 CLI archive，archive 后不再写 authority。
- Track 权威材料和模板中不存在 session-budget 或其他已否决扩展的遗留承诺。
- `bun run check`、strict validate、std lint、`git diff --check`、构建、本地安装和 dogfood upgrade 全部通过。
- 最终 verification 使用 fresh 证据，不复用实现阶段 task receipt，并形成可审计结果。

## 影响范围

- 行为能力：`codument-core` 的实现连续性、方向审查和归档复盘。
- 模板：`src/templates/codument/std/{operations,protocols}` 与 `src/templates/codument/config`。
- CLI：`src/cli/mission/validate.ts` 的既有 Mission 状态词汇校验（不改 schema）。
- 测试：`test/templates/` 与 `test/cli/mission/`。
- 狗粮产物：本项目受管理的 `codument/std/` 与 `codument/config/`。
- 不涉及 CLI 数据模型或资源 schema 变更，不涉及外部系统集成。
