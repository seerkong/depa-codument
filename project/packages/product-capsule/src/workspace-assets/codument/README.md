# Codument project assets

本目录是当前项目的 resource-first SkillApp。`manifest.xnl` 声明正式资源；
`SKILL.md` 说明项目边界。这里不安装共享标准、内置操作正文或重复 Kind 定义。

## 目录职责

- `tracks/{pending,active,archived}/`：变更任务树、调度、验收与历史。
- `missions/{pending,active,archived}/`：跨 track 的长期工作。
- `behaviors/`、`decisions/`：行为及按 owner 组织的耐久决策。
- `modeling/`、`engineering/`：领域结构与工程知识 registry。
- `attractors/`、`config/`：项目自己的目标、规则、profile 与 hook 配置。
- `memory/`、`backlog/`、`analysis/`：项目记忆、候选工作与分析材料。
- `sop/`、`workflows/`：项目自定义流程；不是全局内置操作副本。

## 使用

加载全局 `depa-codument` Skill，运行 `depa-codument -h` 获取当前命令。
共享标准在全局 Skill 的 `references/std/`，旧 skill 名称通过
`references/std/compat/operation-alias.md` 按需映射。项目配置使用
`skill://depa-codument/references/std/...` 引用共享标准。

正式写入通过 CLI；AI 负责业务内容和语义审查。结构校验不等于独立验收。
保持 GapLoop、Hook、AttractorCheck 和 fresh verify；归档记录不能凭旧完成声明
成为当前新版验收证据。升级先备份和验证，`review-required` 不代表已完成。
