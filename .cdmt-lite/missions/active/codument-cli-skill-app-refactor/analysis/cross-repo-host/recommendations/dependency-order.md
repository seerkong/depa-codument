# 依赖投影

唯一详细顺序与 checkpoint 在 [order.md](order.md)，执行真源在 [Mission Lite loop](../../../loop.md)。此文件只供方法规范入口导航，不维护第二份节点状态。

首批逻辑边：`rec-01 → rec-02 → {rec-03, rec-04}`；二者合流后才能产品采用。默认排期 `rec-01 → rec-02 → rec-03 → rec-04`，原因是 [相交边界](conflict-matrix.md)。候选 C06 被拆成 rec-01 的来源前置与 B05 的 clone 工作流，消除 C01↔C06 表面循环。

后续：`B01 Halfcode → B02 Codument → B03 三消费者/core recipe → B05 clone`；与原 domain/workspace/migration/context 核心链合流后进入用户三命令 gate，最终 Codument native/兼容证明在其后。B04 的真实 registry 发布独立等待外部授权，不能成为暗中解除三命令冻结的入口。
