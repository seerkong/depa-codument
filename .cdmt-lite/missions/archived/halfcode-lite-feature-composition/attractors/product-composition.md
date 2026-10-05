# 单一公共实现与可选择产品组合吸引子

本文件定义本 mission 的稳定结构，不是实现步骤。概念来源为 Sparrow/ACE 的 skeleton-feature composition 和 DEPA 事实源边界；本方程按 Halfcode / Codument 的现有 XNL、CLI、SkillApp 关系重新定义。

## 方程

```text
产品 = 中立命令 host + 所选公共能力的同一实现 + 产品自有领域能力 + 产品身份/资产
所选能力 → 类型需求 ∩ effect 闭包 ∩ command/Kind 表面 ∩ 资源资产闭包
公共能力只有一个实现 owner；产品只有一个组合与领域 authority
```

## 原语

| 原语 | 是什么 | 不是什么 |
|---|---|---|
| Protocol | XNL、Kind、引用与 admission 的稳定契约 | 产品品牌或第二套编译器 |
| Host | 解析、分发、执行策略及生命周期机制 | 浏览器/业务能力全集 |
| Feature | 具有真实公开边界、声明最小 runtime 需求的能力 | 命令名称列表或源码拷贝 |
| Product composition | 选择能力、装配 effect、定义表面和资产 | 修改公共底座让它认识 Codument |
| Resource material | 有唯一源码、可复现且可安装的资产闭包 | 安装时临时拼文本的新真源 |

## 硬不变量

- I1: Protocol、公共 feature、产品领域和产品组合分别有明确 owner；衍生 command catalog 和安装目录不得反写其 source authority。
- I2: 新增产品能力通过该产品的组合接入，不要求修改别的产品或让底座识别其业务名。
- I3: Feature 只声明自身需要的 runtime facet；产品组合可以取交集，但未选择的能力不成为基础运行必需品。
- I4: parse / schema / children / admission / run 的完整命令链保留真实 runtime 类型；缺能力静态失败，动态输入按公开协议 fail closed。
- I5: effect 显式注入，owner 负责生命周期，借用能力不擅自关闭；本地命令不隐式启动 server/browser。
- I6: 同一选择同时约束执行与外部资源表面；冲突必须显式裁决，资源资产可追溯到唯一源码，source 与 embedded 的语义一致。
- I7: 已有产品行为与安装安全独立于公共库重命名；隔离验证与可恢复迁移不能用破坏现有 session 换取“通过”。

## 排除集

- 两个仓库维护同一通用 command 实现或 catalog/dispatch authority。
- 用宽 optional runtime、`any` 或强转宣称完成组合类型安全。
- 产品用兄弟源码/安装目录作为构建依赖，或未选择 browser/server 仍强依赖它们。
- 默默覆盖同名命令/Kind，或仅扩展 help 却不扩展实现、协议及资产闭包。
- 复制 Kind 定义到各 workspace、安装时拼接 SOP 形成另一份事实源。
- 仅凭 help/build 通过就宣称独立消费与迁移已通过；验证修改全局旧安装。

## 使用与验收

MISSION.md 给出终点和负向验收，loop.md 保存工作图，evidence.md 保存轨迹；这里不复制这些清单。测试只度量实现，不将测试夹具的特例写入通用底座。
