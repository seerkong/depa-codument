---
envelopeVersion: halfcode.resource-envelope/v1
specVersion: 1
kind: CommandOperation
metadata:
  fqn: Codument.CommandOperation.GapLoop
spec:
  command: gap-loop
  description: "Compare implementation with goals, fix gaps and repeat bounded verification."
---

执行位置保持目标项目；@/ 表示项目根。references/std/、operations/、references/ 相对全局 depa-codument Skill（默认 ~/.agents/skills/depa-codument，CODUMENT_HOME 可覆盖 home）；裸 config/、tracks/ 等相对项目 codument/。以下是当前 Agent 要执行的指导，不是已经完成的业务结果。

# gap-loop（目标差距收敛）

GapLoop 让父层编排器控制轮次，每轮由 fresh 子代理独立比较实际态与目标态、修复可处理差距并留下证据。它可以作用于 Track、某个 phase 或 Mission。

## 角色

- 父层：确定 scope、轮次、输入、配置和续轮条件；更新 authority；读取子代理 verdict。
- fresh 子代理：只处理当轮 scope，读取事实、运行验证、写 `reports/`、修复范围内问题并返回简洁 verdict。
- Mission 调用 Track GapLoop 时，Track 父层收口后把结果交还 MissionApplier；局部收口不是 mission invocation 的返回边界。

## 输入与目标态

Track/phase scope 读取 `track.xnl`、proposal、design、Acceptance、相关代码测试和上一轮报告。Mission scope读取 `mission.xnl`、proposal、design、reports、ProjectRef binding 及 bound Track 的真实 authority。

同时按 `references/std/protocols/context-loading.md` 读取本 scope 适用的原始需求和批准取舍；派生 Acceptance 的遗漏本身也是差距。局部 phase 检查不宣称覆盖其它 phase，也不代替最终交付的原始需求完整性核对；不因此新增或重复配置 hook。

目标态来自这些 authority 的共同约束。实现、测试、reports 和 linked resource 是实际态。冲突时先报告 authority 冲突，不凭上下文猜测目标。

按 `references/std/methods/workflow.md` 的“目标—观察—行动”独立重建本轮目标；已确认约束不可当路线假设删除，未决解释不可当新硬要求。选择承诺相关的真实观察，不用技术领域分类或同一套派生测试界定全部覆盖。

## 初始化

1. 定位 Track 或 Mission，解析目标 scope 上的 `GapLoop` 配置；显式命令没有 hook 时按当前 Kind spec 补齐配置并运行 validate。
2. 读取 `max_rounds`、`on_exhausted` 与 `verify_round`；未配置时使用当前 spec 默认值。
3. 运行 `depa-codument validate <id> --strict`，确认 authority 可执行。
4. 开始第 n 轮前运行：
   - `depa-codument track gap-round <track-id> <n>`
   - 或 `depa-codument mission gap-round <mission-id> <n>`

CLI 负责根属性、时间和 Mission revision 的一致写回。

## 每轮

1. fresh-spawn 子代理，只注入 scope、authority 路径、上一轮报告（如有）和 verdict 格式。
   父层等待结果时遵循全局 `SKILL.md` 的“等待独立任务”；普通等待超时不消耗 GapLoop 轮数，也不启动重复 reviewer。
2. 子代理读取实际文件并运行与目标相称的测试、lint、构建或资源校验。
3. 子代理先写 issues-first 的 `reports/gap-<scope>-<round>.md`。
4. 先说明 finding 证伪了什么及证据范围。无差距且证据充分时返回 `NO_GAP`；能在 scope 与授权内修复时完成修复和验证后返回 `FIX_APPLIED`；需要用户决策或外部状态时返回 `BLOCKED`。观测/环境/交付协议问题交正确 owner，不能仅凭证据缺失就改业务或报 `NO_GAP`；无新依据或条件变化不原样重试。
5. 父层核对 report 路径和实际 diff，再决定续轮。

## 续轮

- `FIX_APPLIED`：开始下一 fresh 轮，聚焦上一轮改动与可能的回归。
- `NO_GAP`：通常收口；当 `verify_round=true` 且这是无历史首轮时，再运行一轮轻量确认。
- `BLOCKED`：记录 blocker。若当前属于 Mission 子 Track，先交还 MissionApplier 尝试重规划或其他 ready 分支；只有 mission 也无法继续时才向用户返回 blocked。
- 达到 `max_rounds`：执行 `on_exhausted` 定义的状态，并报告仍未闭合的差距。

### 外部验收的定向校准

已耗尽且 `on_exhausted=block` 后，**不能**重置 `gap_round`、提高 `max_rounds`、抹去原报告或把普通 retry 伪装成新 GapLoop。若外部验收提供了可复现的具体 finding，父层可将 finding 的原文、来源、受影响 Track、source digest 和可复现命令写入该 Track 的 `reports/`，并只允许一次独立的“最小修复 diff → 原 finding 定向复验”。该例外的 receipt 必须绑定同一 finding digest；它不代替全量新 GapLoop，也不能放行其它未审查范围。finding 不可复现、基础设施故障或复验仍失败时保留 block，交回 controller/用户；不得仅把观测或 receipt 超时反馈为业务实现修复。

轻量确认只读取上一轮报告、相关 diff 和必要验证，不重复全量分析。

复验覆盖原 finding 与受影响范围，必需回归及配置检查仍执行。原失败报告/receipt 不删除；证据失效时追加原因和替代引用，不能靠移除失败证据实现收口。

## 子代理返回

```text
status: NO_GAP | FIX_APPLIED | BLOCKED
summary: <本轮结论>
evidence: <gap report 和关键验证>
```

这是子流程通信，不创建独立 XNL/XML receipt。父层依据 verdict 和真实文件继续控制循环。

## 完成条件

最后一轮为可收口的 `NO_GAP`，authority 与报告已验证，gap round 与相关 Track/Mission/task 状态已由对应生命周期命令更新。Hook 本身没有运行期 status 字段。Mission 中的子 Track 随后立即返回 MissionApplier 继续 mission observe/reconcile 或下一 ready operation。
