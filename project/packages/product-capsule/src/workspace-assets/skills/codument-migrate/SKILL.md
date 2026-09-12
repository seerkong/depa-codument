---
name: codument-migrate
description: 自主升级 Codument workspace 或单资源。无参数时完成整个 workspace 的 CLI 迁移、当前 Agent 语义 review 与全量验证；传入路径时只升级该资源。
---

# Codument · migrate

先从当前 CLI 读取随发行提供的协议，不要求旧 workspace 已含新 std：

`codument migrate guide resource`

CLI 暂不可用时先读取随本 Skill 分发的 [bootstrap 协议](references/bootstrap.md)，解决 CLI 可用性后再写。升级后的 `@/codument/std/operations/migrate.md` 也路由到同一发行协议，不构成另一份迁移算法。

- **前置**：目标是已有 Codument 材料；不能要求先通过新 init 或 App admission。
- **无参数**：进入 workspace 模式；本重构候选的三命令产品 gate 仍暂停，遵守 bootstrap 中的限制，不误调用克隆 Host 的同名命令。
- **一个路径参数**：只升级该资源及其必要验证上下文。
- **单资源 CLI**：`codument upgrade-resource <path> --json`。
- **Decision review**：命令对旧 Decision 返回 `review-required` 时，再打开并遵循 [references/decision-migration.md](references/decision-migration.md)。

本文件只承担路由。控制循环以 bootstrap 为准；Decision 的语义映射细则只在 bundled reference 中维护。
