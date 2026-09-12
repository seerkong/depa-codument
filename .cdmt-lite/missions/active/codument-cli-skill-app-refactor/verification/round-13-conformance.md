# Round 13: exact live client and invocation-scoped CLI runtime

Execution state belongs to `../loop.md`. H is the canonical Halfcode source; C's product source remains a frozen migration input.

## Applied boundaries

- T06 execution contract defines the scope/instance/record observation, narrow transport ports and shared HTTP paths. The product must supply a canonical workspace root and explicit agent; no inferred global/default agent or private state path is added.
- T07 `live-client` selects a record for the exact scope, validates HTTP origin and live identity, rereads the record before a single invocation and checks the returned instance/material receipt. A late record change fails with an explicit possibly-executed warning. No record write, automatic start, retry, fallback, argv/code RPC or domain operation is available to this processor.
- T08 `live-transport` implements the T06 HTTP port using injected fetch, bounded per-request signals and redirect rejection. This refines rec-03's coarse T03 transport assignment: generic process/listener effects remain T03, but this Skill App protocol adapter belongs to T08. Putting a T06 dependency into the basic CLI T03 closure would violate the five-package minimum. No new package or dependency is introduced.
- T14 adds an identity-only probe on the existing HTTP shell. It observes the live owner, invokes no resource/handler/Page acquisition, rejects Origin and stale instances, and does not replace server re-admission on POST.
- T04 `createCommandHost` gains opt-in `runtimeScope: invocation`: every runnable leaf requires its own policy; policy resolution occurs before runtime acquisition; each invocation owns its runtime through handler/wait completion and cleanup. Workspace-scoped compatibility behavior remains the default. Acquisition rollback before returning a handle remains the factory's responsibility. The composing product must bind disposal for handles it owns; borrowed runtime handles are not implicitly closed.
- T01/T04 `RuntimeOwnership` / `createRuntimeLifetime` supplies explicit execution → live (Page/Codex) → providers → resources cleanup. It stops admission, drains work, preserves release order and aggregates errors without skipping later phases. The actual packed live fixture uses it; product-wide adoption is still pending.
- T02 combines software-owned leaf policy with admitted capability/backend lifetime; a local leaf cannot acquire a persistent dependency, a required-live leaf never downgrades, and an MCP entrypoint stays independent. T09 resolves only the observed concrete one-shot CLI backend combinations, rejecting caller lifetime overrides. Actual backend acquisition by the product remains a subsequent integration obligation.

## Installation fixture

`scripts/fixtures/optional-registry.ts` creates a closed loopback registry from public tarballs and installed vendor payloads. Dependency and peer/optional edges are traversed using actual installed resolution; absent optional packages are recorded. Public dependencies use normal name/version resolution without overrides. Fixture cache and npm user config are isolated; the registry stops before runtime tests.

This proves installation from controlled materials on the tested platform, not original vendor publisher authentication, arbitrary network isolation or other OS/CPU support. The existing browser/Vue/MCP tests remain; the live consumer now also executes a public CLI command through the public client, a real fixture record, real loopback HTTP and the actual PageWorkflow coordinator with controlled browser ports.

## Validation history and final evidence

- Initial targeted suite: 17 pass / 0 fail / 101 assertions (4 files), before the final type-only fetch signature correction.
- First optional attempt exposed a fixture dependency lookup error (Vue is installed under its real dependent package, not repository root); corrected lookup follows the observed graph.
- Second optional attempt exposed an overbroad expectation: two packed CLI packages were not direct or transitive consumer requirements. Added real CLI capsule/shell consumption, not an override or fake import.
- First combined CLI live fixture lacked required command doc metadata. Added the doc; no production validation weakened.
- Intermediate broad run: public CLI/resources/optionals/legacy passed, check failed on a test URL-vs-string type. Follow-up typecheck also exposed Bun's missing RequestInfo alias; corrected effect signature uses string | Request | URL. Final broad and minimum-runtime suites are running under new immutable log labels.
- Final `run-upstream-check.ts round-13-final`: all five commands exit 0. Root check: **494 pass / 0 fail / 2557 assertions / 108 files**, including typecheck and lint. Public CLI/resources/optionals/legacy gates pass. Logs: `logs/round-13-final-*`.
- Final `verify-minimum-bun.ts round-13-minimum-final --curl-mirror`: pinned Bun **1.3.0**, original SHA512 archive integrity and binary digest `ce7b4f94a13ee0f881b06cfb4e428a017ddc69c3307dae0cb86709042fe0c058`; CLI/resources/optionals all exit 0. Logs: `logs/round-13-minimum-final-{cli,resources,optionals}.log`. This supersedes E128's unresolved optional-install observation for the tested controlled fixture, not other platforms.
- H source: 910 eligible files, digest `a34275c2e6f4dd6f396bf8e882fd8dd15bfd6dfd248748f6fd0f599c0b55f5f4`; 28 paths differ from round 12, no removals. `cross-repo-output-round-13.json` records hashes/origins. C's 1207 protected files remain byte-identical to the original frozen baseline (`607bcf383a027dce766b4a78057a92fe8b5e5a610e21dd78b6a0cfc1c57bc5c8`). Both Git diff whitespace checks pass.

## DEPA and readability review

Record files are derived routing observations; current identity is supplied by the live owner and every POST re-admits its resource. T07 has no direct network/filesystem access or record write port; T08 implements the declared effect and T14 adapts HTTP only. Payload, scope, policy, actual capability bindings and cleanup ownership remain distinct. Event sourcing/reactive graph profiles are not activated by this change. Simplify review retained the existing public host API and consolidated in-flight tracking instead of creating a parallel dispatcher; no checks were removed. This local implementation review is not a fresh-agent final mission acceptance.

## Remaining scope (not PASS by implication)

Public per-invocation policy selection is not full product command migration. The concrete capability acquisition adapter currently in C `project/packages/cli/src/cli/runtime/local-functions.ts` (workspace/clock/ids/SQLite/profile/database/Page target mapping and partial-acquisition rollback), remaining browser/backend runtime construction, full Page projection/catalog-only composition and the product aggregate still require integration against public contracts. Generic phase cleanup is proven but does not itself prove all products wired their ownership correctly. Product adoption, Codument command bindings, workspace/migration/token work and the three-command user checkpoint remain in the mission graph. No real browser/messages, npm publish, global installation or product workspace upgrade was performed.
