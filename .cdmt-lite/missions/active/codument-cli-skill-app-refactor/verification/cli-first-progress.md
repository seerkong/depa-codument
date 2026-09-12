# CLI-first 当前实施切片

状态由 [loop.md](../loop.md) 维护；以下是实现范围与证据解释，不是第二份任务图。

## 已落代码

- `cli-host-contract` 定义 command execution policy 与 effect lifetime；`cli-host-logic` 校验精确完整路径，不继承组策略，未知值拒绝。
- 产品命令 registry 为全部 executable 显式提供 policy；生产 `index.ts` 用 policy 选择 runtime。三个暂停命令的 handler、参数及产品整合状态不变。
- 本地 catalog/SOP/普通 LF 不持有 Serve process/HTTP/PageWorkflow/Codex；Page list 用新的 `createPageProjectionRuntime`，保留 Page/Site/build 投影。
- Serve manager 与 Serve child 分离；MCP stdio 拥有独立 Page/Workflow，但没有 HTTP Serve 客户端或 server。
- 当前 CLI browser 具体 binding 均是等待子进程退出的一次调用、借用外部 browser。closed binding 表拒绝未知 backend；通用 lifetime 规则不按 provider 名把所有调用强制送 Serve。Page 的 persistent supervisor 是另一条 binding。
- LF `pageWorkflow` 使用专用 HTTP 请求；不添加 argv/code 通道。client 预检 descriptor/profile，server 复验 source/profile digest、canonical workspace、agent 与现存 instance；无自动启动/重试/本地回退。
- LF `pageTargets` 裸 CLI 拒绝；Page/MCP 原 allowlist/target 路径继续直接使用同一 catalog operation。
- LF `prepare` 固定 admitted handler 和 Host 选定 profile；close 停止新 admission，等待在途调用及其能力释放，随后产品 runtime 才释放 Workflow 和模块 generation。
- PageWorkflow start 在原自动启动路径之前验证本地 definition/schema/selector；get 与 PageObject invoke 的启动策略未改变。

## 已有验证

policy scoped gate、真实隔离 App/SOP/SQLite/静态 Page fixture、禁止 Serve 的 getter 哨兵、生产 CLI 子进程、真实 loopback typed 调用、错误 scope/instance/source/profile/字段拒绝、Page/MCP/关闭回归，见 E092 起的 [evidence.md](../evidence.md)。

真实网络仅限测试的本机临时服务；Workflow owner 在测试中注入确定性替身。没有打开真实浏览器、发送 Agent 消息或升级真实 workspace。

11 包的隔离 Notes consumer 增加 public Page projection 与 pinned LF 用例；不是源路径 alias。新旧普通 CLI 的 JSON/exit 行为由现有与新增测试共同约束。

## 尚不能宣称完成

- 完整 `serve-placement --scope runtime`/full suite 仍拒绝并输出 UNVERIFIED；scope policy 的 PASS 不是整个 runtime 生命周期验收。
- 新 typed LF 协议的产品 shell 组合已经可执行；完整通用 reusable transport 分层、Page 既有 ingress 的统一复验与所有 live owner 的惰性/并发/部分初始化失败矩阵仍需后续收口。
- source proof 校验用于 admission 失效检测，不宣称跨进程文件事务或对任意不可信 JS 的 sandbox；已 admitted handler 在一次执行期间采用固定版本。
- 领域命令、内部 workspace App/迁移、token 优化与最终发行仍未完成。三个暂停命令未合并，正式 App 根仍要求 `codument/`；当前 Host 的 `.codument/` 不是新的产品 App。
- 继承的 README/docs 缺失测试失败保留，未删除断言或擅自恢复文档。
