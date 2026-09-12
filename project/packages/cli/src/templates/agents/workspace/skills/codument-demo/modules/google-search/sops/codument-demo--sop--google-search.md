---
envelopeVersion: halfcode.resource-envelope/v1
specVersion: 1
kind: SOP
metadata:
  fqn: Codument.Demo.SOP.GoogleSearch
spec:
  profile: typed-leaf
  description: Google HK 搜索与原页面回填 SOP
---

# Google HK 搜索与原页面回填 SOP

<input_contract>
输入来自页面 action：必须包含原始 `page=google-search` 与不透明 `targetRef`。业务 query 由 runtime 按 selector 从该页面读取；不得把 targetRef 复制进业务 input。
</input_contract>

<preconditions>
全局 Host skill 已加载；exact PageWorkflow FQN `Codument.GoogleSearch.Workflow.Search` 在当前 runtime 唯一可解析；原始 targetRef 仍有效。
</preconditions>

<procedure>
1. 原样使用消息中的 `page` 与 `targetRef`。确认 `page` 为 `google-search`；不得猜测、替换或改用其他页面实例。
2. 按全局 `codument` host skill 为当前宿主选择 CLI `PageWorkflow list` 或 MCP App `page_automation_list`，精确确认 `Codument.GoogleSearch.Workflow.Search` 唯一存在。
3. 用当前宿主的 PageWorkflow start 能力启动该 workflow：将原始 `targetRef` 放入 `fromServedPage.origin.byServedPageRef` selector，`subject` 使用 `{ "byExternalPage": {} }`，input 传 `{}`。runtime 会先通过 selector 指定的页面读取 query。
4. 只有返回 runId 才算启动成功。保存 runId，并在同一 CLI Serve 或 MCP App server 查询到 `completed` 或 `failed`。
5. workflow 使用 Ego Lite 打开或复用唯一的 `https://www.google.com.hk/` 标签页，提交 query，并由 registry PageObject 提取第一页自然结果；runtime 随后按原始 targetRef 回填。
</procedure>

<effects>
PageWorkflow 可经已声明的 Ego Browser capability 操作唯一 Google HK 标签页，并经 PageObject result target 更新原始 served Page。不得写入其他页面实例或创建替代浏览器 authority。
</effects>

<output_contract>
返回同一 runtime 的 PageWorkflow receipt；成功结果包含 runId、query、结构化自然结果与 count，页面入口还必须能从原始 targetRef 读取已回填 receipt。
</output_contract>

<success_criteria>
只有 workflow 状态为 `completed`、count 与结构化结果有效、且 runtime 已向原始 targetRef 回填同一 run receipt 时才报告成功。失败时报告真实 error；不得把已提取但未回填的结果声称为成功，也不得换用其他 Serve 或 targetRef 重试。
</success_criteria>
