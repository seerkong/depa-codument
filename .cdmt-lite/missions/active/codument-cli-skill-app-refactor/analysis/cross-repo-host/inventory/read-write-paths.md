---
status: active
last_verified: 2026-09-05
scope: package
---

# Critical read/write paths

Evidence prefixes and fact IDs are defined in [fact-nodes](fact-nodes.md). Static source tracing only. `UNKNOWN` is an unverified integration/consistency guarantee, not proof of a bypass. Risk IDs resolve in [backwrite-risks](../boundary/backwrite-risks.md).

| 路径步骤 | 操作/位置 | 输入来源 | relation | owner boundary | 标记 |
|---|---|---|---|---|---|
| P01.1 Resource-first discovery | A/packages/skill-app-support/src/resources/workspace-resource-catalog.ts:204,222 | product source-root list F01/F03 | discovers | roots normalized, workspace confinement and symlink checks at :123 | OK-declared-relation |
| P01.2 Virtual builtin addition | A/packages/skill-app-support/src/resources/authored-loader.ts:14 | physical manifest + F06 | projects | read-only port; physical collision fails; source hash retained | OK-declared-relation |
| P01.3 Resolve source | A/packages/skill-app-support/src/resources/host-resource-contracts.ts:268 | compiler tree + registered contracts/readers | resolves | compiler Kind registry; exact reader profile | OK-authority |
| P01.4 Publish read model | A/packages/skill-app-support/src/resources/workspace-resource-catalog.ts:634,753 | resolved tree + authored/content/material identities | projects | catalog returns frozen records and revision; no source write | OK-declared-relation |
| P02.1 Code-first profile selection | A/packages/skill-app-support/src/resources/app-package-materializer.ts:231 | SkillApp/SkillModule package-profile manifest | delegates descriptor authority | rejects inline business fields competing with package descriptor at :237 | OK-authority |
| P02.2 Exact package admission | A/packages/skill-app-support/src/resources/package-protocol.ts:253 | package.json + bun.lock + installed exact contract | verifies | contract package identity/version and lock closure checked; not arbitrary semver | OK-authority |
| P02.3 Descriptor projection | A/packages/skill-app-support/src/resources/workspace-resource-catalog.ts:691,709 | loaded descriptor + discovered canonical resources | projects and cross-checks | membership mismatch diagnostic; descriptor cannot silently invent catalog members | OK-declared-relation |
| P03.1 Bundle preflight | A/packages/skill-app-support/src/resources/bundle-materializer.ts:147 | F05 + fresh authored source | observes and compares | manifest/authored/effective/material digests must match | OK-authority |
| P03.2 Resource HostBundle staging | A/packages/skill-app-support/src/resources/bundle-materializer.ts:99,184 | admitted captured source bytes | materializes | write-exclusive files inside owned temporary root | OK-declared-relation |
| P03.3 Package HostBundle staging | A/packages/skill-app-support/src/resources/host-package-materializer.ts:283 | package source digest list | verifies then materializes | reread bytes checked before staging; package.json copy/live node_modules symlink separately traced | UNKNOWN |
| P03.4 Legacy bundle execution | A/packages/skill-app-support/src/resources/bundle-materializer.ts:167,177,189,192 | checked legacy material then live module path | executes | import can read later source after material check; static race R04 | RISK-bypass |
| P03.5 Descriptor/definition admission | A/packages/skill-app-support/src/resources/bundle-materializer.ts:196,205 | imported resourceDefinitions/default.resources | admits | brand recognized or public descriptor converted; allowed Kind, schema, unique FQN checked | OK-authority |
| P03.6 Definition cache | A/packages/skill-app-support/src/resources/bundle-materializer.ts:316 | snapshot revision + materialized index | caches | cache retains latest revision; failed promise cleared; source not writable through catalog | OK-declared-relation |
| P03.7 Artifact release | A/packages/cli-host-capsule/src/resources.ts:45; A/packages/skill-app-support/src/resources/temporary-artifact.ts:16 | admitted lookups / owned generation handles | drains then releases | catalog before explicitly owned materializers; each artifact deletes only its allocated root | OK-authority |
| P04.1 Kind extension admission | A/packages/skill-app-support/src/resources/host-resource-contracts.ts:205,217 | core + Skill-App + Host + consumer registrations | registers owners/revisions/readers/resolutions | common registries own admission, no silent Host-side override | OK-authority |
| P04.2 Kind identity/lock | A/packages/skill-app-contract/src/resource.ts:404; A/packages/skill-app-support/src/resources/host-resource-contracts.ts:238,247 | package identity + schemas + readers | fingerprints and locks | expected lock compared exactly; rename can change this identity R01 | OK-declared-relation |
| P04.3 Codument default binding | A/packages/domain-contract/src/resources.ts:73 → A/packages/cli/src/cli/runtime.ts:86 | available domain registrations | missing default composition edge | no registrations passed; structural definitions do not prove actual product admission R03 | UNKNOWN |
| P05.1 CLI command dispatch | A/packages/cli-host-logic/src/commands.ts:52,61 | product command tree and caller runtime | commands | exact executable leaf validated; execution does not own process output/exit | OK-authority |
| P05.2 Command runtime selection | A/packages/cli/src/cli/runtime.ts:45,52,73 | explicit policy + workspace root | constructs scoped dependencies | product matches profile/placement; page owner constructed only for selected profile | OK-authority |
| P05.3 LocalFunction preflight | A/packages/cli/src/cli/runtime/local-function-execution.ts:30 | definition/source/profile snapshots | observes and pins admission | before/after revision; digest includes descriptor, source authority, content/material and profile | OK-authority |
| P05.4 Local invocation | A/packages/cli/src/cli/commands/local-function.ts:53,56; A/packages/skill-app-logic/src/local-function.ts:71 | prepared definition + input/config | commands | build declared runtime, invoke validated handler, finally release | OK-authority |
| P05.5 Serve invocation | A/packages/cli/src/cli/runtime/local-function-execution.ts:66 | narrow FQN/input/config/profile/digest request | commands | no arbitrary argv/code/placement and no automatic server start; exact instance required | OK-authority |
| P05.6 Serve re-admission | A/packages/cli/src/cli/http/app.ts:207 | client request + current server record/resource snapshot | verifies then commands | workspace/agent/instance/digest/placement checks repeated before invoke | OK-authority |
| P05.7 Runtime teardown | A/packages/cli/src/cli/runtime.ts:167 | admitted functions/workflows + borrowed browser/definitions | drains then releases | LocalFunction → page/codex → browser → resource host | OK-authority |
| P06.1 Legacy global bridge | A/packages/cli/src/cli/resources/definitions.ts:5; B/packages/cli/src/cli/resources/definitions.ts:549 | imported definition API | publishes compatibility binding | immutable process-global install rejects different owner; global key differs across products | OK-authority |
| P07.1 Domain transition | A/packages/domain-capsule/src/index.ts:14,24 | command + explicit repository ports | commands | per-resource queue; outer instances still need repository CAS | OK-authority |
| P07.2 Domain durable commit | A/packages/domain-support/src/lifecycle-repository.ts:141,163,218,221 | owner snapshot + proposed update | transitions/records | exclusive workspace lock, source CAS, staged rename; crashes retain recovery evidence | OK-authority |
| P08.1 Page generation | A/packages/skill-app-support/src/page-generation-store.ts:140,160,228 | generated build output | materializes/projects/prunes | fresh generation directory; current pointer updated; current generation retained | OK-declared-relation |

28 rows: OK-authority 17, OK-declared-relation 8, UNKNOWN 2, RISK-bypass 1. The bypass risk is a checked-source-to-execution consistency race; no source backwrite was observed. Host package dependency closure pinning is separately uncertain at P03.3 because build uses a live installed dependency tree; this scan did not reproduce mutation during build.
