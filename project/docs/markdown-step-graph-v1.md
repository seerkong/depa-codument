# Markdown Step Graph v1

Typed pipeline SOP 的拓扑 authority 是 `<procedure format="markdown-step-graph/v1">` 内的 Step Cards。Entry 选择起始 Step；每个 Step 绑定一个 Child SOP，声明输入映射、进入条件、成功/失败判据和 Route 或 End。不能把生成的 Mermaid 图反写成另一套拓扑。

SOP 的资源 envelope 使用 `envelopeVersion: halfcode.resource-envelope/v1` 与 `specVersion: 1`，profile 为 `typed-pipeline`。六个语义块包括 input_contract、preconditions、procedure、effects、output_contract、success_criteria；可执行细节参考发行 Skill 内的 typed-pipeline-sop 模板。

资源文件头示例（后接上述六个语义块）：

```markdown
---
envelopeVersion: halfcode.resource-envelope/v1
specVersion: 1
kind: SOP
metadata:
  fqn: Example.SOP.Pipeline
spec:
  profile: typed-pipeline
  description: Run verified child operations
---
```

执行前使用 `codument SOP validate --fqn <FQN>`。`SOP graph` 是可重建投影，`SOP notebook init` 创建只记录实际发生事件的 Notebook。每次续跑核对 FQN、content digest 和 format；源发生变化时旧 Notebook 不能直接作为当前裁决，必须明确迁移或重置。

在副作用前记录 running，之后记录真实 receipt。失败不得伪造成功 Route；缺失 Child SOP、悬空 Route、不可达 Step 和模糊分支都应保留诊断。上层 pipeline 编排，不拥有 Child SOP 的业务事实。
