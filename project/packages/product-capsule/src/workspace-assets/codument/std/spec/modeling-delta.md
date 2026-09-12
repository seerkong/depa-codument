# modeling delta

增量以一个 context 的目标态快照表达，不是任意零散节点补丁，也不新建 op/删除清单 DSL。宿主 Git 拥有历史；领域 Processor 产生纯三方合并 proposal，文件 effect 负责事务。

## 作者合同

track 的 `modeling_deltas/<plane>/<context>.xnl` 使用内置 ModelingRegistry owner，body 是该 context 的目标态主体 forest。新资源通过 `codument modeling scaffold` 建版本化骨架；字段、profile、示例见 [modeling-registry.md](modeling-registry.md) 与 [modeling-node-schema.md](modeling-node-schema.md)。canonical 位置为 `codument/modeling/<plane>/<context>/index.xnl`。

- 仅对象/类型、状态机、policy、模块/组件边界、authority、Actor 通信、组件 input/config/runtime/output 变化才需要 delta；enabled 不等于每条 track 必须生成。
- 同 ID 表示同主体：新 ID 为新增；同 ID 的差异为修改；base 中存在而目标快照缺少的节点表示删除。编辑前读取 pinned base，不能把“未关注”误当“希望删除”。删除与并发修改冲突默认暂停。
- 保持 ID、URI、源位置与 owner 一致。文件移动不授予身份重命名；跨 owner 移动或改变 owner 扩展字段需显式 review，不能靠自造 vfs rename 指令完成。
- 新建采用 data-topology/v1；legacy 字段保留其解释。三侧同一主体改变 schema 解释时要求 migration review，不能由自动 merge 推断等价。
- Track/Mission 的 Ports 显式连接 delta 输入与 canonical modeling 输出。不要复制可测 BDD case，引用 behavior://。

## base 与事务

track create 记录 Git commit 锚点。archive 读取该 commit 的不可变知识 blob（不切换 checkout），与当前文件及 delta 同时观测。

1. 解析完整 owner、递归节点与源片段；旧 Git forest 仅在隔离历史适配边界保真包裹，无法证明可读时转 review。
2. 按稳定 ID 三方合并。不同节点或同节点不相交子部可合并；same-field / delete-modify / add-add 默认 human。
3. 所有 proposal 在 transaction-owned staging 解析、schema/引用校验与冲突检测。behavior、engineering、decisions 等相关 registry 共用提交边界，prepare 期间不改 live。
4. 源未漂移才执行 rollback-capable commit 并移动 process；失败恢复己方写入，保留独立编辑和恢复记录。无 delta 不创建空业务资源；App 空 Catalog 目录可已存在。
5. 运行 modeling validate / lint，语义质量与 DEPA authority 仍需 review；机械成功不是 fresh verdict。

## 冲突策略

默认 issues-first，不静默选边。报告节点及 base/ours/theirs；低歧义选择也记录依据，真语义冲突交用户或手改后复检。

config/modeling.xnl 的 MergePolicy 允许按 same-field、delete-modify、add-add 配 human|ours|theirs|base。保留已配置值，不为省 token 改策略。下例为既有 ModelingConfig 的 body 片段，不是独立资源：

```xnl
<MergePolicy (
  <Conflict { type = "same-field" resolve = "human" }>
  <Conflict { type = "delete-modify" resolve = "human" }>
  <Conflict { type = "add-add" resolve = "human" }>
)>
```

绝对 modeling:// URI 不依赖 import；不要把未接入的跨文件 Import resolver 当现有 CLI 能力。
