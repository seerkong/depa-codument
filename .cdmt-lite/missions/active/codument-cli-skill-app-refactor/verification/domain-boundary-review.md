# 领域首切片的实现期复核

历史首切片记录；Round30当前领域兼容与剩余边界见[领域子集验收](domain-capabilities-round-30.md)。下文的“尚未”仅描述当时，不替代loop工作图。

本文件为实现者自检，不是最终 fresh independent review。当前节点仍 active。

## 已形成的实际边界

| 包 | 已有实际职责 | 仍欠的领域能力 |
|---|---|---|
| domain-contract | 完整树生命周期、验证/仓储 ports、receipt、registry owner/路径/冲突数据、9 类实验 Kind descriptors | 完整领域协议与稳定版语义契约 |
| domain-logic | 生命周期状态提案/纯语义校验、verification processor、操作编排、递归 registry 索引、保守 node merge、Behavior 校验/native proposal、Decision forest 校验/frontier | 其余 registry/config、晋升/归档/历史转换完整规则 |
| domain-support | 显式 workspace 的 verifier/process/receipt IO、递归源文件 snapshot、生产 lifecycle repository/CAS/协作锁/回滚 | migration/recovery ledger 与完整产品组装 |
| domain-capsule | 单实例 admission、同资源串行、关闭 drain、显式 release | 默认 product runtime 装配（端口实现就绪后） |

四包均有真实源码及目标测试。当前 product 命令尚未绑定新 operation，旧 src 不变，不能算旧命令矩阵已迁入。

## 事实与验证

- 资源 owner 的输入为带 revision 的完整树快照；processor 克隆输入，不就地修改 source。
- 验证完成才生成 DONE 提案。未完成 TaskGroup 在启动 verifier 前拒绝；正式 commit 仍要求比较 sourceRevision。
- capsule 的初始 CAS 负例使用注入 test repository（历史 E064）；E076 已增生产 repository 与真实文件/故障/子进程测试。当前外部 consumer 99148 已实际使用 production repository + strict lifecycle codec，验证真实 verification→CAS→保真 patch；验证期间的源变化保持而拒绝提交。
- verification 的 old v1 content key、命令后观察、fresh/cache 语义保留。Git dirty/eligible untracked 与缺失 tracked 路径参与 fingerprint；receipt 文件与选中 Track 的控制面排除保持。
- registry source map 保留精确原文；read model 的 files/index 与来源 owner/path 单向关联。duplicate-id/duplicate-slot/syntax/missing-id 阻止 ready。部分有效 index 仅用于诊断，不可据此覆盖冲突源。
- node merge 仅接收显式选中的 identity-owned nodes；不接受缺 ID / 非 DataElement 后默默删掉。默认冲突仍人工处理，显式策略保留。

## 新发现：parse 不等于源码保真

`xnl-core@0.1.12/src/parser.ts` 使用 `skipWhitespaceAndComments`，公开 options 仅 textBlockStyle，没有注释保留选项。
所以 raw source → AST → formatter 会丢源码注释，虽然 formatter 可以输出显式给定的 Comment 节点。
当前实现完整保留 source map 并明确 formatter 不是 patch writer；还没有用该路径改任何正式资源。

E073 通过 token 位置补丁和同一 parser 前后语义核对，已证明生命周期 scalar/ID 写入的原文保真。E076 文件 writer 直接写精确 UTF-8 字节，不用自动添加换行的 Workspace.writeTextAtomic；保留 mode、拒绝非法 UTF-8。结构/元数据变更仍拒绝写入并要求 review，尚不是通用 migration writer。
不能为赶上节点完成而删原注释测试、强称 parser 已保留注释，或以“语义等价”覆盖用户原文。

## 后续观察方向

- compiler directory catalog 支持显式 `entry="track.xnl"`、`scope="root"|"children"`，无需为了发现把每条 Track 改名为 manifest.xnl。
- single-file catalog 当前只枚举指定目录，不递归；Decision forest 支持 documentCardinality=many，但嵌套 owner 的递归索引仍由领域 read model 负责。
- E071 九类 Kind 的非空 membership、typed projection、来源与契约错误已实测；仍为 experimental/structural，不冒充完整 semantic validators。
- 历史 metadata parser、一般结构保真写入与 semantic validators 仍是未完成依赖。新旧入口最终必须委托同一 operation，不长期运行两套可写实现。
- 本地 repository 锁序列化协作写进程，不锁住任意外部编辑器或整个 ProjectRef 分布式系统。源字节在最终 rename 前再查；回滚失败保留 journal 并阻止新写；已经发布后的清理失败不谎报成未提交。migration/crash recovery 仍待单独实现和验收。
- 新 Track/Mission validator 不再生成 XML DTO，profiles 通过输入观察；新增缺失观察 warning/strict error，不削弱已配置 AttractorCheck。Behavior 提案使用完整 AST 的原生 checked mutations，不经过丢未知属性的旧 XML DTO；尚无通用源文件 writer。
- Decision 校验显式接收多文件原文，保持父子/引用/环与 options/answer/durable gate。frontier 复用同一验证结果，修复逻辑 URI lookup；未隐式增加或宣称 activation 运行期调度已实现。
- modeling 尚未迁入。旧 schema 的强制七级 fact_grade 不符合当前 DEPA 开放 authority 判据，不能盲目复制；D12 要求保留历史字段，区分兼容输入与新作者合同，不自动猜测 role/model/owner。
