---
envelopeVersion: halfcode.resource-envelope/v1
specVersion: 1
kind: CommandOperation
metadata:
  fqn: Codument.CommandOperation.MaintainTrack
spec:
  command: maintain-track
  description: "Discuss phases, revise plans or reschedule an existing track."
---

执行位置保持目标项目；@/ 表示项目根。references/std/、operations/、references/ 相对全局 depa-codument Skill（默认 ~/.agents/skills/depa-codument，CODUMENT_HOME 可覆盖 home）；裸 config/、tracks/ 等相对项目 codument/。以下是当前 Agent 要执行的指导，不是已经完成的业务结果。

# codument-maintain-track

Maintain an existing track with one explicit mode: `discuss-phase`, `revise`, or `schedule`.

- `discuss-phase`: refine a phase's TaskSpace, acceptance, and risks.
- `revise`: update the minimum track-local proposal, design, decisions, or plan artifacts after evidence changes scope.
- `schedule`: add or revise direct-child DAG dependencies and parallel limits.

Every `track.xnl` edit happens in place on the CLI scaffold: run `depa-codument schema track` for the current root shape and slot fragments first. Authoring XNL is never a whole-file rewrite and never goes through JSON or byte-editing tools.

Read the target track and the shared protocols in `references/std/protocols/` and methods in `references/std/methods/`. Preserve the track as the state source, make only evidence-backed changes, validate it strictly, and report changed files. This operation replaces the legacy bodies documented in `references/std/compat/`.

