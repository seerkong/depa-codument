---
status: active
last_verified: 2026-09-05
scope: package
---

# Design and recommendations fresh review — round 1

Verdict: **FIX_APPLIED**. One important execution-plan consistency gap was corrected in two Verify fields. No further blocking design gap was found within this bounded package-level review. The parent must run a fresh round 2 before closing the recommendations gate; this result is not product, implementation, migration or release PASS.

## Correction applied

The work graph moved unfinished generic extraction and runtime work to Halfcode canonical source, ahead of Halfcode/Codument product adoption, but their Verify fields still named only commands under the old Codument `project/` tree. At that phase those commands could exercise the retained pre-adoption copy and pass without validating the newly migrated public implementation. This conflicted with rec-02/03's upstream/public-artifact proof and the graph's new source-owner prerequisites.

After the parent released those exact fields, changed [loop.md:118](../../../loop.md) and [loop.md:146](../../../loop.md): require tests against Halfcode public package source plus independent fixtures consuming newly packed `halfcode-cli-lite-*` artifacts. Existing `project` commands remain historical or post-adoption regression evidence and cannot independently complete either node. The replacement gates are explicitly planned, not claimed to exist or have run. No other mission fields or author-owned design/recommendation text were changed by this reviewer.

## Review boundary and evidence

Read the depa-expert skill, fresh-child/gap-loop protocol, recommendation schema, package-role protocol and framework-neutral DataTopology rules. Reviewed the analysis scope, final inventory and boundary findings, all six convergence documents, all ten recommendation documents, MISSION.md, the work graph and technical attractor. This reviewer waited for both authors to finish before the final verdict.

Sampled source evidence directly: `C/packages/cli-host-contract/src/index.ts:5,39,70`, `C/packages/cli/src/cli/runtime/local-function-execution.ts:30,66`, `C/packages/cli/src/cli/http/app.ts:207`, and `C/packages/skill-app-support/src/resources/package-protocol.ts:253`. They support the existing command/runtime contract, private full preflight/server re-admission gap, and exact package/lock checks that the new public contract must preserve. `C/` expands to `/Users/kongweixian/infra-dev/depa-codument/project/`; `H/` to `/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/`.

This was an analysis adequacy gate. No product tests, builds, installs, registry queries, publication, clone operations or product-source edits were run. The observed R04 window and R05 dependency-byte uncertainty retain their different evidence strengths; neither was dynamically reproduced here.

## Important boundaries checked

- All 33 current physical manifests have one disposition row; the 14 target public packages have explicit names, roles, owner, public capability and prohibited dependencies. The three new resource/live/HTTP boundaries have distinct installation or lifecycle responsibilities. Support ports, capsule selected closures and the Codument adapter's two public sides are stated. Existing private roots, product/native distribution and vendor-facing identities have limited compatibility exceptions; public reusable libraries all retain closed-role suffixes. No extra framework or mechanical six-package feature template is required.
- Basic CLI installation excludes Skill App/Hono/browser/Vue/MCP; resource/live capabilities and concrete optional providers are selected separately. Architecture §3 and rec-02 require package-manager closure proof, while rec-03 separately verifies lazy creation, concurrent initialization, failure/close behavior and borrowed handles. Small exports or lazy imports are not treated as installation isolation.
- Architecture §4 distinguishes consumer commands, declarative Kind registrations and the finite executable ABI. Existing Notes provider evidence does not stand in for missing Codument default registration or arbitrary executable Kind extensibility. B02 requires explicit domain owner/readers and negative admission cases while retaining unfinished domain semantics in the existing mission nodes.
- Architecture §6 and rec-02 separate exact artifact provenance from semantic owner/revision/reader identity. Limited legacy profiles, preserve-existing-write, trusted release mappings, conflicting owner/integrity/version rejection and exact-name compatibility entry or explicit migration are stated. Neither a new npm prefix nor equal version numbers bypass exact admission. Formal `codument/`, legacy global APIs and Vue keys remain separate identity axes.
- rec-03/04 connect source/profile/instance admission to actual executed closure, including legacy relative dependencies and package metadata/lock/dependency mutation cases. Source authority and derived artifact/cache lifetimes remain distinct; cleanup cannot overwrite authored files. Domain lock/CAS/journal is not promoted into an event-log architecture or a completed general migration ledger.
- Architecture §9, D09 and B05 separate consumer scaffold, source-only snapshot and explicit full eligible-working-tree snapshot. Full mode includes dirty tracked bytes, tracked paths that match ignore, nonignored untracked bytes and the original lock. Source allowlist cannot silently remove docs/mission/codument from that full mode. Rebrand has a separate receipt and cannot globally replace public package or semantic identity; historical dirty clone provenance is not a fabricated Git merge base.
- rec-01…04 each have the required eight sections, evidence, a bounded delivery and observable positive/negative conformance. B01…B09 retain product adoption, normal transitive dependency resolution, final native/runtime/platform proof, clone modes, frozen commands, historical migration/context obligations and existing full-check failures. Library/core recipe proof, final Codument product acceptance and real npm publication are explicitly different gates.

## Dependency and phase adequacy

The logical first batch is `rec-01 → rec-02 → {rec-03, rec-04}`, with default serial work on rec-03 then rec-04 because their contract/admission/materializer edits overlap. Their final artifact set must jointly pass before Halfcode self-consumption, then Codument adoption, then the three-consumer/ordinary-transitive-resolution gate. Moving the source ledger portion of C06 into rec-01 removes the apparent C01/C06 cycle; clone scaffold can wait for the release set without blocking the initial public-package work.

The work graph preserves incomplete domain/workspace/migration/context nodes and historical scoped evidence. Library fixtures can run before complete Codument feature migration, but final native/bin/JSON/exit compatibility, real dogfood and old `src/` retirement remain after the separate three-command decision. Rollback distinguishes source changes, product manifest/lock pins, immutable published artifacts and already-migrated authored data requiring backup/receipt/controlled restore. No circular requirement to complete the frozen command integration before testing the core public set was found.

Read-only structural checks on the final author files found 16 convergence/recommendation Markdown files, four rec documents with all required sections, no broken local links in those 16 files, and a work graph of 23 nodes / 30 edges with no unknown prerequisites or cycles. This checks document structure, not whether planned conformance has executed. The reviewed design set SHA-256 is `d6359b4781079177a783f526ca5dafaf6d84c117119f1ff9e08d6b328214f816`, computed from sorted relative path, NUL, file bytes, NUL for all Markdown files directly under convergence/ and recommendations/.

## Remaining limits

Exact implementation API signatures, final installed metadata, runtime floors, platform smoke results and npm ownership remain future evidence obligations. Historical full-check failures remain unresolved. The parent still owns completion of analysis navigation, manifest/evidence and loop summary fields after the independent gates; those progress-only updates are not treated as missing product implementation in this review. Fresh round 2 should recheck the two Verify corrections, the final design/recommendation set and cross-document phase consistency, without rerunning product tests or expanding the architecture.
