# 新版 depa-codument 五类真实 E2E 编码能力分析

日期：2026-09-12  
范围：Todo、Stream Pipeline AI Agent、Blog、Ecommerce、Nested Mission 五类 case；Todo 与 Stream 的第二次独立运行用来观察重复性。候选固定为 R3；正式模型为 `gpt-5.6-terra`、reasoning `medium`。

## 结论

现有证据不能证明“模型本身的编码智力相对旧版下降”。旧、新 E2E 不是受控 A/B：旧 runner 默认模型为空、验收偏文件/脚本/自测存在性；新版固定 Terra，并加入随机 HTTP、真实服务、fresh reviewer、真实浏览器、源码不漂移与 hook 耗尽门。新版通过率因此主要衡量更严格的**完整交付收口能力**，不是单纯代码生成能力。

但日志确实证明新版架构存在一种真实的有效能力下降：**路由已聚合为单 CLI SkillApp，执行状态机仍主要由模型解释长文并手工驱动；新鲜会话之间又缺少精确、机器可读的交接投影。** 结果是模型把大量注意力消耗在发现 Track、解释协议、调用生命周期命令和补结构证据上，业务代码的端到端完整性、UI/异步边界和模型—实现一致性在最后阶段才暴露。

所以问题不是“单 SkillApp 不如多个 Skill”，也不是 GapLoop/AttractorCheck 过多；真正下降的是：

```text
有效交付能力
= 原始代码生成能力
- 控制面解释与手工编排负担
- 跨 actor 交接信息损失
- 过晚到达的真实业务反馈
- 测试合同与产品合同偏差
```

五类 case 都产出了实质代码；失败集中在 last-mile integration/closure，而不是完全不会写代码。

## 先排除错误比较：新版测得更严格

旧 modeling/engineering E2E 的评分对“有源码、测试文件、脚本成功、delta 文件存在”直接计分；安全维甚至以文件名是否含 auth/validation 等词作为部分证据（`e2e/modeling-engineering/score.ts:190-210`）。它没有从浏览器验证 Todo/Blog 的实际交互，也没有随机跨用户业务 oracle。

旧 Stream verifier 主要检查固定文件、grep RxPY/OpenAI/readline 关键词，然后运行被测 Agent 自己写的 pytest（`e2e/project-implementation/stream-pipeline-ai-agent/verify.sh:79-133`）。它不能发现新版 reviewer 复现的“整个模型 turn 完成后才打印”问题。

旧 Nested verifier 检查 Mission/Track 关键词、`bun test` 和业务源码关键词（`e2e/nested-mission-agent/verify.sh:15-38`），不启动双服务验证库存、支付、取消。新版补充诊断实际证明两仓 HTTP 业务可运行，但正式试次仍因 descriptor 合同不匹配失败。

旧测试还存在 workload 差异：Todo/Blog/Ecommerce 的实现提示只要求“最小但可运行”应用（各 `e2e/modeling-engineering/*/implement.md:5`），旧 Ecommerce 明确允许拆成 core/payment 子域；新版要求单次交付完整 REST、真实 UI、权限、恢复与异步语义。旧 runner 的 `MODEL` 默认未指定（`e2e/modeling-engineering/run.sh:37-44`、`e2e/project-implementation/run.sh:10-16`），新版固定 Terra/medium（`project/e2e/runtime.ts:7-8`）。因此不能用本轮 2/7 反推旧版到新版的净下降百分点。

## 五类 case 的失败性质

| Case | 观察到的代码能力 | 最终未通过的直接原因 | 主归因 |
|---|---|---|---|
| Todo | 两次均能生成完整 API/页面；Todo 1 首次通过，Todo 2 最终纠偏通过 | Todo 2 attempt 0 没找到已批准 pending Track而另建 Track；attempt 1 的真实 UI 出现 await 后 `currentTarget` 失效及 `innerHTML` 注入 | 状态交接/发现缺口 + 自测缺少真实浏览器语义 |
| Stream | 两次都完成 RxPY 分层、SDK adapter、工具循环并让自测通过 | 第一次不是实时终端流；第二次同步 `create()/stream()` 抛错逃逸，未进入分层 error fact | 长规格下的 integration closure 不足；测试只覆盖组件/迭代期异常 |
| Blog | API、认证、状态机与测试基本完成 | 缺作者草稿编辑 UI；Modeling 声明 `passwordHash`，实现却丢弃密码；评论 UI 也不完整 | 为完成流程/后端收缩了 surface 范围；模型与代码 authority 未持续调和 |
| Ecommerce | 已实现领域主干，自测通过；5轮 GapLoop连续找到并修复金额、库存、支付幂等问题 | 第5轮仍有真实修复，按 `max_rounds=5/on_exhausted=block` 正确停止 | 需求密度过大且真实领域边界反馈到达太晚；不是 hook 导致错误 |
| Nested Mission | 两仓代码、测试、Mission/Track 关联及补充真实 HTTP 诊断通过 | 前两次规划分别缺 modeling/engineering delta；最后输出 `argv` 而 runner只接受 `command` | 规划提示/验收合同不对称 + 多 actor 编排负担；原始编码不是主要失败点 |

## 根因一：Track authority 存在，但交接 projection 丢失

这是最明确的产品/集成架构问题。

- 新 runner 把 planning 与 implementation 放到 fresh session，并只告诉实现者“Plans are approved”（`project/e2e/workload.ts:187-199`），没有传 planning receipt 的 Track ID、stage、directory 或 next command。
- `impl-track` 无 ID 时指导 Agent 调用 `depa-codument list --json`（`project/packages/product-capsule/src/templates/agents/global/skills/depa-codument/operations/impl-track.md:36-40`）。
- 但当前 list projection 明确不显示 pending Tracks（`project/e2e/workload.ts:90-101`）。Todo 2 因此判断没有 Track，另建 `add-todo-application`，原批准的 `implement-todo-application` 保持 `new`，外层在 `workload.ts:102` 拒绝交付。
- 旧 implement prompt 反而明确要求从 `codument/tracks/pending` 或 `active` 下读取唯一 Track（`e2e/modeling-engineering/todo/implement.md:1`）。新版通用提示丢掉了这个稳定交接指针。

DEPA 判定：`track.xnl` 是 versioned repository authority；`list` 是 derived observation。执行 Actor 却把不包含 pending 的 observation 当成完整 authority discovery，属于 relation/适用边界未表达清楚。问题不是多个 owner，而是 projection contract 与 consumer 假设冲突。

影响：浪费一次完整实现 attempt、制造重复 Track、使后续纠偏同时背负两个生命周期对象。它直接降低跨会话持续编码能力和首次通过率。

## 根因二：CommandOperation 标准化了入口，没有标准化执行 Processor

全局 Skill 的职责声明是先 `depa-codument -h`，再通过命令读取完整 operation（`project/packages/product-capsule/src/templates/agents/global/skills/depa-codument/SKILL.md:24-29`）。这个固定根、动态加载方向本身没有失败证据；Todo 1 首次通过也说明单 App 路由可工作。

问题在下一层：`plan-track`、`impl-track` 等顶层命令主要返回一大段 SOP，CLI 没有把“选哪个 Track、当前 ready task、需加载哪些引用、哪个 hook 已有有效 receipt、下一条合法 transition”投影成一个紧凑的机器执行包。`impl-track` 文档仍要求模型手工完成 Track 选择、完整上下文加载、DAG 调度、task transition/completion、hook/fresh 协作与最终 lifecycle（例如 `operations/impl-track.md:36-82`）。

观察量：七个正式 run 的 Agent 记录共有 508 条 shell command，其中 371 条（73%）包含 `depa-codument`，284 条（56%）包含显式文件查找/读取；单 run 为55–112条命令。当前 operation 大小约为：plan-track 34KB、impl-track 16KB、plan-mission 11KB、impl-mission 21KB；Stream 原需求自身另有21KB/613行。

DEPA 判定：CommandOperation 目前更接近“instruction Data + 输出 Effect”，真正的 workflow Processor 仍在不稳定的自然语言 Agent 内。CLI 拥有状态 transition effect，却没有提供足够的 canonical processing shape；每个 Agent 会话都重新组装 outer input → resource discovery → lifecycle commands → hook execution。这会放大行为方差，而不是获得 CLI 标准化本应带来的确定性。

## 根因三：上下文经济性差，业务注意力被控制面稀释

七个正式 run 的观察输入为85,217,000 token，其中79,704,320为cached input（93.5%）。这不是完整账单，也不能单独证明因果，但与大量重复读取、CLI/SOP调用和fresh纠偏日志方向一致。Todo 2用了112条命令，Nested 91条，Stream 1用了98条。

需要保留 fresh/GapLoop/Attractor 的独立性；问题不是这些检查花 token，而是每个 Actor 在进入业务问题前，反复重建同一大段控制协议和资源定位。当前没有 task-specific ContextView：把当前 Track ID、ready leaf、acceptance闭包、代码映射、配置hook、有效/失效receipt及外层失败压成带hash的最小投影。

结果模式很一致：局部模块和自测能完成，但跨层细节被漏掉——Todo 漏真实DOM语义，Blog漏编辑工作台，Stream漏UI实时性与 iterable 创建前异常，Ecommerce在最后hook才连续暴露领域边界错误。

DEPA 判定：不是“少读文档”问题，而是 Data projection 粒度错误。当前把完整标准正文和零散资源交给 Actor自行拼 closure；应由确定性 Processor 生成来源可追溯、可失效、按当前任务收敛的 ContextView。

## 根因四：结构验证早，真实业务反馈晚

新版 CLI 对 XNL、lifecycle、Modeling/Engineering 结构的验证很强，但这些检查不等于浏览器、异步时序、权限或领域不变量。runner 只有在实现者宣称交付、Track completed、脚本成功之后，才进入独立 business oracle、fresh review 和 UI gate（`project/e2e/workload.ts:200-231`）。

因此 Agent 的自测容易形成局部假绿：

- Todo/Blog 页面测试主要覆盖源字符串或简单函数，真实浏览器才发现交互缺失/注入。
- Stream 测试覆盖 projection 与 generator 迭代异常，没有覆盖真实 shell 输出先后关系和调用 iterable 之前的同步异常。
- Ecommerce 的普通测试通过后，GapLoop仍连续找到价格/折扣快照、映射、跨订单 paymentId、安全整数等问题。

GapLoop并没有降低编码能力；恰恰是它揭示了局部自测未覆盖的实际错误。下降来自“反馈延迟”：高价值 oracle 只在大批代码和大量 workflow 状态完成后到达，纠偏半径大、轮数消耗快。

## 根因五：合同在 request、acceptance、operation、Track 与 harness 间发生漂移

当前至少存在六类信息面：原始 request、新版 acceptance、全局 operation/reference、项目 attractor/config、Agent生成的 Track/Modeling/Engineering、runner隐含断言。它们的最终裁决关系没有全部机器化。

两个直接证据：

1. Nested planner提示要求Mission/Track/绑定，却没像普通Track提示那样明确要求每仓 modeling/engineering delta（`project/e2e/workload.ts:187-191`）；外层验证却对每个 Track强制三类delta（`workload.ts:128-130`）。前两次attempt仅为补这两项，挤掉真正实现预算。
2. Nested acceptance写“`e2e-server.json` command argv”（`project/e2e/cases/nested-mission-agent/acceptance.md:7`），没有给普通HTTP case那样的明确 `{ "command": [...] }` schema。Agent合理地产出 `{ "argv": [...] }`，业务诊断通过但正式runner拒绝。

Blog 的 `passwordHash` Modeling 与实际实现不一致则是另一方向：计划数据被当成目标 authority，但实现后的差异没有在任务级持续reconcile，直到最终fresh reviewer才发现。

DEPA 判定：这些不是简单文案错误，而是多个 projection 对同一交付合同的语义没有单一编译/验证边界。request应是业务目标 authority；acceptance/harness是可执行验收合同；Track/Modeling/Engineering是从二者派生并在实现后调和的版本化计划，不能各自独立漂移。

## Harness 因素：会压低观测通过率，但不能解释全部失败

应从产品能力中单独分账：

- Stream 1 attempt 0是Python发现问题，attempt 1是reviewer在交付目录创建venv触发源码漂移；真正产品失败在attempt 2的实时输出。
- Blog attempt 0被中间`Reconnecting`误判失败，attempt 1遇到归档选择/知识校验路径问题；attempt 2才暴露真实UI/模型差距。
- Nested前两次存在planner提示与validator不对称，最后有descriptor措辞歧义。

所以2/7不是纯产品编码通过率，不能据此定量声称“下降71%”。但即使剔除这些干扰，也不能把复杂case判为通过：Stream、Blog、Ecommerce各有独立复现的真实实现缺口。没有反事实重跑，不能计算一个“校正后通过率”。

## 对“单 global SkillApp”设计的判断

目前没有证据支持退回15个独立Skill。新版global SKILL的description能承接旧名称，CommandOperation可动态发现，Todo 1证明路径可用。global固定根和workspace `codument/`项目资产分层也不是失败来源。

真正偏差是：迁移把**入口和文档位置**合并了，却还没有把旧skills隐含的“带明确目标进入某个操作”升级为机器可传递的 operation invocation。新的command看起来像命令，实质仍是让Actor读取SOP后自行扮演完整workflow engine。合并本身没伤害能力；缺失的执行契约使聚合后的认知负担集中到一个会话。

## 建议的改造优先级

1. **先修交接，不改质量机制。** `plan-track`完成后输出稳定receipt：`trackId/stage/directory/sourceHash/nextCommand`；runner/host下一Actor显式传receipt。增加能覆盖pending/active/archived的精确`track resolve <id>`或`track candidates --stages pending,active --json`。禁止用默认list的局部projection推断“没有Track”。
2. **把CommandOperation推进为可执行Processor。** 增加`operation prepare/continue <operation> [resource-id] --json`式的执行包：当前authority、ready node、allowed transitions、适用reference列表及hash、hook配置/round/有效receipt。AI仍负责业务判断和代码，CLI负责确定性状态投影与机械推进；不把业务代码搬进server。
3. **提供task-specific ContextView。** 只投影当前leaf所需request/acceptance/behavior/modeling/engineering/code-map与失败反馈，保留可展开来源。目标是减少重复协议装载，不截掉验收、不缓存fresh verdict。
4. **把真实oracle前移到phase/task。** UI smoke、stream timing、同步异常、金额/幂等/库存不变量应成为对应Task acceptance命令或phase gate；最终fresh reviewer和GapLoop继续保留。这样相同准确性检查更早反馈，减少最后阶段大半径返工。
5. **统一合同编译边界。** case/真实项目先从request+acceptance生成机器可校验的DeliveryContract；Track/Modeling/Engineering引用其criterion ID。Nested descriptor使用明确schema和CLI validator；planner所需delta与outer validator来自同一配置projection。
6. **再做受控A/B。** 用相同Terra/medium、同一request、同一acceptance/oracle、同一attempt与hook策略，比较旧多Skill入口与新单App入口，每类至少多次。分别报告raw code completion、workflow completion、business oracle、fresh review、UI五级结果，才能量化架构净影响。

## 不应采取的修复

- 不删除或减少GapLoop、AttractorCheck、fresh review、真实浏览器来提高通过率。
- 不把所有operation全文重新塞进SKILL.md，也不恢复每项目复制std。
- 不通过增加outer attempt或hook round掩盖低收口率。
- 不把Nested补充HTTP诊断晋升为正式PASS，也不把harness失败全算成产品失败。
- 不为单个case在公共CLI写业务特例；修复应落在交接、ContextView、合同schema和workflow Processor这些可复用机制。

## 最终判断

新版 `depa-codument` 的**原始代码生成能力没有被日志证明显著下降**：所有case都生成了可运行主干，Todo最终2/2，Nested真实业务诊断通过，复杂case的大量自测也成功。

被明确证明下降的是**从规划到完整交付的有效带宽和稳定性**。首要责任顺序为：

1. stronger oracle造成的表观落差（比较口径变化）；
2. pending Track不可从默认projection发现且fresh handoff不带ID（真实架构回归）；
3. CommandOperation仍是长文SOP而非机器化执行Processor（真实架构缺口）；
4. 控制面上下文过重、task-specific closure缺失（高可信放大因素）；
5. 真实业务反馈过晚与自测oracle不足（真实编码收口问题）；
6. nested/harness合同不对称与早期runner缺陷（测量干扰）。

最值得先修的是1个小而承重的垂直切片：`plan receipt → explicit Track resolve → impl execution packet → task-level external oracle`。它不改变global单SkillApp和resource-first workspace设计，也不牺牲任何准确性机制，却能直接减少重复发现、错Track、长文重读和过晚纠偏。
