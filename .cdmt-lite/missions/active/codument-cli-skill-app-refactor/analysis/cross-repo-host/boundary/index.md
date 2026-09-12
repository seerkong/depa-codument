# Boundary questions

Boundary: cross-repository package ownership and extension contracts. Holds: package manifests, public entrypoints, release/clone/runtime seams. NotOwnedHere: business rule redesign, final three-command UX, publishing credentials, source implementation. Tier: dated analysis. Upstream: [scope](../scope.md). Downstream: inventory, convergence, recommendations.

Boundary outputs: [fact roles](fact-roles.md), [owner and transitions](single-writer.md), [risk classification](backwrite-risks.md). Evidence lives in [inventory](../inventory/index.md), not this navigation page.

## First-principles questions

1. Who is the single source owner of reusable behavior? Compare both repositories' packages/*/package.json and public exports; do not infer ownership from current prefixes.
2. What changed between current Halfcode and the cloned/refactored project? Inspect Git provenance and clone script semantics; which independent changes require reconciliation instead of whole-directory replacement?
3. Which packages really implement contract, logic, support, adapter, capsule and shell roles? Inspect public APIs, dependencies and authority paths for each manifest.
4. What does a third CLI need to supply without editing Host? Trace command registry, product identity, resource discovery and builtin Kind provider ingress through public contracts.
5. Who owns formal workspace source, materialized catalog, runtime sessions and migration ledger? Inspect resource loaders, materializers and lifecycle entrypoints; can projections write back to source?
6. Can a one-shot CLI consume the smallest capability closure without Serve or optional browser/Vue/MCP dependencies? Trace CLI-first composition and packed consumer harness.
7. Which identifiers are package names versus durable wire/resource identity? Inspect FQN, owner/fingerprint, global runtime bridge, workspace directory and schema-version fields before proposing any renaming.
8. What makes a package independently distributable and compatible? Inspect exports, engines, dependencies, pack scripts and runtime artifact recipes; where are workspace/source-path assumptions?
9. Can Halfcode itself become an ordinary public consumer while preserving clone workflows? Inspect CLI bootstrap and scaffold scripts; distinguish application scaffold from full working-tree snapshot cloning.
10. What sequence proves reuse and preserves rollback across two repositories? Inspect existing verification gates and mission limitations; require immutable artifacts and explicit adoption checkpoints.
