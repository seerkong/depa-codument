# codument-maintain-track

Maintain an existing track with one explicit mode: `discuss-phase`, `revise`, or `schedule`.

- `discuss-phase`: refine a phase's TaskSpace, acceptance, and risks.
- `revise`: update the minimum track-local proposal, design, decisions, or plan artifacts after evidence changes scope.
- `schedule`: add or revise direct-child DAG dependencies and parallel limits.

Every `track.xnl` edit happens in place on the CLI scaffold: run `codument schema track` for the current root shape and slot fragments first. Authoring XNL is never a whole-file rewrite and never goes through JSON or byte-editing tools.

Read the target track and the shared protocols in `std/protocols/` and methods in `std/methods/`. Preserve the track as the state source, make only evidence-backed changes, validate it strictly, and report changed files. This operation replaces the legacy bodies documented in `std/compat/`.
