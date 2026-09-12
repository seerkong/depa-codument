# Typed pipeline SOP template

Use this template only for an upper-level AI-orchestrated pipeline. The six semantic blocks remain the typed contract. Inside `<procedure format="markdown-step-graph/v1">`, Step Cards are the only topology authority; Mermaid is generated and the Notebook stores only occurred state.

```markdown
---
envelopeVersion: halfcode.resource-envelope/v1
specVersion: 1
kind: SOP
metadata:
  fqn: Example.SOP.RunPipeline
spec:
  profile: typed-pipeline
  description: Orchestrate validated Child SOPs
---

<input_contract>
Canonical pipeline input and authority references.
</input_contract>

<preconditions>
Conditions required before selecting the Entry Step.
</preconditions>

<procedure format="markdown-step-graph/v1">

## Entry

`run-child`

## Step `run-child` — Run child operation

### SOP

`Example.SOP.PerformOperation`

### Enter when

The canonical input reference exists.

### Input mapping

Pass the canonical reference without copying the owned business object into the Notebook.

### Success

The Child SOP returns a verifiable result reference.

### Failure

Record the real receipt and remain on this visit; do not take a Route.

### End `success`

Return the verified Child SOP result reference.

</procedure>

<effects>
Effects are owned by the referenced Child SOPs; this pipeline only orchestrates.
</effects>

<output_contract>
The final stable result reference and terminal status.
</output_contract>

<success_criteria>
The terminal evidence is verifiable and every occurred visit has a real receipt.
</success_criteria>
```

Before execution, run `depa-codument SOP validate --fqn <FQN> --json`, optionally inspect `SOP graph`, then run `SOP notebook init`. Verify Notebook FQN/digest/format on every continuation. Write `running` before effects, evidence-backed state after effects, and only the actual Route ID. On revision mismatch or ambiguous Route selection, stop for explicit reset/migration or a decision.
