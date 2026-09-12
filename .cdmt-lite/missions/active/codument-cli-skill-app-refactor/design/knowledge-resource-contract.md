# Knowledge owner resources 与 DataTopology 兼容合同

状态：领域迁入的实施细化；先以非空 compiler/reader probe 验证，再接命令。不更改真实 codument/。关联：architecture.md 的递归 owner 要求、loop D12、workspace-and-evolution 吸引子。

## 观察与差距

- 旧 `src/cli/{modeling,engineering}/registry.ts` 将文件解析为裸 XNL forest，只索引顶层节点；新 domain `indexXnlRegistry` 已有递归 owner/path/ancestor/source 索引，但没有知识业务 reader。
- 旧 modeling/schema 的 entity/object 强制 fact_grade/single_writer，七级枚举与当前 depa-expert 的开放 DataTopology 冲突。旧 component/port/state-machine 等最小表征、工程知识八种表征、引用与路径校验仍有价值，不能删除。
- 当前 public compiler 接纳有 Kind/envelope/spec 的 owner 资源，已有九个产品 Kind 不包含 modeling/engineering forest owner。把每个知识节点注册成 Kind 会把作者词汇变成安装协议；把整个目录当 Markdown 附件又会绕过 Resource 校验。
- 旧 modeling scaffold 的 registry 分支实际写 `<plane>/<context>.xnl`，注释却承诺 `<plane>/<context>/index.xnl`；新版采用后者，delta 保留前者，并在历史迁移中识别旧平铺位置，不静默丢弃或双写。

## Data 与 authority

| 对象 | 角色与 authority | 改变路径 | 派生关系 |
|---|---|---|---|
| 知识 owner XNL 文件 | 作者维护的知识事实，workspace working tree 权威 | scaffold/merge/migration 的 source-aware 写入；作者编辑仍可发生 | 解析为完整 forest，再索引；不从索引反写 |
| 文件内业务节点 | owner 闭包中的知识主体，不是独立软件 Kind | 由同一个文件写边界定位 source path | 暴露 id/URI/parent/ancestors/owner/source provenance |
| registry index / Resource reader | derived observation，单次源快照 | 无业务写权；来源变化重建 | 查询、结构与领域校验共享来源 |
| migration backup/receipt | 恢复材料及操作记录，不参与正式 Catalog | 迁移器创建；受控恢复 | 不把历史备份当第二套可写知识 |

此处没有运行时 Signal/Stream graph 或 canonical event replay 需求；两个可选 DEPA profile 均 NOT_APPLICABLE。

## Owner 形态与单一来源

在既有 domain-contract/logic 内增加两个聚合 Kind：`ModelingRegistry`、`EngineeringRegistry`，各为 single-file/one-document；内置 owner/revision，不给 workspace 复制 KindDefinitions。文件内 body 保留业务 forest，表征仍是其子树；不增加每节点 package/Kind。

每个 owner 有当前 envelope/specVersion、明确 `#id`；ModelingRegistry 的 `modeling_schema` 必填，允许 `data-topology/v1` 或仅用于兼容的 `codument-legacy/v1`。EngineeringRegistry 不引入无需要的新知识等级或 profile。

Catalog 负责 owner membership。知识 reader 暴露完整 portable tree 和递归索引，不将表征误当独立资源。跨文件完整性需要整个 registry；单个 Resource structural admission 不冒充跨文件语义 PASS，产品 Resource validate 在后继 App 集成中调用相同知识 validator。这一集成尚未完成时，完整 workspace/capabilities gate 必须继续 UNVERIFIED。

递归索引识别具有 `kind` 的知识主体以及带 id 的嵌套主体；表征的 text/无 id 容器不成为知识条目。所有节点保留 owner/path，顶层缺 id/kind 不能被过滤成成功；重名 id 或产生相同 URI 的不同节点拒绝。URI 仍保留原 modeling/engineering scheme 与路径语义。

## 新作者与旧材料

- 新建 ModelingRegistry 默认 data-topology/v1。entity/object 保留 types 表征要求；DataTopology 用 `semantic_role`、`authority_model`、`relations` 记录开放标签与有向关系，不再强制单一 writer 或封闭七级。不可变 value 可显式说明无可变 owner；确需裁决的状态要由语义 review 确认 owner、transition、durability 与 evidence，CLI 不凭字符串宣称其架构正确。
- 关系集合可以为空，表示明确没有本 scope 的外连关系，而不是缺字段。自定义 role/model/relation 名不被枚举拒绝。relation 元素须有非空关系名及目标说明；不以新增固定枚举替代旧枚举。
- 保留旧七级规则的独立 legacy schema 函数只服务显式 codument-legacy/v1 材料。机械迁移包裹 owner、保存原 forest 与字段并标识历史 schema；不得伪造 fact_grade→semantic_role 或 single_writer→owner 的语义等价。
- 已迁入的 legacy owner 可以保留旧主体。新增主体明确标记 `modeling_schema="data-topology/v1"`，使新作者不会因文件历史默认而继续产生七级字段。主体局部覆盖不影响兄弟，未知 profile 拒绝；覆盖只在知识主体生效，不借普通表示节点隐式切换。
- 从 legacy 到新语义的变换归 migration skill review：读取事实证据、提出明确字段与关系、源保真应用，再重新校验。旧字段可作为历史说明保留，不被新规则删除；是否符合新语义由新字段与证据判断，不靠去掉告警。

## CLI 与 effect 边界

保留 modeling/engineering 的 validate/lint/scaffold 路径及旧选项；默认 enabled（modeling true、engineering false）、显式目录/--deltas 绕过 gate，和原输出特例分别测试。支持层仅观察显式 root/config/Track 位置及原 bytes；解析、规则、merge proposal 属 logic；owner 排序/drain，写入复用 sourceRevision、锁与 no-clobber。无 Serve、无 cwd 全局切换。

lint 是拆文件建议，不是质量验收；行数从同一 source snapshot 取得，不再重复 IO；nodeCount 保持原顶层业务主体口径，不把 wrapper 算作唯一节点。递归主体依旧参加语义校验。语义 schema 不通过的 draft 不得由 scaffold 伪装为已完成验收。

## 验证顺序

1. 两种非空 owner 经真实 compiler、内置 contracts、reader，暴露 nested provenance；未知 Kind/profile、重复 slot/id/URI、不带 envelope 等负例拒绝。
2. 新旧 modeling profile 对同组主体分别判定，开放标签、多 relation、value 无 owner成立；缺必填 DataTopology、无效 legacy grade 与缺表征仍拒绝。工程八类表征及原引用/路径规则回归。
3. 只读命令显式/默认/禁用/delta/JSON特例，源不变且无 Host live 能力；scaffold 新文件与既有 owner 的 source-aware 插入、漂移/重复/路径/权限负例。
4. 后继 merge/archive/migration 使用同 owner reader，不独立重建旧 registry writer；App 集成验证正式集合一致，完整 gate 不能由本窄切片提前变 PASS。

## 实测收敛：Catalog 不隐式递归

Round24 compiler 0.3.0 实测：`single-file` Catalog 的 root 仅枚举直属文件，不递归深层目录；浅 root 对非空嵌套树可能产生 ready/零资源。因此不能把 compiler ready 单独作为 workspace membership 完整性证据。测试保留该观测，并用指向实际深层 owner 目录的 Catalog 验证两个 Kind 与 nested member/source provenance。

后继 App 节点必须补产品 membership 观测/注册投影：从 manifest 声明的正式根递归枚举当前 owner，明确 orphan、legacy、archive 与隐藏目录策略，将精确文件 closure 交给 generic compiler，而非在通用 Host 写 Codument 特例。需要通用 read-port/loader 注入接缝时归 Halfcode 公共包；物理 manifest 与投影摘要分开、实际文件 bytes 不复制成第二真源。此项是已观察的未完项，不能将本轮显式 Catalog 的 PASS 当作自动递归发现已完成。
