# Gap 1：halfcode-lite-feature-composition

检测日期：2026-10-04。

结论：**存在 gap，不能维持“全部排除集已覆盖、完整目标均已完成”的验收结论。** 本轮确认 4 项差距，另有 1 项 authority 边界需要确认。共享包拆分不是无效工作；问题在剩余实现及验收范围不足。

本轮遵循 cdmt-mission-lite gap-loop，只观察、运行只读探针及写本报告；未修改业务代码、目标、Acceptance、归档位置或 completed 状态。使用 depa-expert 检查 package/authority/runtime 边界。未运行模型 E2E、发布、全局安装或完整回归套件。

路径约定（下文所有代码证据相对此处，行号为本次观察时）：

- H = `/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite`
- D = `/Users/kongweixian/infra-dev/depa-codument/project`
- M = 本 mission 目录。
- C = `/private/var/folders/qh/nm2y7v2s0jn7skv5_yphcbj40000gn/T/halfcode-independent-consumer-HYonOr`，此前真实安装 composition.9 的独立最小消费者；本轮在这里重新执行无写入运行探针。
- Bun = `/Users/kongweixian/.bun/bin/bun`。

## 目标态与事实边界

权威顺序：用户最新更正 → MISSION.md → AT1 → loop Decisions。重点包括：统一 `halfcode-lite-*`；当前合同 authority 为 `@halfcode-lite/skill-app-contract/resource-contracts/v1`；公共实现同源；命令/运行能力/Kind/资产四面选择一致；缺能力静态失败；三个消费者从真实制品独立构建运行。

`design/npm-package-architecture.md` 是 MISSION Notes 与 D4 明确指定的包级合同。其 §6 包含安装 launcher 的实现，不等于授权 npm 发布。Acceptance 勾选、Round10 完成记录、过去测试数字不是本轮证明。

DEPA 事实划分：源包契约和产品资产是 versioned repository authority；运行时 owner 负责能力生命周期；安装目录、catalog、制品和本报告是来源受控的投影/观察，不反写上游。没有为本次审计强加事件溯源或响应式图，二者 NOT_APPLICABLE。

## C1 · demo Kind 定义迁移与“禁止复制到 workspace”的边界未闭合

| 权威/事实 | 内容 |
|---|---|
| 用户批准、D9/D10 | 显式更新内置 demo 的 14 个 Kind 定义到当前 reader/authority；不改外部 workspace、旧 fixture、schema revision |
| AT1 排除集 | 禁止复制 Kind 定义到各 workspace，没有声明 demo 安装例外 |
| 当前实现 | H `packages/cli/src/templates/agents/workspace/skills/halfcode-app-lite-demo/manifest.xnl:3` 仍声明 `KindDefinitions/` catalog；H `packages/cli/src/cli/install.ts:326` 默认递归安装 workspace skill，`:375` 被 init-workspace 调用 |
| 过去验收 | M `inventory/final-boundaries.md:51` 对这个排除项只引用 depa 的无 KindDefinitions 测试，未覆盖 Halfcode demo 安装 |

更新 demo 定义的批准并不清晰地等价于批准长期向每个 workspace 复制它们；也不能在本轮擅自删除用户刚批准更新的文件。这里先报 authority 范围待裁决，不把批准过的迁移本身判错。

建议裁决：demo 的合同文件可以保留为显式 authoring/兼容夹具，但默认安装的 App 不携带标准 Kind 定义，由 Host 提供；如确需安装例外，须明确限定为示例，而不能继续声称 AT1 全面无例外通过。

## G1 · P1：两产品仍维护同一通用 live 调用实现

对标：期望-2、约束-1/5、AT1 单一实现 owner。

失败场景：维护者修复 PageWorkflow receipt、Serve 状态检查或 PageObject HTTP 错误处理，只修改 Halfcode 源头；depa 仍执行自己的副本。升级公共 npm 包不会带入该修复，第三个 CLI 也不能仅通过现有 feature 包获得这段完整客户端实现。

证据：

- H/D `packages/cli/src/cli/app/invoke.ts` 两份文件逐字相同，327 行；SHA-256 均为 `8986aa586c45b8a3a6f706ededdf71c461d1d8ab5ace3673fa22daf324589b96`。
- 其中 `:39` 开始的 Serve lifecycle、`:114` 开始的 PageWorkflow start/get、`:154` 开始的 PageObject action 包含实际状态检查、HTTP 请求和结果转换，不是单纯 re-export 或产品参数配置。
- H/D `packages/cli/src/cli/serve-feature.ts:5` 均从本地 `./app/invoke` 导入；H `:41`–`:44` 将这些实现绑定到公共 feature。D 同样有活跃绑定。两侧 `http/app.ts` 也导入本地模块。
- 只读命令 `shasum -a 256 <D>/packages/cli/src/cli/app/invoke.ts <H>/packages/cli/src/cli/app/invoke.ts` 已执行；`rg -n 'app/invoke'` 已确认调用链，非仅历史未用文件。

改向：将通用 live client/结果转换放到合适的 Halfcode public logic/support 边界，显式注入 workspace、HTTP、Serve ports；产品仅保留不同 policy、身份与 domain binding。不要直接把带 demo/status 产品入口的整个文件搬入公共包。

验收补项：同一个 fake transport 下，两产品通过同一公共实现验证错误、receipt 和生命周期；静态检查只声明 npm import 并不足以检测本地实现副本。

## G2 · P1：缺能力静态失败只覆盖 factory 表面，未覆盖实际产品/clone 组合链

对标：期望-3、约束-5、AT1 I3/I4 及 optional runtime/强转排除项。

失败场景：新 CLI 根据默认 scaffold 扩展命令或修改 profile→runtime 创建关系，漏装 resource capability 仍能通过类型检查；实际执行时才失败。已有产品也通过“宽可选 runtime → 运行时 require 检查”绑定，而不是在组合时证明所选能力存在。

证据：

- H `packages/cli-host-logic/src/clone-scaffold.ts:30` 生成 `resources?`；`:42` 使用 `runtime.resources!`；`:48` 由字符串 profile 决定是否提供资源。该生成物没有使用窄 Resource/SOP command factories；`:9` 依赖列表也没有 resource-capsule。
- H/D `packages/cli/src/cli/contracts/command.ts` 仍将 catalog、SOP、browser、server、page 等声明为可选全集。
- H/D `packages/cli/src/cli/resource-feature.ts:4` 调用公共 `requireResourceFeature`。H `packages/resource-capsule/src/runtime.ts:24` 接受 `Partial<ResourceFeatureRuntime>`，在运行时抛错。
- H `packages/cli/test/feature-types.ts` 只证明 `bind: r => r` 缺字段会报错，没有证明实际产品的 binding/profile 配对，也没有检查 clone 生成物。
- H `scripts/verify-feature-composition.ts:28` 起手写另一份正确的最小产品；它不从 clone scaffold 生成该消费者。

本轮 TypeScript compiler API 虚拟文件探针（文件名放 D 根以使用其真实依赖，无落盘）：

```ts
import {createResourceCommands, requireResourceFeature} from 'halfcode-lite-resource-capsule';
createResourceCommands<{}>({bin: 'empty', bind: r => requireResourceFeature(r)});
```

使用 strict/noEmit/skipLibCheck、ESNext、bundler module resolution 检查该文件，`getSemanticDiagnostics` 返回 `[]`。不是用 `any`、强转或关闭 strict 构造的结果。

随后在 C 从已安装制品实际创建相同 commands，`createRuntime: () => ({})`，dispatch `['Resource','tree']`，结果为：

```text
code: 1
command: Resource.tree
message: Workspace resource catalog is not configured
```

这说明动态 fail-closed 仍有效，**不代表有安全绕过**；但不能据此宣称“缺能力静态失败的完整链条”已实现。运行时输入需要 admission 是合理的，问题是静态产品装配也只剩这层兜底。

改向：给静态组合入口及各 execution profile 建立所需 runtime 的真实类型关系；动态/legacy admission 单独保留明确边界。clone 必须生成与正式推荐 API 同源的 Resource/SOP 示例。负例覆盖删掉实际 binding 的能力、错误 profile 配对和生成物，不只覆盖裸 factory。

## G3 · P2：Kind reader 集合没有随产品能力选择收敛

对标：期望-3、AT1 方程与 I6（同一选择约束命令、运行能力、Kind、资产）。

失败场景：产品声明只提供资源/SOP 子集，公共默认 resource host 却仍接纳 Page、McpApp、PageWorkflowBundle 等未选能力的协议。其“资源协议有效”和“该产品提供相应能力”没有显式边界；新增产品不能通过当前组合 API 同步约束这两个面。

证据：

- H `packages/skill-app-capsule/src/index.ts:38` 默认调用完整 `createHostResourceContractRuntime()`。
- H `packages/skill-app-support/src/resources/host-resource-contracts.ts:70` 的选项只有 current/legacy、identity、附加 registrations 和 expectedLock；`:86` 无条件加入完整 builtin 注册。
- H `packages/skill-app-logic/src/resources/reader-contracts.ts:101` 遍历完整 Kind descriptors；唯一内置筛选是 legacy 不带 CommandOperation，与 feature 选择无关。
- C 的最小消费者本轮调用已安装包的默认 reader，得到 16 个业务 Kind、18 个 reader，包含 BrowserWebApiBundle、McpApp、Page、PageBundle、PageObjectBundle、PageWorkflowBundle。
- 同一 runtime 的 `resolvePortableSpec` 对 `Page`、`writerSpecVersion: 1`、合法最小 `properties/body/subdomains` 成功返回 `readerValue.kind: Page` 和 `readerId: cli-host.Page.reader/v1`。

界限：本轮没有发现这些 schema 会自动启动 browser/server；依赖裁剪仍成立。纯通用查看器支持所有 schema 可以是合法产品选择，但它需要是显式的 inspect-only 策略，不能拿 npm 依赖没有 Vue/Hono 代替“四面选择一致”的证明。`resourceContracts` 注入允许消费者自己构造另一 runtime，并不等于框架已有可复用的 feature→Kind 选择方案。

改向：保持 contract authority 与 FQN 不变，增加显式 reader/Kind contribution 选择或清楚的 inspect-only/readable 与 executable 区分；两完整产品选择全量，最小产品按定义选择其子集。增加未选 Kind 的 admission/能力诊断负例，不能只断言未知 Kind 或重复 Kind。

## G4 · P2：包级方案中的 npm 安装入口没有落地，制品验收绕过了它

对标：MISSION Notes、D4 指定的 `design/npm-package-architecture.md` §6，以及期望-4 的产品制品闭包。

失败场景：按获批方案准备 `halfcode-lite`/`depa-codument` 产品 npm 安装包时，没有对应 launcher 及 optionalDependencies 平台选择。现有测试证明的是私有 source CLI tarball 可安装，再由测试自建编译入口，并非设计中的用户安装入口。

证据：

- H `package.json:2` 和 D `package.json:2` 虽然使用产品名，但均 `private: true`，没有 bin/optionalDependencies；实际 workspace 平台包存在，尚无安装入口包。
- H `scripts/prepare-release-set.ts:16` 的 product 清单打包 source CLI/product 组件，不含 launcher 或平台包。
- 本轮读取 composition.9 两个 `release-set.json`：`launcher: []`、`platform: []`；sourceCli 分别为 `halfcode-lite-cli`、`depa-codument-cli`。
- M `verification/verify-products.ts:40` 起安装的是 `<family>-cli`；`:78` 起在测试内复制目录、自建 packaged-entry 并调用 Bun.build。这个验证有价值，但覆盖不到 npm launcher/platform selection。
- 目标 §6 明确写了 optionalDependencies 与“若尚未生成 launcher，实施需验证再迁移”，未在 Decisions 中取消此目标。

改向：实现并只在隔离本地 registry 验证 launcher→平台包→binary 的安装链；不需要 npm publish 或改全局安装。如果本轮确实只希望交付公共库和源码组合，应由用户明确将 launcher 留待后续，并相应更正目标及完成范围，不能把“禁止发布”解释成“无需实现”。

## 已打到的部分与本轮验证边界

- 重跑 `bun M/verification/audit-boundaries.ts`：44 packages、21 shared、875 public imports；DAG、无 product backedge、声明依赖、有限 exports、role naming 全部通过。脚本明确注明只是静态边界，不证明语义 ownership；G1/G2 正说明其边界。
- 直接阅读两产品 `product-capsule/src/commands.ts`，Resource/SOP/LocalFunction/browser/page/serve/MCP 等已消费同源公共 factories。不能把残留 G1 误表述成“完全没有抽取”。
- canonical public npm 家族与当前资源 authority 已按最新纠正统一；保留 reader IDs/FQN/兼容 fixture 不自动算旧品牌残留。旧 scoped wrapper 的存在已登记兼容边界，本轮未证明其造成活跃 canonical 分裂。
- C 的已安装资源 runtime 本轮 snapshot 为 `ready: true`，SOP/SkillApp 正常，diagnostics 为空；上述动态缺能力检查真实失败关闭。
- 已检查 Halfcode global SKILL.md、depa global SKILL.md 和 clone 生成的 SKILL.md。depa description 的 `codument-*` 是用户明确要求的旧入口映射，不是应机械删除的残留；Halfcode demo FQN/目录的旧名字也有协议兼容边界。clone 指向自定义 resources 命令而非公共 Resource/SOP 的偏差归 G2。
- 565/732 全量回归、独立 tarball、embedded 和迁移成功是历史证据，本轮没有重跑；不能将那些结果报为本轮新测试。也没有验证真实浏览器、模型 E2E、发布后的 npm 解析或全部跨平台安装。

## 建议确认后的收敛顺序

1. 先裁决 C1；默认建议 Host 标准 Kind 不复制到 workspace，demo 合同样本移为显式夹具/authoring 材料。
2. G1 提取剩余公共 live client；G2 收紧实际产品和 scaffold 的静态组合边界。
3. G3 补齐 Kind/readable/executable 选择合同及负向探针。
4. G4 补本地产品安装链，或明确批准延期并收窄完成声明。
5. 将上述反例作为验收，再运行相关回归与三消费者真实制品检查；不启动昂贵模型 E2E。

按 cdmt-mission-lite gap-loop 停止条件，本轮到此等待用户确认；确认纠正后才将归档 mission 恢复 active、补工作图并修复。报告不自动重开任务，也不改写历史完成记录。
