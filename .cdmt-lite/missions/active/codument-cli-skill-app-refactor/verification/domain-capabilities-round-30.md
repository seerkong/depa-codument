# 领域能力子集验收（Round30）

这是实现期证据索引，不是最终fresh independent review，也不是第二套工作图。执行状态以loop.md为准。

## 已验证边界

冻结0.5.4基线共53个command paths，排除12个不可执行group后为41叶子：32领域叶子已接入同一本地domain owner；6迁移叶子由后继migration节点承担；init/status/upgrade-workspace继续USERgate，不伪称已兼容。

| 能力族 | 叶子数 | 主要实际证据 |
|---|---:|---|
| Track lifecycle/create/verification | 7 | domain-commands、domain-scaffold；真实命令后--参数、fresh/失败不提交、源与context CAS |
| Mission lifecycle/create/bind/archive | 6 | domain-commands、domain-archive；外部ProjectRef、修订与全部promotions同恢复边界 |
| Decision forest/create/frontier | 3 | domain-commands、decisions；完整祖先owner、唯一identity、原文与引用 |
| 本地ProjectRef绑定 | 3 | domain-commands；原始数组JSON、相对根、无真实外部写入 |
| list/show | 2 | domain-query；显式content、递归读模型、失败不返回部分成功 |
| BehaviorPatch create | 1 | domain-scaffold；native空草稿不冒充semantic verdict |
| validate/std lint | 2 | domain-validate/domain-std；strict、原mixed JSON及文本例外 |
| modeling/engineering | 6 | domain-knowledge；开放/legacy schema、owner/profile三方合并、原文/未知字段保留 |
| Track archive/artifact sync | 2 | domain-archive/domain-artifact；目标确认、binary/mode、协作锁、独立编辑保留、恢复材料 |

`capabilities --scope domain`实际执行225tests/1931assertions/48files（E240），逐项输出上述32命令与9个DEFERRED；无scope仍拒绝完成声明。最终root575tests/5367assertions/115files、typecheck/lint（E241）；architecture339/2622（E235）。

## 制品与独立安装

公共R16 digest `3e28f0c8207d19076ba2c26c48034e02202c1d8c68ce8aec6359bfee1675524c`；C候选 `round-30-full-archive-product-artifacts` digest `02b3c5eaf1b65e765c8f31b350a9addbaeada83b6d91f98c0b80fd6b9a27a628`。

普通包源解析后关闭registry，204 installed domain tests/1536assertions/40files及strictTS、32旧CLI叶子、native/旧完整lock/Page/Vue/MCP/owned close通过E238。同候选Bun1.3.0 Notes/H/C通过E239。真实npm发布、其它OS native和真实browser未执行。

## DEPA与非承诺

- contract拥有输入、源快照、提案与receipt；logic负责语义和纯晋升/patch；support持有受限IO和来源guard；capsule负责admission/drain；adapter只持有CLI协议，product明确装配。没有领域HTTP旁路。
- 原文是authority；AST/index为派生。Git blob为不可变历史输入；archive journal/backup为恢复材料，不是第二套当前状态。所有晋升先提案、后同恢复边界发布。
- 新source writer保留当前source外部注释、未知复合字段和完整新知识主体。显式替换的Behavior子树按native语义替换；原delta仍留在归档，不承诺把每条delta-only注释复制到既有canonical节点。
- 协作锁与前后源guard不等于任意编辑器OS级atomic CAS；崩溃不自动恢复。不完整rollback保留journal/backups，正常CLI不会偷锁或覆盖独立编辑。
- 结构Kind admission不等于完整业务校验。自动递归membership、真正workspace SkillApp、安装Skill路由和历史migration仍由后继节点验证；本子集不把浅Catalog空结果当App成功。
- 旧src/真实codument/用户attractor保持基线664项零变化（E234）。旧入口退役、dogfood升级、三命令组合均未提前进行。
