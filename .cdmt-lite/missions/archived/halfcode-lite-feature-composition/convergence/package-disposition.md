# 包级处置与目标 ownership

公共 family 统一为无 scope 的 `halfcode-lite-*`。以下是架构处置，不是已发布名单；既有 0.1.x 消费和 0.2.0 源码须先作兼容矩阵，不能伪造相同版本制品。

目标包的准确名称、直接依赖、公开 API 和参考项目对应关系以 [npm-package-architecture.md](../design/npm-package-architecture.md) 为准。本表是迁移处置索引，不维护第二份目标依赖图。

| 当前能力 | 处置 | 目标 role/name 示例 | Owner 与理由 |
|---|---|---|---|
| cli-host-contract/logic/support/capsule/shell | RETAIN + RENAME + 精确公开面 | halfcode-lite-cli-host-{contract,logic,support,capsule,shell} | Halfcode；复用现有机制，不重复创建 skeleton |
| skill-app-contract/logic/support/capsule | RETAIN + RENAME | halfcode-lite-skill-app-{contract,logic,support,capsule} | Halfcode；Resource/Kind/catalog/SOP 的唯一公共底座 |
| browser-support、live-host-capsule、http-shell、mcp-app-capsule、page-builder-vue-support | RETAIN + RENAME，审计边界 | 对应 halfcode-lite-* | Halfcode；已有 effect、live owner、HTTP 表面与 builder，不重新复制 |
| 私有 CLI 的 Resource/SOP/CommandOperation commands | RELOCATE | halfcode-lite-resource-capsule | Halfcode；同一个 command factory 供两个产品使用，Kind 定义不拷贝到 App；protocol contract 仍归 skill-app-contract |
| 私有 CLI 的 LocalFunction / Page / Browser / Serve / MCP commands | RELOCATE，按闭包 SPLIT | halfcode-lite-local-function-capsule / page-capsule / browser-capsule / serve-capsule；MCP 优先扩展既有 capsule | Halfcode；每组命令声明最小 facet，实际包数由依赖/变更边界决定 |
| init/upgrade/status 及安装管理机制 | SPLIT 通用机制与产品策略 | halfcode-lite-management-capsule；安装 IO 留 cli-host-support | Halfcode 只拥有安装/备份/字节复制协议；Codument upgrade/migration 策略留 depa，不把两产品同名命令强行视为同语义 |
| product resources / source-embedded 资产供应与构建机制 | RELOCATE | halfcode-lite-resource-bundle-support | Halfcode；真实 effect 实现与版本化资产闭包，不增加第二套 VFS/安装真源 |
| 两个现有 cli shell 包 | RETAIN 产品 dialect；中立执行同源 | halfcode-lite-cli-host-shell + 可选 halfcode-lite-cli-shell | 产品 shell 保留 agent/help/历史 argv 行为，调用公共 runCli；没有第二 dispatcher，见设计 §3/§10 与 E34 |
| product-capsule 的默认品牌/App policy | RETAIN 为产品组合；通用 asset mechanics RELOCATE | halfcode-lite-product-capsule（产品默认）；通用部分归现有 support/capsule | Halfcode；其他产品不依赖它来换字符串，也不再次生成 global SkillApp |
| scoped skill-app-contract compatibility wrapper | 明确迁移/兼容，不作为新 canonical 包 | canonical halfcode-lite-skill-app-contract | 公共无 scope；只有实际 consumer 需要才保留限期 compatibility alias |
| depa domain-* / host-adapter / product-capsule / cli-shell | RETAIN，消费新公共 API | depa-codument-* 保留 | depa 自有规则、actor、迁移、operation 和产品组合；不纳入 Halfcode clone shared inventory |
| 两边私有 cli 包 | 缩减为 product shell + build entry | bin: halfcode-lite / depa-codument | 产品各自发布 binary；可复用 API 从明确公共 feature packages 获取 |

不得只为名称整齐创建 contract/logic/support/adapter/capsule/shell 六套空壳。命令工厂可留公开 capsule subpath；只有真实独立发布和依赖隔离需求成立才拆新 package。
