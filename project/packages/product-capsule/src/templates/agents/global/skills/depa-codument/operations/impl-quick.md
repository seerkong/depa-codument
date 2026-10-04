---
envelopeVersion: halfcode.resource-envelope/v1
specVersion: 1
kind: CommandOperation
metadata:
  fqn: Codument.CommandOperation.ImplQuick
spec:
  command: impl-quick
  description: "Implement a small, scoped change with focused verification."
---

执行位置保持目标项目；@/ 表示项目根。references/std/、operations/、references/ 相对全局 depa-codument Skill（默认 ~/.agents/skills/depa-codument，CODUMENT_HOME 可覆盖 home）；裸 config/、tracks/ 等相对项目 codument/。以下是当前 Agent 要执行的指导，不是已经完成的业务结果。

# impl-quick（基于 Codument 上下文快速实现小改动）

用于小范围变更：bug 修复、测试补齐、局部重构、非破坏性配置修正。它读取 Codument 知识上下文和项目工程文件后直接实现，不创建 track、mission 或 proposal。

## 0. 边界

适合 quick：

- 恢复既有预期行为的 bug fix。
- 小范围测试补齐。
- 局部重构且不改变对外行为。
- 非破坏性配置/脚本修正。

不适合 quick：

- 新能力或对外行为变化。
- 需要完整 Track 生命周期才能表达清楚的变更。
- 架构/模式调整。
- 多阶段或跨模块高风险工作。
- 长期自动化目标。

遇到不适合 quick 的工作，停止并建议 `depa-codument plan-track` 或 `depa-codument plan-mission`。

## 1. 上下文加载

1. 直接读取与目标相关的项目约束、代码和测试；仅当 `operation-hooks.xnl` 显式为 `impl-quick:before` 配置 `<AttractorCheck>` 时才执行 fresh check，执行与结果处理统一遵循 `references/std/protocols/attractor-check.md`。
2. 读取与请求相关的：
   - `codument/attractors/`、`references/std/attractors/`。
   - `codument/decisions/`。
   - `codument/decisions/` 与相关 archive/track 历史。
   - 源码、测试、配置、脚本。
3. 遵循 `references/std/methods/workflow.md` 的“目标—观察—行动”，依据请求、既有行为约束和当前证据形成足以选择本次修改的理解。关键未知先查证；后果可逆的普通选择采用安全默认，实际影响当前切片的假设与未决在输出中说明。

## 2. 实现流程

```text
@delimiter: --
-- #sequence ?quick
---- #step ?scope
判断请求是否适合 quick；不适合则 #exit 并建议 plan-track / plan-mission
---- /?scope
---- #step ?context
读取 Codument owner 知识和相关工程文件，形成最小上下文
---- /?context
---- #step ?edit
在 quick 的授权边界内，依据当前证据选择能证伪关键假设的最小观察或连贯修改，按项目既有模式实现
---- /?edit
---- #step ?verify
围绕实际承诺从合法消费入口验证输入到结果及适用不变量，完成与改动相称的最小必要验证；局部或替身通过不能代替承诺的真实边界证据，可在授权隔离环境观察。能跑测试就跑，不能跑则说明原因
---- /?verify
---- #step ?durable
判断是否发现承重决策或可复用教训；如有，只提示是否写入 decisions 或 memory，不静默沉淀
---- /?durable
---- #return ?done value="quick implementation complete"
---- /?done
-- /?quick
```

失败先区分目标解释、实现、观察前提或交付协议的失效，修复对应 owner；证据不足不自动触发业务实现修复。按共享方法依据新信息复验原问题与受影响范围，无新依据不原样重试；已有失效证据保留并说明替代关系，不删除失败历史。

## 3. 知识沉淀

默认不创建 track、不写 proposal。

若实现过程中发现稳定长期知识：

- 承重的取舍/策略 → 提示是否写入 `decisions/`。
- 可复用的教训/模式 → 提示是否写入 `memory/`。
- 对外行为变化 → quick 不再合适，建议创建 track。

未经用户明确同意，不要把 quick 中发现的知识直接沉淀为 durable owner registry。

## 4. 输出

最终回复包含：

- 修改摘要。
- 验证结果。
- 是否仍属于 quick。
- 是否发现建议沉淀到 `decisions` / `memory` 的长期知识。
- 若未能验证，说明原因和剩余风险。
