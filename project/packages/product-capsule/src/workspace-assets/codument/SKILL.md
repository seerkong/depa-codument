---
name: codument
description: 在当前项目的 codument/ workspace 中讨论、规划、执行和验证规格驱动的软件变更，并维护行为、决策与工程知识。已有具体 Codument 操作 Skill 时按该操作路由执行。
---

# Codument workspace App

本目录是当前项目唯一的正式 Codument App；`manifest.xnl` 声明资源成员。
先读 [std/AGENTS.md](std/AGENTS.md)，按用户当前意图加载对应 operation 与所引用的规范，不默认展开所有历史正文。

- `@/` 表示项目根；正式资源在 `@/codument/`。Agent 的薄 Skill 只路由到这里，不能维护第二份 Track、Mission 或知识库。
- scaffold、状态转换、归档、迁移与 registry 写入走 CLI 的正式入口；AI 负责业务内容和需要独立判断的语义验证。保留 CLI 生成的 identity、envelopeVersion 和 specVersion。
- Kind/schema 由已安装产品包内置；不要创建 KindDefinitions 来绕过校验。resource-first 的知识与声明内的 code-first 执行资源可以组合，但不能重复声明同一资源身份。
- 按配置执行 GapLoop、Hook、AttractorCheck 和 fresh verify。紧凑上下文不是降低检查强度或复用 fresh verdict 的许可。

`Resource validate` 同时核对正式成员与领域规则；结构通过不等于语义评审完成。旧 workspace 无法读取时，使用发行包随附的 migration Skill 进入迁移，不先手工覆盖旧 authority。
