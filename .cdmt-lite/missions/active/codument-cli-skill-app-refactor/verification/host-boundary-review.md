# 公共 Host 实现期边界自检

本文件是实现者的边界复核，不是最终 fresh 独立验收，也不拥有工作图状态。证据为 E014–E059；当前完整项目仍有 E029 三个文档缺失失败。

| 能力 | 公共职责与 authority | 产品保留的绑定 | 实证 |
|---|---|---|---|
| 命令 | cli-host-contract/logic/capsule/shell 的注册、parser、dispatch、输出、root instance | COMMANDS、品牌、legacy 参数路由 | notes CLI help/JSON/自有 Note list/validate；重复/缺 contract 拒绝 |
| 资源与 Kind | skill-app-contract 的 owner/revision；logic 规则、support compiler/read-port；resources capsule | Codument Kinds 待领域节点注册；产品 legacy global adapter | 无 Kind 副本、自定义 reader/schema、unknown/conflicting owner、真实 registry integrity |
| LocalFunction | typed runtime ports、schema admission、显式 invocation release | 产品 capability selection、配置来源 | SQLite 成功/失败后 statement/connection 关闭，Workspace 越界拒绝 |
| Page/Site/Workflow | page catalogs、queue/receipt/build owners、平台 ports、HTTP shell | 默认资源根、产品 HTTP 路由、身份与资产 | 双实例、异步关闭、Page RPC、allowlist/schema、静态和 Vue Page |
| HTTP/SSE | listener effect、HTTP host admission/drain、channel 与 subscription owner | Codex/Ego/demo/status 路由、端口配置 | 本地真实 HTTP/WebSocket，关闭/失败清理，SSE abort |
| Browser/debug | provider supports、owned bridge、lexical client_fetch loader、命名 exports | 外部 task-space/session 名、legacy globalThis.client_fetch | 受控 provider、relative import、同步 helper、导入修改失效、TERM/KILL；真实浏览器 NOT_RUN |
| Vue/MCP | builder/worker、MCP transport connection 与闭包 | worker 发行位置、stdio、hostSkill/hostVersion | tarball 中真实 Vite/worker、MCP 握手；CLI stdin EOF 后退出 |
| 服务/Codex | service records/process ports；Codex IPC/sidecar support 与 client capsule | `.codument` 记录位置、Agent、BIN/env | detached start/reuse/restart/stop；模拟 IPC peer，不发真实消息 |
| 安装/备份 | text template/instruction processor；文件 backup effect | 目标目录、受管 marker/body、旧错误格式 | 公共包隔离安装；失败还原；未触碰全局安装 |

## 生命周期与边界判定

- 正式资源仍属于 authored workspace。catalog、build receipt、临时代际是单向投影；未知版本/来源摘要变化不能被缓存掩盖。
- 代码构建返回独立的纯 receipt 与释放句柄。资源消费者结束后由 Host close 回收自己创建的代际；注入 registry 默认借入。工作流借入 browser，不能删除外部 task space。
- CLI main 在 command.wait 结束后释放 runtime；MCP connect 不是终态。HTTP stop 先拒绝 ingress、关闭 pending RPC，再等待请求和 owned runtime。
- 通用文件 checkpoint 不是业务迁移事务：没有跨进程锁或崩溃 ledger，不能替代后续 migration 的 inspect/stage/validate/commit。
- 新公开包只通过 exports 连接，不依赖旧 root src 或外部 Halfcode 源码。compiler 的既有标准 Kind identity 与包名前缀不等同于 Codument 业务依赖。

## 尚未收口

- `project/packages/cli` 仍是过渡产品组合层；其品牌、外层命令、默认目录、旧 JSON/参数兼容和发行资产需在产品 cli-shell/集成节点统一。
- root legacy Codument 的领域/registry/嵌套任务/迁移/Skills 尚未迁入，不能以 Host consumer 代替这些验收。
- README/docs 缺失等待用户说明；完整 check 非绿色。真实浏览器、最终发行和所有最终语义独立验证均没有被本自检冒充为已完成。

E058 的完整 generic consumer 已满足领域开发的公共接口依赖；据此继续领域节点，最终发行仍必须等 Host 整体收口（D11）。
