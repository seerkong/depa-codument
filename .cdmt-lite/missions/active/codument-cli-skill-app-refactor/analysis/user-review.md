# v0.5.3 用户评审采纳记录

来源：`/Users/kongweixian/Downloads/codument-v0.5.3用户评审.md`，评审注明基线 commit `8558c21ed17700714f7e9714c31799b736cec955`。这是参考输入，不能取代本次用户需求或当前代码证据。全文已阅读；不复制成另一份正式规范。

| 建议 | 处置 | 当前证据/理由 | 本次落点 |
|---|---|---|---|
| 薄 CLI、强 Agent | 采纳职责分界 | 旧 lifecycle/迁移已有确定性边界；语义规划仍适合 Agent | shell/domain 分离，保留确定性操作能力而非按命令数裁撤 |
| Agent 首先为 Processor、按需 Actor | 采纳 | 当前普通实施已有 local/delegated 自主；Host 有实际异步 workflows | 不把所有任务 actor 化，现有异步 owner 生命周期保留 |
| DataTopology、physical write≠owner | 采纳 | 现有 generated Kinds、正式 XNL、receipt/cache 各有不同 authority | AT1/AT2 与 current-state 的关系表 |
| Context Capsule/L0-L2 | 采纳并约束 | impl-track 必需上下文长，薄 Skill 已具备路由起点 | 可重建 ContextView，明确 version/closure invalidation |
| 自适应 Quick/Track/Mission 路由 | 保留现产品语义，精简重复文本 | 用户本次不要求新语义分类器，现已有 discuss/quick 边界 | 薄触发与语义路由；不建 grant 系统 |
| 风险驱动轻/标/严验证 | 调整 | 用户明确保留用 token 换准确性的机制；impl-track:19 已强制相关独立性 | 允许输出范围和必要上下文自适应；不自动调低已配置检查 |
| Evidence Envelope 与 receipt 复用 | 部分采纳 | track/verification:40 已支持 fingerprint reuse | 先补 evidence provenance/freshness，兼容旧 receipt；不复制缓存体系 |
| Candidate→Canonical | 采纳共同边界 | BehaviorPatch/archive/registry merge 已存在 | 复用受控晋升；CLI 不成为业务语义的总 owner |
| Archive 压缩且“最多一个 decision/lesson” | 调整 | 固定配额可能丢失用户业务语义 | 短索引+历史引用，保留全部正式决策和证据，无硬性内容删除 |
| 显式 Agent runtime/effects | 采纳 | Host contracts 当前依赖 concrete runtime，旧 cwd 全局 | 显式 ports；普通授权编辑不新增逐次 CLI 权限流程 |
| Continuation Summary | 采纳 | 续跑需要当前 frontier/有效证据，现有状态已在正式资源 | 派生 continuation，禁止第二状态 owner |
| 默认无锁，必要时 reservation | 保持按需，暂不新建 reservation 平台 | 未取得新增多 worker 竞争需求 | 文件事务和已有异步 lifecycle 保留；新并发机制须证据 |
| commit/高风险 guard | 暂缓新通用 guard 命令 | 非本次明确要求；archive/migration 已有本地边界 | 保留已有前置验证，不扩张 Git/部署平台 |
| 不建 RAG/evidence graph/全仓 grant/lock | 采纳非目标 | Token 问题可先从 source routing 与 receipt 入手 | MISSION 范围外 |

评审中“代码是 executable projection”用于业务期望与实现关系；判断当前实际行为仍以代码、测试和运行证据为准，不能拿文档代替现场观测。
