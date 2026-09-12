# Token/上下文成本优化设计

## 证据与假说

本轮测得模板 `std/` 61 文件、354,457 bytes；薄 Skills 17 文件、18,391 bytes。`impl-track.md` 32,002 bytes，`plan-track.md` 32,905 bytes。文件大小不等于真实 token 使用，不能据此宣称已经节省。

已观察：impl-track:94 的必读列表较广；impl-track:109 与 :121 的中断恢复叙述还存在默认续跑/问答的重复分支表达；fresh reviewer 会需要独立合同闭包。优化重点是精确路由、移除语义重复和减少无关材料重复注入。

已有 fingerprint receipt 缓存应继续使用，先检查失效覆盖再考虑扩展，避免增加另一套证据 authority。

## 任务上下文投影

ContextView 字段草案：当前目标/task/frontier、适用 acceptance、适用规则/attractor/hook IDs、必要资源 URI 与 source digest、可读摘要、最新有效 receipt 引用、已知冲突、下一硬边界、展开入口。

- L0：当前任务与适用项索引、进度和出处；默认不嵌完整 archive、全 workspace 规范。
- L1：执行当前节点必须读取的合同/协议/代码证据闭包；对应 source 内容缺失不得靠摘要通过。
- L2：历史推理、完整 owner/跨项目背景按真实信息缺口展开；所有原文保留。
- 缓存键至少涵盖 task/goal、source closure 的内容 digest、manifest/Kind 版本、hooks/profiles/操作协议版本与生成器版本。成员新增/删除也影响 closure，不能只 hash 旧列表。
- 当前代码/配置或证据前提变化，相关 view 和 receipt 重新检查。语义 review 的 freshness 不由 generic cache 决定。
- 预算超限只报告并优先去冗余；必要合同可超预算展开，不截断验证依据。

这里的 ContextView 只承担投影与导航。默认不建设大型 RAG、全局 evidence graph、新的权限/锁平台。

## Operation 优化

1. 薄 Skill → 当前 operation 路由 → 按事件章节/独立子协议；把重复 invariant 放唯一协议，调用处保留触发与参数。
2. 机械 ready/frontier、版本/配置解析、receipt/资源摘要使用已有确定性 CLI 数据，AI 负责语义判断；不把每次读写/思考变成 CLI grant。
3. compact 输出采用明确选项或新 API，旧 JSON 保持兼容。成功返回必要字段和详情引用；错误必须保留 diagnostics 与可恢复上下文。
4. continuation 只记录当前位置与证据引用，可重建、不再另写正式 task status。
5. archive 建立短索引，完整历史仍存；不把“最多一个 decision/lesson”的评审建议变成会丢业务语义的配额。

## 检查保真

同 fixture、同配置，比较两版展开的检查计划：hook 点、顺序、profile、round cap、on_exhausted、verify_round、HumanConfirm 以及 fresh context 要求必须一致。

GapLoop 与 AttractorCheck 的职责和判定保持独立。同 hook 点不能因为引用同一 attractor 就合并执行或用一个 verdict 替代另一项。

fresh reviewer 可以读紧凑索引，但必须独立读取它实际适用的 source；不能仅接收实现者总结。确定性命令 receipt 可按有效前提复用，fresh semantic check 仍重做。

## 测量合同

固定场景：小改动、Track 初次实施、Track 续跑、Mission 下一 leaf、配置 GapLoop+Hook+AttractorCheck 的高风险改动、旧资源 migration review。

每场景固定任务、source fixture、hook/profile、读入顺序和原文可访问性；记录加载文件/章节、重复字节、必要 contract coverage、CLI 输出、验证调用/轮数及故障检出。基线不能以“读全部 354 KB”虚增；依当前 operation 实际要求构建可审计读取轨迹。

规划验收目标：前三个常规场景的必需协议/上下文总输入量中位数至少下降 25%，六个场景必要合同覆盖与机制保真 100%；高风险场景允许更少节省但不得缺检查。该阈值是待用户确认的目标，当前没有达标数据；基线若证明不合理，记录证据后重规划，不能通过降低检查来凑数。

计算口径固定为每场景 `reduction = 1 - after_input / before_input`，取前三场景 reduction 的中位数；同一来源重复读入按实际读取次数计入，不能只对去重后的文件集合计数。before_input 必须大于零，基线读轨迹在优化前冻结。

本地固定 tokenizer 可用时记录其名称/版本与 token 数；不可用则用 UTF-8 bytes 和重复读取率作为代理，报告必须明确是代理。只有取得同模型/配置的真实会话 usage 才报告实际 token/费用减少，不安排额外付费 benchmark。

故障对照至少包括：过期 receipt、遗漏 hook、错误 profile、缺 acceptance、隐藏业务差距、变更 source 后缓存未失效、未知 migration extension。缺陷检出不低于旧方案；为测试通过而删负例判失败。
