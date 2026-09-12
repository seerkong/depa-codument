# Typed leaf SOP template

Use this template for one reusable operation. Keep all six blocks exactly once, non-empty, outside fenced examples, and in this order. The natural-language `<procedure>` is opaque Markdown; it is not a graph or an automatic executor.

```markdown
---
envelopeVersion: halfcode.resource-envelope/v1
specVersion: 1
kind: SOP
metadata:
  fqn: Example.SOP.PerformOperation
spec:
  profile: typed-leaf
  description: Perform one operation and verify its receipt
---

<input_contract>
Describe canonical inputs and their owning authorities.
</input_contract>

<preconditions>
Describe observable conditions required before the operation starts.
</preconditions>

<procedure>
Describe the operation in readable multiline Markdown. Preserve stable references and do not invent facts.
</procedure>

<effects>
List allowed external or workspace effects and the runtime authority that owns each one.
</effects>

<output_contract>
Describe the result shape and stable references returned to the caller.
</output_contract>

<success_criteria>
Describe evidence required to claim completion and the failure discipline when evidence is absent.
</success_criteria>
```

Do not initialize a workflow Notebook for `typed-leaf`; it has no Step Graph topology.
