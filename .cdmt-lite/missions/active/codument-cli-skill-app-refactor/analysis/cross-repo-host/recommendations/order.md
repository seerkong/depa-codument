# 依赖、采用与停止门

本文件是建议顺序；执行状态仅在 [loop.md](../../../loop.md)。D01–D10 为设计 authority，包名/边界只从 convergence 投影。

```text
用户确认跨仓核心设计
  → rec-01 当前来源 reconciliation
  → rec-02 公共 contracts/identity/basic-resource closure
  → rec-03 完整 CLI-first/live/HTTP
  → rec-04 executable closure 一致性
  → B01 Halfcode 自消费
  → B02 Codument 依赖与真实 wrapper 采用
  → B03 同一 set 的第三消费者、正常 transitive resolution、core recipe proof
  → B05 clone 三模式
  → 保留的 domain/workspace/migration/context 核心合同合流
  → 核心验收 + 用户决定三命令
  → 完整三命令/兼容/最终产品发行与 dogfood gate
```

rec-04 的逻辑前置只有 rec-02，但默认排在 rec-03 后，避免修改相同 admission/materializer 接缝。B02 后继续原“迁入 Codument 领域与兼容命令”未完工作；依赖采用不等于领域能力完成。B03 是公共库/core fixture 与发行配方证据，不宣称完整 Codument 产品通过；最终 Codument native/双 bin/旧 src 退役严格后置于三命令决定。B04 是分层发布义务，库 metadata/本地 recipe 验证可随 B03，真实 npm 发布另有授权门。

| 阶段出口 | 必须拿到的证据 | 停止条件与回滚范围 |
|---|---|---|
| rec-01 | 当前两树 digest、逐项来源、身份矩阵 | 新漂移/无法解释的差异只停相交单元，保留用户 bytes；不整树回滚 |
| rec-02 | 基本五包与资源/可选真实闭包、身份负例、相关 package tests | 不清楚旧 profile 映射就不迁该身份；保留 C 基线，撤回 H 本次变更须避开新增用户改动 |
| rec-03 + rec-04 | 公开 lifecycle/准入与两个 mutation case 在同一 artifact set 上通过 | 未准入 bytes 被执行、local 触 Serve、owned 泄漏、bypass 任一出现即不开放产品采用；保留失败证据 |
| B01/B02 | 各产品只消费 public exports，明确公共 set hash 和自身 lock | 两产品可分别 pin 回前一 immutable set；不改写既有包 tarball，不删除尚未被证明替代的旧源码 |
| B03/B05 | 三个隔离 consumer 同 set、无 overrides 正常传递解析、clone 各模式凭据 | 安装失败/私有路径泄漏/full snapshot 静默删项则拒绝过门；INC-05 仍红就不能宣称全量完成 |
| 三命令最终门 | 用户明确决定 + 完整 workspace-app/migration/capabilities/distribution | 没决定保持暂停；真实 authored 资源改变后回滚须用 backup/receipt/受控 restore，单降依赖不足 |
| 真实发布门 | 独立授权、包名/权属/版本核验、支持 runtime/平台的证据 | 未授权不发布；发布后用旧版本 pin 或新修正版，禁止覆盖已发内容 |

本地 tarball 或临时受控包源的 publish-ready 证明不等于向公共 npm 发布。跨仓核心实现批准、三命令合并决定、真实外部发布授权互不替代。新 consumer/clone 只用隔离 fixture，不改示例 App、用户真实 workspace 或全局安装。
