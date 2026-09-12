# modeling 登记表

`codument/modeling/` 拥有领域结构知识（对象、类型、状态机、模块依赖、authority、Actor）；可测行为归 behaviors，实现与维护知识归 engineering。代码拥有实际实现，文档不得从派生索引反写成另一真源。

## 文件与身份

canonical 文件为 `<plane>/<context>/index.xnl`，大文件可拆至同 context 的子目录。delta 使用 `<plane>/<context>.xnl`，见 [modeling-delta.md](modeling-delta.md)。每个文件只有一个内置 ModelingRegistry owner；body 保存业务 forest，业务节点不各自定义软件 Kind。App 递归 Catalog 发现这些 owner，不扫描隐藏目录。

新文件先用 `depa-codument modeling scaffold` 创建当前版本 owner，再填正文。示例是填写后的形态，版本和身份沿用 CLI receipt：

```xnl
<ModelingRegistry #codument.modeling.domain.orders envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 { modeling_schema = "data-topology/v1" } [
  <object #orders.order { kind = "entity" semantic_role = "domain-fact" authority_model = "owner-controlled" relations = [] } (
    <types ?t>interface Order { id: string; status: string }</?t>
    <fact-source ?>订单状态由订单 owner 裁决，经状态迁移入口写入；本节点没有对外关系。</?>
  )>
]>
```

- 稳定命名空间 `#<context>.<name>` 或 `#<plane>.<context>.<name>` 全局唯一；内联身份为 authority，不依赖隐藏 sidecar。
- `modeling://<plane>/<context>/<name>` 指向业务节点，保留原 URI 语义。已知 URI scheme 参与引用校验；拆分不得改变逻辑身份。
- 新 owner 使用 data-topology/v1。开放 semantic_role / authority_model / relations 与 legacy 解释边界见 [modeling-node-schema.md](modeling-node-schema.md)。旧 forest 经迁移包裹，不在普通 reader 猜测 profile。
- 包括嵌套主体在内的所有业务节点参与 schema、ID 与引用检查；表征不是独立资源。普通属性放 `{}`，系统 envelope/spec 在 metadata；语法见 [xnl-format.md](xnl-format.md)。

## 启用与增量义务

modeling 默认开启（缺配置也按 true）；显式 enabled=false 保持关闭，安装/升级不得覆盖。仅结构知识变化才产生 delta，不为普通测试、文案或 enabled 开关制造空主体。App 初始化创建正式 Catalog 所需空目录，不等于已有业务知识。

missing/empty registry 合法并产生 warning；非空 registry 必须有 domain plane，未知 derived plane 为 warning。`modeling validate` 验 schema/引用，`modeling lint` 给分形拆分建议（默认约400行或8个顶层主体，可配置），不冒充语义 review。完整 Resource validate 检查正式源，不因为功能开关隐藏破损内容，也不改开关。

## 归档与历史

宿主 Git 是历史 authority，不建立平行 VCS。track 锚定 commit；归档读取不可变 Git blob 的 base、当前 registry 的 ours 和 delta 的 theirs，由领域纯逻辑按节点身份提出三方 merge。无冲突且完整校验通过后，文件 effect 事务提交所有 registry 并移动 process；失败保留源和恢复材料，不写半成品。历史字段、未知扩展和 profile 解释不得静默删除或猜测。详见 [modeling-delta.md](modeling-delta.md)。

