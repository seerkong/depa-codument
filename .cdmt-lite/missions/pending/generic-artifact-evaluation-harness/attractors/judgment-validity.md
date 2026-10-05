# 证据充分性与验收器校准吸引子

> 本文件定义质量维度：判断必须可追溯、可证伪，无法判断时保持未知。
> 不变量是本体，文本是载体，收据和评分是当前投影；它不规定实现步骤。

## 0. 怎么用

- 检查目标覆盖、证据和判断之间的关系，不以格式正确代替行为正确。
- 不承诺模型无误，不替用户补写无限长需求，不定义某业务的具体正确答案。
- 结构边界服从 general-evaluation.md；本文件只管判定质量。
- 校准样本的 gold owner 独立于被评估产物及本轮 reviewer。

## 1. 一句话方程

```text
judgment = reason(originalTarget, admittedObservations, unresolvedScope)
authentic evidence ⊄ sufficient evidence
PASS requires supported obligations; uncovered/unknown ≠ PASS
execution availability ⟂ artifact correctness
evaluator confidence is bounded by calibration and observable scope
```

## 2. 基本原语

| 原语 | 是什么 | 不是什么 |
|---|---|---|
| Obligation | 来源绑定的可评估目标及解释 | scenario 生成器随意创造的需求 |
| Claim | reviewer 对满足/违反目标的判断 | 已经发生的系统事实 |
| Evidence | admitted observation 对 claim 的支持 | 命令参数、准备结果或自报完成 |
| Unresolved | 歧义、未覆盖、能力不足、证据不充分 | 自动免检项 |
| Decision | 带依据与策略版本的判定 | schema 成功的别名 |
| Calibration | 独立已知答案/失效条件对评估器的度量 | 给生成应用写专属测试脚本 |

## 3. 硬不变量

### I1 · 原始目标不被派生计划替代

解释可变，原始目标不变；被漏掉或确有歧义的目标仍存在。

- ❌ scenario 没列到某要求，于是总体 coverage 被宣称完整。
- ✅ 衍生解释带来源与理由，已知遗漏/未知明确阻止无条件通过。

### I2 · 真实性与充分性分别判断

native 收据证明观察真的发生；独立 reasoning 才讨论是否支持业务结论。

- ❌ 找到字符串、执行 exit 0 或所有 ID 有引用，就自动证明功能正确。
- ✅ 正负例、真实入口、必要状态与异步完成按目标推导，支持关系可被反驳。

### I3 · 不同结果轴不相互伪装

失控或基础设施缺证据是不能判，不是应用必然错误，也不是通过。

- ❌ browser timeout 触发业务修复，或无法观察被当作功能通过。
- ✅ 记录执行故障及局部已有发现；整体结果明确不通过/无法完成，保留归因。

### I4 · 独立性来自可执行边界

reviewer 不改交付物；产物内的指令和 self-test 只作待审材料。

- ❌ app manifest 宣称全通过便跳过验收，或 verifier 顺手修应用再评分。
- ✅ 目标与评估策略来自受信输入，产物内容不升级为评估授权。

### I5 · 表示修正不改历史语义

格式纠正只修表达，不重做业务操作，不增加纠偏上限。

- ❌ 为满足 schema 改 finding/expected/status，旧尝试或失败成本消失。
- ✅ 原结论冻结、修正计费可见、历史 policy 保留，新复验使用新根。

### I6 · 验收器自身接受反证

校准必须含已知错误、证据不足与基础设施失效，而不仅是绿色样本。

- ❌ 只运行一个成功应用，就宣布通用验收可靠或编码能力提高。
- ✅ 报告 false PASS/false FAIL/遗漏/弃判与范围，未知统计不编造。

## 4. 排除集

- X1: 派生 scope 变成完整需求 authority，遗漏被隐去。
- X2: 真实收据/ID 覆盖/exit 0 被直接提升为语义 PASS。
- X3: 基础设施失败伪装业务失败，未知伪装通过。
- X4: reviewer 修改交付物；产物指令或 manifest 接管评估策略。
- X5: 格式修正改变业务事实或重置历史/预算。
- X6: 校准无反例、无不充分样本，或用有限样本宣称普遍正确。

## 5. 事实源阶梯

用户目标及确认约束 → 冻结产物与真实观测 → 解释/claim → admitted decision → 汇总。
gold fixture 定义由校准集 owner 写，reviewer 不能修改 gold。
即使来源真实，派生 claim 仍可错；traceability 不是证明系统。

## 6. 常见误读

- 模糊需求是正常输入；应暴露解释与不确定，而非强制用户写长文。
- 固定 fixture 可校准 harness 的机制与错误识别，但不能写入真实应用的业务路线。
- coverage 高只是覆盖声明；需要继续审支持关系和原始目标遗漏。

## 7. 与 harness 的关系

MISSION 的校准验收度量本文件，测试绿色不重定义语义。
loop/evidence 保留失败与反证；报告必须声明实际校准范围。
