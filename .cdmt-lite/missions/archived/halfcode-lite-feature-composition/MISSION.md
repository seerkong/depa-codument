# Mission: Halfcode Lite 公共能力与 CLI 产品组合

终点: Halfcode Lite 成为拥有统一公开包、可选择能力实现及资源资产的公共底座；自身 CLI 与 depa-codument 通过包引用组装产品，第三个 CLI 能只选择需要的能力而无需复制实现。

本文件是期望态权威。循环状态见 [loop.md](loop.md)，证据见 [evidence.md](evidence.md)，方案见 [design/architecture.md](design/architecture.md)。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构 | [attractors/product-composition.md](attractors/product-composition.md) | 单一公共实现、显式能力组合、产品独立 authority | 计划 / 决策 / 实现 / 校验 | 1 |
| AT2 | 概念来源（非本方程） | `depa-expert` 的 package-role / fact-source-truth；Sparrow superset mission | 借鉴边界与组合关系，不复制其他产品的协议和实现 | 参考 | 参考 |

## Notes

- 每轮加载 `cdmt-mission-lite`、`depa-expert`。用户于 2026-10-04 授权使用控制论循环实施，采用已提议的保留嵌套仓库布局；当前实施状态见 loop.md。
- 用户先要求当前代码提交，已完成 `aab479c`，author 为 `kongweixian <kong_weixian@163.com>`，未推送。新增本 mission 的规划文件不在该快照内。
- 三个候选名：`halfcode-lite-feature-composition`、`halfcode-lite-cli-subsets`、`halfcode-lite-shared-foundation`；选择第一个，覆盖公共能力组合而不暗示只改 CLI 外壳。
- 原 `/Users/kongweixian/infra-dev/halfcode-cli` 是容器目录，不是 Git 根；其中主仓库和 apps 仓库独立，playground 当前不是 Git 仓库。实施需保留全部目录内容和各仓库状态。
- 设计采用 package / standard 档：关键边界和公开面已调查，不宣称完成全树依赖审计或迁移验证。
- 用户明确包身份迁移：`halfcode-cli-lite-*` 与 `halfcode-app-lite-*` 均改为 `halfcode-lite-*`，不是只改其中一个前缀。例如两种旧 `skill-app-contract` 包名均收敛为 `halfcode-lite-skill-app-contract`；不生成 `halfcode-lite-lite-*` 或第三套 canonical family。
- 用户在 Round9 明确修正当前 resource-contract authority：使用 `@halfcode-lite/skill-app-contract/resource-contracts/v1`，不再使用 `@halfcode-app-lite/...`。同源 owner package identity 使用 `@halfcode-lite/skill-app-contract`；这只是协议 authority 标识，实际 npm 包仍无 scope。保留旧 CLI/APP 身份的显式兼容测试，不自动改写其他已安装 App。
- [npm package 级架构](design/npm-package-architecture.md) 列出每个目标包的公开 API、直接依赖、发布分类与 Sparrow/ACE 实际 npm package 对应关系；实施依此合同提取并验证，不以系统层示意替代包级设计。

## 期望结果

- 期望-1: 容器移动为 `/Users/kongweixian/infra-dev/halfcode-lite`；全部 canonical npm 包从 `halfcode-cli-lite-*`、`halfcode-app-lite-*` 两套身份统一迁移为无 scope 的 `halfcode-lite-*`，并同步活跃源码、dependencies/peerDependencies/optionalDependencies、import、exports、构建发布脚本、制品 metadata、lock 与 depa-codument 引用；旧身份仅作为明确兼容记录或历史证据保留。
- 期望-2: 通用命令与 runtime 能力由 Halfcode Lite 公开包提供，产品只组装；不再在 depa-codument 克隆维护通用 CLI 实现。
- 期望-3: 命令、执行能力、Kind 协议与资源资产四个组合面保持一致；类型安全、生命周期、冲突检查与本地优先行为可被独立验证。
- 期望-4: Halfcode Lite 完整产品、depa-codument 产品和独立最小 CLI 消费者均能从发布制品闭包构建及运行，不依赖兄弟源码目录。
- 期望-5: depa-codument 原有命令、global SkillApp、项目级 `codument/`、历史迁移与安全边界保持兼容；不因本次架构升级改变产品职责。

三组投影：

- 源头库存：现有 Halfcode host/resource/browser/live/http/MCP/build packages，私有 CLI 内的命令和模板；depa-codument 的通用命令副本及自有 domain / migration / operation 资产。
- 需要改造：统一身份与路径；通用命令工厂、能力装配、资源资产组合及发布闭包；depa 消费端与 clone scaffold。包清单详见 [convergence/package-disposition.md](convergence/package-disposition.md)。
- 最终暴露：Halfcode Lite 公共可复用 API 与产品 CLI；depa-codument 当前已暴露功能保持基线，不把所有库存默认暴露给所有产品。最小消费者仅暴露资源/SOP 能力，证明其他能力确实可选。

## 约束

- 约束-1: 架构方向以 AT1 为准；不另建重复 dispatcher、catalog authority 或业务特判底座。
- 约束-2: 保留 Halfcode 上游其他会话的 tracked 修改、未跟踪与忽略文件、apps 和 playground；不得 reset、覆盖已有目标或擅自提交其他仓库的改动。
- 约束-3: 不改 Sparrow/ACE/OpenCLI，不推送、不 npm 发布、不全局切换安装；不修改旧 `codument` bin 或正在使用的 workspace。
- 约束-4: XNL / FQN / VFS / schema revision / 历史记录不随品牌字符串机械更名；协议迁移须独立裁决。包版本、产品版本与协议版本分别管理。
- 约束-5: 公共实现由 Halfcode Lite 拥有，Codument 业务与适配由 depa 拥有；产品不跨仓库源码 import，不用可选字段大全和类型断言掩盖缺失能力。
- 约束-6: 验证写入隔离临时目录；不重跑昂贵模型 E2E，不实施产物评估系统；规划批准前只修改本 mission 文档。
- 约束-7: npm 包名迁移不得残留两套旧前缀作为活跃 canonical 依赖，不得产生 `halfcode-lite-lite-*`。确有外部消费者需要的兼容 alias 必须单列用途、期限及独立测试；归档记录不机械重写。

## Acceptance

- [x] 期望-1 → 移动前后只读内容清单、Git status、活跃引用扫描与新制品 metadata 核对 → 内容保留、身份闭包一致；命名/移动操作会写入，仅实施阶段执行。
- [x] 期望-2, 约束-5 → 依赖图与公开 exports 扫描（只读）、消费者类型检查（写隔离输出）→ 通用命令由同一公共 factory 提供，无兄弟源码引用、无缺能力强转。
- [x] 期望-3, 约束-1 → 类型负例、命令重复/Kind 冲突/缺失 effect 负例及资源覆盖检查（写临时测试输出）→ 显式失败，无第二 registry authority、隐式 override 或业务特判；AT1 排除集全部覆盖。
- [x] 期望-4 → 独立临时消费者安装真实 tarball、构建、调用资源/SOP、检查依赖闭包 → 不包含未选择 Browser/Serve/MCP，亦不依赖上游 node_modules 或本地源码链接。
- [x] 期望-5 → depa 命令基线、local-first、安装字节一致性和历史 workspace 迁移回归（仅临时副本）→ global/项目 App 和历史完成语义不退化，命令集合无未经批准删减。
- [x] 约束-2 → 移动前后 tracked/untracked/ignored 内容与各仓库状态核对（只读）→ 所有原内容可恢复，目标不存在才移动，未擅自提交 upstream。
- [x] 约束-3 → 文件变更范围及外部 bin/skill 摘要比对（只读）→ 无额外仓库修改、无旧 bin/global 安装/发布变更。
- [x] 约束-4 → 协议与版本兼容矩阵审查、旧 XNL/FQN 夹具回归 → 品牌改名不隐式升级协议，不手工伪造 lock tarball 和 integrity。
- [x] 约束-6 → 变更范围与执行记录审查 → 按用户授权执行，测试隔离，不启动模型 E2E 或评估系统实现。
- [x] 期望-1, 约束-7 → 扫描活跃 package manifests/import/build scripts、新 tarball metadata 与实际安装 lock，并与单列兼容清单比较（只读；安装验证仅写临时目录）→ canonical 只采用 `halfcode-lite-*`，无两套旧前缀或重复 lite；历史/兼容命中均可解释。

Round10 完整性曾被 gap-1 推翻；本轮已按 E59–E62 重新执行原验收与新增反例，上述勾选现在由 verification/acceptance.md 的最新命令/结果支撑，历史记录仍保留。

- [x] 期望-2, 约束-5 → 两产品 live 客户端同源检查及 public 调用测试 → G1 无通用实现副本。
- [x] 期望-3, 约束-5 → 实际 profile/binding 与 clone 生成物类型及运行探针 → G2 缺能力静态失败。
- [x] 期望-3, 期望-5 → 子集 Kind admission 与默认安装负例 → G3/C1：标准 Kind 不默认复制，子集与完整产品策略显式。
- [x] 期望-4, 约束-3 → 两产品 launcher/platform 本地隔离安装 → G4 真实安装链通过，无全局写入/发布。

## 范围外

- 泛化产物评估 harness 的开发及新旧产品模型 E2E 对比。
- 改写 ACE/Workbench/Sparrow 协议，或把 Halfcode XNL 替换为 ACE 的 FS-native 协议。
- 自动迁移其他消费者、全局已安装产品与其他 session；npm 发布、远端推送另需授权。
- 把所有能力强制拆成六个包、运行时下载插件、通用 workflow 引擎或无实际需求的 feature registry。
