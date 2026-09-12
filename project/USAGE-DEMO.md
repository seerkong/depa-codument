# 骨架与隔离示例

以下命令描述现存 Host 界面，示例 FQN 来自随附 demo；不表示 Codument 全部旧产品命令已经移植。开发时可用 `bun run packages/cli/src/cli/index.ts` 代替 `codument`。

## 本地资源与 SOP

`codument Resource validate --json` 在本地校验声明的资源。`codument SOP validate --fqn <FQN>` 校验 SOP；typed pipeline 使用 `markdown-step-graph/v1`。

`codument SOP graph --fqn <FQN>` 生成图，`codument SOP notebook init --fqn <FQN>` 只建立发生态记录。图与 Notebook 都不替代 SOP 的作者内容。

## Page 与长生命周期

显式生命周期命令为 `codument serve start`、`codument serve status`、`codument serve restart`、`codument serve stop`。普通领域查询不应执行这些命令。Codex Page 与 Claude Desktop MCP App 需要对应连接；不要用未验证的连接去访问真实业务。

OWID 示例工作流为 `Codument.Owid.OpenDataExport.Workflow.Run`，输入示例：

```json
{"entityCodes":["CHN","TUR"],"downloadScope":"displayed"}
```

工作流返回 business envelope；调用成功与业务结果成功分列。完整所需输入以工作流 schema 为准，不能把这个局部输入当成万能可执行命令。

## fixture 与 live

fixture 使用隔离目录、受控 HTTP/浏览器端口和假数据；通过它不证明 live 网络、真实登录或各平台本机能力。live 必须另有授权、真实运行结果和限制记录。

浏览器选择支持 `--transport opencli` 与 `--opencli-transport plugin` 等显式参数。`bun run benchmark:browser-backends` 是专门的 backend 对照入口，其结果不能代替领域验收；运行前检查它选用的 fixture/live 模式与副作用。
