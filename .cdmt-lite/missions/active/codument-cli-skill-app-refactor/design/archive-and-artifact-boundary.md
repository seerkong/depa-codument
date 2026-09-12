# Archive 与 Artifact 的受控发布边界

领域节点的实施细化，不是新工作图。来源：旧 `src/cli/commands/archive.ts` 全文、`archive/staging.ts`、两份知识 merge、`commands/artifact.ts`；对应 AT1 的唯一写入裁决与 AT2 的语义保真/可恢复性。

## 实际缺口与处理顺序

知识 read/scaffold 已有新 owner；`mergeXnlNodes` 已承接两族共同三方合并算法并增加顺序交换验证。完整 archive 还没有新 CLI，不能把已有 `mission-archive` 基础状态转换冒充旧归档。先完成同属当前领域节点、边界较窄的 artifact sync，再补完整归档事务；不是删去归档或把节点提前标 done。

## Artifact sync

- 保留 `artifact sync --source --target [--dry-run] [--force] [--json]`。显式源和目标路径由本次请求授权；normal CLI 不隐式同步，不触发 Serve。支持任意二进制制品，不把它们当 XNL。
- Data：源文件树为发布输入，目标为外部交付副本，逐文件摘要/状态是一次性观测；它不是第二份 Codument 领域 authority。Conflict/dry-run/synced 结果保持 source/target/changes 形状与原退出码 2/0/0。
- Logic：比较 source/target 快照形成 create/update/unchanged，冲突且无 force 时零写入，dry-run 始终零写入。Effect：显式路径解析、regular-file 检查、字节与 inode/mode 观测、受控写入与恢复。Capsule 排序与关闭，不在 shell 写文件。
- 在读之前拒绝符号链接、特殊文件、源/目标重叠和目标结构冲突；`--force` 只授权替换所选普通文件内容，不授权删除目录或跟随链接。
- 在第一笔发布前保留本次被覆盖文件备份，写入前重查来源/目标；失败按已发布清单反向恢复。若恢复前发现第三方编辑，保留备份并报告 recovery-required，不以快照覆盖新编辑。锁与恢复目录只属于本次同步，不成为正式 App 或隐式 daemon。
- 原 CLI 的 rollback 总是删除备份、可能掩盖恢复失败；新版必须区分发布成功但清理失败、发布失败且已恢复、发布/恢复失败且材料保留。不可把错误处理加强描述为对任意编辑器的 OS 原子 CAS。

## 完整归档的必要闭包

- Track：active 位置/状态门，`--yes/-y` 对非 completed 的显式确认，`--skip-specs` 仅跳过行为/spec 晋升；知识 enabled/merge policy、Decision 验证及晋升、memory profile 均不随之跳过。归档命名沿旧 updated/created/mtime 回退与本地月/分钟目录规则，不把这些时间当业务裁决证据。
- Mission：active/pending 唯一位置、completed/cancelled/superseded 门；bound Track 的 active/missing 检查及显式 yes 保留问题。ProjectRef 必须按当前绑定解析，不能延续旧只按本仓目录猜链接的缺陷。归档日期与冲突后缀规则保留。
- 行为 patch、两知识 merge、Decision 晋升、memory 候选、summary 和 lifecycle move 都来自一次受控源观测。各源与配置在提交前重查。源未知字段及没有变更的源片段保留；legacy XML/Markdown 进入 migration/review，不在正常 reader 重开双解析链。
- Knowledge baseline 由 Track 的明确 Git commit 与路径树提供；commit 先解析为不可变对象，读取 Git blob 不切分支、不写真实工作树。没有 baseline 且 canonical 非空继续拒绝；历史裸 forest 可通过隔离 legacy adapter 解释，未知 schema/meaning 仍需 review，不伪造新 DataTopology。
- 每个 delta 文件映射唯一 canonical owner，body 节点按 ID 做三方合并；聚合 owner 的 schema/身份不随 delta 或包名机械变动。源 profile 不同而无法证明主体解释一致时显式冲突；不能把 wrapper 当普通业务节点整体覆盖。
- 多文件晋升与目录移动须同一恢复边界；仅在所有验证过线后提交，失败恢复各已尝试目标。Journal 是恢复材料，不是事件溯源 authority；没有 canonical event/replay 需求，不激活 EventSourcedStateProfile。

## 证伪矩阵

Artifact：二进制、空树、create/update/unchanged、dry-run/冲突无写、force、额外目标文件保持、source/target 漂移、symlink/FIFO/目录冲突、N-th 写失败恢复、恢复遇独立编辑保留备份、同目标锁、清理告警；真实打包 CLI JSON/文本/exit 与无 Serve。

Archive：原行为/知识/决策/记忆组合、merge 各冲突政策与缺 baseline、stage/配置/源漂移、无覆盖目标、linked ProjectRef、移动失败/恢复失败、未知材料保留、幂等重试与故障可恢复。完整 CLI 没有通过前保持旧能力矩阵未迁移，不以部分 helper 绿测试填满验收表。

## Round29 的知识写入投影

- baseline中的旧bare forest只在历史adapter机械包裹为legacy schema observation；源Git blob不改，XML/未知grade/歧义不能猜测。正常canonical/delta仍要求当前owner envelope。
- 同一知识身份跨输入的schema解释不同，必须明确migration review；缺省profile不继承自嵌套业务父节点，只由该主体override或文件owner决定。新主体跨owner缺省不同则在该主体显式保留其来源profile。
- 三方合并只处理body的identity-owned主体。canonical header/identity/扩展保持；delta出现额外owner字段变化不当作主体变更静默丢弃，而要求owner review。空desired body保留现存aggregate owner（新引入的owner身份不因业务成员删除而消失）。任何human conflict使整族updates为空。
- 来源fragment优先current，新增主体使用delta原fragment，base policy恢复使用基线fragment；对changed fragment用原token定位、canonical parser复核。owner外壳不整份重serialize。旧current注释和新增完整主体注释保留；同一既存主体中仅新增的delta注释不是AST合并事实，仍保留在归档过程源，不声称所有delta注释都自动晋升。
- token匹配使用Hirschberg线性行存储，不设置新的资源规模限制；#word/<Tag语法原子不可拆。不同text delimiter/属性顺序不构成业务冲突，正文与delimiter碰撞时只在rendering副本选确定性安全marker。

## 接续的 BehaviorPatch 边界

依据旧 `utils/spec-xml.ts` / `behavior/{resource,patch-resource,mutations}.ts`，旧实现先压成XML DTO再写XNL会丢未知复合属性；新processor只在完整native AST上应用selector，之后走既有native diff/dry-run和源保真writer。

- 普通入口只接当前Behavior/BehaviorPatch；旧spec XML/includes继续由migration边界处理。`--skip-specs`最终只绕过此族，不能绕过knowledge/decisions/memory。
- 保留Upsert/Delete/Move顺序与跨capability Move；selectors的requirements/suites/cases别名映射已存在的canonical collection结构。目标必须唯一，缺失/重复/不安全路径拒绝，不能通过DTO flatten抹掉未知子树。新capability只在Upsert/Move显式目标时产生；现有capability遵循其真实source owner，不强行迁文件。
- Upsert是用户明确选中子树的替换；未选中主体、root扩展、结构化值都不受影响。Move保留完整子树并按显式to重新命名目标，已有目标的替换沿旧语义；根不可Delete/Move。自动补父结构仍受最终行为合同验证，不允许为兼容旧漏洞写出无Statement的Requirement。
- 多个patch按可复现顺序在一个提案内组合，所有受影响Behavior在写前完成完整校验，不先提交前几条成功操作。内层helper通过不代表archive事务通过。

## 事务组合的实际锁协议

读取现有support后确认：lifecycle/scaffold/knowledge使用`codument/.lifecycle-write.lock`目录；单文件Decision writer使用目标旁的`.<file>.write-lock`，并非所有writer都会取得全局锁。因此完整archive不能仅凭全局锁声称已排除所有领域写入：受影响的单文件发布还应配合该文件锁，并在首次发布前/完成后重查整个相关source集合。新文件等独立编辑不参与全局锁，漂移时保留它、恢复本次已发布目标；不可用整目录快照覆盖第三方新增内容。

summary与memory也纳入首次提交前的提案和备份，不延续旧的“先move并删除恢复材料，再生成summary/memory”顺序。既有summary冲突不能静默覆盖；memory同路径同内容可以幂等，异内容必须冲突，而不是旧代码的“存在即跳过并报告已promoted”。这些是准确性/可恢复性纠偏，不是新增自动晋升开关。
