---
status: proposed
last_verified: 2026-09-05
rec_id: rec-03
scope: package
---

# rec-03：公开 CLI-first、live owner 与 HTTP 接缝

## 背景问题

完整 preflight/digest/transport/Serve 复验还在 C 私有 CLI，H runtime 仍构造全图。第三 CLI 使用 lower-level public ports 不等于已能复用完整 CLI-first 行为（R02）；cache 与 close 边界也需按 instance 归位（D04）。

## 目标

第三消费者可通过公共契约完成 local 调用与 live-required 的安全拒绝，按需组成 live owner 和窄 HTTP ingress；每个 owned handle 能精确 drain/释放。

## 非目标

不造第二 daemon、万能 argv/code RPC、用户 placement 配置或 Actor 框架；不把任意新 Kind 注册当成任意执行 ABI；不决定 Codument 三个暂停命令的表面。

## 输入证据

- [R02](../boundary/backwrite-risks.md)、[P05.1–P05.7](../inventory/read-write-paths.md)：`C/packages/cli/src/cli/runtime/local-function-execution.ts:30,66`、`C/packages/cli/src/cli/http/app.ts:207`、`C/packages/cli/src/cli/runtime.ts:167`。
- [F09–F14](../inventory/fact-nodes.md)、[conformance](../inventory/depa-conformance.md)：`H/packages/cli/src/cli/resources/app-package-materializer.ts:368`；`C/packages/cli-host-capsule/src/page-build.ts:20`。
- D02/D03/D04，T12/T13/T14 与 [architecture §4–5](../convergence/architecture.md)；C/H 前缀见 rec-01。

## 目标包与角色边界

Halfcode 所有：T06 `halfcode-cli-lite-skill-app-contract` owns preflight/receipt/compatibility 数据与 narrow ports；T07 `halfcode-cli-lite-skill-app-logic` owns runtime-first admission、placement 与 Page/workflow Processor；T03 `halfcode-cli-lite-cli-host-support` implements transport/process ports。

T12 `halfcode-cli-lite-skill-app-capsule` 选择 T01/T06/T07/T08 的 catalog/materializer 与 invocation/drain closure；T13 `halfcode-cli-lite-live-host-capsule` 选择 T04/T12 和 T07/T08，加调用方 injected optional effects，拥有 Page/Serve/workflow 实例；T14 `halfcode-cli-lite-http-shell` 将 Hono/HTTP 映射到公共 T12/T13 入口并执行 server re-admission，不能成为领域 authority。T13 无具体 browser/Vue/MCP 或 HTTP 表面依赖；T12 无 T13/T14 强依赖。产品只提供 commands、runtime bindings/defaults 和 legacy profile。

## 验收（conformance case）

1. 同一已打包 public set 的最小消费者分别运行 catalog、local LocalFunction、live-required fixture。local 路径给 Serve record/probe/start/HTTP effect 安装“调用即失败”哨兵仍成功；live-required 缺实例必须失败，不能降级 local。
2. 叶子 command + admitted resource/capability + backend 生命周期决定 placement；对相同命令更换受支持 backend 验证路线。未知 capability、非法组合、客户端自报 placement 或任意 argv/code 请求均拒绝。
3. 窄 live request 中 root/agent/instance/profile/digest/协议字段各造一个不匹配值；服务端依据自身当前实例和重新准入资源拒绝，未进入业务 Processor。合法调用仅一次执行，回执关联已准入身份；LF pageTargets 缺合法上下文继续拒绝。
4. 并发首次调用只创建一个所需 live owner；初始化失败、取消、关闭中调用、单个 close 抛错都覆盖。顺序为停止 admission → drain → live/page/codex → owned browser/providers → resource artifacts；其他 owned handles 仍释放且错误汇总，borrowed handles 不关闭、重复 close 不重复释放。
5. 两 workspace 实例 catalog/descriptor cache 与 Page generation 隔离；关闭一个不能删除另一个 artifact。PageBuild 的依赖和状态显式在 runtime，纯 Processor 不 import support。MCP caller transport 保持已有契约，不默认改成 HTTP/stdio。

实现后在 H 新增/迁移对应 public consumer 入口并记录实际命令；可复用 C 的 `verify:mission -- serve-placement`、consumer/architecture case，不把历史 policy scoped PASS 当成完整 runtime gate。全部验收当前 PLANNED / NOT_RUN。

## 依赖前置

rec-02 的公共 contracts/exports 与 resource closure 通过。rec-04 的 metadata/dependency admission 负例必须在任何产品采用前合流；本项只可用已声明且已证的闭包，不把未验证 loader 条件封成“完全固定”承诺。

## 对应三面与层级

控制/数据/扩展面 × platform；产品 command/binding 选择属于 application。Data、Effect、Processor 与必要异步 owner，回溯 three-plane-map R02、D04 行；两个可选 Data profile 仍 NOT_APPLICABLE。

## 落地建议（由同一 Mission Lite 承接）

先同一 contract/Processor 再窄 transport 和 T12/T13/T14 真实 composition，写入 H 的公共源码与隔离 fixture；原私有产品路径的替换留到 B01/B02，不提前执行产品采用。与 rec-04 改同一 admission/materializer 时串行合并并复验最终组合。回退保留前一公共 artifact set/lock 与 provenance；未改真实资源，只有本 fixture 的衍生 artifact 可清理。
