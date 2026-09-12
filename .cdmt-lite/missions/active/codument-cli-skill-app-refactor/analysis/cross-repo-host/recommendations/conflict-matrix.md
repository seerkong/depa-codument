# 冲突矩阵

执行中任务以 [loop.md](../../../loop.md) 为准。旧 active generic/runtime/domain 工作已由主编排转为新顺序续跑，历史证据保留原 scope；不同时继续 C 通用源码抽取和 H canonical 实现。以下矩阵只做排期约束。

| 首批对 | 是否相交 | 处置 |
|---|---|---|
| rec-01 × rec-02/03/04 | 来源 digest/目标 files；先写会使来源失效 | rec-01 先；每次受影响写入前再验 digest |
| rec-02 × rec-03 | T01/T06 contracts、T12、exports/manifests | rec-02 的 basic/resource gate 先，rec-03 扩完整 execution；不并行改接缝 |
| rec-02 × rec-04 | T06/T08 bundle contract/materializer | rec-02 先；保留 source/metadata/依赖保证范围 |
| rec-03 × rec-04 | T06/T08/T12 admission receipt、cache/drain | 默认串行 rec-03 后 rec-04；最终同一 set 合流验收 |

| 建议 × 既有/后续工作 | 冲突事实 | 处置 |
|---|---|---|
| rec-02/03 × 原通用包/拆 runtime 节点 | 同一通用实现与 public contracts，源码 owner 已改 H | 在原节点恢复，不新增并行实施状态；C 只作输入/后续消费 |
| rec-02/03/04 × Codument domain 迁入 | domain contract 依赖 Skill App 身份，provider edge 尚缺 R03 | 待 B02 锁定公共 set；不把 domain semantic reader 放 H，不删原领域未完合同 |
| B02 × 三个冻结命令/发行入口/旧 src | C02 product assembly 与 compatibility shell 有直接相交面 | 只迁 adapter/capsule 和非冲突命令；没有命令 alias/替代 installer/自动升级绕过 |
| 首批/B03 × 原 INC-05 文档相关失败 | 全量 gate 有历史红灯、原因/所有权未定 | 重观察后按依据修复或请求用户处置；不恢复未知删除、不删断言，不能用 scoped PASS 结案 |
| B04/B05 × 两仓 release/clone scripts | native builder manifest、allowlist、lock/rebrand 同属产品 recipes | 依公共 set 分期串行，库证明/core recipe 与最终产品切换分开 |
| 所有源码变更 × 用户新修改 | 2026-09-05 inventory 是 dated snapshot | 重新观察相交 bytes；保留独立改动，不以设计授权覆盖未知变更 |

没有观测到的其它进行中改动不猜测为“无冲突”。rec-01 的新 status/digest 是实施时检查此矩阵是否仍成立的输入。
