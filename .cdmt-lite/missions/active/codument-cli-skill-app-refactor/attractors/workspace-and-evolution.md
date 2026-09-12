# Workspace Skill App 与可升级性吸引子

本文件定义 Codument 的领域载体和跨版本稳定关系。方程及排除集是本体，文件是载体，新旧格式的代码和数据是投影。

## 0. 使用边界

本文件管资源身份、业务保真与升级。Host 内部拆包由 AT1 约束，成本取舍不能削弱本文件。
升级的目的在于保持并演进业务语义，不是仅使新 parser 接受字节。

## 1. 方程

```text
workspace/codument = SkillApp(authored membership, knowledge, domain resources)
resource contract = built-in owner + explicit version + reader/writer
migrate(source, target) = inspect → backup → transform → validate → commit/review
known meaning preserved; unknown meaning retained and escalated
canonical resource has one active identity; compatibility is a boundary
```

## 2. 基本原语

| 原语 | 含义 | 不属于它 |
|---|---|---|
| SkillApp | workspace 的 Codument 资源聚合入口 | 单个功能 Skill 的重复数据副本 |
| Kind contract | Host 接纳的版本化 schema/reader/writer 归属 | App 自授信任的定义 |
| authored resource | 产品资源当前 authority | loader 临时缓存 |
| migration plan | 确定性、带来源的转换声明 | AI 猜测业务语义 |
| review-required | 未能确定性证明、需要语义处理的收据状态 | 可以跳过的 warning |
| backup | 恢复与对照材料 | 同时被 loader 当新 authority 发现的旧副本 |

## 3. 硬不变量

### I1 · workspace 有唯一 App 入口

✅ codument/ 含 SkillApp manifest 与 SKILL，Host 按显式 source 发现，owner-local 文件可追溯。
❌ `.agents/skills` 和 codument/ 各自保存一份可变的正式 Track 或完整重复 App。

### I2 · Kind 内置

✅ 通用及 Codument contract 经代码组合注册；实例只引用版本化契约。
❌ 每次 init 都复制 KindDefinitions，或在 workspace 改 schema 绕过 Host admission。

### I3 · 混合 authoring 不增加 authority

✅ resource-first 知识与 code-first executable resource 在声明的 membership 内组合。
❌ 同一资源同时由 XNL 和 descriptor 独立定义，不校验重复/冲突。

### I4 · 语义保真跨版本

✅ stable ID、DAG、owner、extension、hook 顺序、round 和历史引用保持或有显式转换记录。
❌ 为过校验删未知字段、丢弃历史、把默认值强加到已配置内容。

### I5 · 升级可恢复且可重复

✅ 转换前备份；提交前验证；再次升级业务资源不变；失败保留可恢复源。
❌ 半转换资源立即参与正式发现，或先删旧 authority 再尝试转换。

### I6 · 兜底可启动

✅ 新发行随 CLI 提供迁移 Skill/协议，旧 workspace 缺新 std 也能先取得升级指导。
❌ 必须先通过新 SkillApp parser 才能运行旧资源 migration，形成启动死锁。

### I7 · 正式能力连续

✅ 旧命令兼容调用同一新操作；嵌套任务/跨项目/晋升/归档仍可复现。
❌ 以模板或 CLI 更简短为由默默去掉某操作，或旧别名偷偷调用旧全局 runtime。

## 4. 排除集

App 自带重复 Kinds；旧新两份可写 Track；只换 version 字段；未知内容静默丢弃；备份被扫描为业务资源；migration 依赖已完成 migration。

## 5. 事实关系

产品 package 拥有契约定义；workspace 拥有实例与业务内容；CLI 负责受控转换；Agent 负责不可确定的语义判断。每个选择的依据和来源保存在 review/receipt 中。

## 6. 误读

resource-first 不意味着每个 Markdown 都发明一个 Kind，也不禁止 LocalFunction/Page 等 code-first 扩展。内置化改变 contract 分发，不授予升级器覆盖用户业务的权力。

## 7. 与验收关系

历史夹具、幂等、失败恢复、字段语义对照与真实 Skill 兜底共同度量演进；只跑新建空 App 不足以证明升级完成。
