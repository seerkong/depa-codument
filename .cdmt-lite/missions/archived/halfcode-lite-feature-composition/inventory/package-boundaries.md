# 关键包边界盘点

档位：package / standard。以下保留立项时的历史观测；最终裁决与证据见 [final-boundaries.md](final-boundaries.md)，不能将本表旧 GAP 当作当前状态。

| 边界 | 观测角色与状态 | 证据 | 需要处理 |
|---|---|---|---|
| Halfcode cli-host-contract/logic/capsule/shell | 已有中立命令协议、分发、owner 生命周期与 shell；总体可保留 | cli-host-contract/src/index.ts；cli-host-capsule/src/index.ts:16 | 不另造 skeleton；审查 parse/schema 泛型及公共 exports 中浏览器/resource 耦合 |
| Halfcode skill-app-contract/logic/support/capsule | 已有 XNL、catalog、reader 与本地 resource runtime | skill-app-capsule/src/index.ts:22；skill-app-logic/src/resources/reader-contracts.ts | 保留 protocol authority；扩展点需落在现有 reader/admission 而不是产品复制 Kind |
| 两产品私有 CLI command-registry | GAP：通用命令定义与实现依旧产品内各自维护，公开 feature 闭包不足 | Halfcode packages/cli/src/cli/command-registry.ts:129；depa project/packages/cli/src/cli/command-registry.ts:141 | 提取同源 typed command factories，产品只选择、装配与定义特有策略 |
| depa CommandRuntime | GAP：产品聚合类型被大量通用命令直接依赖；局部能力被 optional 处理 | project/packages/cli/src/cli/contracts/command.ts:27 | 聚合保留在 composition root，各 feature 声明最小 facet；不能只删 optional 而不补闭包 |
| Halfcode cli-host-support、skill-app-support | uncertain：存在依赖公开 logic 的情况；仅 package.json 不足以判定规则反向依赖 | 对应 package.json | 实施查实际 imports/effect contract；纯 codec 可保留公开依赖，领域决策必须移至 logic，不能机械改名掩盖 |
| depa domain-* / host-adapter / product-capsule | 自有 domain、文件支持、命令边界转换与真实组合 | project/packages/host-adapter/src/index.ts；product-capsule/src/index.ts | 保留 depa owner，不下沉到 Halfcode；逐步缩小产品 CLI assembly |
| Halfcode product-capsule | 品牌绑定、资源选择和默认 app 组合；不应成为所有产品的必需基础包 | packages/product-capsule/package.json 与 src/skill-app.ts、resources.ts | 拆清通用 asset mechanics 与 Halfcode 产品默认配置；真实闭包保留 capsule，不能纯空转发 |
| depa mcp-app/page-builder-vue wrappers | 主要转发，独立公共边界价值未证实 | project/packages/mcp-app/package.json；page-builder-vue/package.json | 依赖公开支持包；仅有已用兼容面才留薄 wrapper，不新建对称六包 |

role 后缀要求适用于拟发布公共能力包，产品 binary 名不受六角色命名限制。依赖任何 public lower logic 不能直接判违规；需核实是否反向使用领域规则或隐式 IO。
