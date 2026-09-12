---
envelopeVersion: halfcode.resource-envelope/v1
specVersion: 1
kind: SOP
metadata:
  fqn: Codument.Demo.SOP.OwidOpenDataExport
spec:
  profile: typed-leaf
  description: OWID life-expectancy 开放数据筛选、ZIP 下载、结构化预览与可选页面回填 SOP
---

# OWID Open Data Export SOP

<input_contract>
本 SOP 支持页面入口和直接入口两个入口。canonical typed input 包含 allowlisted `chartSlug=life-expectancy`、`entityCodes`、`startYear`、`endYear` 与 `downloadScope=displayed|full`。页面入口还携带 exact `page=open-data-export` 与不透明 targetRef；直接入口不得虚构页面或 targetRef，也不得把 targetRef 加进 input。
</input_contract>

<preconditions>
`Codument.Owid.OpenDataExport.Workflow.Run` 在当前 runtime 唯一可解析，typed input 通过 registry schema，年份范围与实体代码有效；页面入口的 targetRef 仍有效。
</preconditions>

<procedure>
1. 页面入口原样保留消息中的 page、targetRef 和 canonical input；直接入口只使用同一 typed input。
2. 精确确认 workflow FQN，并用 registry schema 校验所有业务字段。
3. 启动 workflow：业务字段只从 typed input 原样透传；页面入口把 targetRef 放入 `fromServedPage.origin.byServedPageRef` selector，直接入口省略 selector 并使用 definition default。只有返回 runId 才算发起成功。
4. 在同一 runtime 查询 receipt 到 `completed` 或 `failed`。`failed` 表示运行基础设施失败；`completed` 后仍检查业务 envelope 的 `code`。
5. `code=0` 时报告 runId、rowCount、preview 与下载 meta；`code!=0` 时报告 `error.kind` 与真实 detail。
</procedure>

<effects>
Workflow 只允许配置 allowlisted OWID 图表、打开其 Download UI、触发一次 displayed/full ZIP 下载、解码 CSV/metadata/README，并在页面入口经 result target 更新原始 targetRef。
</effects>

<output_contract>
返回 PageWorkflow run receipt 与业务 envelope。成功 envelope 包含 `code=0`、结构化 data 与下载 meta；业务失败包含非零 code、error.kind 和真实 detail。
</output_contract>

<success_criteria>
只有同一 runtime 的 run 为 `completed` 且 envelope `code=0`，ZIP 下载与 CSV/metadata/README 解码均有真实证据时才成功。页面入口还要求原始 targetRef 回填完成；不得把部分下载、fixture 或旧页面结果声称为成功。
</success_criteria>
