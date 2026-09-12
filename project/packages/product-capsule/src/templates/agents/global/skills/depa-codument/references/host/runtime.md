
# Host runtime reference

本文件是全局 depa-codument App 的按需 Host 参考，不是另一个独立 Skill。业务 FQN、schema、SOP、Page 和成功判据属于各 workspace skill；host 不复制业务 catalog。

## 工作区的初始化、更新
项目初始化证据：codument/manifest.xnl 和 codument/SKILL.md；.codument/ 仅为 Host 私有状态，不能据此判断项目 App 已初始化

未初始化：`depa-codument init-workspace`（如需同时初始化全局状态，使用 `depa-codument init`）
已初始化：`depa-codument upgrade-workspace`
查看状态：`depa-codument status`

安装目标固定为 Codex `.agents/skills`，不接受安装侧 `--agent` 或 `--skills-dir`。

## Host 与 workspace skill 的职责

- 本 host skill 负责 CLI、agent-scoped Serve、当前对话 MCP App、页面/自动化/Local Function 资源发现、Ego task space 和 PageWorkflow/PageObject 运行协议。
- workspace skill 负责 SkillApp、Site、PageBundle/Page、SOP、Local Function、PageWorkflow、PageObject、业务 schema、长期记忆与成功判据。
- 用户只需表达要打开或执行什么，不要求用户提供端口、skill/page 映射、FQN 调用步骤或 SOP 正文。

### 前端资源模型与 authority

- `SkillApp` 是分发和知识边界，拥有 Skill 文档、references 与可选的 `memories/`；Site 或 Page 不得另建第二份长期记忆 authority。
- `Site` 是一个可独立打开的站点/Workspace 标签，拥有导航、默认挂载点、布局和生命周期；`PageMount` 只把 Site 的 URL path 显式映射到一个 Page FQN。
- `Page` 是一个可寻址的前端页面。运行组合关系固定为 `Site -> PageMount -> Page`，SiteHost 是内部 runtime 组件名，不是公开 Kind。
- `PageBundle` 是共享源码、构建和运行身份的目录资源，在 catalog 构建阶段按 manifest 执行 `PageBundle -> materialize -> Page[]`；请求阶段不得扫描目录或把 `*.html`/`*.vue` 当作隐式路由。
- HTML profile 只有 manifest 中的 `HtmlPage` entry 会产生 Page。Vue profile 只有 `VuePage` route record 会产生 Page；一个 `App.vue` 的多个可渲染 path 是多个 Page，动态 path 是一个 Page definition，alias 与 named views 仍属于原 Page，group/redirect-only 以及 components、layouts、composables 和普通 `.vue` module 都不是 Page。
- 同一 Vue PageBundle 物化出的 Pages 共享 build identity、watcher、generation 与 frame；Page 保存自己的 source route。独立旧式 Page 仍受支持，并由 Host 投影为 implicit Site，原 `/pages/:name/` surface 保持兼容。
- Host 默认同时读取当前目录的根 `SkillApp`（直接在应用目录运行）与 `.agents/skills/*`（workspace 安装模式）。两个 source 使用同一 FQN authority；重复 FQN 必须带 source origin fail closed，不能靠复制或同步流程选真源。

## XNL 资源目录与 Kind-native CLI

legacy workspace skill 的 `manifest.xnl` 是 `SkillApp` catalog authority。`app-package` / `module-package` 中，XNL 只选择 profile 并按位置与 Kind 发现资源；`defineSkillApp` 拥有精确的 modules、pageBundles、sites 与直属 resources membership，`defineSkillModule` 拥有唯一 HostBundle FQN 与模块直属非 Host resources membership，Host 会将 descriptor 与实际发现结果做闭集校验。多业务模块由根 manifest 以 `ManifestResourceCatalog` 发现 `modules/<module>/manifest.xnl`（`SkillModule`）；模块 manifest 再用 nested Catalogs 定位自己的 pages、sops、mcp-apps 与 HostBundle。`SkillModule` 只表达结构，不可直接调用，也没有 Kind-native 顶层命令。

模块的 Host/Bun 代码放在独立 `HostBundle`：legacy manifest 显式声明 `entry`、完整 `sources` 和允许的 `exports` 叶子 Kind；`host-package` 则指向独立 Host descriptor（不要与默认导出的 SkillModule descriptor 共用文件），由它组合并导出 `resourceDefinitions`。两种 profile 都可同时导出 PageWorkflow、PageObject 等既有叶子定义，Host 按完整闭包摘要并从匹配 digest 的隔离 generation 装载。浏览器脚本放在 pages 资源目录，不能混入 host 闭包。

既有 `LocalFunctionBundle`、`PageWorkflowBundle`、`PageObjectBundle` 与 `BrowserWebApiBundle` 是长期支持的稳定 profile：原目录、manifest、FQN、单叶子 Kind 限制、发现和调用语义保持，不要求迁移到 modules/host。新旧 profile 可在同一 SkillApp 共存，并在统一 definition index 中对重复叶子 FQN fail closed。不要创建、读取或建议旧 JSON authority、成对 SOP XNL、结构资源顶层命令或旧风格资源命令。

```bash
depa-codument Resource tree --json
depa-codument Resource validate --json
depa-codument Site list --json
depa-codument SOP list --json
depa-codument PageBundle list --json
depa-codument Page list --json
depa-codument LocalFunction list --json
depa-codument PageWorkflow list --json
depa-codument PageObject list --json
```

1. 命令面统一为 PascalCase Kind 加小写 action；detail 使用精确 `--fqn`，不得按描述近似选择资源。
2. `Resource tree|validate` 是整个 XNL catalog 的总览与校验入口；具体 Kind 使用 `list|detail|validate`，可执行 Kind 再使用其 `invoke|start|get` action。
3. 输出中的 `command` 使用 `Kind.action`，`sourceRoot` 与 `logicalPath` 是 workspace-relative provenance；不得根据内部绝对路径或宿主文件位置构造调用。
4. 未知 Kind、重复 FQN、Bundle entry 越界/漂移、schema 错误或 catalog diagnostics 必须原样失败，不得回退到旧格式或旧命令。

## Agent scope

Codex 使用 `--agent=codex`（可省略）。`serve`、`Page list`、`PageWorkflow list/start/get` 与 `PageObject list/invoke` 必须保持同一 agent scope，才能共享同一个 Serve、页面实例和内存 receipt。

Claude Desktop 不使用 agent scope、会话枚举或跨会话 adapter。MCP App View 所在的当前 Claude 对话就是唯一接收者；View 只能在 host 声明 `message` capability 后通过 `ui/message` 向该对话发送最小指令。

## MCP App host 协议

<mcp_apps_guidance>

手工接入 Claude Desktop 前，运行 `depa-codument mcp-app config --json`，由用户把返回的 `mcpServers` 片段复制到宿主配置；该命令不会读写 Claude Desktop 配置。server 入口为 `depa-codument mcp-app serve --transport stdio`。

在支持 `io.modelcontextprotocol/ui` 的 host 中：

1. 用 `page_list` 按 page name 或 description 唯一选择业务 Page，再调用 `open_page`；不要直接跳转到描述相似的外部网站。
2. `open_page` 返回 `ui://` resource、page、SOP FQN 与不透明 `targetRef`。View 必须原样保留该引用。
3. 页面 action 先通过 app-only `page_target_update` 校验并写入 exact target state。`ui/message` 固定包含本 host skill、SOP FQN、page 与 targetRef；只有 page manifest 为该 action 声明 typed input schema 时，才额外追加单一 canonical `input: <JSON>` 行。workflow result 只能由 runtime 回填。
4. 当前对话收到 action 后，用 `sop_get` 精确读取 SOP，用 `page_automation_list` 唯一确认 workflow，再调用 `page_workflow_start/get`。
5. View 用 `page_target_get` 读取 exact receipt 并更新页面，不解析聊天文本。unknown/stale target、重复 FQN、缺 `message`/`serverTools` capability 均失败关闭。
6. 不支持 MCP Apps 的 host 只返回 standalone 文本 fallback，不得声称页面已内嵌显示。
</mcp_apps_guidance>

## SOP authoring 与运行协议

<sops_guidance>
页面向 Agent 发送的结构化消息固定以本 host skill、`action: <SOP-FQN>`、`page: <page-name>`、`targetRef: <page-target-ref>` 开头。若 page manifest 为 action 声明 typed input schema，可再有且仅有一行 canonical `input: <JSON>`；不得展开动态字段或携带 SOP 正文。

收到消息或用户目标命中 SOP 时：

1. 把 `action` 当作精确路由键。Codex 在当前 Agent 已安装 workspace skills 的 `SKILL.md` `<sops>` catalog 中查找，并用 `SOP detail --fqn <FQN> --json` 精确读取；MCP App host 使用 `sop_get`。不得按 page 名或描述近似选择。
2. 加载命中的 workspace skill，读取该 SOP 的 `<path>`，并遵循 reference；不得按 page 名猜 SOP，也不得要求消息携带 SOP 正文。
3. 页面事件中的 `page` 与原始 `targetRef` 是 SOP 输入的一部分，必须原样保留。未知/重复 FQN 或输入不足时失败，不得替换 SOP 或页面实例。
4. 按 `spec.profile` 解释正文：`freeform` 不猜 typed block；`typed-leaf` 校验六个 semantic blocks但不创建 Notebook；`typed-pipeline` 的 `<procedure format="markdown-step-graph/v1">` 是拓扑唯一 authority。新建或修改时分别完整读取 `references/freeform-sop.md`、`references/typed-leaf-sop.md`、`references/typed-pipeline-sop.md`。
5. `SOP graph --fqn <FQN>` 只是 generated Mermaid projection。拓扑变化只能编辑 SOP Step Card，不能手改 Mermaid，也不能把 Mermaid 或 Notebook 反写为 procedure。
6. 执行 typed pipeline 前运行 `SOP notebook init --fqn <FQN> --json`，并核对 Notebook 的 exact FQN、`sopContentDigest`、`procedureFormat` 与当前 SOP；任何 mismatch 都停止推进，要求显式 migration 或 `--reset`，不得静默覆盖。
7. Notebook 只记录已经发生的 visit、blocker 与 journal。每次进入 Step 使用单调递增 visit ID；调用 Child SOP 或其他 effect 前先写 `running`，之后只根据真实 result/receipt 写 `completed|waiting|failed|cancelled` 和稳定 evidence reference。
8. 下一候选必须由当前 `<procedure>` 加 sparse occurred state 推导。只记录实际选择的 Route ID；零条 Route enabled 时记录 waiting/blocked，多条同时 enabled 时记录歧义并停止，不使用 first-match。cycle/self-loop 每次都创建新 visit，不折叠历史。
9. Notebook 不复制 Entry、完整 Step/Route 清单、target、condition 或未来计划。workspace skill 的 `<sops_guidance>` 只补充业务选择边界；CLI、Serve、agent scope 和运行错误处理以本区为准。
</sops_guidance>

## Serve 生命周期

<serve_guidance>

```bash
depa-codument serve start --port 0 --json
depa-codument serve status --json
depa-codument serve restart --port 0 --json
depa-codument serve stop --json
```

1. Codex standalone Page、PageWorkflow 和外部 Ego PageSession 共用当前 workspace/`--agent=codex` scope 的唯一 Serve supervisor。打开普通业务 Page 前，先在 Codex app 内调用 `tools.codex_app__list_threads({ limit: 20 })`；只选择 `status === "active"` 且 `cwd` 等于本次 Serve 所在 workspace 绝对路径的项。找到后以 `depa-codument serve start --port 0 --codex-thread-id <current.id> --json` 启动；健康实例会被复用且立即锁定到该 task，页面无需再次手选会话。未找到当前 task 或不在 Codex app 内时，不传该参数，保留页面的手动绑定回退。返回的 `url` 是后续页面 URL 真源。
2. `status` 区分 running、stopped 与 stale record；`restart` 先停止已记录实例再创建新的 server instance/Ego task space；`stop` 幂等。需要诊断时读取 JSON 中的 `running`、`pid`、`url`、`serverInstanceId` 和真实 `message`。
3. 裸 `depa-codument serve` 为兼容入口，等价于 `serve start`；新 guidance 和自动化应优先使用显式子命令。`start`/`restart` 接受 `--host`、`--port` 和可选 `--codex-thread-id`，`0` 表示选择空闲端口。只有 Codex app 已按当前 workspace 精确发现 task 时才可传该 id；不得猜测 id 或通过 Page API 枚举其他 workspace 会话。
4. `PageWorkflow start/get` 必须回到同一 Serve；若 status 不再 running，不得新建进程并声称旧内存 receipt 可恢复。
5. Claude Desktop 当前对话 MCP App 使用 stdio MCP server 和 `ui://` resource，不启动普通 Serve、不使用 Codex agent scope，也不枚举或选择 Claude 会话。
</serve_guidance>

## Page 协议

<pages_guidance>

用户提示词通用格式：`请打开 codument 中的“<页面描述>”业务页面。`

当用户明确说“codument 中的”页面时，必须先查询 Page Registry 并打开命中的 CLI 业务页面；不得因页面描述与外部网站相似而直接打开同名网站。

用户要求打开某个本 CLI 页面时：

1. 执行 `depa-codument Page list --json`。
2. 用用户给出的页面标识精确匹配 `name`，或用自然语言与 `description` 匹配；不得写死页面属于哪个 workspace skill。
3. 按 `<serve_guidance>` 先发现当前 Codex task；找到时执行 `depa-codument serve start --port 0 --codex-thread-id <current.id> --json`，否则执行不带该参数的 `serve start --port 0 --json`。复用返回的 agent-scoped Serve，不猜固定端口。
4. 打开整个工作台时，将 Serve 返回的 `url` 与 `/workspace/` 组合；打开 registry 返回的 Site/Page 时使用其 `entryUrl`。Shell 以 Site 为标签和生命周期边界，并在标签内用 PageMount 导航；无显式 Site 的 standalone Page 使用 implicit Site 兼容入口。静态 Page 通过 `/page-content/<name>/` 加载；Vue PageBundle Pages 共享精确 generation，并由 route bridge 切换 source route。调用方不得绕过 Shell 猜 raw content、frame、generation 或 builder URL，也不得使用 Serve 后台 Ego task space 展示 Page UI。
5. 通过 `--codex-thread-id` 启动的 Serve 已有默认绑定，页面不得再次要求用户选择会话。只有未绑定回退时，Shell 才打开会话面板；只能从 `/api/agent/targets` 返回的当前 workspace targets 中选择并经 `/api/agent/bind` 绑定，不得猜 task id 或枚举其他宿主会话。
6. 单页面应用可继续使用 standalone Page：只有 `index.html` 是静态 Page，只有 `src/App.vue` 是 live Vue Page，两者同时存在视为歧义。一个目录包含多个 HTML entry，或一个 Vue App 需要暴露多个可渲染 route Page 时，必须使用显式 PageBundle manifest；不能复制为多个 standalone Page，也不能自动把所有文件识别为 Page。Vue App 只可 import `vue`、`@ai-cli/page-sdk/vue` 与 PageBundle root 内相对 module；不得创建或执行 App 自有 `package.json`、`node_modules`、Vite 配置或任意安装脚本。
7. `depa-codument Page list --json` 的 `runtime.buildStatus|generation|diagnostics` 是 CLI 状态真源；Serve 内 `/api/pages` 返回相同 projection。修改 `src/` 后 Host 会保留 last-success、生成不可变新 generation 并只刷新目标 iframe。构建错误应按 Page-relative `diagnostics` 修复源码，不猜内部端口、缓存目录或构建命令。

Claude Desktop 的 MCP App 模式改用 `<mcp_apps_guidance>` 的 `page_list` + `open_page`，在当前对话内显示 `ui://` View；不启动普通 Serve，也不选择 Claude 会话。
</pages_guidance>

## Local Function 协议

<local_functions_guidance>

1. 执行 `depa-codument LocalFunction list --json` 或按 `--operation query|detail|action` 过滤，再用完整 FQN 唯一选择；不得按描述近似调用。
2. 用 `LocalFunction detail --fqn <FQN> --json` 读取 input/config/output schema 与 `runtimeCapabilities`。调用时只提交 schema 声明字段；`config` 默认 `null`。
3. 用 `LocalFunction invoke --fqn <FQN> --input '<json>' --config '<json-or-null>' --json` 执行。LocalFunction 是 server-local processor，不等价于 browser function、PageObject Action 或 MCP tool，不得用 `invoke --fqn`/浏览器 transport 替代。
4. `workspace|sqlite|clock|ids|pageWorkflow|pageTargets` 由 Host 按 Bundle 叶子 definition 最小注入；未声明 capability 不可用。若声明 `configuration`，LocalFunction 还必须声明 `appConfigurationRefs`，并且只能用 `runtime.resources.configuration.app.get(<已声明名称>)` 读取这些当前 profile 的非敏感 section，不能猜测或枚举其他 section。代码只能经对应目录 Bundle 的 `entry` 由 Host materializer 加载，SQLite 路径必须位于 workspace，任何路径、material 漂移、schema、export 或重复 FQN 错误都应原样报告。
5. Page 只可通过自身 XNL `Page.localFunctions` 精确 allowlist 调用，并经 `/api/pages/<page>/local-functions/invoke` 复用同一 dispatcher。LocalFunction 定义只来自 `LocalFunction/manifest.xnl` 所绑定 bundle；不得由页面 body 指定另一 Page 身份或绕过 allowlist。

</local_functions_guidance>

## PageWorkflow CLI 协议

<page_workflows_guidance>

```bash
depa-codument PageWorkflow list --json
depa-codument PageWorkflow start --fqn <PageWorkflow-FQN> [--selector '<closed-selector>'] --input '<json-object>' --json
depa-codument PageWorkflow get --run-id <runId> --json
```

1. Codex 先用 CLI `PageWorkflow list`；MCP App host 使用 `page_automation_list` tool。都必须按完整 FQN 唯一确认 workflow，并读取 CLI 返回的 schema；不得按描述近似选择。
2. Codex 先按 `<serve_guidance>` 确认同一 workspace/agent 的 Serve 正在运行，再执行 CLI start；MCP App `page_workflow_start` 使用 stdio server 内同一 coordinator 与 target authority。只有返回 runId 才视为发起成功。
3. 保存 runId，用 get 查询至 `completed` 或 `failed`。get 不会在原 Serve 消失后新建进程恢复内存 receipt。
4. `failed` 时读取 `run.error` 并报告真实错误，不重复启动来掩盖失败。
5. targeted leaf 统一使用 `(runtime, selector, invocation, config)`；runtime 只含声明过的 capability，selector 是 definition profile 规定的闭合 union，业务参数只放 `invocation.payload`，`config` 当前为 `null`。payload 不得重复 `targetRef`、`targetId`、`outputPath` 等地址字段。
6. workflow/page object 只能使用 Host 解析 selector 后注入的 Ego/Page session；业务 bundle 不创建浏览器、不自行解析目标。若 workflow 要把 receipt 回填 served Page，`resultTarget.operationRef` 必须指向已接纳 PageObject definition 中明确声明的 served-page Action。
7. 页面事件中的 `targetRef` 必须放进 `fromServedPage.origin.byServedPageRef` selector；业务 input 不包含它。失效时提示重新点击，不猜测其他页面实例。
</page_workflows_guidance>

## PageObject 与 Action 协议

<page_objects_guidance>

1. Codex 执行 CLI `PageObject list`，MCP App host 调用 `page_automation_list`。按完整 FQN 唯一确认 PageObject 或 Action，并读取 CLI 返回的 action schema。
2. 默认由已登记的 PageWorkflow 通过 registry allowlist 调用 PageObject Action；需要直接调用时使用 `PageObject invoke --fqn <Action-FQN> [--selector '<closed-selector>'] --input '<json>' --json`，不得用通用 `invoke --fqn` 替代。
3. served page selector 为 `{"byServedPageRef":"<targetRef>"}`；external page 使用 definition 默认 selector 或 `{"byExternalPage":{"targetId":"..."}}`；workspace artifact 使用 `{"byWorkspaceArtifact":{"outputPath":"..."}}`。selector 必须恰有一个合法分支且匹配 definition selectionPolicy。
4. Action 的 Processor 同样接收 `(runtime, selector, invocation, null)`；已解析 target 不作为 Processor 参数，地址字段不复制进 invocation payload。未知/重复 FQN、schema 不匹配、selector 不闭合或 cardinality 不唯一都应失败。
5. workspace skill 的 `<page_objects_guidance>` 只补充业务选择和安全边界；通用发现、运行和错误处理以本区为准。
</page_objects_guidance>

## 其他公共命令

```bash
depa-codument status
depa-codument invoke --fqn <FQN> --skills-dir <skills-root> --input '<json>' --json
depa-codument exec --code '<expression>' --skills-dir <skills-root> --json
```

`invoke` / `exec` 的 skills root 由当前 Agent 显式传入：Codex 为 `.agents/skills`。init/upgrade 只管理本 CLI 的 skills 与 workspace 文件，不修改 MCP 或 Claude Desktop 配置。

`client_fetch` backend 按“显式 `--transport` > workspace `.codument/config.json` 的 `browser.transport` > `ego-browser`”选择。transport 只表示外部 provider：`ego-browser|opencli|mdd-browser-robot`；provider 专属配置必须放在同名块中。OpenCLI 通过 `browser.opencli.transport=plugin|browser-eval`（命令行对应 `--opencli-transport`）选择子 transport。MDD 只接受 `browser.mdd-browser-robot.transport=chrome-extension`，宿主只调用其公开 machine protocol 与 Chrome Extension 路径。Ego 的同名块当前保持开放。所选 provider、登录态、extension grant 或 CORS 错误必须原样报告，不得静默回退。
