# Loop: 通用 AI 产物评估 Harness 的第一阶段收敛

Status: pending
Round: 0

> 恢复时加载 MISSION Notes 指定的 skills。工作图是假说，由观察、调和、行动、验证推进；本轮没有执行授权。

期望态权威：[MISSION.md](MISSION.md)。证据：[evidence.md](evidence.md)。

## Work graph

### 冻结基线与落实边界

- Status: pending
- After: none
- Covers: 约束-1, 约束-2, 约束-3, 约束-4
- Verify: 隔离 prepare/preflight、来源解析与 owner/指纹清单 → 原始资产和其他 mission 未改变，计划能对应当前源码。
- Outcome:
  - 以 design/current-state.md 为分析起点，重观察 dirty snapshot、公共依赖、活动批次及可用历史产物。
  - 确定每个既有模块是原地抽离、薄适配还是保留历史；写下 owner 与调用链，不机械复制目录。
- Done when:
  - 安全隔离根与源码基线明确；新验证路径纳入工程检查的方案明确；MISSION 经 active preflight 通过。

### 建立目标证据和判定契约

- Status: pending
- After: 冻结基线与落实边界
- Covers: 期望-2, 期望-3, 约束-1, 约束-5
- Verify: `bun test evaluation/test/contracts.test.ts evaluation/test/admission.test.ts evaluation/test/target-coverage.test.ts` → 目标来源、未覆盖义务、歧义及两轴结果不混淆。
- Outcome:
  - 先落 contract 与纯 admission/结果投影；原始目标不可由派生 scenario 覆盖，观测事实与模型判断分开。
- Done when:
  - 版本化合同与负向用例可运行；各事实写入者和跨适配器转换明确，无通道特例进入 core。

### 打通非 Web 的独立评估切片

- Status: pending
- After: 建立目标证据和判定契约
- Covers: 期望-1, 期望-3, 约束-2, 约束-3
- Verify: `bun test evaluation/test/eval-only.test.ts evaluation/test/isolation.test.ts evaluation/test/lifecycle.test.ts` → 不初始化 Codument 也能评估 CLI/库样本，交付根不可写。
- Outcome:
  - 由受信 process observer 记录真实 argv、退出、stdout/stderr、阶段、文件指纹与时间；不从模型复述推导执行成功。
  - 复用原 runner 隔离与资源释放，运行态放评估 scratch；不靠命令名白名单证明业务正确。
- Done when:
  - eval-only 有真实 process 垂直切片，纯测试与 native smoke 互相区分，失败可追溯且无实现调用。

### 接入浏览器观测与失效隔离

- Status: pending
- After: 建立目标证据和判定契约
- Covers: 期望-1, 期望-3, 约束-2, 约束-3, 约束-4
- Verify: `bun test evaluation/test/faults.test.ts evaluation/test/concurrency.test.ts` + `bun evaluation/calibrate.ts --profile=artifact-smoke --no-model --output-dir=<新评估根>` → 新 owner native smoke 通过，控制权/未知效果 fencing 与关闭验证生效。
- Outcome:
  - 适配既有 restricted Ego channel、native observations、setup lease；浏览器细分 scope 留在浏览器适配器。
  - 公共能力按真实端口语义复用；不将宽权限 eval provider 当受限 reviewer 的替代。
- Done when:
  - 浏览器与 process 都使用公共 ledger；只能清理本评估持有的资源，无 Chrome/OpenCLI fallback 或活动批次空间复用。

### 建立独立判断与成本预算协议

- Status: pending
- After: 打通非 Web 的独立评估切片, 接入浏览器观测与失效隔离
- Covers: 期望-2, 期望-3, 期望-5, 约束-5, 约束-7
- Verify: `bun test evaluation/test/admission.test.ts evaluation/test/budget.test.ts evaluation/test/usage.test.ts` → native 事实不能被 prose 伪造，表示修正不变更业务判断，预算包含失败和准备。
- Outcome:
  - 复用 agent runtime 但去掉五例安装/生成耦合；判断使用原始目标、派生义务及 admitted observations。
  - 建立已知 pass/fail/insufficient 校准输入，明确缺证据不通过、不等于业务错误；模型无法成为不可证伪的最终 authority。
- Done when:
  - 无模型协议、攻击/遗漏样本和费用账本测试过线；真实校准入口与硬预算可执行但尚未调用。

### 将产品基准接入单一评估入口

- Status: pending
- After: 建立独立判断与成本预算协议
- Covers: 期望-4, 期望-6, 约束-4, 约束-6
- Verify: `bun test evaluation/test/benchmark-adapter.test.ts` + `bun test e2e` → 新旧基准同实现、历史可读、终态与 attempts 不变。
- Outcome:
  - 产品适配器仍拥有安装/生成、工作流验证、业务纠偏和外层上限；评估 core 只返回结果，不回写 Track。
  - 原有入口薄委托，历史报告保留 policyVersion；README/SOP 指向同一新入口，不产生平行 scorer。
- Done when:
  - current/legacy 适配回归与历史回放过线；新增目录加入 typecheck/lint/test；没有 full generation。

### 有界校准验收器自身

- Status: pending
- After: 将产品基准接入单一评估入口
- Covers: 期望-5, 约束-3, 约束-7
- Verify: MISSION 的有界校准命令 → 两通道的 pass/fail/insufficient 有可审计结果与原生 usage，预算未超限。
- Scope:
  - 本计划确认才授权六样本、最多十二次 Terra/medium 模型调用；协议准备/修正也扣预算。若额度不足，记录实际证据，不能用 stub 冒充语义验收。
  - 无模型闸门全部通过后才开始；不修改历史产物，校准输出另开根。
- Done when:
  - 期望-5 完整满足，无已知样本 false PASS/false FAIL；不足和基础设施态归因正确，未覆盖范围明示。

### 完整回归和独立目标重观察

- Status: pending
- After: 有界校准验收器自身
- Covers: 期望-1, 期望-2, 期望-3, 期望-4, 期望-5, 期望-6, 约束-1, 约束-2, 约束-3, 约束-4, 约束-5, 约束-6, 约束-7
- Verify: 最终隔离副本 `bun run check` + MISSION 全部验收 + completion 闸门 → 全部期望/约束和吸引子排除集有最终证据。
- Done when:
  - 不采信旧勾选，从原始用户目标和 attractors 重建目标态并复验；报告局限、策略版本与真实成本，无虚构效果提升；符合 skill 完成条件后归档。

## 尚未看清

- 最终可用的历史产物是否仍保留，以及其完整需求/指纹能否恢复；执行首节点重观察。若已丢失，使用校准专用冻结 fixture，不偷偷重新生成五例应用。
- 非 Web 真实样本选择 CLI 还是库，以本仓库可独立运行、来源明确的产物为优先；不是新的语言矩阵承诺。
- 模型对“义务遗漏/充分性”的稳定性仍需校准。六个样本只能验证有限行为，不能估计稳定统计通过率；扩大样本是后续工作。
- 未来第二个消费者、跨平台隔离、公共包拆分与远程评估不影响本阶段收敛，尚不据此预建插件框架。

## Actual state

- 已归档 Halfcode feature composition / npm public release；本项目版本 0.6.0，当前公共依赖 0.2.1。公共包与产品版本、资源协议版本不是同一个版本轴。
- 既有 harness 已有 native 收据、隔离、一次协议修正与 fresh semantic review，不是从零建设。独立验收仍混在五例产品生成/工作流流程，具体证据见 design/current-state.md。
- `npm-release-install-e2e` 的 E7 记载另一批五例运行已启动；本轮只读取状态，不判断其最终结果或操作其资源。
- 当前 worktree 有大量其他变更，全部保留。本轮只新增本 pending mission 的规划文件，没有业务修改、构建、安装或模型调用。

## Last action

- 读取 mission skills、已完成跨仓改造、当前 harness 与公共 API；建立分析、结构/质量吸引子、验收合同和工作图。规划验证结果追加到 evidence.md。

## Next

- 等待用户确认本计划及其中六样本、最多十二次 Terra/medium 模型调用、120 分钟的评估校准预算。确认后整体转 active，通过 preflight，从“冻结基线与落实边界”进入控制论循环；不接管其他 mission。

## Decisions and replans

- 现有独立 review 已取代固定业务 oracle → 主要问题是抽离产品耦合与校准判断充分性，不重造浏览器工具，不声称旧 oracle 仍是当前业务闸门。
- 公共能力刚完成重组/发布 → 按公开端口复用，将评估安全策略和事实 owner 放在适配方；本阶段先模块边界，不为预想消费者拆六个空包。
- 收据真实性与语义正确性不是同一件事 → 两个正交 attractor；负向校准而非继续追加 Web 特例。
- 用户只要求新 mission 与任务规划 → 停在 pending，满足 cdmt-mission-lite §7 的“已立项”返回条件。
