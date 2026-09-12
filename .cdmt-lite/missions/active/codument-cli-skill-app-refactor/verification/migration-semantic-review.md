# Current Agent semantic review of historical Decision fixtures

Scope: five raw historical inputs in `test/resources/decision-migration-inventory`, independently read by the current Agent during Round32. This is an isolated, source-backed semantic exercise, not an assertion that all dogfood history has been upgraded and not a cached fresh verdict for future users.

| Source | Evidence-based reconciliation | Allowed action / unresolved condition |
|---|---|---|
| archive-recoverable | Exactly one matching archived stable ID. Its explicit question concerns recovery policy; options distinguish complete archived XNL from lossy summary. Full raw-answer, rationale, evidence, provenance and confidence survive only in the XNL. | Choose semantic owner `decisions/migration/recovery.xnl` from the explicit recovery-policy question, recover the entire root closure, let CLI normalize its envelope, validate and compare the complete AST before retiring the Markdown projection. Do not rebuild from the summary. |
| markdown-only | One stable legacy URI, but two historical choices. The text explicitly forbids inventing missing hierarchy/options/activation. Exact punctuation and narrative are meaningful. | Preserve full Markdown plus backup; report unresolved mapping of two choices to one identity. Do not fabricate child IDs or mark the semantic migration complete merely because an opaque text wrapper could pass the parser. |
| missing-source | Explicit archive URI has no matching source in the fixture. | Preserve summary and backup; require the referenced original or an explicit user decision accepting a new authority. No generated recovery. |
| ambiguous-id | Root and recursive archive files claim the same ID but disagree on decision-text and evidence. | Report two conflicting candidates, not scan-order selection; both unchanged. |
| target-conflict | Existing canonical ID and archived ID have different selected policies. | Preserve both; no overwrite or automatic preference for archive/source freshness. Resolve authority with user/business evidence before publication. |

The replay test encodes these reviewed, fixture-specific decisions, not a generalized Markdown-to-Decision inference engine. CLI-generated scaffolds and the actual migration/Decision validators remain the version/structure owners. Recoverable case passes per-target validation and idempotence; four unresolved cases remain explicit review, not false PASS. Archived raw source is retained as the proof input; this scoped exercise does not retire or rewrite its containing historical Track.
