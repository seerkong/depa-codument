# 当前 package role 盘点

包相对路径以仓库根为准。`invalid-name` 表示不符合 DEPA role 后缀，不自动表示产品运行有错。先按实际职责处置，再考虑命名。

| 现有包 | declared role | observed role | verdict | evidence | 判定 |
|---|---|---|---|---|---|
| 根 depa-codument | 无 | CLI 外表 + Codument 领域规则 + filesystem support + 模板 | mixed | package.json；src/cli/migrations/index.ts:1；src/cli/kinds/registry.ts:53 | GAP：迁入产品领域闭包；产品原包名作为发行兼容例外 |
| project 根 depa-codument | 无 | private monorepo/build aggregation | 无执行 role | project/package.json | NOT_APPLICABLE：workspace 治理容器不当运行能力包 |
| project/packages/cli | 无 | shell + Host composition + resources logic + 多类 IO | mixed | contracts/command.ts:1；runtime.ts:36；resources/workspace-resource-catalog.ts:419（均相对此包 src/cli） | GAP：RELOCATE/SPLIT，公开 contracts 不再引用实现类型 |
| project/packages/skill-app-contract | contract | authoring 类型、纯定义 helper、Kind schema/版本 descriptor 构造 | 有 contract 主体，需收紧执行边界 | src/resource.ts:47、:55、:68（相对此包） | PARTIAL：保留数据契约；reader/转换/执行归 logic/support，简单结构定义 helper 可保留 |
| project/packages/mcp-app | 无 | contracts/logic/support/stdio 公开面混合 | mixed | src/index.ts:18、:21、:22（相对此包） | GAP：组合 API 收口到 capsule；stdio 外表经 shell 适配 |
| project/packages/page-builder-vue | 无 | Vite/Vue/federation 构建及文件 IO | support | src/index.ts:1、:19、:374（相对此包） | GAP：明确 PageBuilder contract；命名 support，保留真实 build 边界 |
| project/packages/runtime-darwin-arm64 | 无 | 可执行分发/安装 wrapper | shell/distribution | 此包 package.json bin/files | 命名待按发行映射归位，无业务 authority |
| project/packages/runtime-darwin-x64 | 无 | 可执行分发/安装 wrapper | shell/distribution | 此包 package.json bin/files | 同上 |
| project/packages/runtime-windows-x64 | 无 | 可执行分发/安装 wrapper | shell/distribution | 此包 package.json bin/files | 同上 |

## 首批必须修复的边界

1. CommandRuntime 的稳定 port 类型从 implementation 文件提取；依赖方向由包 exports 和类型检查保护。
2. Host engine 与产品 COMMANDS/identity 分离；可复用 package 由调用者提供 identity、sources、Kinds、commands、template source、provider bindings。
3. resource scan 的 filesystem support 与 schema/readers/materialization 规则分离；同一 Host 只组合一套 admission/catalog authority。
4. 旧全局 workspaceDir/process.chdir 不进入可重入领域 logic；root 由 runtime 输入，多 workspace 不互相污染。
5. 旧迁移的纯转换与事务 IO 分离，保留备份/receipt/review；未知字段的语义处理仍由当前 Agent 负责。

## 参考材料的取舍

DEPA 当前 package-role 协议和 boundaries-and-vendor 优先用于本 package 范围。模块 capsule 的 Python 样板、占位 registry 和固定函数命名不逐字移植成 TypeScript 包验收；只在存在真实转换/多态时设置 adapter，避免与“不要空壳适配器”冲突。
