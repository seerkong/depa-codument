# Compatibility boundaries

This directory documents historical names and paths, not active resource registration.
For old skill names, read [operation aliases](operation-alias.md) only when needed.
Use `depa-codument -h` to discover the current CLI surface.

| Historical surface | Current surface |
|---|---|
| Project `codument/std/` | Global skill `references/std/`; removed from the project after a successful upgrade |
| Global `std/` | Global `references/std/` |
| `std/actions/` or `std/operations/` | Root `operations/`, exposed as CommandOperation commands |
| `std/operations/_operation-spec.md` | `references/std/protocols/operation-authoring.md` |
| `std/commands/` | Relevant operations and migration/method references; no parallel command manual |
| `std/kernel-pointer.md` | Retired; no external dynamic-workflow documentation dependency |
| `skill://depa-codument/std/...` | `skill://depa-codument/references/std/...` at the migration boundary |
| `config/action-hooks.xml`, `config/action-hooks.xnl`, `config/operation-hooks.xml` | Project `config/operation-hooks.xnl` |
| `ActionHooks` / `Actions` / `Action` | `OperationHooks` / `Operations` / `Operation` |
| `std/sop/` | `references/std/protocols/` and `references/std/methods/` |

Global `init-global` / `upgrade-global` back up and replace the selected agents' entire
`depa-codument/` skill directory with the packaged App. Old customizations remain in
the backup, not in the new active installation. Other skills and the old `codument`
executable are outside this replacement.

Workspace `upgrade-workspace` preserves project-owned resources and history while
retiring known non-project distribution assets and updating standard references.
Unknown custom content requires review and preservation/migration, not silent deletion.
A `review-required` receipt does not mean the workspace has completed its upgrade.
See [workspace migration](../../migration/workspace-upgrade.md) for the execution boundary.
