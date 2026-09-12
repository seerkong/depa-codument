---
status: active
last_verified: 2026-09-05
scope: package
---

# Inventory fresh review — round 1

Verdict: **FIX_APPLIED**. All three inventory authors had completed before this verdict. A fresh second round is required; this reviewer does not continue itself. No user decision blocks the inventory. No source, tests, mission state, manifest, release artifact or publication was changed.

Reviewed scope: both targets in ../scope.md, ten questions in ../boundary/index.md, all nine leaf inventory/boundary documents. Parent-owned index/manifest aggregation is excluded from the leaf snapshot. Review used depa-expert inventory schemas, DataTopology rules and package-role protocol. This was bounded static review with read-only manifest enumeration and replay of the dependency-object comparison; no build, install, test suite or runtime reproduction was executed.

## Applied corrections

1. Added missing positive third-party extension evidence to inventory/provenance-distribution.md and the Kind-provider row of boundary/fact-roles.md. `A/scripts/verification/consumer.ts:75` invokes the packed custom-Kind fixture; `A/scripts/verification/custom-kind-consumer.ts:20–27` provides an independent owner/revision/reader and resource configuration, `:39–49` asserts command dispatch, unknown/conflicting provider rejection, writer-schema rejection and no physical KindDefinitions copies, and `:51` closes owned runtimes. Existing coverage and its no-rerun limit are now explicit. This is separate from absent default Codument domain admission and from arbitrary executable-Kind extensibility.
2. Updated inventory/depa-conformance.md Data row and checklist item ②. Previously the partial Data assessment cited incomplete package/distribution unification; it now cites the completed authority inventory's actual static admission race and bounded dependency staging uncertainty. `A/packages/skill-app-support/src/resources/bundle-materializer.ts:174,177,189,192` establishes the legacy check-to-live-import window; `A/packages/skill-app-support/src/resources/host-package-materializer.ts:297,300` establishes separate metadata copy/live dependency access. Neither is described as reproduced failure or source backwrite. Package naming and release verification no longer independently imply a Data violation. The 2/7 full checklist count is unchanged.

`A/` expands to `/Users/kongweixian/infra-dev/depa-codument/project/`; `B/` expands to `/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/`.

## Evidence audit and retained judgments

- Independently enumerated 33 physical manifests: A 21, B 12; 30 non-generated manifests, 26 immediate workspaces. Confirmed A 15 non-private source libraries and B one, with three native manifests each; B's three generated builder copies are derived payloads. Export-key counts agree with the table. Package suffix policy exceptions remain distinct from runtime defects and publication authority.
- Verified concrete support ports and public codec edges: `A/packages/cli-host-support/src/codex.ts:2–3` implements CodexSidecar and uses public logic codecs; `A/packages/cli-host-support/src/resource.ts:187` publicly re-exports a resource walker. This does not establish a private import, cycle or second authority. The inventory's conditional policy qualification remains appropriate; no blanket support-to-logic runtime failure is inferred.
- Independently replayed PD03 with all three runtime dependency objects: string comparison false, all keys/values equal. `A/scripts/check-release.ts:177` therefore rejects them before binary/pack checks. Verified PD04 copying source at `A/scripts/build-release.ts:33` versus allowlist at `A/scripts/check-release.ts:203–207`. Kept PD05 as unverified portability rather than asserted installed failure.
- Checked public contract identity at `A/packages/skill-app-contract/src/resource.ts:314,398,404,412` against B counterpart, and exact contract-registry/lock ingress at `A/packages/skill-app-support/src/resources/host-resource-contracts.ts:205–253`. Renaming defaults can affect owner fingerprints and lock compatibility; subject FQN, formal workspace path, globals and package identity are correctly separated.
- Checked virtual loader's read-only overlay and physical digest at `A/packages/skill-app-support/src/resources/authored-loader.ts:14–54`; no physical Kind-source write is present. Domain provider is explicitly draft and exports only owners/revisions (`A/packages/domain-contract/src/resources.ts:49,73`); product default factory receives no registrations (`A/packages/cli/src/cli/runtime.ts:86`). The actual-vs-proposed integration distinction is retained.
- Checked lifecycle owner caveat at `A/packages/domain-support/src/lifecycle-repository.ts:30–34`, package staging and legacy execution above, consumer tarball overrides at `A/scripts/verification/consumer.ts:35–49`, and source closure traversal at `:99–119`. No full release, registry ownership, cross-platform execution or general migration-ledger claim has been promoted from those narrower observations.
- Mechanical explicit-prefix locator check inspected 309 occurrences before corrections: concrete paths existed and lines were within file bounds. The only non-file match was the incidents introduction's explicitly illustrative `A/packages/...:10`, not a claimed evidence locator. Context-shortened locators were manually checked for the sampled critical claims; the review does not claim semantic verification of every cited line.

## Completed snapshot and counts

Git metadata: A's enclosing repository HEAD `bba44a1ac23cb8d5b2312f3cd0c9f78ddd471a8e`; B HEAD `9666641bcddfcee3b1d2842a7526d01630fdaf94`, B working tree clean at review. A's working tree is the analyzed source; HEAD alone is not its byte identity.

| Inventory | Rows | Relevant count |
|---|---:|---|
| Package boundaries | 33 | 16 match, 17 invalid-name/RISK rows; three derived copies inherit H05 |
| Provenance/distribution | 12 | 12 RISK rows; PD03/04 deterministic source checks, no full build |
| Incidents/observations | 9 | 5 current RISK conclusions; four repaired historical incidents |
| Fact nodes | 18 | 7 clean, 9 multi-entry, 2 model_uncertain |
| Read/write paths | 28 | 17 OK-authority, 8 OK-declared-relation, 2 UNKNOWN, 1 RISK-bypass |
| Boundary risk records | 5 | 0 demonstrated backwrites or competing runtime authorities |

These are overlapping evidence-table counts, not an additive unique-defect total.

After corrections, SHA-256 of the nine leaf documents is `d112b0582ae684031c34f5198e8ac923ccb0a827c0c4ef578de5e7dc3da83849`. Reproduction: sort the relative paths of inventory/{package-boundaries,provenance-distribution,incidents,depa-conformance,fact-nodes,read-write-paths}.md and boundary/{fact-roles,single-writer,backwrite-risks}.md; hash each UTF-8 relative path plus newline, raw file bytes, then newline in order. Review file and parent-owned index/manifest are excluded.

No further inventory correction identified in this bounded round. The next fresh review should verify the two corrections and cross-table consistency before architecture convergence consumes the inventory.
