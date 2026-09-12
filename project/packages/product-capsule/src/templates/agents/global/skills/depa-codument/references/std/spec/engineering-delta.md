# engineering delta 编写规范（references/std/spec/engineering-delta.md）

> 每个 track 对 engineering 登记表（`codument/engineering/`）的变更，用**owner 的目标态快照 + 节点级 3-way 合并**表达。宿主 Git 提供不可变 base；领域纯逻辑提出 proposal，文件 effect 提交事务。
>
> 仅当 `codument/config/engineering.xnl` 的 engineering profile `enabled` 时启用。

## 形态：目标态节点

track 在下面路径写该 owner 全部节点的目标态；不能只写关注的节点，把其它 base 节点误当删除：

```text
tracks/{pending,active}/<id>/engineering_deltas/<plane>/<category>/<topic>.xnl
```

示例：

```xnl
<EngineeringRegistry #codument.engineering.backend.howto.orders envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 [
<howto #backend.howto.orders.add_endpoint { kind = "howto" } (
  <desc ?>新增订单接口的标准维护步骤。</?>
  <when-to-use ?>需要新增 backend endpoint 并接入 behavior case 时使用。</?>
  <steps ?>
  1. 先新增 behavior case。
  2. 在 orders module 增加 route handler。
  3. 写集成测试。
  </?>
  <verification ?>运行 backend route test 与 depa-codument validate。</?>
)>
]>
```

## 操作语义

| 操作 | 怎么表达 |
|---|---|
| 新增 / 修改节点 | 在 `engineering_deltas` 写目标态节点，按 `#id` 命中 |
| 删除节点 | base 中有而目标快照没有的节点表示删除；与并发修改冲突默认暂停，不自造删除清单 DSL |
| 重命名 / 移动文件 | 保持节点 id；跨 owner 或 owner 扩展变化需显式 review，不自造 vfs rename 指令 |
| 同文件内重排 | 目标态保留稳定 id，合并以 id 为身份 |

## base 锚定

- track create 时记录当前 `codument/engineering` 的宿主 git commit id，作为 3-way base。
- archive 读取 Git 不可变 blob 的 base、当前 registry(ours)、track delta(theirs)，不切换 checkout。所有 registry proposal 完整校验且无未解决冲突后才共用事务提交与移动 process；失败保留源与恢复材料。字段/注释/扩展来自源片段，不从索引重建。

## 冲突策略

默认保守：

| 情形 | 默认 |
|---|---|
| 不相交节点 | 自动 |
| 同节点不同子部 | 自动 |
| 纯新增 / 纯删除未被动过节点 | 自动 |
| 同节点同子部异内容 | 人工 |
| delete-modify | 人工 |
| add-add 同 id 异内容 | 人工 |

策略可在 `codument/config/engineering.xnl` 覆盖：

```xnl
<MergePolicy (
  <Conflict { type = "same-field" resolve = "human" }>
  <Conflict { type = "delete-modify" resolve = "human" }>
  <Conflict { type = "add-add" resolve = "human" }>
)>
```

`resolve` 取 `human | ours | theirs | base`。

