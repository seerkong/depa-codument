# Freeform SOP template

Use this template when the procedure benefits from direct Markdown but does not need the typed semantic contract or a run Notebook. Freeform content MUST NOT be guessed into typed blocks or a Step Graph.

```markdown
---
envelopeVersion: halfcode.resource-envelope/v1
specVersion: 1
kind: SOP
metadata:
  fqn: Example.SOP.DescribeOperation
spec:
  profile: freeform
  description: Describe one reusable operating procedure
---

# Describe operation

State the authority boundaries, inputs, procedure, observable success, and failure handling in readable Markdown.
```

The FQN MUST contain exactly one canonical `.SOP.` segment. Omitted `spec.profile` also projects as `freeform`, but new files SHOULD declare it explicitly.
