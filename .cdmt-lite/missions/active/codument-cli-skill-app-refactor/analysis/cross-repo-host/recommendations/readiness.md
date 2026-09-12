# 五闸与首批范围

依据 [D01–D10、C01–C06](../convergence/decisions.md)，convergence 已 done。五闸依次为问题明确、输入自包含、验收可度量、范围内、前置可满足；PASS 为设计就绪，不是授权或运行验收。包角色、effect contract、owner、closure 与禁止边合入 G3/G4，详见各 rec 和唯一 [T01–T14 包表](../convergence/package-disposition.md)。

| 候选与本次切片 | G1 | G2 | G3 | G4 | G5 | 裁决与去向 |
|---|---|---|---|---|---|---|
| C01 来源与 API/identity reconciliation；取 C06 的来源凭据前置 | PASS：PD01/02/08 | PASS：两当前树、dated inventory；新漂移由首个动作观测 | PASS：逐项输入/输出 hash 与处置有闭合表 | PASS：两仓 public/package 边界 | PASS：只读基线可先行 | PASS → rec-01；不假设旧 dirty clone 有完整 merge base |
| C01 公共 owner、identity 与基本/资源安装闭包 | PASS：PD07/08、C03–C13/H03–H05 | PASS：D01/02/05 + 精确包表 | PASS：角色/exports/依赖/身份正负例 | PASS：14 目标已定，首项完成其中真实闭包 | PASS：rec-01 可同批前置 | PASS → rec-02；T13/T14 的完整实现留给 rec-03，无空包占位完成 |
| C02 完整 execution/live 公共接缝 | PASS：R02、F09–F14 | PASS：D03/04、architecture §4–5 | PASS：local 零 Serve、窄 ingress 复验、owned close | PASS：T12/T13/T14，产品只供 bindings | PASS：rec-02 同批前置 | PASS → rec-03 |
| C04 captured executable closure | PASS：R04/R05 | PASS：D07、两个源位置与负例边界 | PASS：旧字节或拒绝，不能执行新字节 | PASS：T08/T12 局部 admission/materializer | PASS：rec-02；与 rec-03 顺序协调 | PASS → rec-04；R05 是待证明一致性，未写成已复现失败 |
| C03 Halfcode/Codument 产品采用 | PASS | GAP：C domain 仍 draft，readers/完整领域语义未齐；INC-05 待实查 | PASS：B01/B02 消费与保真 case | PASS | GAP：本批公共 runtime/closure 尚未验收，采用被分期 | GAP → backlog B01/B02；Halfcode 子项在公共 gate 后可提升，Codument 不以导出代替 admission |
| C05 三消费者与 native/release | PASS：PD03–PD11 | GAP：最终不可变公共制品、最低 runtime/平台证据尚不存在 | PASS：B03/B04 的分层证据 | PASS | GAP：两产品采用与本批 loader/runtime 合流 | GAP → B03/B04；普通 pack proof 可在各 rec 做，完整发布合同不能提前通过 |
| C06 clone 三模式与采用回滚（来源前置除外） | PASS：PD01/02 | PASS：D09/architecture §9 | PASS：included/excluded/hash/lock 与 public-only scaffold | PASS | GAP：scaffold 需要已证明 release set；full/source snapshot 可单独提升 | GAP → B05；只读来源前置已入 rec-01，不让 C01/C06 形成环 |

首批选择的是可隔离验证、无产品入口切换的四个交付单元。后续切片的 GAP 由产出证据消除；它们不是被永久排除。用户冻结命令和真实发布是独立 gate，不靠等待时间、scoped PASS 或本表 PASS 解除。
