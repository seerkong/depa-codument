---
status: active
last_verified: 2026-09-05
scope: package
---

# DEPA conformance of the observed reusable Host seams

`A` and `B` expand to the absolute repository roots defined in [incidents](incidents.md). This table evaluates present source and recorded verification, not the proposed final architecture. Four-dimensional observations, seven-point checks, optional Data profiles and package-role overlay are distinct; package naming and publication policy do not change the Data score.

## Four-dimensional evidence

| Dimension | Codument extracted seams (A) | Existing Halfcode seams (B) | Evidence and limit |
|---|---|---|---|
| Data | PARTIAL: physical authored source and projected compiler view are distinguished; per-host owned caches/resources have declared close paths. Legacy bundle execution can reread live source after admission, and package staging does not establish dependency-byte immutability (R04/R05). | PARTIAL: compiler and source contracts exist, but composition descriptor cache is process-global and not owned by an individual catalog at the inspected site. No second live source authority is inferred solely from two repositories. | A `packages/skill-app-support/src/resources/authored-loader.ts:14`, `:33`, `:52`; A `packages/skill-app-support/src/resources/bundle-materializer.ts:174`, `:177`, `:189`, `:192`; A `packages/skill-app-support/src/resources/host-package-materializer.ts:297`, `:300`; B `packages/cli/src/cli/resources/app-package-materializer.ts:368`. [R04/R05](../boundary/backwrite-risks.md) distinguish a static admission race from bounded dependency uncertainty; neither was reproduced here. Detailed node ownership remains in [fact-nodes](fact-nodes.md) and [read-write-paths](read-write-paths.md). |
| Effect | PARTIAL: generic command execution receives caller runtime; source/SQLite/browser effects are in support and close is explicit. PageBuild coordination still holds injected dependencies and mutable state in an object rather than a data-only runtime with separate processor functions. | PARTIAL: effect factories exist, but product bootstrap directly selects local provider implementations and constructs the full product graph; this public extraction seam is absent in B's private CLI. Global descriptor cache also retains hidden lifecycle state. | A `packages/cli-host-contract/src/index.ts:5`, `:70`; A `packages/cli-host-logic/src/commands.ts:61`; A `packages/skill-app-support/src/sqlite.ts:32`; A `packages/cli-host-capsule/src/page-build.ts:20`, `:34`, `:69`; B `packages/cli/src/cli/runtime.ts:36`, `:45`, `:56`, `:96`. Bootstrap environment reads are observed composition, not automatically core-logic violations. |
| Processor | PASS for sampled generic CLI dispatch: caller command tree is validated, parsed and dispatched through the public command contract, without product-name branches. Overall host remains PARTIAL because full execution-placement/runtime gate is explicitly unfinished. | PARTIAL: command table/schema exist but its assembly imports product command implementations, identity, rendering and runtime in the same private module; another CLI cannot obtain the observed generic public extension surface from that package. | A `packages/cli-host-logic/src/commands.ts:4`, `:16`, `:61`; A `packages/cli-host-contract/src/index.ts:38`; A `packages/cli-host-capsule/src/index.ts:11`; B `packages/cli/src/cli/command-registry.ts:1`, `:34`, `:47`, `:77`; A `scripts/verify-mission.ts:13`. Finite start/stop/status branches are fixed lifecycle transitions, not automatically a missing plugin registry. |
| Actor | PASS for sampled CommandHost/service ingress: a host owns per-root runtimes and tracks admitted work; service requests are copied/serialized and close drains accepted work. Broader independent-process supervision is only as strong as injected record storage. | PARTIAL: runtime constructs PageBuild, browser supervisor and workflow collaborators but the inspected constructor returns the graph without one aggregate close contract; ownership cleanup cannot be inferred from construction. | A `packages/cli-host-capsule/src/index.ts:22`, `:29`, `:45`; A `packages/cli-host-capsule/src/service.ts:3`, `:79`, `:88`; B `packages/cli/src/cli/runtime.ts:108`–`:121`. Service source explicitly assigns cross-process locking to record store; no cross-process exactly-once claim is made. Pure synchronous parsers are NOT_APPLICABLE for Actor. |

## Seven-point checklist

The assessment object here is the cross-repository extraction/adoption seam. “Partial” retains positive evidence and prevents a selected isolated-consumer pass from becoming a claim that both complete products conform.

| Check | Verdict | Evidence-backed reason |
|---|---|---|
| ① Runtime explicitness | 部分 | A command logic receives runtime (`A/packages/cli-host-logic/src/commands.ts:61`); PageBuild still owns runtime dependencies in instance fields (`A/packages/cli-host-capsule/src/page-build.ts:20`), and B still has module-global descriptor lifetime (`B/packages/cli/src/cli/resources/app-package-materializer.ts:368`). |
| ② Data | 部分 | Source/projection relation is explicit in A; the legacy check-to-import race and dependency staging uncertainty are R04/R05, while B retains process-global descriptor cache ownership. The four-dimensional Data row carries exact evidence. Package naming and incomplete release verification do not independently establish a Data violation. |
| ③ Effect | 部分 | Public ports and support exist (`A/packages/cli-host-contract/src/index.ts:70`, `A/packages/skill-app-support/src/sqlite.ts:4`); B product effect/runtime selection remains in its private graph (`B/packages/cli/src/cli/runtime.ts:3`, `:56`). Package-specific mixed/reverse imports are adjudicated exclusively in the package table. |
| ④ Processor | 部分 | A registry is reusable and validates complete command contracts (`A/packages/cli-host-logic/src/commands.ts:4`); B table still composes private product handlers (`B/packages/cli/src/cli/command-registry.ts:3`), and complete placement verification remains absent (`A/scripts/verify-mission.ts:15`). |
| ⑤ Actor | 部分 | A ingress/drain semantics are explicit (`A/packages/cli-host-capsule/src/index.ts:29`, `:45`; `service.ts:79`), while B's inspected runtime only exposes construction (`B/packages/cli/src/cli/runtime.ts:108`). This is not a fabricated claim of a reproduced leak in every B collaborator. |
| ⑥ Avoid overdesign | 符合（抽查范围） | Independent Notes consumer and actual product provide two distinct callers of generic command/identity ports (`A/scripts/verification/consumer.ts:51`; `A/packages/cli/package.json:16`); no empty adapter is required to claim conformance. OBS-09 records install closure without inventing a performance failure. |
| ⑦ Vendor primitives | 符合（抽查范围） | Compiler read-port/loader used directly (`A/packages/skill-app-support/src/resources/authored-loader.ts:1`), Bun build used for modules (`A/packages/browser-support/src/web-api.ts:11`), Bun SQLite SQL/transactions retained while release handles are tracked (`A/packages/skill-app-support/src/sqlite.ts:7`). This does not certify every helper in either repository. |

Literal checklist count is 2/7 fully conforming for this mixed extraction/adoption seam; five items are partial, none is counted as a full pass. It is not a numeric ranking of the complete products and does not outweigh the narrower PASS observations above. No conformance mark here means final release verified.

## Data profile activation

| Profile | Activation evidence checked | Verdict |
|---|---|---|
| EventSourcedStateProfile | Authored manifests are compiler input; caches, service records and receipts are present. No canonical append-only event authority plus replay/reducer was established in the sampled Host seams (`A/packages/skill-app-support/src/resources/authored-loader.ts:14`; `A/packages/cli-host-capsule/src/service.ts:17`). Naming a receipt or retaining historical E records does not activate event sourcing. | NOT_APPLICABLE. No event-sourcing target was requested in scope. |
| ReactiveDataGraphProfile | PageBuild has event subscription and a mutable coordinator/store (`A/packages/cli-host-capsule/src/page-build.ts:23`, `:55`); WebAPI cache is an ordinary Map (`A/packages/browser-support/src/web-api.ts:32`). The inspected watch/event notification transport does not establish a Signal/Observable state graph or reactive node topology. | NOT_APPLICABLE for the sampled Host extraction. This does not judge author-created Vue applications or deny their possible reactive UI internals. |

No concrete DEPA library reference mapping was activated: none is a demonstrated dependency of these seams. Optional profiles are excluded from the seven-point count and their absence is not a Data GAP.

## PackageRoleConformance overlay

Package scope is applicable. [package-boundaries](package-boundaries.md) is the sole row-level authority for declared role, observed role, dependencies, capability/authority evidence and every package GAP, across all manifests in A and B. Match rows by exact current package name (including scoped `@halfcode-cli-lite/skill-app-contract`), not by guessed new names. The overlay must consume that full inventory; this document deliberately does not substitute a few sampled seams for all-package conformance or assign publishing rights from a role suffix.

Relevant referrals from this inventory: OBS-06 maps to the two contract packages and private CLI packages; OBS-09 maps to `depa-codument-cli-host-capsule` and its skill-app closure. The global composition-cache evidence belongs to B's private CLI package row. Package target names/disposition are later convergence outputs, not conformance facts.

Verification limits: [incidents](incidents.md) INC-05 and OBS-07/08 remain current; real browser interaction, lowest Bun version matrix, final distribution/migration suite, public npm name availability and complete cross-platform runtime execution are not established. This inventory ran no tests and made no product changes.
