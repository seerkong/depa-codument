# Round55 新旧完整 E2E 对照

重构后0.6.0与重构前0.5.4真实编译产物/配套Skill，各五项fresh完整规划→实现→独立验收。所有运行隔离/tmp；没有由本编排会话手工修生成应用，纠偏由测试中的模型执行；不修改原全局安装。

| 版本 | 用例 | 正式结果 | 首次外层通过 | 外层次数 | 分钟 | input / cached / output |
|---|---|---|---|---|---|---|
| current | todo | passed | true | 1 | 18.70 | 5,009,103 / 4,665,088 / 58,557 |
| current | stream-pipeline-ai-agent | passed | false | 2 | 21.96 | 5,145,172 / 4,745,472 / 51,300 |
| current | blog | infrastructure-failed | false | 2 | 37.12 | 6,550,687 / 6,123,264 / 75,085 |
| current | ecommerce | passed | false | 3 | 32.18 | 7,739,822 / 7,188,736 / 77,847 |
| current | nested-mission-agent | passed | false | 3 | 34.21 | 9,785,162 / 9,172,992 / 91,727 |
| legacy | todo | infrastructure-failed | false | 3 | 37.65 | 9,810,200 / 9,175,296 / 107,034 |
| legacy | stream-pipeline-ai-agent | passed | true | 1 | 17.14 | 4,414,212 / 4,142,848 / 45,047 |
| legacy | blog | passed | false | 3 | 43.66 | 13,040,689 / 12,291,072 / 125,259 |
| legacy | ecommerce | passed | false | 2 | 34.60 | 9,063,549 / 8,507,136 / 93,776 |
| legacy | nested-mission-agent | passed | false | 3 | 28.10 | 8,737,092 / 8,255,744 / 81,001 |

## 分组汇总

| 版本 | 正式试次 | 首次外层通过 | 最终通过 | infra/未完成 | 总分钟 | input | cached（input子集） | output |
|---|---|---|---|---|---|---|---|---|
| current | 5 | 1/5 | 4/5 | 1 | 144.17 | 34,229,946 | 31,895,552 | 354,516 |
| legacy | 5 | 1/5 | 4/5 | 1 | 161.14 | 45,065,742 | 42,372,096 | 452,117 |

分母保留正式基础设施失败；业务-only分母、缺失数据数及阶段时间见JSON。未运行case保持unknown，不加入已执行试次率。

```json
{
  "direction": "current relative to legacy; descriptive sample only",
  "elapsed": -0.10534749524334741,
  "input": -0.24044419372924117,
  "uncachedInput": -0.1333701607412407,
  "output": -0.21587553664206388
}
```

## 两版均通过的共同用例（事后描述子集）

共同用例：stream-pipeline-ai-agent, ecommerce, nested-mission-agent。不能用此子集替换五项总通过率，也不能称其为无偏/因果估计；它有助于看出总量下降是否来自不同infra结果。

| 版本 | 用例数 | 总分钟 | input | cached（input子集） | output |
|---|---|---|---|---|---|
| current | 3 | 88.35 | 22,670,156 | 21,107,200 | 220,874 |
| legacy | 3 | 79.83 | 22,214,853 | 20,905,728 | 219,824 |

## 各阶段耗时（分钟）

失败阶段与内部修复均计入；driver总时间还包括初始化、CLI门禁、进程启动及清理。无该阶段的用例以—表示，不表示缺失的模型数据为零。

| 版本 | 用例 | 规划 | 实现/纠偏 | 独立review | UI场景规划 | UI验收 |
|---|---|---|---|---|---|---|
| current | todo | 3.01 | 10.00 | 2.24 | 1.25 | 1.69 |
| current | stream-pipeline-ai-agent | 3.55 | 13.41 | 4.80 | — | — |
| current | blog | 1.59 | 17.57 | 14.93 | 1.81 | 0.71 |
| current | ecommerce | 2.83 | 21.04 | 2.47 | 3.43 | 1.80 |
| current | nested-mission-agent | 5.33 | 21.52 | 7.17 | — | — |
| legacy | todo | 2.17 | 24.89 | 7.67 | 0.67 | 1.71 |
| legacy | stream-pipeline-ai-agent | 6.47 | 8.36 | 2.19 | — | — |
| legacy | blog | 5.90 | 25.14 | 7.83 | 1.06 | 3.11 |
| legacy | ecommerce | 6.39 | 19.73 | 3.76 | 2.47 | 1.67 |
| legacy | nested-mission-agent | 10.25 | 9.96 | 7.83 | — | — |

## 无效pilot成本（不计正式旧版失败）

旧封套准入误判pilot：/private/tmp/depa-codument-e2e-iFiRLX；9.11分钟；input 1,922,613 / cached 1,703,936 / output 23,445。原始记录保留，不重置预算。

## 比较边界

- Each case/product has one fresh sample. Current ran before legacy; generation is stochastic, not a causal/population guarantee.
- The first-pass metric means the first outer attempt; internal fresh verification/repair is included in its time and cost.
- NOT a byte-identical harness comparison: legacy envelope admission and interruption handling were corrected after current formal trials. Product binaries, requirement bytes, public policy, business/UI acceptance and bounds stayed frozen. Exact changed files/digests are listed.
- Legacy uses genuine 0.5.4 project-local Skills/std and its historical enabled Modeling/Engineering preset; current uses the genuine 0.6.0 global SkillApp. Those version-specific workflow semantics differ.
- Review includes alignment with each automatically approved authored plan, not just the common external API. Generated plan constraints can differ; for example legacy Blog state-transition findings reference its own behavior/design/model. Rates are complete workflow-delivery observations, not a pure identical-assertion API score.
- The frozen public policy disables hanging Track GapLoop/AttractorCheck/HumanConfirm and retains fresh independent verification. This experiment does not measure those hooks when enabled or prove their production cost/performance equivalence.
- Infrastructure failure is not a business PASS. Overall trial rates retain it; business-only denominator is supplemental and must not disguise it.
- Input/cached/output are observed per-response deltas across parent and child logs, including failed/interrupted work. Cached is a subset of input, not extra tokens; this is not an account bill. Missing values are unknown.
- Costs cover the E2E execution sessions, not this orchestrating chat. All original harness logs/results remain; do not infer that models preserved every application-owned receipt. Observable native file deletions are listed for audit.
- A pre-existing release version assertion remains failing. This scoped test report does not claim the whole repository check or refactor mission completed.
- 96条实际模型上下文均Terra/medium；11个安装Skill根指纹保持；19个自有endpoint与6个UI服务origin关闭、临时auth删除、原件保护指纹不变。
- current harness: 7cdf53928832e0db4f9f05537c9a8a95c9e5660e3f15124486f9a3ae878f14a8
- legacy harness: f250bd9beea3fb6b1efae93dce4ea46b698305e99e90b6bc13a4b9dbaabb9efa

## 原始试次

- current/todo: [日志与结果](/private/tmp/depa-codument-e2e-qD39h4)
- current/stream-pipeline-ai-agent: [日志与结果](/private/tmp/depa-codument-e2e-4V3XIf)
- current/blog: [日志与结果](/private/tmp/depa-codument-e2e-L6Eq7T)
- current/ecommerce: [日志与结果](/private/tmp/depa-codument-e2e-TzOmpZ)
- current/nested-mission-agent: [日志与结果](/private/tmp/depa-codument-e2e-VYDrYT)
- legacy/todo: [日志与结果](/private/tmp/depa-codument-e2e-aW595i)
- legacy/stream-pipeline-ai-agent: [日志与结果](/private/tmp/depa-codument-e2e-UXwrsM)
- legacy/blog: [日志与结果](/private/tmp/depa-codument-e2e-560au2)
- legacy/ecommerce: [日志与结果](/private/tmp/depa-codument-e2e-dVB0mR)
- legacy/nested-mission-agent: [日志与结果](/private/tmp/depa-codument-e2e-8UuQfJ)

阶段耗时、每次finding、原生UI收据、父子会话核算与source差异均保留在同名JSON；缺失/未运行项不填零。
