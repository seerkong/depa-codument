# Authored truth, admission and derived execution views

```mermaid
flowchart LR
  Author["Package author - owner"]
  Source["F03 source - current_authority / filesystem"]
  Contract["F07 identity - current_authority / versioned value"]
  Registry["F06 Kind registry - current_authority / admitted registrations"]
  Virtual["F04 input - derived_observation / immutable read port"]
  Snapshot["F05 snapshot - derived_observation / recomputed"]
  Bundle["F09 bundle - derived_observation / staged artifact"]
  Index["F10 definitions - derived_observation / revision cache"]
  Legacy["Legacy import - later live source read"]
  Author -->|owns| Source
  Contract -->|supplies owner identity| Registry
  Registry -->|projects builtin Kind input| Virtual
  Source -->|projects| Virtual
  Virtual -->|compiler projects| Snapshot
  Registry -->|resolves and locks| Snapshot
  Snapshot -->|admits| Bundle
  Source -->|captured bytes materialize| Bundle
  Bundle -->|projects| Index
  Snapshot -->|revision keys| Index
  Source -.->|R04 check then later import| Legacy
  Legacy -->|admitted definitions populate| Index
  classDef issue fill:#fff0f0,stroke:#c62828,color:#7f0000
  class Legacy issue
  linkStyle 10 stroke:#c62828,stroke-width:2px
```

The package author owns physical source, and Kind registrations declare semantic ownership; the virtual builtin input, resolved snapshot, staged bundles and definition cache are projections with distinct lifetimes. Package-profile TypeScript descriptors are another declared source entry and are cross-checked against discovered resources; that branch is documented in F08/P02 and omitted here to keep the projection view focused. The red R04 branch is a conditional checked-bytes versus imported-bytes race in legacy loading, because `beforeLoad` can separate digest validation from importing the live source path; it is not a source backwrite and was not reproduced in this design scan. No projection-to-source arrow or competing runtime authority was established, while R01 separately warns that changing the contract package name affects identity, fingerprints and locks.

Evidence: [F03–F10](../../inventory/fact-nodes.md), [P01–P04](../../inventory/read-write-paths.md), [resource owners](../../boundary/single-writer.md), [R01, R04 and R05](../../boundary/backwrite-risks.md). Red-edge anchors: `A/packages/skill-app-support/src/resources/bundle-materializer.ts:174`, `:177`, `:189`, `:192`; positive projection anchors: `A/packages/skill-app-support/src/resources/authored-loader.ts:14`, `:33`, and `A/packages/skill-app-support/src/resources/workspace-resource-catalog.ts:753`. R05 leaves dependency-byte immutability uncertain even on the staged package branch; the diagram does not imply it is fully pinned.
