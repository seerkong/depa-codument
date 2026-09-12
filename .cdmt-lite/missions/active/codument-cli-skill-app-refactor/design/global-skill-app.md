# 全局指导 Skill App 与项目资产 SkillApp

本文件记录2026-09-07用户新方向，尚非已实现能力。执行状态只在loop.md；旧三命令方案中的workspace std/多薄Skill分发已不适用。

## 已明确的分发方向

- 新版唯一bin与聚合后的全局产品指导Skill均为depa-codument；这不排除每个项目自己的codument/资产SkillApp。
- global depa-codument包含SKILL.md、合法Halfcode SkillApp manifest、CommandOperation及std完整规范闭包。
- 所有原产品Skill的名称与功能摘要直接列入frontmatter description，不仅写在正文或隐藏索引里；正文给出旧名称→顶层子命令→CommandOperation身份→operation路径映射。
- 原std/operations是操作语义来源。用户进一步指定公共新Kind CommandOperation，以顶层命令直接暴露，替代上一版“仅SOP list/detail后才能取指引”的入口方案。普通SOP保持原用途，不引入第二套workflow engine，不把GapLoop/Hook/AttractorCheck变成普通命令成功。新Kind设计见command-operation.md。
- 正式业务数据仍在项目codument/；std不再向新workspace重复分发。旧workspace的定制std先备份、比对、review，不混入全局共享规范污染其它项目。
- 先聚合global App并验证，再接入init/status/upgrade-workspace。此顺序取代旧的“继续等待原三命令方案确认”，但不授权本机全局安装或升级真实workspace。

## 三组投影

| 源头库存 | 需要改造 | 最终暴露 |
|---|---|---|
| src/templates/skills下15个产品Skill | 各自触发语义、参数及operation路由变为global App内CommandOperation | 顶层plan-track/impl-track等；global description保留15个旧名称及简介，不再分发15个指导Skill |
| source-command-codument-status等生成的命令Skill | 与原命令配置核对，保留必要调用习惯，不冒充上述15个产品模板 | 纳入统一入口的status路由，不独立安装另一个Skill |
| product-capsule内workspace-assets/codument/std及migrate/bootstrap | 全局规范所有权、绝对/相对路径路由、CLI名称、CLI/规范版本一致性 | global App内std；按需读取，不全量预加载 |
| workspace业务配置、attractors、Track/Mission及知识资源 | 保留本地业务authority及SkillApp身份 | codument/项目资产SkillApp，不在global保存任务事实 |
| Halfcode Host与产品init/status/upgrade入口 | 使用公开安装/发现/执行契约，组合产品领域能力 | depa-codument的统一CLI入口；普通功能本地执行 |

15个模板名称：codument-discuss、codument-plan-track、codument-maintain-track、codument-impl-track、codument-archive-track、codument-plan-mission、codument-impl-mission、codument-archive-mission、codument-impl-quick、codument-docs-bootstrap、codument-artifact-sync、codument-migrate、codument-validate、codument-verify、codument-gap-loop。功能摘要以各原模板description及正文核对，不能仅保留名字。

## 用户已明确的身份边界

每个workspace的codument/继续是项目自身迭代资产SkillApp，保留自己的身份与资源发现。global depa-codument是指导CLI及标准operation的另一个SkillApp。两者拥有不同内容，不是同一App的两份副本；不得将“聚合单个指导Skill”解释为删除workspace SkillApp或禁止其正常发现。

global拥有标准操作与规范；workspace拥有任务、配置、知识和项目吸引子。两者运行时通过显式workspace根关联，global安装位置不能变成任务cwd。

## 已观察的技术证据

- product-capsule/src/workspace-install.ts同时分发codument/的App+std和skills/薄路由。
- domain-support/src/workspace-app.ts读取codument/SKILL.md，空文件会失败；domain-logic/workspace-app把其内容纳入观察一致性。
- cli/src/cli/runtime.ts当前同时注册codument、当前目录及workspace安装roots。
- 上游skill-app-support的workspace-resource-catalog拒绝workspace之外的资源根；不能仅把home绝对路径填入现有sources便声称global App可发现。若扩展通用发现，仍由Halfcode公共包拥有，不在Codument复制compiler。
- Halfcode global安装当前只按Codex目标管理全局Skill文本，并非已证明可从任意业务cwd发现global业务SOP。
- halfcode-cli-lite-authoring当前仅“待补充”，以实际公开契约及halfcode-cli-lite/references/freeform-sop.md补充依据，不凭空发明SOP格式。

## 确定身份边界后的实施顺序

1. 修订MISSION/AT2及工作图；按新版MissionLite补齐checkbox验收和三组投影，preflight通过后才改业务文件。
2. 先在Halfcode公共包建立CommandOperation内置Kind及顶层命令投影，再完成旧入口映射与global description；规范路径拆为global标准根和workspace业务根，检查整个引用闭包。
3. 全局安装与明确来源发现，CLI/标准版本匹配，多workspace隔离与重复FQN拒绝；可复用扩展回Halfcode。
4. 新workspace不分发std/多Skill；旧std定制保真review、备份/恢复、无全局反写；重新验证检查机制和上下文成本。
5. 在新架构上接入三个命令及组合入口，执行历史/实际打包安装/版本隔离/完整发行验证，再进入原最终收口。

身份疑问已由用户消除，不再据此阻塞。CommandOperation语义、显式暴露与命名碰撞按新设计记录并验证；上述内容仍是设计，不是已实现的全局安装。
