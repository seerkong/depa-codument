# 工作流程总纲（references/std/methods/workflow.md）

> 原 `references/std/workflow.md` 移入 `references/std/methods/`。这是 quick / track / mission 共用的方法论总纲；各步细节见同目录其它方法文档与全局 [operations/](../../../operations/)。

## 核心原则

- **编排与执行解耦**：TaskSpace 定义工作，Schedule 定义 readiness，Hooks 定义强制行为；普通叶任务由当前 AI 根据边界、上下文连续性、文件重叠、并行收益与运行时能力自主选择 `local` 或 `delegated`。
- **完成以证据为准**：无论本地执行还是委派，任务都必须回到 acceptance、客观命令与 diff 审查后才能完成；委派者的"完成 / 全绿 / 非我责任"自述只是待验证假设。
- **独立性必须显式**：局部任务由 executor 自验，最终交付回原始目标与当前仓库重观察；GapLoop、AttractorCheck、独立 verify 或用户显式要求的独立审查必须 fresh。重观察不等于每个 leaf/DAG 节点另派代理，不能省略已配置的独立检查。
- **三轴分离**：结构（TaskSpace）/ 调度（Schedule）/ 行为（Hooks）正交，见 `references/std/spec/track-xnl-spec.md`。
- **显式 hook 纠偏**：方向/确认/有界修复都由节点或命令生命周期上的无前缀 `AttractorCheck` / `GapLoop` / `HumanConfirm` 触发；**无显式 hook 不隐式暂停**。
- **知识沉淀与晋升**：track 是迭代轨迹；其中**稳定**的真理要按 [knowledge-tiers.md](../attractors/knowledge-tiers.md) 晋升进 owner 层（`decisions`/`memory`）。owner 文档维护**实时优先**（discuss 期就收敛），归档兜底。这是 codument 相对 track 记忆的弱环，需刻意补强。
- **事实写入磁盘**：长程实现中的实证数据、失败归因、环境约束、机制漏洞和 phase/wave 结论写入 `tracks/active/<id>/analysis/findings.md`；新会话恢复时先读它。
- **破坏性 git 禁令**：执行代理不得使用 `git restore` / `git checkout` / `git stash` 这类会抹掉他人未提交成果的命令；只读 git 查询允许，重命名可用 `git mv`。
- **资产边界**：通用提示词/规范由全局 depa-codument SkillApp 拥有，项目 `codument/` 拥有自身资产；不在 workspace 再维护一份通用 std。
- **Workspace 根**：`init` 默认创建普通 `codument/`；若该路径已是有效目录软链接，所有 Codument 读写透明作用于链接目标且保留链接，链接及目标由用户管理。

## 目标—观察—行动

这是共同的收敛方法，不是额外阶段、必填表或领域分类。具体状态、调度、问答与检查仍由各 operation 和现有 XNL/config 拥有。

- **意图与路线分开**：原始用户意图、已确认取舍与适用吸引子约束目标；工作拆分、技术路线和普通假设用于尝试达成它。后者可随证据调整，前者只能经有权的决策/变更入口修订；不能为通过验收缩小目标，已批准设计中的行为约束也不例外。
- **模糊是正常输入**：从简短描述与仓库证据形成当前理解，只在现有 proposal/design/findings 记录影响下一选择的假设和关键未知。不要求用户先写完整规格；未看清不等于范围外，也不授权自行扩产品。能查证先查证，普通选择用现实后果与返工成本可逆的保守默认；重大且无安全默认的选择按 questioning/授权边界处理。
- **行动先产生可信信息**：在当前 ready 范围内优先选择能证伪危险理解或连接假设的最小连贯行动，包括只读调查、隔离实验或获准实施后的功能切片；每个行动以相称的验证闭合，再由新证据决定下一动作。不得在仅规划时实施实验代码，不要求完整生产链路或真实破坏性副作用。
- **按承诺选择观察**：从合法消费入口、真实输入或适用操作序列追到承诺的结果、状态及作用，并检查该承诺相关的边界、不变量和时间尺度。技术、领域与工具由项目决定，不预置 API/UI 等封闭分类，不把某个成功样例当充分证明。隔离测试和替身各有证明范围；承诺的实际接入或外部行为须在对应边界取证，不能只用内部替身通过放行。
- **独立是重建目标**：最终交付及独立检查从原始意图和已确认约束重建目标，再看当前实现与不利证据；Acceptance 是导航，不是覆盖上限。三级验证是防遗漏阶梯，不保证语义充分。多个合理解释尚未确认时记录未决，不把 reviewer 偏好升级为新硬要求；需人工体验判断的目标不能由机器测试替用户裁决。
- **失败先判断证伪对象**：把 finding 与依据、前提、影响范围一起记录，判断它否定了目标理解、路线、实现、观察条件还是交付协议。只修被否定的部分并交正确 owner；工具/环境失败或证据缺失不自动启动业务修复，也不能当业务 PASS。复验说明新信息来自何处，覆盖原 finding 与受影响范围，保留必需回归和配置检查；无新依据或条件变化不原样重试。
- **保留证据与检查强度**：失效证据撤回效力并追加原因/替代引用，不删除历史、重置 round 或改大预算。按有效前提复用确定性执行事实、按风险选择额外观察，不缓存 fresh 语义 verdict；GapLoop、AttractorCheck、Hook 顺序/轮数和人工 gate 完整保持。

## 三阶段

下列 CommandOperation 命令交付当前操作指导，由 Agent 完整读取并在授权范围内执行；CLI 返回指导不等于业务已完成。确定性 scaffold、状态写回、归档和分发仍由操作正文中的原生 CLI 完成。

### 一、创建 track（`depa-codument plan-track`）
查现状（`depa-codument list --json`）→ 选动词开头 kebab `track-id` → CLI scaffold Track 当前 Kind 骨架 → AI 写 proposal/design/TaskSpace → 同轮收集提交模式、校验模式和方向审查并写成 Hooks → 等批准。

### 二、实现（`depa-codument impl-track` 等）
读 proposal/design/analysis/findings → 按 TaskSpace 遍历 phase、按 Schedule 计算 ready 节点 → AI 对普通叶任务自主选择本地执行或委派 → 以 Acceptance/测试/diff 做完成验证 → executor 调用 lifecycle CLI 回写 status，并维护 findings → 在生命周期跑显式 Hook。可按需 `discuss` / `maintain-track` / `gap-loop` / `verify`。

### 三、归档（`depa-codument archive-track`）
移 track 到 `tracks/archived/YYYY-MM/...` → 条件提升 decision/memory → 显式 hook 触发 artifact/docs 同步（`operations/archive-track.md` / `operations/artifact-sync.md`）。

## 何时建 track / 跳过

**建**：新增能力、破坏性变更、架构/模式调整、改变行为的性能/安全工作。
**跳过**：纯 bug 修复、拼写/格式、非破坏依赖更新、纯配置、给既有行为补测试。补充需求落在进行中 track 范围内则并入。

## CLI 缺失

系统找不到 `depa-codument` 时，只读校验可以记为 `SKIPPED` 并明确缺失的机器保证；语义 review 可继续。需要 scaffold、状态写回、迁移、归档、registry transaction 或制品分发的写操作保持 blocked，恢复 CLI 后从同一命令重试。
