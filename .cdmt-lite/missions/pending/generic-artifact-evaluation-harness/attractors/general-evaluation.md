# 独立通用评估结构吸引子

> 本文件定义评估能力在结构维度上应收敛的稳定关系，不是路线图。
> 硬不变量是吸引子本体，本文件是载体，源码与测试只是当前投影。

## 0. 怎么用

- 判定独立评估、产品基准、通道实现和账本之间的合法边界。
- 不定义业务正确答案，不规定每种领域该使用哪些测试。
- 结构维以本文件为准；证据充分性由 judgment-validity.md 约束。
- 本文件不写评估事实；运行 owner 与派生投影分别拥有自己的写入入口。

## 1. 一句话方程

```text
assessment = evaluate(runtime, frozenTargetAndArtifact, policy)
benchmark = generate(productWorkflow) → artifact → assessment
core owns assessment transitions; adapters own boundary conversion
native observation ≠ proposed claim ≠ admitted decision
one run/phase → one evidence owner; IO flows through explicit ports
```

## 2. 基本原语

| 原语 | 是什么 | 不是什么 |
|---|---|---|
| Target | 原始目标与来源明确的确认约束 | UI/API 分类或派生 scenario |
| Artifact | 被评估的冻结交付物及指纹 | 评估时能随便修改的开发 workspace |
| Runtime | 显式注入的观测/模型/时钟/存储等能力 | 隐式全局或巨型万能对象 |
| Policy | 预算、允许能力和判定策略版本 | 函数回调、业务答案或新需求 |
| Observation | owner 保存的实际发生记录 | 模型自己的复述 |
| Assessment | 评估账本与结果投影 | Track 完成权威或业务纠偏控制器 |
| Adapter | 产品/通道的协议转换边界 | 新的事实 owner 或平行执行引擎 |

## 3. 硬不变量

### I1 · 生成与评估可分离

评估消费目标和交付物，不消费“必须先由 Codument 生成”的前提。

- ❌ eval 入口先 init/plan/implement，或非 Codument 产物无法验收。
- ✅ 产品基准选择调用评估；独立产物直接评估，不创建工作流资产。

### I2 · 通用层不认识具体案例

业务场景是输入或上层适配，不是底层分支。

- ❌ core 按 Todo/Ecommerce/Stream 名称选择断言或要求所有产物有 UI。
- ✅ 通道 capability 与目标义务组合；新的业务不改 core。

### I3 · 副作用显式且角色相符

核心状态变换与判定通过 contract 调用 runtime，具体 IO 在 support。

- ❌ admission 直接启动浏览器、读个人 HOME、写 Track 或 import benchmark。
- ✅ contract/logic/support/adapter/capsule/shell 的职责可识别，即使暂在同模块内。

### I4 · 事实只有一个写入 owner

native 通道写 observation，模型写 proposal，受信 harness 写 admitted decision；报告只投影。

- ❌ reviewer 自写官方 receipt，或旧新两个 scorer 都维护正式结论。
- ✅ 原入口委托单一能力，adapter 不改写被转换事实。

### I5 · 运行资源跟随持有者

lease、进程、浏览器连接和可变数据只能由本次 owner 获取、释放及追踪。

- ❌ timeout 后重放未知效果、另建空间掩盖失控、清理其他运行或交付 workspace。
- ✅ 已知安全重观测与未知效果 fencing 分开；关闭有实际反馈。

### I6 · 复用服从语义而非名称

公开原语满足契约才复用，能力缺口由消费方薄适配，底座不反向认识评估产品。

- ❌ 为复用宽权限 browser eval 而撤掉 reviewer 安全边界，或复制一份公共实现。
- ✅ 既有受限通道和公开生命周期能力分工，单一实际执行路径。

## 4. 排除集

- X1: eval-only 与 init/生成/Track 的强耦合。
- X2: case selector、业务断言、Web 分类进入通用 core。
- X3: 隐式 IO、core 反向依赖产品或具体 support。
- X4: 两个正式账本/scorer、proposal 反写 native receipt。
- X5: 未知副作用重放、丢控制权自动 reclaim、跨运行资源清理。
- X6: 平行复制公共底座，或用宽权限机制替换受限 reviewer。

## 5. 事实源阶梯

原始目标/冻结产物 → native 通道记录 → admitted 评估账本 → 报告/聊天。
产品工作流 authority 不在这条链中被评估账本替换。
适配器只转换与引用，派生报告不能反写上层事实。

## 6. 常见误读

- 通用不等于所有领域都用同一工具；相同的是协议与事实边界。
- DEPA 不等于立即建六个 package；有真实边界再决定物理拆分。
- 模块数量、注册表数量不是成熟度；减少双真源比多做一层更重要。

## 7. 与 harness 的关系

MISSION 定终点，loop 定工作图，测试度量本文件排除集。
通过几例校准不改变本文件，也不构成普遍业务正确证明。
