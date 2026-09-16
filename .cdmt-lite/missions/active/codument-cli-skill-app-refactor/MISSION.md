# Mission: Codument CLI Skill App 与可复用 Host 重构

终点: 以已经克隆到 `project/` 的 Halfcode CLI Lite working tree 为迁移骨架，把通用能力归回 Halfcode 源仓库，作为无 scope 的 `halfcode-cli-lite-*` 公共包；Halfcode CLI、Codument 和第三方 CLI 通过版本化公共契约消费它们，Codument 保有自己的领域与产品封装。初始化和升级后的 `workspace/codument/` 都是 resource-first CLI Skill App，主要功能由 CLI 本地执行，仅真正需要常驻生命周期的少数功能经过 Serve；保持验证机制和历史升级通路，并减少无关、重复上下文成本。

本文件是本次迁移的期望态权威。循环状态只在 [loop.md](loop.md)，证据只在 [evidence.md](evidence.md)。本 mission 与被重构产品的 Track/Mission 系统独立。

## Attractors

吸引子约束计划、决策、实现与校验；测试通过但违反排除集，仍按 drift 处理。这里仅列目录，具体不变量在各文件。

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构与复用 | [depa-host-boundaries.md](attractors/depa-host-boundaries.md) | 通用 Host、产品领域、契约与副作用、包依赖、事实归属 | 计划 / 决策 / 实现 / 校验 | 1（技术结构） |
| AT2 | 领域与演进 | [workspace-and-evolution.md](attractors/workspace-and-evolution.md) | Skill App 身份、内置 Kinds、生命周期、历史升级与语义保留 | 计划 / 决策 / 实现 / 校验 | 1（领域及兼容性） |
| AT3 | 质量与成本 | [accuracy-and-context.md](attractors/accuracy-and-context.md) | 验证独立性、上下文经济性、证据失效与质量非退化 | 计划 / 决策 / 实现 / 校验 | 2；成本不得推翻 AT1/AT2 |

跨维冲突先保留用户明确要求，再按各自职责裁决；不能局部化的冲突记录在 loop Decisions，由用户决定目标变更。

## Notes

- 2026-09-12真实E2E实施授权：新增期望-10及约束-21。按smoke→todo→stream-pipeline-ai-agent→blog/ecommerce→nested-mission-agent→关键用例重复运行顺序；真实Codex固定gpt-5.6-terra/medium，不发布、不改真实global。业务需求沿用旧e2e，runner及验收进入project/e2e。外层控制面仍MissionLite，测试业务workspace可实际使用产品Track/Mission。

- 2026-09-11全局App纠偏见 [讨论记录](design/global-app-layout-correction.md)。本轮仅更新mission，不执行产品改造或安装。新约束17…20覆盖旧聚合方案中的生成文档、扫描发现、增量保留旧global文件和保留项目std前提。
- 本轮三组投影：源头库存=现有global生成器、15操作正文、旧std/commands/skill/compat与项目配置引用、Halfcode原VFS资产加载Effect；需要改造=完整App资产正本/固定根加载/compat别名路由/链接与URI/复制及整包替换/项目非业务数据退役；最终暴露=原生CLI与15个动态CommandOperation不撞名、单global指导App及每项目codument/资产App，无第二能力表和旧std活动副本。

- 用户已确认历史完成兼容：保留旧归档Track原文与completed声明，显式记录旧版本迁入且未按新版重新验收；不自动重开，不补造checked/evidence，不作为当前验收PASS。新建/活动资源仍严格；重复ID、失效引用等独立问题不获豁免。

- 2026-09-08新增验证隔离约束：代码修改仍在原仓库；历史升级、成本/完整验收、发行及dogfood切换针对/tmp内本项目副本及隔离home执行。真实原仓库codument/和当前global codument安装不升级、不覆盖；副本升级结果不回写原workspace。此约束覆盖旧“根dogfood受控升级”的实际目标位置。
- 最新方向：workspace codument/继续是项目资产SkillApp；global depa-codument聚合全部旧指导Skill，std迁入global。旧Skill变为公共内置CommandOperation，直接暴露顶层命令；撞名时用不冲突的新名，保留现有命令并在批次总结列映射。先完成此批，再按新结构接入三命令；不再等待旧三命令方案的逐项确认。
- 三组投影：源头库存=15个src/templates/skills产品入口及std完整闭包、既有Host/领域CLI；需要改造=CommandOperation公共Kind/命令投影/global资产与安装/workspace标准分发；最终暴露=15个顶层操作、global单指导Skill及其description中的旧名+简介、每项目资产SkillApp。普通SOP与既有CLI不因发现新Kind而自动重命名或替换。
- 每轮加载 `cdmt-mission-lite`；设计、代码和架构审查应用 `depa-expert`，按当前节点读取必要引用。
- 安装授权更新：用户已明确允许覆盖新global depa-codument bin及所选agent的同名skill；布局讨论/记录回合先不安装，后续实施完成隔离验证再安装。此项仅覆盖下文旧“真实全局安装未授权”的限制，不授权旧codument、原项目dogfood升级或npm发布。
- 这次不用 Codument 自身创建/执行 track 或 mission；`codument/` 的产品能力仍必须迁移保留。
- 原始分析 scope=`package`、depth=`standard`；新跨仓库分析 scope=`package`、depth=`deep`，完整盘点两仓包边界并独立复核，模块内部按关键路径取证，不声称全量函数审计。
- 分析入口：[analysis/manifest.md](analysis/manifest.md)。包处置：[package-disposition.md](analysis/convergence/package-disposition.md)。总体设计：[design/architecture.md](design/architecture.md)。
- 用户七项需求逐一映射到期望-1…期望-7；阅读评审仅提供候选建议，用户约束优先。
- 新增 CLI-first 要求见期望-8、约束-12…14；[CLI-first 设计](design/cli-first-runtime.md) 替代原三命令自动组合的当前实施方案。Omni 为只读参考，不是本项目状态或代码真源。
- Bun 实际路径 `/Users/kongweixian/.bun/bin/bun`。脚本含子进程时将该目录加入本次进程 PATH；不以 PATH 缺失判定本机没安装 Bun。
- 最新跨仓库方向取代临时的“不回写 Halfcode / 所有新包均 depa-codument-*”前提。入口：[跨仓库设计](design/cross-repo-host.md)、[分析状态](analysis/cross-repo-host/manifest.md)。通用能力的最终源码 owner 是 Halfcode；两仓源码按已确认方案逐项改造，示例 App 不改。
- 2026-09-13用户纠正资源读取投影：本地文件来源的 `list`/`search` 必须直接给 agent 可读的绝对详情路径；XNL 的 `detail` 必须仍返回原 XNL 文本，但将其中已解析的 `vfs://` 资源引用投影为绝对本地路径。不得以 JSON 摘要取代 XNL 正文，也不得新增 CLI 行范围读取命令。未来由宿主提供 VFS 时再保留 `vfs://`，本轮不做 FQN 替换。

## 期望结果

- 期望-10: 新版真实E2E覆盖已批准六步，模型固定Terra；独立环境/流程/业务验收、有界纠偏及复跑报告，首次和纠偏后通过率、token与耗时可追溯，不将Agent自述或smoke当业务通过。

- 期望-11: Halfcode 的可复用资源 presentation 在本地 filesystem host 上，把资源详情的实际文件绝对路径暴露给 `list`/`search` 消费者；XNL `detail` 维持原文件正文且仅将已校验的 `vfs://` 引用解析为绝对路径。Codument 的长需求/验收上下文使用这些路径与输入覆盖投影，减少大文本 CLI 搬运而不删减必要原文、fresh 验证或检查轮数。

- 期望-1: 已克隆骨架成为产品实际构建和运行入口；新建 workspace 的 `codument/` 可被 CLI 发现、解析、验证为 SkillApp，支持 resource-first 主体与 code-first 资源混合；Kinds 内置、不复制到每个 App。
- 期望-2: 产品与 Host 的 authority、显式 runtime、effect contracts、Processor、capsule 和按需 Actor 边界符合 AT1；包依赖无环，核心逻辑不直接依赖具体 IO。
- 期望-3: 通用 CLI/Skill App 能力以 Halfcode 仓库为唯一源码 owner，形成可公开发布的无 scope `halfcode-cli-lite-*` 包；Halfcode CLI 自身、Codument、第三个非 Codument CLI 都能通过已打包、版本化的公共契约组合运行，不需要访问另一仓私有源码。Codument 领域和有真实职责的产品封装使用 `depa-codument-*`；原有 npm 产品名 `depa-codument` 保留。公共包版本不随 Codument 产品版本强制联动。
- 期望-4: 有可复现的上下文成本前后对比；常用任务读取更少重复/无关内容，GapLoop、Hook、AttractorCheck、fresh verify、显式人工 gate 的能力、配置和触发语义保持。
- 期望-5: 保留 0.5 系列的确定性 CLI migration 与 migration skill 语义兜底；旧 workspace 可沿可审计路径升级为当前 Skill App，含备份、冲突处理、幂等、业务语义及历史引用保留。
- 期望-6: 用户评审建议有基于现代码证据的采纳/调整/暂缓记录，不能因采纳建议覆盖用户硬要求。
- 期望-7: 本次任务由独立 Mission Lite 文件夹管理，分析/设计/验证中间产物可恢复；所有产品能力和新结构经验收后，构建及运行不再依赖旧 `src/` 实现。
- 期望-8: 普通资源发现/校验、Codument 领域读写/验证/迁移和一次性执行无需 Serve；placement 按叶子命令及 admitted capability/backend 生命周期决定。Catalog、Domain、按调用 Execution 与 Page/live runtime 可分别装配，常驻 Effect 惰性创建和精确释放，Page/Workflow/MCP 与必要 browser 协调保持。
- 期望-9: global depa-codument 是完整、可直接经公共VFS加载的CLI SkillApp资产文件夹；固定位置Effect加载，同一资源驱动help/dispatch与操作正文。安装完整复制、升级整包替换；项目升级成功后codument/仅保有项目资产。SKILL.md引导CLI动态查询及按需读取references/std/compat/operation-alias.md，不维护第二份当前能力清单。

## 约束

- 约束-21: E2E临时项目/home/session/验收证据隔离，明确固定CLI和Skill哈希、模型及配置；不复制个人配置/插件/旧Skill，不回退旧bin。不关闭产品质量机制，不由被测Agent改验收或框架源码，不将质量分数抵消失败。真实调用已授权但不购买额度；凭据不进日志。关键用例todo与stream各重复至少一次，真实失败和基础设施失败分别计数，缺usage不按0计。两次外部纠偏为默认上限，耗尽保留失败而非重置首次结果。

- 约束-22: `detailPath` 与被替换的 `vfs://` 路径只能由 Halfcode 已 admission 的本地 regular file、真实 package root 与现有越界/symlink 守卫生成；绝对路径是当前 host 的 effect projection，不得写回 authored XNL、FQN、content digest 或跨宿主持久状态。没有 local filesystem material 的 host 必须保持 `vfs://` 并明确声明不可解析，不得猜路径。
- 约束-23: 不新增 `Resource read`、`--range`、行范围或另一份正文缓存 CLI；`list`/`search` 返回紧凑 metadata 与绝对文件入口，`detail` 对 XNL 返回替换后的原文本。Agent 的本地文件工具负责实际阅读。现有 JSON 调用方须保留可判定的兼容路径，不能默默把 XNL 文本塞进 JSON resource 摘要。

- 约束-17: global完整资产必须对应Halfcode原有直接加载VFS的文件夹机制；安装仅复制，不能从workspace模板拼接/改写文档生成另一App。固定根的选择属于Effect，解析/校验/CommandOperation复用公共机制；禁止扫描发现替代固定加载、代码内置表与资源双authority。构建字节打包不算语义生成。
- 约束-18: global App根有SKILL.md、manifest、operations/、references/std/compat/operation-alias.md和references/；std迁入references/std，退役std/operations、std/commands及kernel-pointer，std/skill的有效指南按职责迁位。旧skill详细映射只在compact别名文档，SKILL引导按需读取；保留最初description历史名称/简介的发现要求，但不重复展开完整映射或当前动态能力表。全部有效链接、配置URI及CLI正文同步调整。
- 约束-19: 所选agent的global depa-codument目录备份后整包替换，不与旧定制合并；失败恢复。项目upgrade成功后删除codument/std/和已识别的非项目级分发资产，不保留活动旧目录副本。先备份并保全业务资产；未知定制分类/迁入或review，不以未知文件直接删除或虚报成功。历史指纹和迁移兜底保留。
- 约束-20: 本轮仅记录纠偏；恢复实施后先在/tmp副本和隔离home验收，再按已获授权覆盖新global bin+skill。旧codument二进制、真实原项目codument/和相邻非目标skill保护不变；源码与临时构建通过不等于已安装或完成新目标。

- 约束-16: 验证副本置于/tmp（macOS realpath可能为/private/tmp）；源码、项目资产及测试运行状态不通过外部软链接/硬链接共享写入。显式指向副本CLI和workspace，global安装重定向到隔离home；验证前后核对原codument/和现有global codument指纹。npm发布仍范围外。
- 约束-15: CommandOperation由Halfcode公共包实现并内置注册；产品显式暴露，顶层help与dispatch同树。全部旧Skill有一一映射，名称冲突直接另命名，不覆盖现有命令；global拥有std，workspace保有项目SkillApp与业务数据，迁移保真且不把指引获取当业务完成。
- 约束-1: 设计回合只做分析与规划；现已获实施授权，按来源对照改两仓源码。三个产品命令按global聚合后的顺序实施；npm发布与真实全局安装仍另需授权。
- 约束-2: 迁移必须覆盖原有生命周期、嵌套 mission/ProjectRef、scaffold、行为/知识/决策 registry、receipt、archive、artifact sync、技能及受管文档分发；不能以“新骨架没有”为由删能力。
- 约束-3: 通用包不能 import Codument 领域包、硬编码 `codument/` 路径或通过外部项目源码路径运行；可复用性须由独立消费方证明。
- 约束-4: 不为节省 token 关闭检查、降低已配置轮数/验证强度、复用本应 fresh 的语义 verdict、删掉未知字段或压掉必要负例。
- 约束-5: 升级先观测和备份；未知/冲突进入显式 review 或 blocked；禁止直接覆盖用户 authority、丢扩展字段或只改版本号宣称迁移成功。
- 约束-6: 通用包迁回 `/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite` 已纳入目标，实施前须确认方案并重新观察两仓基线，以逐项合并而非整树覆盖保存独立演进。示例 App 不改；不付费、不 npm publish、不更改本机全局安装。先验证隔离 tarball 发布闭包，真实 registry 发布另需授权，不能把本地 pack 等同已发布。
- 约束-7: 用户既有改动保持，包括建档前已修改的 `src/templates/codument/std/attractors/depa-attractor.md`；分析快照记录在 evidence。后续若变化，重新观察后再依证据迁移。
- 约束-8: 只维护本 mission 的一套期望态和工作图；中间分析不是第二套执行状态，产品 `codument/` 与克隆自带 `project/codument/` 都不驱动本任务。
- 约束-9: 2026-09-07用户更正：新版本仅构建/安装 `depa-codument` bin（Windows为 `.exe`），不再提供 `codument` 别名，避免覆盖本机旧版session入口。产品目录与资源身份不随bin重命名；已有子命令、JSON/退出码契约保持兼容映射，新资源式命令不得让migration兜底无法启动。旧根发行入口暂不切换，本机旧安装不改。
- 约束-10: Kind/reader/schema 由产品显式组合进 Host；初始化 App 不含 KindDefinitions；每个资源/字段都有唯一 authority，旧解析链仅留在迁移边界。
- 约束-11: 最终版本高于旧 0.5.4；产品版本、包版本、资源 specVersion 与 envelopeVersion 分开，不能沿用克隆骨架 0.1.0 作为产品升级版本。发布号暂定下一 minor 0.6.0，执行基线重观察后确认可用性，不查询/占用远端包名。
- 约束-12: 先完成global指导App与CommandOperation聚合，再接入init/status/upgrade-workspace及组合入口；新建/升级正式资产仍为codument/。确定性迁移与语义review保留，不以force覆盖未知内容。不提前切换根发行、退役旧src或升级真实dogfood；最终兼容合同保持，不删验收。
- 约束-13: 正式 workspace App 根固定为 `codument/`，不改为 `.codument/`、`.agents/skills/` 或别处；Host 私有状态目录不得持有第二份 App 或正式业务资源。此目录不变量适用于后续内部 installer 及最终 CLI 初始化/升级验收。
- 约束-14: local 路径不读取 Serve record、不 health probe、不隐式 start、不依赖 HTTP Serve；必需常驻调用继续安全失败，不降级 local。策略由软件契约拥有、Server 复验，不新增万能 argv/code RPC、第二 daemon 或 placement 业务配置；不照搬 Omni 未在本项目存在的 BaaS/token 机制。

## Acceptance

- [ ] 期望-10、约束-21 → 隔离副本中bun test e2e与bun e2e/run.ts smoke --bin=<candidate> → 无模型路径/安装/日志/错误退出/超时和伪PASS负例通过。
- [ ] 期望-10、约束-4、约束-16、约束-21 → 隔离副本bun e2e/run.ts run <case> --bin=<candidate>及关键用例重复 → 六步真实证据，环境/流程/业务独立门、固定模型、首次/最终通过率和成本；失败不可冒报PASS。
- [ ] 期望-11、约束-22、约束-23 → Halfcode resource presentation contract tests + 独立 product consumer fixture + Codument context forward tests → list/search 给本地绝对详情路径；XNL detail 保留正文且只替换已校验 VFS 引用；无本地 material、越界/symlink、JSON/正文混淆与未替换场景失败关闭。

- [ ] 期望-9、约束-17 → 固定根VFS真实加载/资源变更驱动help与dispatch/缺失损坏及无关App负例（隔离；具体测试入口在实施节点补齐） → 单一完整资产与公共解析链，不回退硬编码清单。
- [ ] 期望-9、约束-18 → 安装资产链接与manifest/URI闭包、compact别名路由和全部15操作实测（隔离） → 新目录无旧残余，历史映射按需读取，真实资源与命令一致。
- [ ] 期望-9、约束-19、约束-20 → 多agent复制/替换/恢复、旧项目清理/业务保真/幂等/review测试及最终授权安装后核验 → 干净global与项目App、旧codument及原dogfood不变；本次文档预检不代替业务验收。

- [ ] 约束-16 → 隔离项目副本及home、原件指纹与路径/链接守卫 → dogfood升级只改变/tmp副本，原workspace与global codument不变。
- [ ] 期望-1、期望-5、约束-5、约束-10、约束-13 → workspace-app与migration完整门（隔离写入） → 项目SkillApp/内置Kind/历史备份恢复/业务语义成立。
- [ ] 期望-2、期望-3、约束-3、约束-6 → architecture与consumer完整门（隔离打包安装） → 单一上游公共实现、公开消费、无反向依赖/源码路径旁路（AT1负例）。
- [ ] 期望-4、约束-4 → context-economy及独立协议验证（隔离/只读） → 来源失效与检查机制保留，不复用fresh语义判定（AT3负例）。
- [ ] 期望-6 → analysis/user-review.md逐条核验（只读） → 不采纳削弱检查的建议。
- [ ] 期望-7、约束-1、约束-2、约束-7、约束-8、约束-9、约束-11 → capabilities/distribution/all及原件diff（隔离验证） → 旧能力兼容、唯一新bin、版本升级、无原件覆盖。
- [ ] 期望-8、约束-14 → serve-placement完整门（隔离） → 普通命令无Serve、常驻安全准入和精确释放。
- [ ] 约束-12、约束-15 → CommandOperation公共/产品测试、global与workspace安装/升级测试、实际顶层help/调用和后续三命令门（隔离） → 全15入口、碰撞不覆盖、global std无业务副本、workspace仍App，无未知std丢失（AT2负例）；先聚合再接三命令。

上述checkbox为原下表验收合同的新版MissionLite勾选投影，未勾选不代表历史scoped证据不存在；最终范围变更后须重验，不重复维护实现状态。
完整验证场景、环境、副作用和期望信号见 [verification/acceptance.md](verification/acceptance.md)。下表是合同；执行记录只追加 evidence。`verify:mission` 已有部分 scoped 实现；未实现 suite 仍为 UNVERIFIED，历史 scoped PASS 不覆盖新增 placement 合同。三命令按最新global聚合后接入的授权执行隔离验收，不再等待旧确认门。

| 覆盖 | 独立验证命令/审查 | 期望信号 |
|---|---|---|
| 期望-1、约束-10 | `cd project && bun run verify:mission -- workspace-app` | 新 workspace 可发现；内置 Kinds；混合资源及未知 Kind 负例通过 |
| 期望-2、约束-3 | `cd project && bun run verify:mission -- architecture` + 基于 AT1 的代码审查 | 无反向/跨私有依赖；effect 注入；无双 authority |
| 期望-3、约束-6 | 现有 `consumer` 基线 + 待实现的跨仓打包/三消费者验收，合同见跨仓设计 | Halfcode 为公共源码 owner；同一版本公共 tarballs 被 Halfcode/Codument/第三 CLI 隔离安装；运行不读任一源码树，无 workspace/私有路径泄漏；历史本地 consumer PASS 不替代新合同 |
| 期望-4、约束-4 | `cd project && bun run verify:mission -- context-economy` | 固定输入对比达标；机制保真和故障检出非退化 |
| 期望-5、约束-5、约束-9 | `cd project && bun run verify:mission -- migration` | 历史矩阵、Skill 兜底、重跑、冲突、恢复和旧命令兼容通过 |
| 期望-6 | 本地读取并逐条核验 `analysis/user-review.md` 的建议→证据→处置表 | 有用户硬要求优先级；无默认删验证能力 |
| 期望-7、约束-2 | `cd project && bun run verify:mission -- capabilities` | 旧能力清单逐项有新入口、资源 authority 和回归证据 |
| 期望-7、约束-9、约束-11 | `cd project && bun run verify:mission -- distribution` | 仅安装depa-codument bin，旧codument不覆盖；从 project 构建；版本递增；无旧 src 运行依赖 |
| 期望-8、约束-14 | `cd project && bun run verify:mission -- serve-placement`（待实现）+ `architecture`/`consumer` | 无 Serve 负例、capability/backend 路由、服务端复验、lazy/close 与 Page/MCP 回归通过 |
| 约束-12、约束-13 | 规划/注册 diff 审查 + `workspace-app --scope core` + 后续完整 `workspace-app` | 按global聚合后接入三命令；内部及最终初始化都仅创建 codument/ 正式 App；core 不替代最终 CLI 兼容 |
| 约束-1、约束-7、约束-8 | 规划前后两仓 source tree digest、`git status --short`、mission links/sections/DAG 检查 | design-only 回合仅 mission 文档变化；后续获批跨仓实现只改确认范围，dogfood/旧 src/用户既有内容保持保护；整体达标前 mission active |
| 全部期望、约束-7、约束-8 | `cd project && bun run check && bun run verify:mission -- all` + evidence/文件 diff 审查 | 最宽相关回归通过；每项有最终证据，未验证项不得完成 |

## 范围外

- 改两个外部示例 App、实际 npm 发布和用户真实外部 workspace 批量升级不在当前实施授权中。
- 新建完整 Codument 图形产品；本次保留/打通 Page、Site、MCP App 等能力，用最小示例验通。
- 重造 compiler、Git、CI、任务平台、RAG 数据库或默认 Actor/mailbox 平台。
- 为减少 token 删除历史正文、GapLoop/Hook/AttractorCheck，或统一把所有任务降为轻验证。
- 不调用用户真实 Serve/browser/外部 App；只在隔离 fixture 验证，不把 Omni 的实现或 mission 拷入产品。三命令组合按最新用户已选定的global指导App与workspace资产App边界实现，不扩展为真实安装授权。
