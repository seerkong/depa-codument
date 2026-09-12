# Cross-repository Host architecture report

Boundary: human-facing synthesis and evidence diagrams. Holds: [current-state report](current-state.md), current-state diagram views. NotOwnedHere: raw inventory facts, target package decisions, execution state. Tier: dated. Source: inventory/boundary; downstream: recommendations and user design review.

This report describes the inspected source on 2026-09-05. Current-state diagrams are evidence views, not approved package destinations or proof of published artifacts. Repository aliases follow [scope](../scope.md): `C` / `A` is the Codument `project/` tree; `H` / `B` is Halfcode `halfcode-cli-lite/`.

Read the five views in order:

1. [Two-repository overview](diagrams/system-overview.md) — present source ownership, consumers and distribution.
2. [Package dependency boundary](diagrams/boundary.md) — the existing minimal command-host install closure and private Halfcode composition.
3. [Fact-source relations](diagrams/fact-source.md) — authored authority, admission, derived caches and the bounded legacy execution risk.
4. [PageBuild input/output/runtime/config](diagrams/iorc.md) — a core component's present ownership and colocation.
5. [Local versus live execution](diagrams/execution-flow.md) — CLI preflight, local capabilities, forwarding and Serve re-admission.

Complete evidence is in [package boundaries](../inventory/package-boundaries.md), [fact inventory](../inventory/fact-nodes.md), [read/write paths](../inventory/read-write-paths.md), [provenance and distribution](../inventory/provenance-distribution.md), and [boundary risks](../boundary/backwrite-risks.md). Diagrams intentionally select relevant rows rather than reproducing the entire manifest inventory. Red highlights denote the specific issue named beside them; they do not mean every highlighted component is broken, and no source backwrite or package cycle was demonstrated.

Convergence and recommendations, when linked by the parent report, are proposals with separate ownership and acceptance gates. These diagrams retain current package identities and do not imply that equal version numbers make the two contract packages interchangeable.

Validation: five Mermaid blocks passed local structural checks for ASCII content, unique explicit node IDs, defined edge endpoints, balanced subgraphs, edge-style indices and existing relative Markdown links; node counts are 7–12. No local Mermaid parser was found in the checked tooling, so parsing and rendered visual validation were not performed. Product source and release artifacts were not changed.
