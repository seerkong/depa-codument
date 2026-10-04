# Knowledge Tiers & 信息晋升（references/std/attractors/knowledge-tiers.md）

> codument 的**知识分层地图 + 信息晋升阶梯 + 真源优先级**。它回答三个问题：
> 1. 一条信息该落到哪个目录（**分层与职责**）；
> 2. 它什么时候、怎样从临时记录**晋升**为长期真源（**晋升阶梯**）；
> 3. 事实冲突时谁说了算（**真源优先级**）。
>
> 借鉴 attractor-guided-engineering 的"目录职责 + 源真优先级 + 信息晋升"纪律，按 codument 的 **track 中心**模型重构。具体文件级目录规范见 [folder-manifest.md](../spec/folder-manifest.md)。

## 1. 心法：attractor / carrier / projection 三层

- **attractor（吸引子本身）**：少量高层不变量——领域如何划界、契约边界、结构关系。
- **carrier（吸引子的载体）**：把不变量外化成可版本化、可审计的文档——即 `attractors/` + `decisions/`。**长期 owner 文档 = 吸引子的载体。**
- **projection（瞬时投影）**：当前代码/测试——吸引子的瞬时实现。

> 推论：chat 是临时上下文，**文件才是仓库记忆**。重要输入先落文件再 `@`；重要结论按职责分类写回，而不是留在对话里。track 是一次迭代的轨迹；轨迹中稳定下来的真理必须**收敛**进 owner 文档。

## 2. 知识分层表

| 层 | 目录 | 装什么 | 时效 | 是谁的真源 |
|---|---|---|---|---|
| 结构不变量 | `attractors/` | project/product 吸引子、本表、docs 规范 | 稳定·就地改 | 高层不变量、知识纪律 |
| 承重决策 | `decisions/**/*.xnl`（`decision://<stable-id>`） | 从 track/mission 完整 decision forest 提升的长期决策 | 稳定·节点级合并 | "为什么这么定" |
| 长期教训 | `memory/`（`memory://`） | lessons / incidents / patterns / summaries | 稳定·追加 | "反复踩的坑 / 复用模式" |
| 候选工作 | `backlog/` | 跨 track 的下一步候选 + 自主度 | 活的·就地改 | "下一个该做什么"（非真源） |
| 跨 track 路线 | `missions/{pending,active,archived}/<id>/mission.xnl` | 一组相关 track 的任务图、依赖、状态与进度证据 | 活的·就地改 | "多个 track 如何排布"（非行为真源） |
| 迭代工作面 | `tracks/{pending,active}/<id>/` | proposal、design、discussion、`track.xnl`、`analysis/`、`decisions*`、`reports/` | **带日期·迭代内可变** | "本次要建什么 / 怎么收口 / 发生了什么" |
| 轨迹历史 | `tracks/archived/YYYY-MM/...` | 已完成 track | **带日期·归档期间只读** | "历史上做过什么" |

> global SkillApp 的 `references/std/` / `operations/` 与项目的 `config/`、`workflows/`、`sop/` 是工具性资产，不是上述知识层；不能因项目晋升再创建一份通用标准副本。

## 3. 信息晋升阶梯（核心）

信息从"临时"走向"长期"的固定路径。每一跳都有**触发条件**——满足才晋升，避免把临时噪音沉淀成真源，也避免让真理烂在 chat / track 里。

```text
外部输入 / 对话
   │  [建 track / discuss 时，落文件]
   ▼
tracks/{pending,active}/<id>/ ── proposal.md · design.md · discussion · track.xnl · reports/
   │
   ├─[承重的一次性决策]──────▶ decisions/      （decision://）
   │
   └─[可复用教训 / gap 模式]──▶ memory/         （lessons/incidents/patterns）
         │
         └─[同类问题跨多 track 复发]──▶ 方法层：项目 SOP/profile/hook · 通用 references/std/methods/ / operations/ · validation 守卫
               （codument 版 "prose 教训 → 可复用方法 → 固化检查"；先 sop/prompt，再考虑固化为 check/hook）
```

项目特有规程与检查留在项目资产 App。通用方法/操作的修改进入 global SkillApp 的源码维护流程，需其相应授权，不在普通项目执行中直接改已安装的 global Skill 或复制通用标准到项目。

## 4. 何时晋升（触发条件表）

| 从 → 到 | 触发 |
|---|---|
| track/mission → `decisions/**/*.xnl` | 一个原本一次性的取舍变成"以后都按这个来"的承重决策；从根 `decisions.xnl` 与递归 `decisions/**/*.xnl` 同时选择完整 durable tree closure，并按 stable id 合并 |
| track/复盘 → `memory/` | 出现可复用的教训、非显然的 incident、值得记住的 pattern |
| `memory/` → 方法层(sop/skill/check) | **同一类问题反复出现**：先提炼为可复用 sop/prompt；若仍复发，再固化为 attractor-check profile / operation-hook / validation 守卫（按项目误报容忍度调优） |
| 任意 → `migration-map` | owner 文档路径移动/拆分/合并/被吸收 |

> 反向**不**晋升：被否决的方案、未稳定的猜测、纯过程噪音留在 track / `memory` 即可，不污染 owner 文档。

## 5. 真源优先级（冲突时谁赢）

| 问题 | 主真源 |
|---|---|
| 可执行真相（数据/接口/schema） | 源码 / 测试 / schema / config（owner 文档只解释意图） |
| 本次 track 要建什么 | `tracks/pending/<id>/proposal.md` |
| 本 track 怎么执行/收口 | `tracks/active/<id>/track.xnl` |
| 发生了什么 | `tracks/active/<id>/reports/` + `tracks/archived/` |
| 长期必须为真 | `attractors/` + `decisions/` |

**冲突裁决**：可执行真源（源码/测试/schema）> owner 文档（需重新校验后才是吸引子）> track 局部 > chat。若解冲突会改变用户可见行为 / 数据形状 / 接口 / 权限 / 外部集成 → **停下确认**，并把冲突归类为 `实现漂移 | 文档漂移 | 有意的遗留行为` 写进 track 再动。

## 6. 时效性

- **稳定 owner 层**（attractors / decisions）：通过归档合并维护，不因内容变化就新建带日期副本。
- **decision owner 层**：canonical 内容只在 `codument/decisions/**/*.xnl`；物理 owner file 不是 identity，`decision://<id>` 通过全局 stable-id index 解析。历史 `decision.md` 与 archive `summary.md` 是兼容输入/派生视图，不参与 merge、index 或真源冲突裁决。
- **迭代/轨迹层**（tracks/pending、tracks/active、tracks/archived / reports）：带日期；authority 留在 archived 时只读，需要补充工作时由 lifecycle CLI 整体恢复到 active 后再修改。
- **新鲜度模式**：owner 文档标 `stale|unknown` 时，进入研究/对齐优先——不直接拿可执行真相去"修"文档、也不拿陈旧文档去"改"代码，先把漂移归类记录。

## 7. 路由

- decision registry、递归 source、stable-id merge 与 URI：[decision-registry.md](../spec/decision-registry.md)。
- 每个标准文件夹"装什么"的自描述与补齐：[folder-manifest.md](../spec/folder-manifest.md)。
- 晋升操作落在流程里：运行 `depa-codument archive-track` 获取[归档指导](../../../operations/archive-track.md)；显式同步运行 `depa-codument artifact-sync` 获取[制品指导](../../../operations/artifact-sync.md)；澄清遵循[questioning](../protocols/questioning.md)。
