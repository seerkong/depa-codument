# Codument E2E Tasks

## 重构前产品与新版共用验收 harness

当前前后对照入口为 `bun e2e/run.ts run <case> --bin=/absolute/tmp/codument`，显式锁定 legacy 产品。必须提供 `/tmp` 中从重构前版本源码编译的 binary；没有全局/源码 fallback。五个 case 为 todo、stream-pipeline-ai-agent、blog、ecommerce、nested-mission-agent。

本入口复用 `project/e2e` 新 harness 的相同需求、Terra/medium、三 attempt、独立只读功能/UI验收、隔离/日志/token计量；只适配旧版 codument CLI、项目内多 Skill 与 std 布局。根目录历史 product/plan/implement/verify/score 文件保留作证据，不再由 shell runner 调用确定性业务评分。新版使用 `bun project/e2e/run.ts run <case> --bin=/absolute/tmp/depa-codument`。

比较不能混入历史 UI-only 复验。基础设施失败与业务失败分列；缓存是 input 子集，缺 token 为未知，不推算订阅账单。完整新流程说明见 [project/e2e/README.md](../project/e2e/README.md)。以下内容描述保留的历史文件。

`e2e/` 的第一层目录表示一类 E2E 套件；套件下的每个叶子目录是一条独立、可单独运行的具体任务。任务正文必须放在叶子目录；共享 runner 放在套件目录，任务专属验收代码放在对应叶子目录。

分阶段 Modeling/Engineering 任务包含：

- `product.md`：注入临时工作区的业务需求。
- `plan.md`：交给 coding agent 的规划提示词。
- `implement.md`：交给 coding agent 的实现提示词。

套件目录保存共享 runner、评分代码和说明。新增具体任务时创建新的叶子目录，不要把任务提示词分支堆入 runner。默认保留真实运行工作区以便排障；自动 smoke 应设置 `SKIP_AGENT=1 KEEP=0`。

完整项目实现任务统一使用 `request.md` 表示原始需求、`verify.sh` 表示该任务的独立验收，文件名不重复目录中的任务 ID。

当前任务：

- `modeling-engineering/{todo,ecommerce,blog}/`：用三个不同业务任务验证 Track 规划、Modeling/Engineering delta、实现与质量评分的完整链路。
- `project-implementation/stream-pipeline-ai-agent/`：把原始 Python AI Agent 需求交给单次真实 coding-agent 会话，验证 Codument 使用、完整实现与 pytest。
