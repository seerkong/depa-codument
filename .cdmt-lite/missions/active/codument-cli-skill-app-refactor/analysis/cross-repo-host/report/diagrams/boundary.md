# Existing package boundaries and command-host closure

```mermaid
flowchart TB
  subgraph CClosure["C - minimal fixture production closure"]
    CContract["cli-host-contract - contract"]
    CLogic["cli-host-logic - logic"]
    CSupport["cli-host-support - support"]
    CCapsule["cli-host-capsule - capsule"]
    CShell["cli-host-shell - shell"]
    SContract["skill-app-contract - contract"]
    SLogic["skill-app-logic - logic"]
    SSupport["skill-app-support - support"]
  end
  CCLI["C private CLI - shell and product capsule"]
  subgraph HBoundary["H - existing private composition"]
    HCLI["halfcode-cli-lite-cli - mixed roles"]
    HContract["@halfcode-cli-lite/skill-app-contract - contract"]
  end
  CCLI -->|depends on - sampled product edge| CCapsule
  CLogic -->|depends on| CContract
  CSupport -->|depends on| CContract
  CSupport -->|public codec dependency| CLogic
  CCapsule -->|depends on| CContract
  CCapsule -->|depends on| CLogic
  CCapsule -->|depends on| SContract
  CCapsule -->|depends on| SLogic
  CCapsule -->|depends on| SSupport
  CShell -->|depends on| CContract
  CShell -->|depends on| CLogic
  CShell -->|depends on| SContract
  CShell -->|depends on| SLogic
  SLogic -->|depends on| CContract
  SLogic -->|depends on| SContract
  SSupport -->|depends on| SContract
  SSupport -->|public validation and codec dependency| SLogic
  HCLI -->|depends on| HContract
```

Names inside the C closure omit only the existing `depa-codument-` prefix; all eight nodes are installed by the minimal fixture because its five CLI Host packages transitively require all three Skill App packages. Browser, Vue and MCP packages are outside this closure, but compiler, AJV, YAML and Hono vendor dependencies remain, so a small root import is not the same as a small installation. The two support-to-logic arrows use public codecs or validation APIs and are not demonstrated private-import violations; the inventory established no package cycle. Halfcode's mixed private CLI and its scoped contract are actual present boundaries, not suggested package destinations.

Evidence: [package rows C03–C10, H02–H03 and dependency-policy conclusion](../../inventory/package-boundaries.md), [PD07 and PD08](../../inventory/provenance-distribution.md). Source anchors: `C/packages/cli-host-capsule/package.json:25`, `C/packages/cli-host-shell/package.json:15`, `C/packages/cli-host-support/src/codex.ts:3`, `C/packages/skill-app-support/src/sop/notebook-store.ts:3`, `H/packages/cli/src/cli/runtime.ts:3`. Product edges are sampled; the [complete inventory](../../inventory/package-boundaries.md) owns all dependency lists.
