# Two repositories: current source and composition

```mermaid
flowchart LR
  subgraph HRepo["H - Halfcode source tree"]
    HCLI["Private CLI - mixed shell capsule support logic"]
    HContract["Scoped Skill App contract - contract"]
    HEffects["Private Vue and MCP packages"]
    HClone["Clone script - working tree copier"]
  end
  subgraph CRepo["C - Codument project tree"]
    CCLI["Private Codument CLI - shell and product capsule"]
    CHost["11 generic Host source libraries"]
    CDomain["4 domain libraries - separate authority"]
    CClone["Clone script - divergent copy policy"]
  end
  Authored["Authored resource packages - filesystem authority"]
  Notes["Isolated Notes fixture - public API consumer"]
  HNative["H native artifacts - generated distribution"]
  CNative["C native artifacts - generated distribution"]
  HCLI -->|depends on| HContract
  HCLI -->|depends on| HEffects
  CCLI -->|depends on| CHost
  Notes -->|imports packed public APIs| CHost
  HCLI -->|observes| Authored
  CHost -->|observes| Authored
  HCLI -->|build recipe projects| HNative
  CCLI -->|build recipe projects| CNative
  HCLI -->|source input to| HClone
  CCLI -->|source input to| CClone
```

Halfcode currently keeps most Host mechanisms inside its private CLI, while Codument has extracted eleven generic source libraries and four separate domain libraries; the domain node has no product-admission arrow because default Codument Kind registration is still absent (R03). The Notes fixture is an existing packed public-API consumer, but local tarball overrides and inspected assertions are not evidence of npm publication or current Halfcode adoption. Each native artifact arrow denotes a release recipe, not a successful release: PD03 and PD04 record concrete Codument release-check mismatches. The two clone scripts copy working-tree material and now differ in root filtering and replacement order; this view therefore draws no current cross-repository synchronization arrow.

Evidence: [package rows C02–C20 and H02–H08](../../inventory/package-boundaries.md), [provenance PD01–PD06 and consumer fixture](../../inventory/provenance-distribution.md), [domain ingress F18](../../inventory/fact-nodes.md), and [R03](../../boundary/backwrite-risks.md). Source anchors: `C/packages/cli/package.json:15`, `H/packages/cli/src/cli/runtime.ts:36`, `C/scripts/verification/consumer.ts:50`, `C/packages/cli/src/cli/runtime.ts:86`.
