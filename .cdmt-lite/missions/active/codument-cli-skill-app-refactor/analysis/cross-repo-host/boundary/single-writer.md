---
status: active
last_verified: 2026-09-05
scope: package
---

# Owner, transition and physical write boundaries

Evidence prefixes and node IDs refer to [fact inventory](../inventory/fact-nodes.md). Multiple physical writes or public methods do not establish multiple owners.

| Boundary | Owner and legal entrypoints | Physical writes / release | Current judgment |
|---|---|---|---|
| Resource truth F03–F05 | Package author owns source; catalog snapshot/list/detail all read through same loader/composer | Virtual maps and frozen results only; A/packages/skill-app-support/src/resources/authored-loader.ts:25 and workspace-resource-catalog.ts:634 | One source, multiple read projections. No source mutation from virtual Kind injection |
| Kind semantics F06–F07 | Owning contract declares subject/revision; compiler registries admit; readers provide consumer projection | registerOwner/revision/readers/resolutions at A/packages/skill-app-support/src/resources/host-resource-contracts.ts:217 | Different owner/reader roles do not constitute competing semantic authority; duplicate admission behavior delegated to compiler |
| Bundle selection/lifetime F09–F11 | Registry owns runtime mapping; catalog borrows injected registry; materializer owns temporary artifacts | register :243, cache :323, materializer close :135, catalog close :328 in A/packages/skill-app-support/src/resources/bundle-materializer.ts | Legitimate nested owners of distinct facts; borrowing/release distinction explicit |
| LocalFunction F13 | Catalog owns admission/drain; injected bindings own effect construction/release; handler receives capabilities | pending Set, finally release A/packages/skill-app-logic/src/local-function.ts:48,71,81 | Multiple invokes/prepare paths converge on same admission; no independent runtime truth implied |
| Workflow F14 | One Serve runtime coordinator owns live run map and serialized queue | runs/admissions/tail at A/packages/cli-host-capsule/src/page-automation.ts:209; close :277 | CLI-mediated and Page-mediated requests may legitimately command one coordinator; bare CLI does not gain ownership from a record |
| Lifecycle F15–F16 | DomainOwner serializes its own calls; filesystem repository is cross-process write boundary | lock, CAS, temp publication, recovery files at A/packages/domain-support/src/lifecycle-repository.ts:149,163,183,218,222 | Several write sites implement one transaction; no crash-atomic multi-file guarantee is claimed. Manual editor final-rename race explicitly documented at :30 |
| Page generation F17 | Generation store owns generated directory and current projection | immutable target check :142, rename :147, pointer :160, prune :230 in A/packages/skill-app-support/src/page-generation-store.ts | Artifact lifecycle and source lifecycle are distinct; pruning derived artifacts is not historical-authority deletion |
| Legacy global F12 | One product bridge owns its process-global name | immutable defineProperty A/packages/cli/src/cli/resources/definitions.ts:8; different API rejected :7 | Singleton is explicitly compatibility-scoped; two independently loaded implementations can fail installation, not silently overwrite each other |

No demonstrated authority_conflict or backwrite in the inspected paths. Exact runtime/HTTP composition remaining in the private product package is a reuse boundary gap, not evidence that current CLI and Serve each own the same live workflow. The extracted CLI explicitly forwards workflow-dependent invocations and Serve revalidates identity/digest (`A/packages/cli/src/cli/commands/local-function.ts:53`; `A/packages/cli/src/cli/http/app.ts:207`).

Repository source ownership across A and B is a separate design question: the current checked-out copies can evolve independently, but their mere coexistence does not create concurrent runtime writers to a workspace. This inventory does not choose a canonical upstream, migration sequence, or package names.
