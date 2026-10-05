# 验证协议与环境

## 本轮立项检查

- 检查 pending 四类权威文件、目标/约束映射、节点依赖、链接与排除集负向覆盖。
- 官方 checker 的 preflight 只允许 active；pending 不能被假激活以取得绿色。使用导出的 `check` 收集结构错误，确认唯一错误为 `preflight requires an active/ mission with Status: active`。这不是执行 preflight 已通过。
- 验证记录追加 evidence.md；所有业务 Acceptance 仍不勾选。

## 执行环境

- 业务修改在真实本仓库 `project/`；运行/构建/依赖安装/测试使用独立 `/tmp` 副本，显式绝对路径，不读默认 global binary。
- 先保存 dirty snapshot identity、源码/需求/历史产物指纹、公共依赖解析与两个 global bin/Skill 指纹。artifact 和 reviewers 只读，scratch/runtime data 分离。
- 执行前只读观察其他 mission 的 owner；不得复用 TaskSpace 6 或批次根。新的 browser owner 必须独立、可验证释放。
- 运行 node/bun 取本机明确可用路径；当前 Bun `/Users/kongweixian/.bun/bin/bun`。不修改 HOME/CODEX_HOME 全局配置，不复制全部私人 plugins/Skills。
- 下述路径/脚本是待实现验收入口，首节点可改名，但须同步 MISSION 验收引用、保持语义，不能因为未实现而跳验收。

## 三类验证，不相互冒充

| 类型 | 命令/范围 | 模型与外部副作用 | 证明什么 |
|---|---|---|---|
| 确定性测试 | `bun test evaluation/test/...`；`bun test e2e` | 无模型，fake effects + 隔离 fixture | 合同、状态机、兼容、负向边界 |
| native smoke | `bun evaluation/calibrate.ts --profile=artifact-smoke --no-model --output-dir=<新根>` | 本地 process、独立 Ego space，无模型 | 真实通道、隔离、观测、关闭，不证明业务语义 |
| 模型校准 | MISSION 的 judge-calibration 命令 | 六样本，Terra/medium ≤12 调用，总120分钟 | 有限已知 pass/fail/insufficient 样本的语义判定 |

judge-calibration 不运行计划/实现、不安装全局 Skill、不重跑原五例生成。没有模型额度或资源无法完成时记录真实失败，保留剩余节点，不宣布完成。

## 排除集到负向测试映射

| 排除项 | 检验 |
|---|---|
| AT1 X1 强耦合 | eval-only 测试使用没有 codument/ 的产物，并设置拒绝安装/规划/实现 port |
| AT1 X2 case/Web 特例 | boundaries import/源扫描 + 非 Web 同入口 native smoke；target-coverage 验证原文不改 |
| AT1 X3 隐式 IO/反向依赖 | boundaries module graph 与纯 logic fake runtime，禁止 import benchmark/support/fs 等 |
| AT1 X4 双账本/scorer | benchmark-adapter/历史回放；proposal 改官方 receipt 被 isolation/admission 拒绝 |
| AT1 X5 未知重放/资源越权 | faults/concurrency：丢控制权、late effect、重复 request、外 owner cleanup 请求均拒绝 |
| AT1 X6 平行底座/权限扩大 | 单一执行调用链审计，restricted browser capability 逃逸测试，公开 export 边界检查 |
| AT2 X1 scope 隐去目标 | target-coverage 给 planner 漏掉显式要求的 proposal，保留 unresolved 不放行 |
| AT2 X2 真实性即充分性 | admission 拒绝伪造/跨phase证据；校准真实但无关观察、错误入口、ID 假覆盖 |
| AT2 X3 归因混淆 | faults：infra 结果不启动 implementer、不转业务 defect、不计通过 |
| AT2 X4 reviewer 修产物/注入 | isolation 权限拒绝 + artifact 指令/manifest 不能覆盖受信 policy 的校准样本 |
| AT2 X5 格式改判/重置 | admission/budget/benchmark-adapter：freeze semantic identity、保留旧attempt/usage |
| AT2 X6 只有绿样本/过度结论 | judge-calibration 结果含负例、不充分与覆盖局限；sop/report 测试禁止混入不同 policy denominator |

扫描只能辅助人工架构审查，不能以没有某字符串证明任意语义正确。反例校准失败时调整评估器，不修被评应用，不将 gold 偷喂给 reviewer。

## 完整工程回归与交接

- 将 evaluation 纳入 `project/package.json` 的 test/lint 与 tsconfig 范围；在最终隔离副本执行 `bun run check`。
- current/legacy 只需无模型兼容及 replay，保留既有完整生成入口，首阶段不追加生成成本。
- 官方 receipt、raw usage、policy、artifact identity、source quotes、execution status 与 judgment 分开保存；临时 auth 清理，报告不泄漏秘密。
- 复验另开只读 root，不修改旧结果。测试需要临时样本的清理由 runner lifecycle 处理，不由 agent 删除交付资产。
- 最后按 cdmt-mission-lite 独立重观察 MISSION/attractors/用户目标并重跑全部验收；completion 后才归档，不能拿 733 旧测试成绩冒充新增实现的回归。
