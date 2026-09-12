# 目标架构与应用形态

本文是本次 mission 的设计投影；目标在 MISSION，实际工作图在 loop。尚未实施的 API/目录均为方案。

2026-09-05 跨仓库方向覆盖：本文的 workspace、领域与 CLI-first 约束保留；公共包归属、前缀、发布与消费拓扑以 [跨仓库设计快照](../analysis/cross-repo-host/manifest.md) 为准。旧 package-disposition 是最初本仓抽取阶段的 dated 方案，不再作为通用包最终源码归属。

## 分层组合

1. compiler/vendor 层继续使用已有 XNL 原语；不复制 compiler。当前 `0.2.8→0.3.0` 差异集中在 migration compatibility adapter。
2. 通用 Host 包提供命令协议、resource discovery/admission、SOP、配置、bundles、Page/Site、LocalFunction、browser、MCP App、Serve 及安装/打包能力。
3. Codument domain 包提供正式资源的业务规则、生命周期、知识/行为/决策 registry、迁移和受控写入。
4. product shell 注入 identity、sources、Kinds、command registration、模板和 providers，调用通用 shell。

详细 package 名称、role 和可依赖关系见 [package-disposition.md](../analysis/convergence/package-disposition.md)。包是否可复用以隔离 consumer 为证，不凭 package.json 数量判断。

## 初始化后的 workspace

```text
workspace/
  codument/
    SKILL.md
    manifest.xnl             # SkillApp，当前 envelope/spec 版本
    std/                     # 操作/协议/规范；按节点读取
    config/                  # hooks、profiles、registry 配置
    attractors/              # 项目业务/架构吸引子
    tracks/{pending,active,archived}/
    missions/{pending,active,archived}/
    behaviors/
    decisions/
    modeling/
    engineering/
    memory/
    backlog/
    analysis/
  .agents/skills/codument-*/  # 薄触发入口，支持历史 agent 安装路径
  .codument/                 # 既有 Host 私有配置/缓存；不是正式 App 根，不存业务资源
```

不生成 `KindDefinitions/` 或 `std/kinds/KindDefinitions/`。schema/reader 由软件内置；可提供 `Kind detail` 一类公开只读说明供 Agent 取 schema，但不要求 workspace 维护副本。

`codument/` 是用户明确冻结的正式目录名。内部 installer 与后续 CLI 初始化/升级都必须保持它；不能因 clone identity 的 `WORKSPACE_DIR` 是 `.codument` 而把两者混为一谈。

保留多个薄 Skill 以承接现有用户入口，唯一业务 operation 放在 codument/std。根 SKILL 是 App 入口与业务目录；这些 Skill 不再各自成为重复的完整 App。

通用 Host 接收 source 声明；产品设置 `{root:"codument",scope:"root",origin:"workspace"}` 并保留既有 root/installed discovery。扫描按物理来源与 ID 去重，冲突显式报错。不用符号链接解决发现，因为当前安全协议拒绝 symlink。

## Resource-first 的具体边界

- manifest 管正式资源 membership，配置、Track、Mission、Behavior 采用资源声明。
- 持有嵌套 owner 的 Decision/modeling/engineering registry 保留递归语义；先复用其 owner 资源及 reader，不为每个节点凭空增加包或 Kind。
- 必须让 `Resource validate` 和领域 strict validate 对同一正式资源集合给出一致诊断；聚合 reader 需要显式暴露 children/ref/source provenance，不能把复杂 registry 当不透明附件绕过校验。
- Catalog 对递归 forest 的表达能力须在最早垂直切片验证；若 compiler 现有 generic mechanism 无法表达，用产品 reader/注册投影完成，禁止向通用 Host 添加 Codument 特例。
- 纯知识 Markdown 可作 Skill references；可执行 LocalFunction、Page/MCP 示例可用 code-first profile。两者同资源不能出现两个独立 authority；descriptor membership 与 manifest 必须一致。
- 默认历史 archive 不装进 active ContextView，但显式历史查询和 strict/migration inventory 覆盖归档；迁移测试验证历史引用仍可解析。

## Kind 与命令扩展

注册必须贯通 owner/revision/schema/readers/writers/resolutions → ReaderProfile/ContractLock → resource discovery → typed projection → CLI actions。旧 registry metadata 可复用作输入，但新版 contract owner 是包内唯一来源，模板从它生成实例和规范索引。

通用 builtin Kinds 与 Codument 9 类（含小写 `decision` 历史 Kind）内置。Kind 名/FQN 大小写改变须有映射，不机械 TitleCase。

新增 Kind 风格 surface 可以是 `Track list/detail/...`；已有 `track ...`、`mission ...`、`validate`、`upgrade-resource` 等继续作为兼容 adapter 委托同一 operation。迁移不默认强迫所有用户改命令。

2026-09-05 用户覆盖原组合方案：`init`、`status`、`upgrade-workspace` 暂不合并，核心重构后再讨论。当前不决定 handler 胜出、不改名或新增 `host` 命名空间，也不通过其它初始化/升级入口暗中组合。底层 installer/status/migration 能力可独立迁入和隔离验证；其余无冲突领域命令可接入产品 shell。registry 注册重复 path 时拒绝，不按顺序覆盖。

`--workspace-dir`/`-w` 变为 runtime root 输入，不再 chdir。选项处理、错误/JSON、退出码只在 shell 适配；特别保持 upgrade 的 exit 2 可解析 receipt。

## CLI-first 与常驻边界

按 [cli-first-runtime.md](cli-first-runtime.md) 的完整叶子命令及 capability/backend 合同决定 placement。当前资源查询/校验已本地，不能描述为从 Omni 式统一 transport 搬回；主要拆分点是聚合 `createCommandRuntime`、Page projection/live coordinator 与 LF pageWorkflow 生命周期。

领域操作直接走公开 domain capsule/repository，Catalog/按调用 Execution 不装配 Page/live runtime；只有 Page/Workflow/合法 target ingress 和真正的长期 browser owner 使用常驻能力。MCP stdio 保留自己的 connection scope，不自动代理 HTTP Serve。缺服务不安全降级，local 不探测 Serve。复用既有 role 包，不为每个 runtime 分面机械增加 package。

## 可复用性证明

构建一个小的测试 consumer（例如 notes-cli），仅安装本地打包的通用 Host 包，自己定义品牌、resource root、一个非 Codument Kind/命令和一个混合 App。

在 monorepo 外的临时目录运行 help、Resource validate、一个 LocalFunction、隔离 HTTP/MCP 用例；consumer 不安装 domain-*、不读取旧 src 或源 Halfcode 路径。两个不同 root Host 实例并置，验证配置和状态互不污染。

保留原 resource-first/code-first 例子的关键特征为本仓库 fixture；不修改外部示例。pack 产物必须包含 schema、templates、必要运行依赖，不能仅在 workspace:* hoist 环境成功。

## 源码与 dogfood 切换

- `project/` 长期作为 Codument 产品及领域源码根；通用包按新的跨仓设计归回 Halfcode，最终不在两仓并行维护同义实现。无需把 Codument 产品先搬到本仓顶层。
- 旧 `src/` 在行为基线和 migration reference 阶段保留，新 runtime 不 import 它；验证通过后退役旧实现，根脚本改为代理 project，历史代码从 Git 获取。
- 仓库根 `codument/` 是真实 dogfood 数据。先复制到隔离 fixture 并用新发行包升级；通过后才在已确认的实施范围内升级根 dogfood。
- clone 自带 `project/codument/` 是 Halfcode 项目历史快照，不能误认为本产品真实 dogfood；先作为迁移/资源测试来源登记，再在收口节点归位到历史 fixture/归档位置。禁止在根和 project 同时生成同一 mission 状态。
- 核心重构后先进入三命令讨论 checkpoint；用户确认之前不做发行入口切换、旧 src 退役和真实 dogfood 升级。最终发布前仍须以同一套 product package 运行 init/upgrade/validate；旧入口最终只保留薄发行兼容壳，无旧算法 fallback。
