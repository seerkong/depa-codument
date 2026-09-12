# 跨仓库公共 Host 设计收敛

> 目录职责 · holds: 基于已复核 inventory 的目标边界与处置决策 · excludes: 一手证据（../inventory）、实施状态（../../../loop.md）、切片排期（../recommendations） · tier: stable · 来源: inventory round 2 NO_GAP · 下游: recommendations、mission design

Boundary：本目录拥有本轮 proposed architecture，不宣称源码已经迁移或制品已经发布。

Not Owned Here：用户 workspace 的业务事实归产品领域 owner；源码、测试与发布操作不在本设计回合。

| 文件 | 内容 |
|---|---|
| [architecture](architecture.md) | 总体方案、公共接缝、身份兼容、发布与跨仓采用合同 |
| [three-plane-map](three-plane-map.md) | 三面 × 层级、现状到目标的归位 |
| [package-disposition](package-disposition.md) | 全部 33 个 manifest 的处置与精确目标包名 |
| [vendor-primitive-map](vendor-primitive-map.md) | 复用现有原语、必须自有的契约与边界 |
| [decisions](decisions.md) | D01–D10 决策、C01–C06 候选、未就绪事项 |
