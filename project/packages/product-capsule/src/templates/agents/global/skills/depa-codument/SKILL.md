---
name: depa-codument
description: >
  全局 depa-codument CLI 指导，承接全部旧 Skill：
  codument-discuss（讨论范围与取舍）；
  codument-plan-track（规划变更与验收）；
  codument-maintain-track（讨论阶段、修订与调度）；
  codument-impl-track（执行任务图与 hook）；
  codument-archive-track（归档与知识晋升）；
  codument-plan-mission（规划长期目标）；
  codument-impl-mission（持续执行或恢复 mission）；
  codument-archive-mission（归档及决策记忆晋升）；
  codument-impl-quick（小改动与验证）；
  codument-artifact-sync（显式产物同步与冲突检查）；
  codument-migrate（确定性迁移与旧版语义兜底）；
  codument-validate（结构与语义审查）；
  codument-verify（fresh 子代理实际独立验证）；
  codument-gap-loop（有界目标对比纠偏）。
  旧名称或对应意图均使用本 Skill；项目资产仍在 codument/。
---

# depa-codument

全局 CLI 指导 SkillApp；项目 `codument/` 是独立资产 App。保持目标项目 cwd，`@/` 表示项目根。
`references/`、`operations/` 相对本 Skill；裸 config/、backlog/、missions/、tracks/、decisions/、memory/ 相对项目 codument/。
CLI 固定读取发行包中的同一 App；安装按 agent 复制到 skill 目录，CODUMENT_HOME 改安装 home，不扫描项目寻找全局指导。`skill://depa-codument/references/std/...` 指向本全局标准。

**XNL 是磁盘真源，不可降级。** 语法与文本闭合高优先级见 [XNL 格式](references/std/spec/xnl-format.md)。不要把 track / mission / decision 改成纯文本、Markdown、JSON 或 XML，也不要整文件手写 `.xnl`。先 `depa-codument track|mission|decisions create` 建骨架，再对照 Kind spec 对 scaffold 原地编辑。字段与样例在 `references/std/spec/{track,mission}-xnl-spec.md` 与 `decision-registry.md`。

先运行 `depa-codument -h`，再调用所需命令读取完整操作。旧 skill 名按需查 [映射](references/std/compat/operation-alias.md)；标准按需读 [入口](references/std/AGENTS.md)，不展开全部操作。
`depa-codument <command> [arguments...]` 交付完整指导，由当前 Agent 执行。阅读操作时优先默认文本，避免 JSON 的 `operation.markdown` 与 `message` 重复正文；需要机器解析、参数或来源元数据时再用 `--json`，不重复读取两份正文。此选择只针对指导操作，不改变资源查询/状态写入的 JSON 用法。exit 0 不是业务完成。未知业务选项放在 `--` 后。

被派来执行某操作的子代理也按此入口读取当前操作正文，不能只依赖父层摘要或测试命令。父层交接操作入口、执行角色和目标范围/输入路径；子层按该角色行动（已是独立执行者时，不重新执行父层的派发步骤）。仅加载适用操作及其所需引用，不展开全套标准。

原生 validate/migrate 是确定性 CLI；validate-operation/migrate-operation 是复合流程。旧项目先走 migrate-operation，不覆盖 std 或手改版本号冒充升级。
GapLoop、Hook、AttractorCheck、fresh verify 按操作及配置执行，不因成本删除或缓存独立语义判断。外部发布、安装、破坏性操作的授权不由本 Skill 扩大。

查询与普通领域功能本地执行；Page/live 等少数能力使用 Serve。Host 的 invoke/Page/SOP 用法按需读 [runtime](references/host/runtime.md)；底层调用：`depa-codument invoke --fqn <FQN> --skills-dir <scan-root> --input '<json>' --json`。

## 等待独立任务

fresh reviewer/worker 尚在运行且没有其它可做工作时，使用宿主的事件等待工具；显式选择较长的有界等待（通常 60 秒；宿主上限、沟通时限或已知更近的截止时间更短时从其约束）。结果或新输入可提前唤醒。不用连续 1–10 秒轮询代替等待，也不通过反复读取日志、完整合同或旧报告填充空闲回合。

等待超时只说明本次尚无新结果，不是 GAP、任务失败或重开 reviewer 的理由。无新观察则继续等待；出现结果、输入、真实错误或截止时间后再调和。等待长度不改变 fresh 身份、hook 顺序、GapLoop 轮数、验证要求或人工 gate，也不能把尚未完成的检查记为 PASS。

## 临时目录与交付目录

临时 run、浏览器控制器、隔离 build 与日志由其 runner/controller lifecycle 创建和回收。Agent 不得对交付 workspace、应用目录或 `codument/` 使用 `rm -rf`（也不得用等效递归删除）来处理验收、依赖或临时文件；清理失败是 infrastructure/effect 事实，交回 owner 处理，不能通过删除已交付内容消失。
