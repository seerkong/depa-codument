---
name: codument-demo
description: 通过静态 Page、可现场重建的 Vue Skill App、Ego PageWorkflow 与 PageObject 演示 Host runtime 能力。
---

# DEPA Codument Demo

从当前 `SKILL.md` 开始，按任务选择下方资源 catalog 与 reference。SOP、页面描述、PageWorkflow/PageObject schema 和成功判据只在本 workspace skill 中维护；运行方式由全局 `codument` host skill 决定。

<host_runtime_dependency>
<skill>codument</skill>
<role>提供 Codex CLI/agent-scoped Serve 或当前对话 MCP App、页面资源发现、Ego Browser、PageWorkflow、PageObject 和页面实例 RPC。</role>
<instruction>
执行本 skill 前先加载并遵循全局 `codument` skill。用户只需表达页面或业务目标，不要求用户描述端口、agent 参数、runId、PageObject 或 FQN 调用步骤。不得自行发明固定端口、浏览器或页面所属 skill。
</instruction>
</host_runtime_dependency>

<protocol>
先加载全局 `codument` skill。本 skill 只决定调用什么业务资源并维护其 catalog、schema 与 reference；资源发现、调用、agent scope、Serve、错误处理和运行边界全部遵循全局 host skill 中对应类型的 guidance。
</protocol>

<profiled_resources>
`config-profiles/personal` 与 `config-profiles/sandbox` 是可复制的多 profile 示例。Profile 根是 XNL；其 `app/web-api-endpoints.yaml` 为多个 BrowserWebApi 提供非敏感 Base URL，`kinds/DatabaseConnection/.../connection.yaml` 为声明式 SQLite connection 提供 `workspace://` 路径。

调用时使用 `ConfigurationProfile list`、`DatabaseConnection detail` 与 `BrowserWebApi invoke --fqn ... --profile personal|sandbox`。Browser transport 始终从 workspace `browser.transport` 选择，不能在 profile 或业务 input 中覆盖。LocalFunction 若需要 App 配置，必须同时声明 `runtimeCapabilities: ['configuration']` 和精确的 `appConfigurationRefs`；handler 只能通过 `runtime.resources.configuration.app.get(<已声明名称>)` 读取该 profile 的非敏感 App 配置。数据库使用 `runtime.resources.databaseConnections.require(...)` 和 `runtime.effects.database.open(...)`；BrowserWebApi 只能调用 `runtime.effects.browserWebApi.fetch({ path })`，其 handler 固定为 `(runtime, input, null)`。
</profiled_resources>

<sops>
<sop fqn="Codument.Demo.SOP.GoogleSearch">
<description>读取发起页面中的搜索词，通过 Ego Lite 搜索 Google HK，将第一页结构化自然结果精确回填原页面。</description>
<path>modules/google-search/sops/codument-demo--sop--google-search.md</path>
</sop>
<sop fqn="Codument.Demo.SOP.OwidOpenDataExport">
<description>筛选 allowlisted OWID life-expectancy 图表，下载 ZIP，解析 CSV/metadata/README，并支持 direct receipt 或 exact 页面回填。</description>
<path>modules/owid-open-data-export/sops/codument-demo--sop--owid-open-data-export.md</path>
</sop>
</sops>

<sops_guidance>
本区只声明 SOP 的 FQN、描述和 reference 路径。选择或执行 SOP 时，加载并遵循全局 `codument` skill 的 `<sops_guidance>`；本 skill 不重复路由、CLI、Serve、agent scope 或错误处理步骤。两个 demo SOP 都是单一操作的 `typed-leaf`，不得为它们创建 pipeline Notebook。
</sops_guidance>

<pages>
<page name="google-search">
<description>谷歌搜索：输入关键词，通过 Coding Agent 搜索 Google HK 并展示第一页结构化结果。</description>
<path>modules/google-search/pages/google-search/</path>
</page>
<page name="open-data-export">
<description>OWID 开放数据导出：筛选 life-expectancy 实体与年份，下载 ZIP 并展示 CSV 预览和 metadata。</description>
<path>modules/owid-open-data-export/pages/open-data-export/</path>
</page>
<page name="live-vue-dashboard" runtime="vue-module-federation">
<description>Live Vue Dashboard：无需 App package.json 或 Vite 配置，可由 AI 直接修改 src/App.vue 并快速重建。</description>
<path>Page/live-vue-dashboard/</path>
</page>
</pages>

<pages_guidance>
本区只声明 Page 的标识、描述和目录。发现、启动和打开页面时，加载并遵循全局 `codument` skill 的 `<pages_guidance>`；不得在本 skill 写死端口、页面 URL、所属 Skill 或浏览器操作步骤。

用户提示词示例：`请打开 codument 中的“谷歌搜索”业务页面。` 具体使用普通 Serve 还是 MCP App，由全局 host skill 根据宿主能力决定。

高级示例可使用：`请打开 codument 中的“OWID 开放数据导出”业务页面。` 页面标识与 skill 关系仍由 Page Registry 解析，不应写进用户的操作步骤。
</pages_guidance>

<sites>
<site fqn="Codument.Demo.Site.Main" name="halfcode-demo">
<description>以一个 Workspace 标签挂载既有独立 Page、HTML PageBundle entries 和 Vue route Pages。</description>
<path>Site/halfcode-demo/</path>
</site>
</sites>

<page_bundles>
<page_bundle fqn="Codument.Demo.PageBundle.HtmlGuide" profile="html">
<description>通过显式 HtmlPage entries 从一个目录物化多个静态 Page。</description>
<path>PageBundle/html-guide/</path>
</page_bundle>
<page_bundle fqn="Codument.Demo.PageBundle.VueWorkbench" profile="vue">
<description>通过显式 VuePage route records 从一个 App.vue 物化多个共享 build/runtime 的 Page；components 与 views 本身不自动成为 Page。</description>
<path>PageBundle/vue-workbench/</path>
</page_bundle>
</page_bundles>

<site_page_bundle_guidance>
运行组合使用 `Site -> PageMount -> Page`，源码生产使用 `PageBundle -> materialize -> Page[]`。只修改 manifest 中显式声明的 HtmlPage/VuePage 来改变页面集合；不得依赖 `*.html` 或 `*.vue` 通配发现。Vue 动态 route、alias 和 named views 的身份规则，以及 direct-root/installed source、implicit Site 兼容边界，统一遵循全局 `codument` skill 的前端资源模型。
</site_page_bundle_guidance>

<page_workflows>
<page_workflow fqn="Codument.GoogleSearch.Workflow.Search" id="google-search">
<description>通过 fromServedPage selector 从指定 demo 页面实例读取 query，使用 Ego Lite 搜索 Google HK，并提取第一页自然结果后回填。</description>
<input_schema>{"type":"object","additionalProperties":false,"properties":{"query":{"type":"string","minLength":1,"maxLength":200}}}</input_schema>
<output_schema>{"type":"object","required":["query","results","count"],"properties":{"query":{"type":"string"},"results":{"type":"array"},"count":{"type":"integer","minimum":1}}}</output_schema>
</page_workflow>
<page_workflow fqn="Codument.Owid.OpenDataExport.Workflow.Run" id="owid-open-data-export">
<description>显式配置 OWID life-expectancy 实体、年份与 displayed/full scope，下载并解码一次 ZIP；可由 fromServedPage selector 指定结果页面。</description>
<input_schema>{"type":"object","additionalProperties":false,"required":["chartSlug","entityCodes","startYear","endYear","downloadScope"],"properties":{"chartSlug":{"const":"life-expectancy"},"entityCodes":{"type":"array","minItems":1,"maxItems":12,"items":{"type":"string","pattern":"^[A-Z]{3}$"}},"startYear":{"type":"integer","minimum":1543,"maximum":2023},"endYear":{"type":"integer","minimum":1543,"maximum":2023},"downloadScope":{"enum":["displayed","full"]}}}</input_schema>
<output_schema>{"type":"object","required":["code","message","meta"],"properties":{"code":{"type":"integer"},"message":{"type":"string"},"data":{"type":"object"},"error":{"type":"object"},"meta":{"type":"object"}}}</output_schema>
</page_workflow>
</page_workflows>

<page_workflows_guidance>
本区只声明 PageWorkflow 的 FQN、业务描述和输入输出 schema。发现、启动和查询 workflow 时，加载并遵循全局 `codument` skill 的 `<page_workflows_guidance>`；本 skill 不重复 CLI 参数、轮询、Serve 或恢复协议。
</page_workflows_guidance>

<page_objects>
<page_object fqn="Codument.GoogleSearch.Page.Results" id="google-search-results">
<description>Google HK 搜索结果页 PageObject。</description>
<actions>
<action fqn="Codument.GoogleSearch.Page.Results.extract" id="extract">
<description>提取当前第一页自然搜索结果的 rank、title、url、displayUrl 与 snippet。</description>
<input_schema>{"type":"object","additionalProperties":false,"properties":{}}</input_schema>
</action>
</actions>
</page_object>
<page_object fqn="Codument.Demo.Page" id="demo-page">
<description>发起搜索并展示 workflow receipt 的 demo 静态页面。</description>
<actions>
<action fqn="Codument.Demo.Page.setResult" id="setResult">
<description>按 byServedPageRef selector 把 workflow 成功结果或真实错误精确回填原始页面。</description>
<input_schema>{"type":"object","required":["run"],"properties":{"run":{"type":"object"}}}</input_schema>
</action>
</actions>
</page_object>
<page_object fqn="Codument.Owid.LifeExpectancy.Page.Chart" id="owid-life-expectancy-chart">
<description>OWID life-expectancy 图表、筛选状态与 Download data UI PageObject。</description>
<actions>
<action fqn="Codument.Owid.LifeExpectancy.Page.Chart.configure" id="configure"><description>设置实体、年份范围与图表视图。</description><input_schema>{"type":"object","additionalProperties":false,"required":["chartSlug","entityCodes","startYear","endYear","downloadScope"],"properties":{"chartSlug":{"const":"life-expectancy"},"entityCodes":{"type":"array","minItems":1,"maxItems":12,"items":{"type":"string","pattern":"^[A-Z]{3}$"}},"startYear":{"type":"integer","minimum":1543,"maximum":2023},"endYear":{"type":"integer","minimum":1543,"maximum":2023},"downloadScope":{"enum":["displayed","full"]}}}</input_schema></action>
<action fqn="Codument.Owid.LifeExpectancy.Page.Chart.verify" id="verify"><description>验证 allowlisted 图表与筛选状态。</description><input_schema>{"type":"object","additionalProperties":false,"required":["chartSlug","entityCodes","startYear","endYear","downloadScope"],"properties":{"chartSlug":{"const":"life-expectancy"},"entityCodes":{"type":"array","minItems":1,"maxItems":12,"items":{"type":"string","pattern":"^[A-Z]{3}$"}},"startYear":{"type":"integer","minimum":1543,"maximum":2023},"endYear":{"type":"integer","minimum":1543,"maximum":2023},"downloadScope":{"enum":["displayed","full"]}}}</input_schema></action>
<action fqn="Codument.Owid.LifeExpectancy.Page.Chart.openDownload" id="open-download"><description>打开 OWID Download data UI。</description><input_schema>{"type":"object","additionalProperties":false,"required":["chartSlug","entityCodes","startYear","endYear","downloadScope"],"properties":{"chartSlug":{"const":"life-expectancy"},"entityCodes":{"type":"array","minItems":1,"maxItems":12,"items":{"type":"string","pattern":"^[A-Z]{3}$"}},"startYear":{"type":"integer","minimum":1543,"maximum":2023},"endYear":{"type":"integer","minimum":1543,"maximum":2023},"downloadScope":{"enum":["displayed","full"]}}}</input_schema></action>
<action fqn="Codument.Owid.LifeExpectancy.Page.Chart.download" id="download"><description>触发一次 allowlisted displayed/full ZIP 下载。</description><input_schema>{"type":"object","additionalProperties":false,"required":["chartSlug","entityCodes","startYear","endYear","downloadScope"],"properties":{"chartSlug":{"const":"life-expectancy"},"entityCodes":{"type":"array","minItems":1,"maxItems":12,"items":{"type":"string","pattern":"^[A-Z]{3}$"}},"startYear":{"type":"integer","minimum":1543,"maximum":2023},"endYear":{"type":"integer","minimum":1543,"maximum":2023},"downloadScope":{"enum":["displayed","full"]}}}</input_schema></action>
</actions>
</page_object>
<page_object fqn="Codument.Owid.OpenDataExport.Page" id="open-data-export-page">
<description>发起 OWID workflow 并展示两层 receipt/envelope 的 demo 静态页面。</description>
<actions>
<action fqn="Codument.Owid.OpenDataExport.Page.setResult" id="set-result"><description>按 byServedPageRef selector 把最终 receipt 精确回填原始 open-data-export 页面。</description><input_schema>{"type":"object","required":["run"]}</input_schema></action>
</actions>
</page_object>
</page_objects>

<page_objects_guidance>
本区只声明 PageObject、Action FQN、业务描述和输入 schema。发现或执行 PageObject/Action 时，加载并遵循全局 `codument` skill 的 `<page_objects_guidance>`；本 skill 不重复 CLI、Serve、PageSession、Ego 或 registry 调用步骤。
</page_objects_guidance>
