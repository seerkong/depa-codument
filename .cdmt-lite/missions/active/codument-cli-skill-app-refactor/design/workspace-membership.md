# Workspace membership：作者声明与编译输入投影

Round31，实施边界补充；不改变 MISSION/Attractors，不解冻三个产品命令。

## 观察与裁决

compiler 0.3.0 的 `catalogFiles` 只读一层；Directory 的 root/children 是所有权形状，不是递归开关。Manifest 的嵌套 Catalog 需要每层实际作者 manifest。知识目录的每个中间层并非资源 owner，因此不能为递归而制造实体、复制 Kinds、长期维护生成 manifest，或伪造 compiler tree。现有 knowledge-kinds 测试明确记录了浅目录零资源的缺口。

选择扩展 Halfcode Host 已有 read-port 源投影：显式 `hostTraversal = "recursive"`，由 Host 展开为 compiler 原生 Catalog；没有该属性时保持旧行为。通用实现只在 Halfcode canonical 包；Codument 经新 tarball 消费。原生 compiler 继续拥有 envelope、identity、schema、source shape、required files、reference 和 tree authenticity。

## Authority 与职责

- workspace manifest 拥有 membership 的声明；目录与资源文件拥有实际成员和正文。
- Host logic 用显式 ResourcePackageReadPort 观测声明内的目录，产生临时展开视图；不写来源，不另建 registry，不决定 Codument 路径/状态。
- Host support 将展开视图与现有内置 Kind 虚拟源组合，交给真实 compiler。所有记录保留物理 manifest digest，并区别标记 Host catalog projection；资源路径仍指向物理文件。
- Codument installer/模板声明业务集合；领域 membership 审计比较同一集合，负责孤儿、历史集合和 active context 的产品语义。code-first descriptor 仍受原有 membership 等值检查，不能独立重述同一资源。

## 窄协议

只对 App 根 manifest 的 Catalogs 支持该 Host 扩展；不把 compiler 的 scope 改为新的枚举。

- single-file：递归每个可见目录；entry 存在时只选该文件，否则选原生 `.xnl`/`.md`；可显式 `hostExtensions = [".xnl"]` 缩小文件后缀集合。非匹配普通附件不是资源。
- directory：必须 scope=root 与明确 entry；找到 entry 即到达 owner，不继续扫描 owner 的附属目录。中间目录无 entry 可以继续；entry 存在但类型非法必须失败。
- manifest：本轮不扩展递归，继续原生嵌套 Catalog；KindDefinition 不允许递归扩展。
- 根目录缺失、路径越界、符号链接、重复/非法目录项、未知属性值、非法扩展组合均失败；点目录/点文件不参与可见递归集合。保留范围内未知 XNL 到 compiler 报错，不按解析成败筛选资源。
- 空集合仍生成指向 Host 私有虚拟空目录的原生 Catalog，强制 Kind 与 source-shape admission；不能让未知 Kind 因为空而通过。
- 生成 ID/虚拟目录保留给 Host；碰撞失败。每次 snapshot 从来源重建，成员增删自然改变编译输入与 revision。旧物理 manifest 不被格式化反写。

## 验证与接续

### Codument 聚合边界补充

正式独立成员是 pending/active/archived Track/Mission、durable behaviors/decisions/modeling/engineering 及四个业务 config。process 的 behavior_deltas、decision working/canonical forests、knowledge_deltas 是该 process 拥有的语义输入 closure，不作为第二份 durable registry 或独立 Catalog owner；资源检查在相同 process owner 下递归验证它们。普通 reports/fixtures/Markdown 不是暗中声明的新资源。

产品审计复用原领域 source ports，以确定的正式根观察应有成员，再与作者 manifest 实际发现集合比对：漏收为 orphan，独立领域资源声明在错误归属位置为 misplaced。不能通过移除 Catalog 消除领域校验错误。knowledge 与 decision 沿各自原 validator 保留 warning/error 分级；lifecycle 使用原 strict 规则，不将合法空知识 registry 的提示擅自提升为安装失败。

一次检查做 source→Catalog→source，比较前后成员/源 hash/必需文件存在性，且逐 owner 比对真实 compiler authorityDigest；这不宣称阻止任意编辑器在检查完成后的变动，也不缓存 fresh agent 判定。源码尚不被任何暂停 CLI 命令调用。

公共最窄证伪：嵌套非空成员、源 digest/路径、动态增删、重复身份、空未知 Kind、非法路径/链接、owner 边界、旧浅行为及 code-first membership 回归。随后上游完整 check、公共制品与三消费者、Codument core App 非空/孤儿/多 workspace/无 Serve/内部 installer/Skill 路由。只有已测试范围记 PASS；完整 CLI 初始化仍 DEFERRED。
