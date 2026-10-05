# Halfcode Lite → 可选择 CLI 产品集合：架构提案

日期：2026-10-04。状态：待确认，未实施。方法：DEPA package / standard，依据实际源码和 Sparrow/ACE 历史方案。关键包盘点见 [inventory](../inventory/package-boundaries.md)，处置见 [package disposition](../convergence/package-disposition.md)。

补充的 [npm package 级架构](npm-package-architecture.md) 是目标包边界与依赖设计真源，逐包列出真实 npm 名称、公开 API、直接依赖、发布分类和 Sparrow/ACE 对应关系；本文件的系统层概述不能代替该包级合同。

## 1. 结论

目标不是“再克隆一个 Halfcode CLI”，也不是“Codument 全盘继承 Halfcode 产品默认行为”。应当是：**公共协议和中立 host + 按需选择的公共 feature implementations + 产品自己的领域与 SkillApp 资产**。

Halfcode Lite 自身也是这个公共底座的消费者，不享有另一份私有通用实现。depa-codument 像 Sparrow 一样组合公共能力，加上自己的 track/mission/migration/operations；未来第三个 CLI 可以只选择资源/SOP/本地函数，完全不安装浏览器或启动 Serve。

现有 host 已足够成为 skeleton 的基础，不重造第二个 framework。当前缺口主要在通用命令及能力/资产组合，而不是基础 dispatcher。

## 2. 观察到的事实与可借鉴经验

以下事实基于当前、尚未移动的路径；完整历史 mission 位于 `/Users/kongweixian/work-repos/sparrow/sparrow-fabric.ts-2/.cdmt-lite/missions/archived/sparrow-fabric-superset`。

| 已调查的事实 | 源码定位 | 对本次的意义 |
|---|---|---|
| Sparrow runtime 是各 feature 的交集；createSparrowCommands 引用已发布的 ACE capsules | sparrow-fabric.ts-2/packages/sparrow-fabric-logic/src/index.ts:139、316 | 复用实际 command implementation，不仅共享类型或命令名称 |
| ACE schema 的 parse 保留实际 runtime TActual，children/admit/run 一并类型化 | ace-runtime-cli/packages/ace-rt-skeleton/src/contracts/command.ts:37 | 组合必须覆盖完整类型链，不以强转或所有字段 optional 解决问题 |
| ACE command table 有显式覆盖裁决，Kind 扩展落在 Workbench standard pack | ace-runtime-cli/packages/ace-rt-extension/src/command-table.ts；kind-pack.ts | 命令扩展、Kind 扩展均有 authority；不能另建平行 registry |
| Workbench FS-resource-tree 与 skill-app-standard 提供 acquisition/compile/admission/semantic validation | ace-workbench/packages/fs-resource-tree/package.json；packages/skill-app-standard/src/index.ts | 协议层与 CLI 产品组合层分离，产品不重复维护 Kind 真源 |
| Halfcode command host 先选 execution policy，再按需创建 runtime；负责 close/drain | halfcode-cli/halfcode-cli-lite/packages/cli-host-capsule/src/index.ts:16 | 已有 local-first 和生命周期基础，应保留和加强 |
| Halfcode resource host 有独立 catalog/definition/config/SOP 生命周期，不要求 browser | 同仓 packages/skill-app-capsule/src/index.ts:22 | 基础资源消费者可以真正脱离 live-host |
| Halfcode 与 depa 的私有 registry 都维护大量通用命令 | 同仓 packages/cli/src/cli/command-registry.ts:129；depa project/packages/cli/src/cli/command-registry.ts:141 | 需要提取公开 command factories，移除复制维护 |
| depa 聚合 CommandRuntime 包含 domain、resource、browser、page、Serve 等 | depa project/packages/cli/src/cli/contracts/command.ts:27 | 聚合应只在 product composition；feature 应依赖窄 facet |

历史 Sparrow 方案分出了四个面：Kind 编译/协议、运行行为与 effect、命令实现、资源与 skills composition。只抽出命令 registry 而留下复制的运行实现/模板，并没有完成那种架构。

不能照抄的部分：ACE 的 FS-native/YAML/JSON 协议与 Halfcode XNL 不同；本次借鉴关系，继续使用现有 `halfcode-compiler.xnl` 及 canonical reader/admission，不引入 Workbench 作为新编译真源。ACE Kind 扩展的实际覆盖策略也不是本次默认许可；本次要求明确 override 许可与兼容检查。

## 3. 对应关系和层次

| Sparrow/ACE 分工 | Halfcode/depa 目标分工 | 不属于该层 |
|---|---|---|
| Workbench protocol + FS compilation + standard pack | 现有 XNL compiler、skill-app contract、canonical readers/admission | CLI 产品身份、Codument track 业务 |
| ACE skeleton + published feature capsules | Halfcode Lite cli-host 机制 + 公共 feature factories/effects | Codument 专属 hook/attractor/migration 策略 |
| ACE runtime 产品组合 | Halfcode Lite 完整 CLI、默认 App/安装资产组合 | 所有其他 CLI 的强制默认配置 |
| Sparrow superset + AIAgent/workflow 自有功能 | depa-codument 产品组合 + domain/missions/operations | 公共 Browser/Serve/Resource 实现副本 |

```text
现有 XNL compiler / public contract（协议 authority）
                 ↓
Halfcode Lite 公共 host + 独立 feature 实现/资产
                 ↓
       产品显式选择和 effect 装配
       ├─ Halfcode Lite 完整产品
       ├─ depa-codument + 自有 Codument domain/SkillApp
       └─ 独立最小消费者：仅 Resource/SOP（以后可加 LocalFunction）
```

这里是静态 TypeScript product composition，不新增运行时插件下载、巨大 feature manager 或替代既有 dispatcher 的 DSL。

## 4. 四个组合面及 authority

### 4.1 命令实现

公共 feature 提供 `createResourceCommands`、`createSopCommands`、`createLocalFunctionCommands` 等工厂；文档、schema、children、admission、executionPolicy、run 来自同一 factory，而非产品抄写。

每个 feature 声明最小 `Needs`。产品 runtime 取所选 Needs 的交集，在 composition root 明确绑定 owner。实施首先用现有类型做完整类型探针；确有丢失 TActual 时才修改协议，禁止只测 handler 的窄化。

同名命令默认报错；产品只通过显式 override 许可覆盖。`init/status/upgrade` 的名字相同不代表语义相同：共享安装与检查机制，保留 Codument 的项目迁移与状态策略。不能为了复用而让 domain 命令依赖 Halfcode 产品的管理逻辑。

### 4.2 runtime / effect 闭包

Command host 继续拥有分发及 invocation/workspace scope。Resource host 拥有 catalog；Browser support 实现浏览器 effect；live host 拥有必要的 server 生命周期。Feature 借用 catalog，不能自己偷偷构造第二份或关闭借来的 owner。

placement/profile 选择先于 IO。资源、domain、SOP 等本地命令不创建 server/browser；选择 Page/Browser/MCP 时才引入其闭包。help/version 不应触发安装、目录写入或浏览器发现。

不把 `resources? browser? page? domain? ...` 大全集当成 reusable runtime contract。聚合对象可以留在产品 composition，但各 feature 的公共签名和依赖必须窄化。

### 4.3 Kind / 编译协议

保留现有 canonical XNL readers、definition admission、revision 与 FQN resolver。公共扩展入口表达 reader/projector/validator/compiler contributions，注册到既有系统，不另建 `kinds.json` 真源。

区分“底座能够理解哪些 Kind”和“产品选中并暴露哪些 Kind/verb”。CommandOperation 是公共内置能力，Codument App 提供 operation 资源，不重复拷贝 Kind 定义。扩展未知 Kind、冲突 reader、缺失 required effect 均 fail closed。

品牌改名不自动重写 FQN、XNL namespace、protocol revision 或持久历史记录。只有承载包身份的可执行定义 import 等按兼容矩阵迁移。

### 4.4 SkillApp / 资源资产

公共资源源码只有一个 owner，通过版本化可复现制品交付；产品声明使用、明确重命名/覆盖及自己的新增资产。优先复用现有 resource effect 与 embedded 打包机制，只有现有机制无法表达闭包时才引入 resource bundle 包，不照抄一套 archive builder。

global depa-codument App：固定位置完整资源树加载 VFS；安装只是把完整树复制到各 agent 目录，覆盖该产品自己的安装目录。动态 operation 通过 CLI 发现；旧名映射保持 `references/std/compat/operation-alias.md`。不回到安装时拼装 SKILL.md 或复制多套旧 skills。

project `codument/` App：独立项目级迭代资产，保持原目录名；升级时保留业务/历史事实，清理旧非项目资产遵循已有 deterministic migration 与 review。公共 std 在 global App；不把共享 Kind/std 重新塞进每个 workspace。

资源返回仍遵守已明确的规则：单文件资源暴露绝对路径供 agent 自行读取；XNL 详情继续为 XNL，只按实际文件来源转换 vfs 路径；不增加 line-range CLI。source 和 embedded provenance 必须可分别验证，不能用猜出的磁盘路径替换无物理来源的引用。

## 5. 包边界与产品选择

保留并改名现有 `cli-host-*`、`skill-app-*`、browser/live/http/MCP/builder 公共包；重点从私有 CLI 提取 command factories，落入真实 capsule 的公开 subpath 或新 feature capsule。具体处置与命名见 [package-disposition](../convergence/package-disposition.md)。

明确的包级提案见 [npm package 级架构 §3–§6](npm-package-architecture.md#3-公共底座包保留而不是重新造-skeleton)：新增 resource/resource-bundle/local-function/browser/page/serve/management 能力包，扩展既有 MCP capsule，保留已有底座与 live/http/builder 支持边界。首批 Resource/SOP/CommandOperation，随后其他已有能力。包界在抽取验证失败时需要显式修订，不再留成“某包或某子路径任选”，也不按“一功能六包”机械拆分。

| 产品 | 公共选择 | 自有内容 | 表面策略 |
|---|---|---|---|
| Halfcode Lite | 完整现有能力集合 | 默认产品身份、demo App/authoring policy | 保持现有产品功能；已删除的 demo 命令不恢复 |
| depa-codument | 当前已使用的公共能力，按 profile 懒加载 | Codument domain、migration、operations、global/project App | 现有命令基线保留；本次不擅自缩减 Page/Serve 等 |
| 验证用最小 CLI | Resource + SOP/CommandOperation | 最小 App、独立 bin identity | 无 Browser/Serve/MCP/build-Vue 依赖；不是产品上线需求 |

clone 继续用于生成 product scaffold，而不是 fork 公共实现。已存在的 shared/product 分类沿用公开机制；升级 clone 输出使新项目依赖发布包、只拥有自己的 composition/identity/assets。不能使 clone 重新带回通用 commands 的可写副本。

DEPA 分工：contract 声明数据与 effect port；logic 执行规则；support 实现 IO；adapter 属于执行边界转换的一方；capsule 装配真实闭包；shell 暴露外部协议。各 owner 的 Boundary/Not Owned Here 与生命周期须可定位。不存在的职责不建空包。

## 6. 改名与路径迁移不能只是替换字符串

目前存在三个身份口径：容器/消费端 `halfcode-cli` / `halfcode-cli-lite-*`，上游源码 `halfcode-app-lite-*`，目标 `halfcode-lite-*`。上游源码为 0.2.0，depa 仍消费 0.1.0/0.1.1。实施必须先确认行为差异，不把“改名”和“接受全部上游新行为”混在一起。

### 推荐路径方案：保留嵌套仓库拓扑，只统一名称

```text
/Users/kongweixian/infra-dev/halfcode-lite/
  halfcode-lite/                 # 原 halfcode-cli-lite 主仓库
  halfcode-lite-apps/            # 原 apps 独立仓库
  halfcode-lite-playground/      # 原 playground 全部内容
```

容器和主仓库同名略重复，但不把三个不同项目合并，不破坏 Git 根。若用户更偏好扁平主仓库，须另明确 apps/playground 的位置，不能顺手把整个容器变为主仓库。本提案推荐前者，实施授权时确认即可。

迁移包含 tracked 修改、未跟踪和忽略内容，不重新 git clone 干净 HEAD。先核对目标不存在、worktree/symlink/absolute config，再保留可恢复快照和每个根的状态；所有活跃路径按新布局调整。归档 mission、历史日志和证据保存原记录，可用迁移说明解释旧路径，不批量改写历史事实。

包身份统一 `halfcode-lite-*`，不出现 `halfcode-lite-lite-*`，不新建付费/private scope。`halfcode-compiler.xnl` 是独立协议依赖，本次不默认重命名。产品 binary 为 `halfcode-lite` 与 `depa-codument`；不自动替换用户已安装命令。

release pipeline 必须打出真实新 package metadata、依赖闭包与 integrity；通过本地隔离 registry 验证无妨，但消费者不能依赖碰巧仍存活的 localhost 端口。不得把旧 tgz 的文件名/lock URL 改成新身份而未重新打包。更新 lock 由真实安装产生。

包 semver、产品版本和协议 revision 各有唯一工程化来源；是否从当前 0.2.0 延续或给新 identity 定版本，在基线比较后明确，不为统一数字倒退协议。

## 7. 实施顺序与闸门

1. 冻结源码/制品/命令/资产基线，记录其他 session 的 dirty 状态和两个旧版本消费集合；确认目录布局及新身份。此步不擅自提交上游他人改动。
2. 保留所有内容移动并完成活跃路径/包 identity 迁移；生成真实新制品，先验证同等行为，再切 depa 依赖。该变更与架构提取分开验证和提交。
3. 首批提取资源/SOP/CommandOperation 的 typed commands 与窄 runtime facets；用两产品复用验证，不先做巨量新抽象。
4. 逐批提取其他当前通用 feature、安装机制和资产组合；Codument 领域/迁移留在本项目。删除私有通用副本前确保新公共入口覆盖基线。
5. 两产品从同一发布闭包组装；独立最小消费者只选基础能力。类型正负例、冲突、无 server 本地执行、borrowed ownership 都要有验证。
6. 全量包构建/测试、独立 tarball 消费、source/embedded/global 安装字节一致性、历史 workspace 临时迁移回归；证据写入本 mission。全部通过后再讨论 npm 发布和 global 切换。

新代码阶段每轮按观察→调和→行动→验证推进。若结构或身份决策无法从授权范围确定，明确请求确认；不要用 help 输出或测试绿代替排除集验收。本轮仅立项，允许按 pending 返回条件停止。

## 8. 验收不只检查 build/help

- 类型：完整 parse/schema/children/admit/run 正例，以及缺 effect 的消费者编译负例；禁止宽 optional / `as unknown` 掩盖失配。
- authority：command 重复、非法 override、未知 Kind、冲突 reader、资产无声明覆盖均拒绝；选中表面与实现闭包一致。
- 生命周期：借用 catalog 不关闭，owned effect 关闭一次；错误/中断有 drain；local domain/help 不启动 serve/browser。
- 独立性：全新临时目录只安装 packed artifacts，实际运行资源/SOP/函数；禁止跨仓源码和当前 node_modules 污染。
- 裁剪性：最小消费者 lock/dependency graph 不含未选中的 Browser/Serve/MCP；包引用之外无复制实现。
- 资产：global App 与安装文件逐字节一致，source/embedded 引用行为一致；project codument/ 不含旧 global std 投影。
- 兼容：当前 depa commands 和历史完成记录语义保持；只在临时 workspace 副本验证，外部 bin/skills 不变化。

此方案不需要现在重跑模型 E2E；先用确定性的架构、制品和兼容验证证明底座变更成立。

## 9. 需要确认的决策

- 是否采用上面的“保留容器/子仓拓扑、统一 halfcode-lite 名称”布局。
- 是否按“先身份迁移稳定基线，再提取公共 feature，再两产品组装与独立消费”的分阶段方案实施。
- 不默认接受上游 0.2.0 所有新增语义；在基线阶段将行为差异列出，超出本次目标者另行确认。npm 发布和全局安装仍不在本次授权范围。
