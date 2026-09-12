# 准确性保持与上下文经济吸引子

本文件定义减少重复输入且保持验证能力的稳定关系。少量不变量约束优化方向；字节、token、测试和报告是度量。

本体是方程和排除集，本文是载体，当前 operation/CLI 输出是投影。

## 0. 使用边界

成本优化主要针对不相关读取、重复协议和冗长成功输出。必要语义判断与独立验证允许继续消耗 token。
AT1/AT2 管结构和业务，成本指标不能取代它们。

## 1. 方程

```text
context = current intent + applicable contract closure + valid evidence references
view = project(sources, versions, task, policy)
source or policy changed → prior view invalid
required checks(after) = required checks(before) under identical configuration
less redundant context AND preserved fault detection → valid optimization
```

## 2. 基本原语

| 原语 | 含义 | 不属于它 |
|---|---|---|
| ContextView | 有来源、有版本、可重建的任务投影 | 改写真源的短文 |
| L0/L1/L2 | 入口摘要/适用合同/按需历史展开 | 丢掉必要规范的硬 token 截断 |
| receipt | 可核验的执行事实 | 自动等同 fresh semantic verdict |
| fresh reviewer | 独立读取当前适用依据并判定 | 继承实现者完成结论的确认器 |
| check policy | 用户和产品明确配置的验证要求 | 成本助手自动降低的强度 |
| cost baseline | 固定场景与版本的可复现度量 | 文档大小直接等同实际账单 |

## 3. 硬不变量

### I1 · 必要依据完整

✅ 精确加载适用文件/章节，依赖闭包和来源可继续展开。
❌ 为限长截掉 acceptance、已生效 attractor、不利 evidence 或 migration 扩展字段。

### I2 · 检查机制等价

✅ 同配置下 hook 顺序、GapLoop round/耗尽语义、AttractorCheck 和人工 gate 一致。
❌ 把两种检查合并成同一个 PASS，关闭 hook，减少已配置轮数。

### I3 · 独立语义判断保持 fresh

✅ reviewer 自读当前合同和证据；实现者只交 paths/范围/验收问题。
❌ 用缓存 summary 替代本次 fresh review，或把实现者解释作为唯一依据。

### I4 · 缓存是可失效投影

✅ source/contract/config/runtime/evidence 前提变化均触发相应失效；不确定时重新观测。
❌ 只依赖 mtime、过期 hash 或不同命令的成功 receipt 放行。

### I5 · 保存历史，减少默认装载

✅ archive 细节保留可追溯引用，默认给紧凑入口；必要时展开原文。
❌ 为减少读取删除原日志、旧决策、失败证据或以摘要覆盖原 authority。

### I6 · 经济性可证伪

✅ 同任务、同检查配置、同必要 source closure 比较成本与故障检出。
❌ 改任务、改验证强度或把静态字节缩小称作真实模型 token 节省。

### I7 · 输出压缩不改变协议

✅ 成功结果简洁，细节按引用读取；已有 JSON 用户有兼容选项/版本。
❌ 改旧 JSON 字段或删 review-required diagnostics 造成升级和自动化失效。

## 4. 排除集

廉价假 PASS；缺源摘要；fresh 语义 verdict 缓存；预算阻断必须检查；archive 信息破坏；未标明模型/tokenizer 的 token 报告。

## 5. 事实关系

authority/config/code → ContextView；执行环境 → receipt；reviewer → 当前语义判定。三者不可互相冒充。

## 6. 误读

“全部载入后再总结”可能没有节省输入成本。证据缓存与语义 review 是不同边界。低成本目标允许为完整性扩大上下文，必须记录原因。

## 7. 与验收关系

固定场景的输入量、重复读取、负例检出和检查 trace 共同度量结果；真实 token 无数据时只报告静态代理指标。
