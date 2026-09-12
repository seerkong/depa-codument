---
envelopeVersion: halfcode.resource-envelope/v1
specVersion: 1
kind: CommandOperation
metadata:
  fqn: Codument.CommandOperation.Migrate
spec:
  command: migrate-operation
  description: "Run deterministic CLI migrations with semantic fallback for older workspaces."
---

执行位置保持目标项目；@/ 表示项目根。references/std/、operations/、references/ 相对全局 depa-codument Skill（默认 ~/.agents/skills/depa-codument，CODUMENT_HOME 可覆盖 home）；裸 config/、tracks/ 等相对项目 codument/。以下是当前 Agent 要执行的指导，不是已经完成的业务结果。

# skill: codument-migrate（自主迁移）

全局安装与项目升级职责见 [升级边界](../references/migration/workspace-upgrade.md)；实际迁移步骤仍由下述 CLI 协议提供。

运行 `depa-codument migrate guide resource`，读取当前发行自带的控制循环协议。该入口不依赖 workspace manifest、config 或 std 已经升级。

有一个路径参数时处理该资源；无参数时按协议进入 workspace 模式，遵守当前产品入口可用性和人工 gate，不调用另一套同名 Host 初始化/升级命令。

Decision review 按 `depa-codument migrate guide decision`；早期 plan.xml 按 `depa-codument migrate guide track`。本 operation 不另存一套迁移步骤、Kind 定义或语义 verdict。
