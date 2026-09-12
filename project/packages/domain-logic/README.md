# depa-codument-domain-logic

Track/Mission transitions and projections operate on complete XNL snapshots.
They return a new tree and never mutate the caller's tree or write files. Time is
explicit input. The resource owner must admit the versioned source, resolve its
authority, and commit a proposal against the source revision.

`runTrackVerification(runtime, request)` uses workspace-bound fingerprint, receipt,
execution, digest and clock ports. Content/command/track changes invalidate cached
evidence; `fresh` always executes. `completeVerifiedTrackTask` checks receipt
identity and successful status but cannot itself establish external freshness.
The composing owner must run verification before committing task completion.

`indexXnlRegistry` preserves exact source text and indexes selected identities in
complete forests with source/owner/ancestor paths. Syntax, duplicate IDs and
collapsed singleton slots prevent a ready result. Parsing omits XNL source
comments, so index readiness is not permission to rewrite a source file.
`serializeXnlForest` formats a supplied AST with explicit marker bindings; it is
not a source-patching algorithm. `mergeXnlNodes` merges selected identity-owned
nodes, rejects unnamed inputs, and preserves conservative conflict policies.

This is a partial domain migration, not the complete Codument product. Legacy
commands still use the original implementation until the new owner is wired in.
The nine experimental Kind reader/writer registrations preserve the portable
tree and expose `validationLevel: structural`; they do not replace the remaining
domain semantic validators or the separately bound filesystem writer.

`patchLifecycleSource` applies only scalar attribute and identity changes at their
original source spans. It retains all unedited bytes (including comments and text
markers), uses xnl-core to validate before/after semantics, and rejects structural
changes it cannot prove safe. This is the lifecycle patch layer, not a general
registry editor or the future cross-version migration writer.

`validateLifecycleTree` checks current Track/Mission root fields, TaskSpace,
per-layer DAGs, material ports, hooks, GapLoop/Attractor controls and Mission
ActorSet/ProjectRef/nested-link rules directly on the admitted tree. Profile names
are explicit observations. Missing profile observations produce a warning (error
under strict), never a claim that the reference was validated. Duplicate DAG/Node
declarations are rejected; this also avoids silently merging ambiguous schedules.
`createValidatedLifecycleSourceCodec` combines these checks with current envelope
admission. Required files, BehaviorPatch/registry validation and cross-workspace
reference resolution still need their own gates. None of these functions change
the configured execution frequency of hooks or verification.

`validateBehaviorTree` inspects Requirement/Statement and KnowledgeHint rules,
plus BehaviorPatch operation/selector/Upsert structure. `proposeBehaviorMutation`
uses checked native XNL mutations against complete trees, preserving opaque data
without a legacy XML projection. The result is an AST proposal, not a source
file: BehaviorPatch selector application, archive promotion and the general
source-preserving publication layer are not yet wired into product commands.

`validateDecisionSources` validates explicitly supplied current-envelope source
maps: nested ownership, duplicate IDs, option/answer shape, durable resolution,
cross-file depends_on/activation/derived_from references and dependency cycles.
Parser slot-collapse warnings reject the affected file instead of validating a
lossy tree. `readDecisionRecords` is the compatible forest read model, not a
writer. `projectDecisionFrontier` reuses the same validated refs and retains the
pending/parent/dependency/priority projection, normalizing logical decision://
references for lookup. Legacy Markdown handling and durable promotion are still
being migrated; normal admission never silently accepts old envelopes.
