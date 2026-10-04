# Codument 入口与路由

涉及 planning / proposal / track / mission、行为变更、架构/性能/安全工作或范围模糊时读本入口。正式资源根为 `codument/`；操作、方法、格式分别由全局 `operations/`、`references/std/methods/`、`references/std/spec/` 拥有。

## 选择入口

使用全局 depa-codument Skill；调用其顶层 CommandOperation，完整读取返回的操作正文。旧 codument-<operation> 是历史调用名，不再要求安装同名 Skill；只展开本次适用的规范，不预读整个 std。执行时遵循 [上下文协议](protocols/context-loading.md)：索引不是验收依据，必要原文不能被预算截断。

以下仅作意图导航；当前命令与完整正文以 `depa-codument -h` 及所选 CommandOperation 返回为准，导航不注册命令。

| 当前意图 | 读取操作指导的入口 |
|---|---|
| 范围未定，先讨论并分流 quick/track/mission/blocked | `depa-codument discuss` |
| bug、测试、行为不变的局部重构/配置 | `depa-codument impl-quick`；超出边界转规划 |
| 新能力/行为/架构变更 | `depa-codument plan-track` → `depa-codument maintain-track`（discuss-phase/revise/schedule）→ `depa-codument impl-track` |
| 跨 Track 长期目标 | `depa-codument plan-mission` → `depa-codument impl-mission` → `depa-codument archive-mission` |
| 目标对比、独立验证、结构与语义审查 | `depa-codument gap-loop` / `depa-codument verify` / `depa-codument validate-operation`（互不替代；原生 validate 只做确定性校验） |
| 已完成 Track 收口 | `depa-codument archive-track`；按配置晋升知识及决策 |
| 现状知识初始化、显式制品同步、旧格式升级 | 共享 workflow / `depa-codument artifact-sync` / `depa-codument migrate-operation`（原生 migrate 仍是确定性入口） |

## 适用规范导航

下表是展开入口，不是每次全部必读；operation 的必读项和当前生效配置优先。

| 问题 | 去读 |
|---|---|
| 模糊目标的收敛、观察与失败反馈；工作流程和 CLI 不可用的边界 | references/std/methods/workflow.md |
| 信息分层、晋升、冲突优先级 | references/std/attractors/knowledge-tiers.md |
| 目录职责、新建 docs 文件夹 | references/std/spec/folder-manifest.md |
| 下个任务、自主度 | backlog/README.md |
| Mission 目录与四角色循环 | missions/README.md、references/std/protocols/cybernetic-loop.md |
| 长期复用教训、memory profile | references/std/attractors/project-memory.md、memory/ |
| Track/Mission 三轴与字段 | references/std/spec/{track,mission}-xnl-spec.md |
| Decision owner、递归 source/merge、decision:// | references/std/spec/decision-registry.md、references/std/spec/xnl-format.md |
| 提问、决策、验证协议 | references/std/protocols/{questioning,decision-tree,validation}.md |
| TDD、DAG、流程标记 | references/std/methods/{tdd,dag-execution}.md、references/std/spec/flow-notation.md |
| operation hook、方向 profile、能力开关 | config/operation-hooks.xnl、config/attractor-profiles.xnl |
| 当前操作与历史调用名 | 运行 `depa-codument -h`；遇到旧 skill 名时按需读取 references/std/compat/operation-alias.md |

## 知识与写入边界

重要输入/结论 file-in/file-out，不只留 chat。discuss 中已稳定的决策与教训，当轮写对应 decisions/memory 候选；但 quick 的 durable 写入仍以 impl-quick 的显式用户确认规则为准。

归档晋升：track → decisions（承重决策）、memory（复用教训）；反复出现的 memory 再固化为 method/skill/check。触发和冲突由 knowledge-tiers 统一裁决。新建 docs 目录带 folder-manifest 职责块。

CLI 拥有 scaffold、结构校验、生命周期、迁移、registry transaction、frontier、分发等确定性操作；AI 编写业务 prose/XNL、处理 review-required 并做语义复核。状态/归档/迁移不从摘要手写。只读检查在 CLI 不可用时可标 SKIPPED 后继续语义 review；scaffold、状态、迁移、归档、registry、制品写入保持 blocked。

常用只读入口：`depa-codument list --json`、`show <id> --json`（正文显式 `--include-content`）、`track ready <id> --json`、`decisions frontier`、`validate <id> --strict`。写入参数按所选 operation 或 CLI help；首次项目执行 `depa-codument init`，已有项目先 `depa-codument status`，升级使用 `depa-codument upgrade-workspace --json` 并处理 review-required。全局指导单独通过 `depa-codument upgrade-global` 更新。
