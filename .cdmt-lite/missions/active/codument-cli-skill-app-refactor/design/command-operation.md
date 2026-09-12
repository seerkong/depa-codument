# CommandOperation：资源声明到顶层操作命令

此为用户修正后的公共能力设计，Round38–39已实现并经真实制品消费验证（E274起）。通用实现归Halfcode公共包，Codument只声明本产品操作，不复制通用机制。

## 语义与职责

CommandOperation是独立的内置Kind，表示“可从CLI顶层直接取得的Agent操作指引”。资源身份仍有稳定FQN以便校验、引用与追溯，但不是用户发现该操作的前置条件。

```text
CommandOperation declaration + explicit product exposure
  → one validated CommandDefinition tree
  → root help / command help / argv validation / operation delivery
```

顶层帮助和实际分派必须消费同一份验证后的命令树，不能只在help追加字符串或在未知命令fallback里临时检索同名文档。`-h`不能启动Serve、执行LocalFunction或依赖一个已初始化的业务workspace。

调用plan-track等指引命令只提供当前标准operation、参数与来源，当前Agent继续执行；成功取得指引不代表Track已创建，不启动隐藏AI进程。原确定性CLI仍负责受控业务写入。SOP继续承载原有资源流程，CommandOperation不通过自动包装为SOP或要求Notebook来改变原执行规范。

## 两层SkillApp

| 载体 | 拥有的内容 | 不拥有 |
|---|---|---|
| global depa-codument | CLI操作指南、operations/中的CommandOperation正文、std/其余规范闭包 | 项目的Track、Mission、知识、配置和执行状态 |
| project/codument/ | 本项目资产SkillApp、业务资源、配置及项目吸引子 | global标准操作的重复副本 |

只聚合旧15个指导Skill；不消除workspace SkillApp，不让全局Skill目录成为任务workspace。保留depa-codument唯一新bin与旧codument安装隔离。

## 已实现声明合同

资源沿用Halfcode标准Markdown envelope与Kind准入：

- metadata.fqn：稳定的CommandOperation身份，如Codument.CommandOperation.PlanTrack。
- spec.command：一个顶层命令token，如plan-track；不是任意argv或shell代码。
- spec.description：顶层帮助中的功能摘要。
- Markdown正文：操作内容直接随envelope存于operations/plan-track.md；不使用operationPath再存一份正文。源模板在产品workspace-assets，安装投影不在global std/operations中重复分发这些15篇。
- 公共CLI schema使用[arguments...]和--json，--后的参数原样交付Agent；不添加第二个参数解析器，不把参数作为shell代码执行。

资源拥有“操作是什么”，产品安装/组合策略拥有“哪些资源暴露为此CLI的顶层命令”。不是所有发现的workspace CommandOperation都自动进入宿主全局命令空间；按显式来源准入，拒绝未授权覆盖。

定义与操作来源使用完整digest闭包：指引、参数或引用变化后重建投影。入口取得操作的receipt包含来源、操作标识与版本/digest；不能依赖过期安装索引冒充当前源。

## 公共包分工

- skill-app-contract/logic：Kind合同、资源解析/验证及只读投影；不得硬编码Codument命令、路径或文案。
- cli-host-contract/logic：复用CommandDefinition、argv校验、树校验与帮助渲染；资源投影到命令不拥有另一套dispatcher。
- support：读取已准入来源及正文，路径/符号链接/版本边界检查。
- capsule/product shell：组合资源来源与注册策略，冻结一致快照后供help与dispatch使用；资源安装目录和业务workspace显式分开。
- Codument：旧名称映射、15个产品操作、global资产、std及领域功能。Kind定义不下发到任何App实例。

以实际exports与依赖方向确定最小接缝，不为一个Kind新造六个包。当前catalog的workspace边界不直接放开；global根是显式独立准入来源，不准以任意绝对路径绕过既有约束。

## 顶层暴露与兼容

预期顶层操作：discuss、plan-track、maintain-track、impl-track、archive-track、plan-mission、impl-mission、archive-mission、impl-quick、docs-bootstrap、artifact-sync、migrate、validate、verify、gap-loop。

旧codument-*名称与各功能摘要必须进入global SKILL.md的frontmatter description；正文映射到`depa-codument <operation>`。显式用户要求优先于skill-creator通常避免完整能力列表的默认建议。

已存在的validate和migrate是确定性CLI入口，不能被同名指引静默替换：

- 默认注册同名冲突即失败，错误指出两个来源，不能first-wins/last-wins。
- 用户进一步明确撞名直接选择不冲突的CommandOperation命令名：validate-operation、migrate-operation。原validate/migrate保持全部语义，不添加--operation桥接或混合分派；批末报告最终全量映射和冲突方案。
- 没有现有原生命令的plan-track/impl-track等直接返回操作指引；无需先list/detail或提供FQN。
- 不把原Skill的AI语义校验与CLI结构校验合成同一个PASS。显式绑定的参数合同与选项冲突也必须校验。

## 验收

1. 独立非Codument消费者注册一个CommandOperation，实际`-h`与直接调用均可用，公共包没有Codument依赖。
2. Codument顶层帮助列出全部映射；不创建workspace、不连接Serve也能查询plan-track等操作。
3. 重复command、与内置命令撞名、未准入workspace覆盖、缺正文、越界/符号链接、过期来源和未知参数均有拒绝负例。
4. validate-operation/migrate-operation与原validate/migrate同时存在；原argv/raw JSON/退出码保持，指引获取与业务执行互不冒充。
5. global description在未加载正文时足以路由所有旧Skill名；独立语义推演检查计划/执行/迁移及GapLoop等入口不误选。
6. 新workspace仍为SkillApp，但无std及多指导Skill副本；旧定制std经备份/review，不能自动上写全局。
7. 先证明公共Kind与global聚合，再接入init/status/upgrade-workspace，最终打包安装/历史迁移与旧session保护复验。
