# Loop: Codument CLI Skill App 与可复用 Host 重构

Status: active
Round: 47

本轮模式：用户已授权检查点提交及依据E310自主优化。检查点ce0f2cb，author kongweixian <kong_weixian@163.com>。优先精确交接、只读执行上下文和前置真实行为验证；代码在原仓库，测试/构建在/tmp副本。Round45七个终态试次及限额保持，新候选使用fresh trials；不安装global或升级原dogfood。

期望态：[MISSION.md](MISSION.md)。证据：[evidence.md](evidence.md)。本图是唯一执行计划/状态投影；名称为人机交接主标识。

> 固定纪律（勿删）：节点完成 ≠ 回合结束。更新本文件后，同一回合继续取下一个「当前可做」节点；停点只认：验收全过 / 硬中断（工具·宿主·用户强制）/ 卡住（缺输入、不可逆选择）。不因「做了一段」而回头汇报。

## Work graph

### 嵌套绑定忽略契约与确定性错误定位

- Status: done
- After: 固定E2E规划检查策略并校验实际挂载
- Covers: 期望-4, 期望-10
- Verify: project bind真实新仓忽略规则、保留用户gitignore、精确失败消息；隔离完整回归及后继fresh Nested，不恢复4Qt0XU。
- Outcome: 确定性绑定检查在规划后、实现前及最终验收复用同一入口；先让失败抵达正确纠偏目标，不让无上下文AssertionError引发无关业务修改。
- Done when: 找到忽略契约owner并修复真实缺口、正负测试通过；旧失败/轮数完整保留。
- Evidence: E333错误边界失配；E335显式privacy Effect、真实Git正负例/早期两仓检查、最终693tests/typecheck/lint/native/PpXqEq smoke通过。后继fresh业务仍需测量，不更改原终态。

### 固定E2E规划检查策略并校验实际挂载

- Status: done
- After: 缺失结论核对原始文件边界
- Covers: 期望-4, 期望-10, 约束-4, 约束-21
- Verify: 单一E2E策略派生planner交接、snapshot与实际Track检查；缺失/错参数/嵌入无效scope/删除/重复检查负例；跨仓及未执行backlog仅检查声明，不强迫完成；完整回归后新试次，不改活动run。
- Outcome: 明确E2E选择每Track一个末phase GapLoop(max5/block/verify_round=false)和coding AttractorCheck，保留独立verify；不修改产品auto默认或既有项目配置。规划前传选择，规划后及实施后验证，避免用更少实际检查宣称等强度节省。
- Done when: producer/observer共用同一策略，resume不悄然给旧run换政策；源码与隔离验证过线，后继测量明确新策略身份。声明检查不冒充实际fresh执行证据。
- Evidence: E331比较策略偏差；E334单一producer/observer策略、W全688tests/typecheck/lint/native与10项smoke通过。后继试次仍需真实执行检查，未把声明当执行证据。

### 缺失结论核对原始文件边界

- Status: done
- After: 验收执行协议显式交接与校准
- Covers: 期望-4, 期望-10, 约束-4, 约束-21
- Verify: review-probe真实隐藏示例资产及独立pytest；完整回归/Skill闭包；路径存在与确实缺失的独立只读情境，不以过滤清单代替直接检查。
- Outcome: 缺失结论基于目标路径的原始观察，不将rg默认遗漏隐藏/ignored项误认为交付缺陷；真实缺失仍FAIL。
- Done when: 核对义务抵达内部verify和外部review入口、真实校准与回归过线；不自动推翻模型FAIL、不扩大扫描私人文件或重置旧run。
- Evidence: E326原误报保留；E328独立存在/缺失情境、真实review-probe、完整685tests及native smoke通过。只验证观察协议切片，不宣称已消除完整业务验收误报。

### 独立执行角色加载当前操作合同

- Status: done
- After: 让关键操作约束抵达实际入口
- Covers: 期望-4, 期望-10, 约束-4, 约束-18
- Verify: 独立fresh情境从全局入口发现verify并完成目标反推，不递归spawn、不修改实现；相同读取闭包下原样输入负例；新/tmp副本完整check及Skill校验。
- Outcome: 父层交接操作入口/角色/范围，子层自行取得当前指导；父层摘要与命令receipt都不代替子层语义判断。
- Done when: 按需路由与角色边界过线，不复制操作清单、不新增hook/轮数或弱化fresh；真实E2E效果另测。
- Evidence: E324原漏检及不确定边界保留；E325独立Terra前向情境、U完整685tests/7944assertions、Skill校验及native smoke通过。只完成角色交接切片，不等于业务检出效果或净节省已过线。

### 验收执行协议显式交接与校准

- Status: done
- After: 外层执行证据识别与裁决顺序
- Covers: 期望-4, 期望-10, 约束-4, 约束-21
- Verify: read-only agentTurn自动交接同观察器接受的独立成功测试块约束；fake agent负例与完整回归；独立临时Python小fixture真实Terra校准，不计入业务PASS。
- Outcome: reviewer在行动前知道执行证据格式，失败的混合块须单独重跑测试；不放宽heredoc/失败退出守卫，不把infra反馈到业务实现者。
- Done when: 提示和准入合同一致、真正native成功测试可识别、source保护及模型审计通过；之后再取完整fresh测量。
- Evidence: E322原失败保留；E323完整685tests、最终smoke与X01WIQ真实Terra独立pytest/source/model校准通过，非业务PASS。

### 脚手架参数可发现性

- Status: done
- After: 精确规划交接与执行上下文
- Covers: 期望-4, 期望-10, 约束-2, 约束-4
- Verify: domain合同共享模板类型表驱动help和准入；全部十类真实生成、非法类型不写入、help无workspace副作用及完整回归。活动nMEIGO的T冻结，源码改动等待其终态后另验。
- Outcome: help明确scaffold模板子集，不把完整知识schema类型误当模板支持，也不通过放宽schema消除错误。
- Done when: 公共产品合同单一列表，help/renderer/validator一致；成功argv/输出协议不变；隔离验证通过。
- Evidence: E321定向8tests、完整685tests/typecheck/lint、实际native help和smoke通过。模型消费效果另测；活动nMEIGO未使用此候选。

### 精确规划交接与执行上下文

- Status: done
- After: 新版真实E2E框架与无模型smoke
- Covers: 期望-4, 期望-10, 约束-4, 约束-16, 约束-21
- Verify: 隔离副本生命周期上下文、E2E交接负例、完整typecheck/lint/test及候选smoke。
- Outcome: 保持旧list契约；显式Track身份跨fresh会话传递，CLI提供单一authority的只读执行投影；pending不会被误认为无计划。知识规划合同和真实行为验收时机一致。
- Done when: pending/active/archived精确身份、重复/失效交接、任务上下文、配置及hook保留负例通过；fresh review无未解决偏差。
- Evidence: E310诊断、E311授权、E312最终完整check 672pass/7842assertions+smoke10/fresh复检；此节点是机器协议切片，不等于真实业务或token经济性已通过。

### 优化候选真实测量

- Status: active
- After: 精确规划交接与执行上下文
- Covers: 期望-4, 期望-10, 约束-21
- Verify: 新候选fresh todo、stream及其它受影响用例；固定Terra/medium与原轮数，独立业务验收和usage报告。
- Outcome: 用实际执行而非文档字节衡量有效交付；原失败保持可追溯。
- Done when: 新试次有终态、真实验收及成本证据；失败据证据调和，不能重置旧预算。
- Evidence: E313 qUXNoE为UI基础设施终态；aTb63U attempt0因缺必需测试failed，attempt1在gap_round5因原始B/C与三片段内容流测试缺口blocked。两次试次不重置；据此新增原始需求对照/等待/运行时交接源码修正，完整验证后用另一个新候选测量。

### 显式展开适用吸引子引用

- Status: done
- After: 精确规划交接与执行上下文
- Covers: 期望-2, 期望-4, 约束-4, 约束-16
- Verify: profile引用纯投影、disabled/未引用/配置变更负例、CLI context及完整回归，后继新候选fresh测量。
- Outcome: 执行上下文把Track引用的profile映射到明确正文URI，提醒首次实现前读取；既有profile配置仍为authority，投影不增加或跳过hook。
- Done when: 不把只读配置当作加载规范；不激活未配置profile；投影不冒充正文或fresh verdict，测试与fresh复核通过。
- Evidence: E314，完整677pass/7871assertions、配置/正式嵌套与Extension排除负例/fresh复核。真实经济性由优化候选真实测量继续验证，不提前宣称降低token。

### 浏览器基础设施失败分类

- Status: done
- After: 精确规划交接与执行上下文
- Covers: 期望-4, 期望-10, 约束-21
- Verify: 超时和显式基础设施receipt终止而非业务纠偏；真实UI失败仍拒绝PASS；隔离完整回归。
- Outcome: 外部浏览器不可用不触发模型修改已交付应用，未完成验收不能晋升通过。
- Done when: 分类正负例和fresh复核通过，真实工具故障完整保留。
- Evidence: E313原故障保留；E314实际awaitUiGate deadline/坏JSON及receipt身份和产品失败分类负例、完整回归/fresh复核过线。仍无完整真实UI PASS。

### 让关键操作约束抵达实际入口

- Status: done
- After: 保留原始需求到验收的对照, 减少无新信息的子代理等待往返
- Covers: 期望-4, 期望-10, 约束-4, 约束-18
- Verify: skill-creator独立Terra前向情境：等待及短deadline、原样最小输入/非约束示例、已声明权限边界；链接与完整回归；之后新候选真实测量，不追认旧试次。
- Outcome: 共享等待规范单一放到真实会先读的SKILL入口，调用点只路由；原始示例的省略语义与已声明权限边界不被自造fixture或空泛安全承诺替代。完整当前AST不与XNL重复强制装载。
- Done when: 不静态复制operation清单，不新增hook/轮数/通用安全审计，不把示例变成未授权scope；前向情境与源码回归通过，成本实际效果仍单独计量。
- Evidence: E320独立Terra前向正负情境、684tests完整回归、Skill验证和新候选smoke通过；运行期等待/成本效果仍由真实测量观察，不宣称已经实现节省。

### 外层执行证据识别与裁决顺序

- Status: done
- After: 外层验收只读隔离与污染分类
- Covers: 期望-4, 期望-10, 约束-21
- Verify: 同一fresh线程的原生argv/exit记录；变量路径与环境前缀正例，echo/查询/字符串内命令/控制流/其它线程负例；真实FAIL不被证据启发式遮蔽；无证据PASS为infra；完整回归。
- Outcome: 交付判定不依赖展示用shell字符串的错误再解析；不把验收器无法识别证据当业务编码缺陷。
- Done when: 不执行或求值命令文本，不放宽真实PASS要求，不借用别的线程证据；定向和完整验证通过。
- Evidence: E319保留原失败；E320原生同线程准入及伪命令负例、FAIL优先/缺证据PASS基础设施分类、实际旧日志只读回放、684tests完整回归通过。

### 外层验收只读隔离与污染分类

- Status: done
- After: 浏览器基础设施失败分类
- Covers: 期望-4, 期望-10, 约束-21
- Verify: 实际sandbox拒写交付source/build/dependencies但允许隔离tmp与Codex运行状态；review输出不写交付目录；污染错误不进入implementation反馈；完整回归和无模型smoke。
- Outcome: 验收者只能观察已交付authority；测试环境/输出有独立写入位置，不能把reviewer造成的变化当业务缺陷让实现者修复。
- Done when: 只读边界正负例与新分类验证通过，不增加忽略目录、不豁免source fingerprint、不提升旧失败为PASS。
- Evidence: E317保留9JWDGk污染原始记录；E318实际sandbox/fake agent负例、完整681tests/7891assertions及无模型smoke过线。真实新试次测量单独进行，不提升旧PASS。

### 显式交接隔离Python运行时

- Status: done
- After: 精确规划交接与执行上下文
- Covers: 期望-4, 期望-10, 约束-21
- Verify: 精确runtime入口提示负例及隔离登录shell实际执行3.12；之后新冻结harness完整回归，不改变运行中的aTb63U。
- Outcome: runtime预检选择与模型消费同一个明确入口，不依赖被login shell改排的PATH。
- Done when: 不安装新runtime，不改变测试需求；引用已准入Python与临时目录，测试和fresh复核通过。
- Evidence: aTb63U implementation-0先误用/tmp，再用python3生成旧pip环境；父层相同sandbox诊断日志controller-python-path-diagnostic.log实际观察python3=/usr/bin/python3(3.9.6)，python3.12=私有bin(3.12.7)。源码先修，活动试次和候选不变。

### 减少无新信息的子代理等待往返

- Status: done
- After: 精确规划交接与执行上下文
- Covers: 期望-4, 约束-4, 约束-21
- Verify: 按skill-creator进行独立情境复核，完整App资产/链接回归与后继新试次wait调用分布；不改正在运行的候选。
- Outcome: 等待fresh reviewer结果时采用较长有界事件等待，无新信息不重新加载合同；仍响应新输入和真实阻塞，不跳过检查或抬高轮数。
- Done when: 宿主上限优先、正常等待非失败、fresh判定不复用、所有调用入口可达协议；源码及fresh验证通过，真实token收益另外测量。
- Evidence: aTb63U实施父session已观察57次wait_agent，其中56次timeout_ms=10000、1次1280；这类无新信息往返是E310命令统计未涵盖的成本来源。计数不等于已节省token。

### 保留原始需求到验收的对照

- Status: done
- After: 精确规划交接与执行上下文
- Covers: 期望-4, 期望-10, 约束-4
- Verify: 基于明确保留名称/长需求来源的独立正反情境复核；完整App资产/链接回归，后继新候选真实测量。
- Outcome: 外部原始需求仍是约束来源；proposal/Acceptance只作可追溯派生，明确接口/测试/文件保留要求不被概述丢掉。使用现有proposal与input MaterialBundle，不创造第二状态owner或新hook。
- Done when: 无原始文件时不编造来源；不把任务内旧PASS等同原需求覆盖；局部scope不冒充完整交付。通过源码与fresh复核后才冻结后继候选。
- Evidence: aTb63U implementation-0内部8tests/fresh checks通过；外层test collection检出缺少原需求指定test_thinking_stream_keeps_start_delta_end，attempt0真实failed。原Track输入仅三种派生deltas，没有原request引用，报告以派生Acceptance为主；继续保留实际失败，不由父层改应用或原trial。

### 新版真实E2E框架与无模型smoke

- Status: done
- After: 统一公共合同0.1.1与本地制品闭包
- Covers: 期望-10, 约束-16, 约束-21
- Verify: /tmp隔离副本bun test e2e；bun e2e/run.ts smoke --bin=<candidate>，路径、global、日志、超时及失败退出负例。
- Outcome: 真实Terra runner与独立验收边界建立，源头旧e2e只读保留，临时环境不会覆盖旧bin/home。
- Done when: smoke实际exit0且负例证明假通过被拒绝；当前可用认证/模型入口已观测，不以mock推断真实成功。
- Evidence: E290–E292、E303；最终671c harness完整check 670pass/7807assertions及typecheck/lint通过，RifTBP smoke 10项exit0/modelCalls0；真实cS2ETJ probe验证Terra/medium及实际CLI调用。框架校准trial与正式模型通过率分开。

### Terra真实业务E2E与重复运行

- Status: active
- After: 新版真实E2E框架与无模型smoke
- Covers: 期望-10, 约束-4, 约束-21
- Verify: todo→stream→blog→ecommerce→nested，各环境/流程/独立业务验收；todo与stream各第二次；聚合原始usage与首次/最终结果。
- Outcome: 同模型执行真实工程任务，以外部判据做有界纠偏，产品问题回源码修复并作废受影响结果。
- Done when: 各场景和重复关键用例均有真实验收过线证据，失败/成本完整报告，无验收弱化。
- Evidence: E293–E309；七次正式试验全部终态，Todo首次1/2、最终2/2；Stream两次未过、Blog/Nested失败、Ecommerce与Stream2按配置耗尽block。测试运行与测量已完成，不等于本节点全业务验收完成。
- Blocked on: Round45原试次的三次outer预算或on_exhausted=block已耗尽；禁止第四试次、重置hook或改写失败。用户已授权源码优化及新candidate+fresh trials，由“优化候选真实测量”节点推进，不解禁旧run。本节点仍未满足全部业务验收，不扩张到发行/历史原件迁移。

### 统一公共合同0.1.1与本地制品闭包

- Status: done
- After: 收敛固定根完整全局App与动态别名路由
- Covers: 期望-2, 期望-3, 约束-3, 约束-6, 约束-7, 约束-16
- Verify: 上游合同/依赖/准入测试，protocol保持2；/tmp源码及新制品消费者typecheck和完整回归；来源/lock一致且无2.0.0合同残留。
- Outcome: 用户指定0.1.1为公共合同要求；包版本与协议2各自拥有明确事实源，保留精确包版本/锁/descriptor校验。旧制品和旧global不改。
- Done when: 公共源码与已安装版本化制品同源，0.1.1成功、错误版本与协议失败，C无重复品牌类型错误；新全局安装仍经过后继完整验收。
- Evidence: E288–E289；H 556测试与C新制品651测试及类型/lint通过，实际新global安装完成。

### 明确全局聚合与 workspace 资源身份

- Status: done
- After: none
- Covers: 期望-1, 期望-4, 期望-5, 约束-8, 约束-12, 约束-13
- Verify: 源头库存/需要改造/最终暴露三组投影与用户决定一致；新版MissionLite preflight通过。
- Outcome: 用户明确global指导App与workspace资产App并存；新CommandOperation提供顶层入口，不删除workspace SkillApp。设计见global-skill-app.md与command-operation.md。
- Done when: 用户身份决定与两层所有权记录一致。业务实施前harness升级和preflight作为下一节点，不能把设计当代码证据。
- Evidence: E272，用户直接澄清；不存在待确认workspace身份。

### 设计并实现公共 CommandOperation 与顶层投影

- Status: done
- After: 明确全局聚合与 workspace 资源身份
- Covers: 期望-1, 期望-2, 期望-3, 期望-4, 约束-3, 约束-9, 约束-10
- Verify: 更新harness并通过preflight；Halfcode内置Kind、实际根help/dispatch一致、独立消费者与命名/来源/路径/版本负例。
- Outcome: 公共能力回Halfcode，Codument声明操作；后续global聚合/std迁出与三命令基于此接入。不得静默覆盖既有validate/migrate。
- Done when: 公共接口和实际打包消费者通过，不以help文本或设计文档冒充实现。
- Evidence: E274–E275，新H不可变制品正常消费、555宽回归、C实际15命令与隔离native通过。

### 全局指导聚合与标准迁出

- Status: active
- After: 设计并实现公共 CommandOperation 与顶层投影
- Covers: 期望-1, 期望-4, 期望-5, 约束-7, 约束-13, 约束-15
- Verify: 15旧Skill映射、真实App准入、隔离编译bin安装/全部命令、旧Skill哨兵、已知std备份退役与未知std保留review、独立前向路由与宽check。
- Outcome: global拥有标准操作与Host指导；workspace资产App不分发std/薄Skill。原生validate/migrate不变，操作名另为validate-operation/migrate-operation。
- Done when: 上述正负例过线，后继产品命令绑定不计作本节点完成。
- Evidence: E275历史聚合证据保留；E284因用户新要求重开：旧PASS不覆盖固定根完整App、直接复制/整包替换和干净workspace。后续执行以新增纠偏节点为准，不能继续以旧Done when宣称关闭。

### 收敛固定根完整全局App与动态别名路由

- Status: done
- After: 设计并实现公共 CommandOperation 与顶层投影
- Covers: 期望-9, 约束-17, 约束-18, 约束-20
- Verify: 重观察Halfcode VFS资产及Effect接口；补充固定根加载/动态资源help与dispatch/损坏缺失负例、别名按需加载与安装资产链接闭包测试；执行前重跑preflight。
- Outcome: 完整源码App和VFS/安装同一资产；SKILL引导动态CLI，references/std/compat/operation-alias.md承载历史映射；references/std布局闭合，不再由TS拼装另一App。
- Done when: 实際资源加载正负例、15操作及链接/URI测试通过，源码路径和多agent固定根选择有证据，不以静态文本一致代替加载。
- Evidence: E286；59文件真实App、公共准入和动态元数据反例、15操作native、独立前向审查及路径闭包通过。完整项目回归/实际全局安装仍属后继门。

### 整包替换全局Skill并清理旧项目分发资产

- Status: done
- After: 收敛固定根完整全局App与动态别名路由
- Covers: 期望-5, 期望-9, 约束-16, 约束-19, 约束-20
- Verify: /tmp多agent首次复制/整包替换/失败恢复和旧项目清理/定制保真/幂等/review；验证成功后实际新global bin+skill安装检查及旧codument指纹。
- Outcome: 新global无旧目录残留；成功升级的项目codument/仅项目资产；非项目数据明确清单退役。全局内容修改留备份不混回，新安装授权不扩张为真实dogfood升级。
- Done when: 隔离完整回归与清理负例通过、已授权新global安装实际核验；不得以仍保留项目std的review结果冒充升级完成。
- Evidence: E286隔离正负例由E288完整回归复验；E289实际三agent整包安装，每份59文件与源码逐字节一致。真实历史dogfood仍review，不计作成功升级。

### 隔离新版可执行入口

- Status: done
- After: 无（用户2026-09-07新增独立范围，不解冻三命令）
- Covers: 约束-7, 约束-9, 约束-12
- Verify: binary-identity及release相关测试、实际构建、隔离安装映射与旧codument sentinel保留、最宽源码回归。
- Outcome: project默认构建、源包bin、三平台native包、lock和安装查找只用depa-codument；workspace与demo身份不变。本机旧安装与根旧src保持不动。
- Done when: 新入口实际运行，发行元数据不含codument别名，隔离验证无覆盖旧命令；证据追加后回到原三命令USER gate。
- Evidence: E269–E270。630/6617/typecheck/lint；实际default及三平台native build、三包npm pack清单、隔离bin安装/新help/version/旧sentinel和本机旧codument原件保留通过。完整依赖闭包未重跑，不把bin隔离测试冒充最终发行验收。

### 设计跨仓公共包归属与消费协议

- Status: done
- After: 分析现状并形成可确认方案
- Covers: 期望-2, 期望-3, 期望-7, 约束-1, 约束-3, 约束-6, 约束-7, 约束-8, 约束-10, 约束-11, 约束-12, 约束-13, 约束-14
- Verify: 两仓独立 package/authority/incident inventory；inventory 与 recommendation 各两轮 fresh review（FIX_APPLIED→NO_GAP）；23 节点/30 边 DAG、完整期望/约束覆盖、链接及两仓 source digest 检查，见 E101–E104。仅证明设计充分，不证明迁回或发布完成。
- Outcome: analysis/cross-repo-host；包归属/命名/公开接口、三消费者、发布闭包、兼容与回滚设计，后续工作图修订。
- Done when: 深度分析与有界复核完成、目标/依赖/验收自洽；跨仓源码实施仍需用户确认。

### 确认跨仓方案并冻结来源对照

- Status: done
- After: 设计跨仓公共包归属与消费协议
- Covers: 期望-3, 期望-7, 约束-1, 约束-6, 约束-7, 约束-8
- Verify: 用户确认 + 两树 HEAD/status/eligible bytes/exports/identity 快照、逐项保留 H/采用 C/组合/暂缓表检查；对应跨仓 rec-01。
- Outcome: 可复现的当前输入、差异处置、允许编辑范围与回退材料；初始 dirty clone 不伪造普通 merge base。
- Done when: 方案获准且实施基线重新观察完成，后续每项搬迁可追到输入与来源；尚不改真实 workspace。
- User gate: 用户“确认、同意这种设计。请开始实施”已通过设计确认；来源冻结已验证并保留逐文件恢复材料。三命令与真实 npm 发布仍有各自独立 gate。

### 归回公共契约与最小安装闭包

- Status: done
- After: 确认跨仓方案并冻结来源对照
- Covers: 期望-2, 期望-3, 约束-3, 约束-6, 约束-10, 约束-11
- Verify: E112–E114：H root check 424 pass/0 fail；基本5包及资源9公共+9vendor正常解析；实际两族旧tarball/完整lock/reader/损坏制品拒绝/旧code-first明确migration-required；global/Vue单实现桥接正负例；Bun 1.3.0 三组打包消费。可选包使用overrides，产品桥接采用和三消费者完整普通解析仍属后继门。
- Outcome: Halfcode 持有 canonical public contracts 和迁回能力的源码；目标 halfcode-cli-lite-* 包，语义身份与 artifact provenance 分开；不形成长期双源码真源。
- Done when: 基本 CLI 不安装 Skill App/Hono/browser/Vue/MCP，旧身份精确映射经过测试，未知/冲突 fail closed；产品可继续 pin 迁移前制品，临时源码副本不接受独立功能演进。

### 固定已准入执行材料闭包

- Status: done
- After: 归回公共契约与最小安装闭包
- Covers: 期望-2, 期望-3, 约束-3, 约束-5, 约束-7
- Verify: 跨仓 rec-04 的 legacy source、metadata、dependency mutation fixtures → 固定已准入 bytes 或拒绝、cleanup；不得只重 hash entry 声称锁住全部依赖。
- Outcome: materializer 的受限一致性合同；R04 条件竞态与 R05 未明保证得到可观测判定。
- Done when: 正负例及相关 loader/package 回归通过；与 runtime/admission 重叠写入串行，不扩成供给链平台。
- Evidence: E121/E124/E126/E128：legacy/package bytes与metadata/dependency mutation、隔离stage/cleanup/重试、atomic definition/material receipt、code-first与resource-first server re-admission组合均通过；最新Bun1.3.0资源消费者通过。仅关闭本受限材料合同，不涵盖任意handler IO、AppPackage/Page builder全部材料或尚未收口的runtime/产品采用。

### Halfcode 通过公共包自消费

- Status: done
- After: 抽取 Skill App 与执行能力包；拆分 runtime 并收窄常驻执行；固定已准入执行材料闭包
- Covers: 期望-2, 期望-3, 约束-3, 约束-6, 约束-7, 约束-11
- Verify: Halfcode 产品 capsule/shell 的公开 API 消费检查、原能力回归、隔离 immutable tarball set core fixture；不得访问 Codument 私有源码。
- Outcome: Halfcode 自身不走特殊内部旁路；product identity/templates/providers 与公共机制分开，聚合 root check 覆盖公共包测试。
- Done when: 同一上游实现服务其自身产品；原行为/关闭/资源兼容有证据，采用可单独回退；尚不发布 npm。
- Evidence: E160–E162、verification/halfcode-adoption-conformance.md：525项根回归、七组pack门、最低Bun1.3.0及固定release set的真实CLI/旧code-first/完整lock兼容已过线；公共机制实际服务原生入口，产品identity保持。native OS recipe/全局安装仍属后继门。

### Codument 改为版本化消费与真实封装

- Status: done
- After: Halfcode 通过公共包自消费
- Covers: 期望-1, 期望-2, 期望-3, 约束-3, 约束-6, 约束-9, 约束-10, 约束-12, 约束-13
- Verify: 同一公共 tarball set 安装后 domain fixtures/adapter/public imports/owned-close 通过；无 workspace/source alias 跨仓旁路。
- Outcome: 四 domain 包保留，host-adapter/product-capsule/cli-shell 承担真实职责；旧通用源副本在消费证明后退役。该节点仅迁依赖和当前已有领域接缝，不冒充所有领域功能迁完。
- Done when: product/core fixtures 可离开两仓源码运行；基础产品注入与旧身份兼容成立，无绕道合并三命令；余下领域迁移继续后继节点。
- Evidence: E166–E167、verification/codument-adoption-conformance.md：同一公共 set 的十一产品包普通传递安装，冻结旧身份、99领域回归、实际完整CLI/Vue/MCP/close及根444回归通过；153项旧通用副本经hash核对后可恢复退役。仅关闭本消费节点。

### 跨仓三消费者与公共发行闭包验收

- Status: done
- After: Codument 改为版本化消费与真实封装
- Covers: 期望-2, 期望-3, 约束-3, 约束-6, 约束-11, 约束-12, 约束-14
- Verify: 同一 immutable release set 的 Halfcode/Codument/Notes core consumers + 无 transitive overrides 的受控包源解析 + public files/assets/engine/最小闭包/identity/local-live/close 负例。
- Outcome: 库级发布就绪证明，修复已观察的 release metadata/allowlist/嵌套 workspace 问题；平台 format/native smoke 分列，未测不宣称支持。
- Done when: 公开包可按发布名/版本独立解析，消费者不读两仓私有源；只证明 core/library 和 recipe 边界，不提前证明三命令、完整 Codument native 发行或已发布 npm。
- Evidence: E168–E169、verification/three-consumer-conformance.md：同新set6e5bc29f…的H/C/Notes在Bun1.3.14及1.3.0过线；公共14SRI保持、原consumer入口改按制品且完整/最小/domain-core通过；nested worker recipe两产品实际构建/close通过，H529/C448及架构213过线。其它OS native/最终C发行仍未测。

### 区分消费脚手架与完整源码快照

- Status: done
- After: 跨仓三消费者与公共发行闭包验收
- Covers: 期望-3, 期望-7, 约束-3, 约束-6, 约束-7
- Verify: scaffold/source-only/full eligible-working-tree 三种 fixture，dirty tracked（含已跟踪 ignored）+ eligible untracked + lock/provenance；变换前后分列，无静默漏文件。
- Outcome: scaffold 引公共包不复制通用实现；source-only 保留 upstream allowlist；显式 full 模式满足用户完整 dirty snapshot 要求，rebrand 独立且不重写公共包/资源身份。
- Done when: 两种 snapshot 范围与回执可复现；第三 CLI 脚手架可安装运行，无误复制 mission/私有实现到默认消费方；不改外部示例。
- Evidence: E174、verification/clone-conformance.md；固定3e28f0c8候选，两生产者两代scaffold和snapshot、三产品、最低Bun五套均通过。metadata变换仍明确要求构建前review，不冒充全产品重命名。

### 分析现状并形成可确认方案

- Status: done
- After: none
- Covers: 期望-6, 期望-7, 约束-1, 约束-7, 约束-8
- Verify: mission 章节/链接/覆盖/DAG 检查 + 内容 digest 对比 + 旧 migration 目标测试 → 规划自洽、范围内只新增 mission、25 tests pass。
- Outcome: 三份 attractors；包级 inventory/处置；workspace/迁移/token 设计；用户评审取舍；完整验收合同。
- Done when: 所有规划文件已落盘且通过规划结构检查；不表示产品验收完成。

### 冻结基线与验收夹具

- Status: done
- After: 分析现状并形成可确认方案
- Covers: 期望-1, 期望-3, 期望-4, 期望-5, 约束-2, 约束-6, 约束-7
- Verify: 旧版本基线测试、project 原有 check/各包测试、command/fixture/context inventory → 测试结果与缺口均有 source fingerprint。
- Outcome: 记录 source snapshot，安装并锁定 project 依赖；完整 command/option/output/Skill/capability matrix；历史布局夹具、六场景读取量基线。
- Scope: project 与隔离 fixtures；不再次 clone、不修改 Halfcode。
- Done when: 所有迁移族与成本场景有可重放来源；继承失败有归因；新旧 compiler 差异有明确 probe。

### 抽取显式契约与 CLI 垂直切片

- Status: done
- After: 冻结基线与验收夹具
- Covers: 期望-2, 期望-3, 约束-3, 约束-9
- Verify: `cd project && bun run verify:mission -- architecture --scope cli` + `consumer --scope cli` → parser/dispatch/ports 隔离、真实 tarball 外部 consumer command 可执行；完整 architecture 仍待后续包迁移。
- Outcome: 建立 host-contract/logic/support/capsule/shell 的最小真实闭包；product identity 和命令注册输入化；新 harness 实际执行检查。
- Done when: 一个真实命令经新公开包完整运行，JSON/退出码正确，多 root 无 cwd 污染；无仅改包名的空壳。

### 抽取 Skill App 与执行能力包

- Status: done
- After: 归回公共契约与最小安装闭包
- Covers: 期望-1, 期望-2, 期望-3, 约束-3, 约束-6, 约束-10
- Verify: 在 Halfcode canonical source 运行迁回后的公共包测试，并以新打包的 halfcode-cli-lite-* 制品运行独立 resource-first/code-first/custom-Kind/执行能力 fixture（新 gate 待实现）；既有 `cd project && bun run verify:mission -- consumer` 只保留为历史基线或 Codument 采用后的回归，不能单独满足此节点。
- Outcome: resource contracts/logic/support、browser、MCP/Vue closure；通用发现/注册扩展；第二 CLI 消费方；pack 产物与显式 lifecycle。
- Done when: 通用包不 import domain，consumer 不依赖原源码，Host 原能力未漏迁，custom Kind admission 全链路通过；新增 CLI-first consumer/生命周期合同亦过线，不以 E058 的旧证明替代。
- Resume: 保留 E058/E099 的本仓抽取进展；新的 source owner 在 Halfcode。先按跨仓处置 T01–T14 归位再补未完合同，不在本仓继续双侧演进。
- Evidence: E140/round-14-conformance.md：14包实际隔离tarball安装、custom Kind/readers、resource-first/code-first与材料mutation、browser/Vue/MCP执行和最低Bun1.3.0过线。产品采用仍独立后继，不将本节点done替代真实产品兼容门。

### 修订 CLI-first 与暂停命令方案

- Status: done
- After: 抽取显式契约与 CLI 垂直切片
- Covers: 期望-8, 约束-12, 约束-13, 约束-14
- Verify: 只读 Omni 三份 mission 文件与实际 transport、本项目调用链；mission 文档链接/覆盖/DAG 与代码摘要检查，见 E090/E091。
- Outcome: design/cli-first-runtime.md；analysis/cli-serve-placement.md；覆盖旧三命令自动合并计划，明确 core/最终集成两阶段。
- Done when: 本轮仅设计文件落盘且自洽；不代表 placement 代码已完成。

### 固定精确 placement 与无 Serve 基线

- Status: done
- After: 修订 CLI-first 与暂停命令方案
- Covers: 期望-8, 约束-12, 约束-14
- Verify: `cd project && bun run verify:mission -- serve-placement --scope policy`（80443）exit 0：23 pass / 268 assertions / 4 files；真实 executable 全覆盖、本地哨兵/SQLite/生产 CLI 子进程/typed loopback/source-profile-instance 负例。完整 runtime 门禁不在该 scoped PASS 范围，见 E099。
- Outcome: Host-owned placement contract/纯 resolver、command mapping、无 Serve 哨兵测试与旧输出基线；不新增整类 resource RPC，不动三命令组合。
- Done when: registry 完整路径无漏项/重复，非法 descriptor/profile/capability 不降级 local；现有 Page 专用 API 语义保留。

### 拆分 runtime 并收窄常驻执行

- Status: done
- After: 固定精确 placement 与无 Serve 基线；归回公共契约与最小安装闭包
- Covers: 期望-2, 期望-3, 期望-8, 约束-3, 约束-14
- Verify: 在 Halfcode canonical source 对公共 T12/T13/T14 运行 runtime/architecture 测试，并由新打包公共制品的独立 fixture 验证 capability/backend、lazy/close、无 Serve、服务端复验与 Page/MCP（新 gate 待实现）；既有 project 的 `serve-placement --scope runtime`/`consumer`/`architecture` 只作历史或采用后回归，不能用尚未换依赖的 Codument 副本证明上游实现。
- Outcome: Catalog/Domain/Request Execution 与 Page/live 生命周期分面；Page projection 脱离 workflow；LF pageWorkflow typed ingress；browser lifecycle policy；实例/目标/placement 服务端复验。
- Done when: one-shot 请求不构造 Page/Agent/supervisor；常驻首次并发只创建一次，失败/关闭释放精确；CLI 无私有跨命令 workflow receipt；MCP connection 不被强改为 HTTP client。
- Resume: E092–E100 的已实现 policy、preflight、pinned LF/close 保留；对应跨仓 rec-03，把完整接缝归公共 T12/T13/T14，在 Halfcode canonical source 完成未验收 lifecycle。
- Evidence: E140与round-14-conformance.md五case映射；H503pass及四组pack、Bun1.3.0三组均通过。真实capability/SQLite/profile、catalog/request/Page projection、四backend CLI、Page/Codex/provider关闭与source admission已在public set验证；57叶子inventory完整。两产品实际绑定属于B01/B02，尚不能宣称Codument命令迁完。
- Current action: Round13 public client transport、invocation-scoped host、admitted lifetime组合、通用owned cleanup与受控optional安装已过线（E135）。下一轮迁出实际capability acquisition/runtime构造接缝并补完整inventory/facet组合；不能重复将新公共primitives当作已采用的产品runtime。最终边界见verification/round-13-conformance.md，不替换两产品私有路径直至前置门满足。
- Resume round 12: 上述T06/T07/T12以及T13/T14切片现已实际打包通过，rec-04组合完成。剩余不是重新建包，而是public client transport、完整leaf/backend placement与aggregate lifecycle，以及最新最低Bun optional安装确定性；详见verification/round-12-conformance.md与E128。

### 迁入 Codument 领域与兼容命令

- Status: done
- After: Codument 改为版本化消费与真实封装
- Covers: 期望-1, 期望-2, 期望-7, 约束-2, 约束-9, 约束-10
- Verify: `cd project && bun run verify:mission -- capabilities --scope domain` + `architecture` + `serve-placement` 的领域矩阵 → 领域生命周期/registry/receipt/归档矩阵、domain ports、内置 Kind 和非冲突旧命令通过；三个暂停入口明确 DEFERRED，workspace installer 与新迁移桥在后继节点验收。
- Outcome: domain-contract/logic/support/capsule + product shell，9 类既有 Kind 的新版契约，嵌套/registry/归档/receipt 规则归位。
- Done when: 新 runtime 不 import 旧 src；正式资源只一套 transition；非冲突新旧命令委托同一本地实现，不建立领域 HTTP 通路；三命令的底层能力与最终命令组合分列。
- Resume: 四 domain 包已有证据不清零；先换成上游 public dependency，再继续缺失的 command binding、reader/registry/归档/migration 语义。
- Evidence: E235–E241、verification/domain-capabilities-round-30.md：32领域旧叶子逐项本地运行、完整晋升/归档恢复、11内置Kind、575根回归、339架构、204 installed及最低Bun通过。六migration叶子明确后继DEFERRED，三命令USERgate，不以此节点代替完整capabilities或App/migration验收。

### 建立 resource-first workspace 与 Skill 路由

- Status: done
- After: 迁入 Codument 领域与兼容命令
- Covers: 期望-1, 期望-7, 约束-2, 约束-9, 约束-10
- Verify: 拟实现 `cd project && bun run verify:mission -- workspace-app --scope core` → 公开 installer API 在隔离目录创建真实 codument/ SkillApp、无 KindDefinitions、递归非空 registry 与混合资源通过；不调用或改造暂停的产品 init。
- Outcome: 新 manifest/SKILL/source roots/templates 与独立 installer API；保留 agent 安装配置和薄 operation Skills；三个命令的最终组合移到后置讨论节点。
- Done when: 内部新建/重复调用、未知 Kind/冲突/目录安全负例通过；正式 App 仅位于 codument/，与 `.codument/` 私有状态分开。最终 CLI init 验收仍欠。
- Evidence: E253–E256：root589/6037、App14/365+真实编译installer、全部架构353/2989、同公共185f8d37的三产品真实安装及最低Bun/两clone通过。正式codument、递归/孤儿/混合资源/85资产/六Agent目标/重复零写/故障恢复已测；仅内部API，不替代后置三命令兼容。

### 打通历史迁移与 Skill 语义兜底

- Status: done
- After: 建立 resource-first workspace 与 Skill 路由
- Covers: 期望-5, 约束-4, 约束-5, 约束-9, 约束-10
- Verify: 拟实现 `cd project && bun run verify:mission -- migration --scope core` + 当前 Agent 的旧 Decision 兜底演练 → 公开迁移 API/非冲突 CLI 的来源/备份/保真/重跑/恢复验证通过；新 upgrade-workspace 合并仍暂停。
- Outcome: 旧格式 adapter、新 contract writer、事务 staging/ledger、随发行包 bootstrap migration Skill；root dogfood 副本升级。
- Done when: 内部历史矩阵通过或未知输入明确 review/blocked 且无数据损失；真实兜底后重扫和 strict validation 通过。流程无 Serve；最终 upgrade-workspace 入口/exit 2 和新旧 installer 组合不算已验收。
- Evidence: E261–E264。38/core、625/root、254/installed、当前与最低Bun均过；真实三历史副本完整备份/review保留，当前Agent Decision五场景演练。只完成内部core合同；历史全局ID冲突等仍需语义裁决，三命令/Agent刷新保持USERgate，不将review等同升级成功。

### 精简上下文并保持检查机制

- Status: done
- After: 打通历史迁移与 Skill 语义兜底
- Covers: 期望-4, 期望-6, 约束-2, 约束-4
- Verify: `cd project && bun run verify:mission -- context-economy` + 受影响 Skill/operation 验证 → 成本目标与完整性/故障检出同时过线。
- Outcome: L0/L1/L2 视图、来源/版本失效、紧凑输出、操作去重、continuation 和历史索引；不改已配置验证语义。
- Done when: 固定场景报告可复现，必要 contract coverage 100%，fresh/round/hook trace 等价；无真实 usage 时明确代理指标。
- Evidence: E265–E266：固定六场景entry-reading代理中位数38.05%，未省必需迁移材料；五检查协议字节不变，独立逐项比较与四负例推演PASS，46机制/763、root629/6575、installed257/2337及最低Bun通过。合同覆盖仅所列场景和适用规范闭包，不泛称模型质量100%或实际费用下降；没有新增缓存authority。

### 集成发行入口与 dogfood 切换

- Status: pending
- After: 确认后三命令接入与完整兼容验证；跨仓三消费者与公共发行闭包验收
- Covers: 期望-1, 期望-3, 期望-5, 期望-7, 约束-2, 约束-6, 约束-7, 约束-9, 约束-11
- Verify: `cd project && bun run verify:mission -- capabilities` + `distribution` + 新 CLI 对 dogfood validate → 全部旧能力、本地发行闭包、唯一depa-codument bin、版本和完整升级可用。
- Outcome: root 薄发行入口/project build 统一；仅/tmp项目副本dogfood受控升级；clone 自带历史归位；旧 src 实现按依赖清单退役，保留用户修改。
- Done when: 所有旧能力迁移证据先于旧 src 退役，公共源码已归 Halfcode 且产品使用被验证的 release set；本机 smoke 通过，非本机运行声明有证据或明确限制；未授权真实 npm 发布不执行。

### 核心重构验收并讨论三命令

- Status: done
- After: 抽取 Skill App 与执行能力包；拆分 runtime 并收窄常驻执行；精简上下文并保持检查机制；跨仓三消费者与公共发行闭包验收；区分消费脚手架与完整源码快照
- Covers: 期望-1, 期望-5, 期望-8, 约束-12, 约束-13, 约束-14
- Verify: 非冲突领域命令矩阵、完整 `serve-placement`、consumer/architecture、workspace-app/migration core 与最宽回归过线；逐项列出三个最终命令仍 DEFERRED，不改为 PASS。
- Outcome: 汇总核心证据，按最新用户确定的global聚合后接入顺序准备产品命令合同。
- Done when: 核心证据与global聚合验证成立，三个产品命令的参数/副作用/JSON/退出码合同固定后进入接入节点。
- User gate: 最新用户已批准global聚合后接入三命令；不再沿用旧暂停，真实安装/发行仍独立。
- Evidence: E275承接E267–E268核心证据及最新用户顺序；三命令实施合同继续落design/three-command-integration.md，不在本节点冒充已实现。
- Evidence: E267–E268：当前最宽629/6587/typecheck/lint、完整serve-placement/consumer、architecture及App/migration/domain/context core均通过。命令现状及待确认组合方案已落design/three-command-integration.md；仅缺用户对三命令的明确决定，不将本节点或全mission提前标done。

### 确认后三命令接入与完整兼容验证

- Status: active
- After: 核心重构验收并讨论三命令
- Covers: 期望-1, 期望-5, 约束-9, 约束-12, 约束-13, 约束-16
- Verify: 无 scope 的 `workspace-app`、`migration`、`capabilities` → 实际打包 CLI 的 init/status/upgrade-workspace、历史参数/JSON/exit 2、codument/ 目录合同全部通过。
- Outcome: 仅按后续用户确认方案组装三个产品命令；如选择不合并，则先修订最终范围/兼容验收，不能擅自删验收。
- Done when: 内部 API 证据和真实 CLI 证据闭合，未在确认前启用组合、别名或自动升级旁路。

### 最终独立验收与归档

- Status: pending
- After: 集成发行入口与 dogfood 切换
- Covers: 期望-1, 期望-2, 期望-3, 期望-4, 期望-5, 期望-6, 期望-7, 期望-8, 约束-1, 约束-2, 约束-3, 约束-4, 约束-5, 约束-6, 约束-7, 约束-8, 约束-9, 约束-10, 约束-11, 约束-12, 约束-13, 约束-14
- Verify: `cd project && bun run check && bun run verify:mission -- all` + 最终独立 DEPA/行为/升级审查 → 所有合同有最终快照证据，无未判差距。
- Outcome: issues-first 验收与修复复检；最终证据、交接文档和版本/限制说明。
- Done when: 最宽相关回归过线；独立性要求达成；无 UNVERIFIED 被算完成；Status 改 completed 后整体移至 archived。

## 尚未看清

- Round47追加观察：94Yims plan0为保存原始需求快照三次`base64 < request.md`（原生CommandExecution不同id，各输出28225字符），另一次acceptance编码输出3613字符，存在字节搬运经过模型上下文的额外成本。先前仅观察到两次，现按完整记录更正。尚未量化主导开销；现有原始快照规则要求自包含但不要求base64，未发现material导入CLI。后续按事实决定窄策略，不以此减少必要原文阅读或取消输入追溯。
- 三个同名命令最终用户界面和组合行为：明确延期到核心重构后讨论，不在本轮替用户选择。
- Browser/LF公共runtime边界已由E140以及后继三消费者/clone制品证明；尚未验证的是其它OS native与真实外部browser长期行为，不能扩大已有本机隔离证明。
- modeling作者合同与迁移core已由E196–E205、E261–E267验证。真实历史App仍有全局ID冲突、缺design、完成状态/criterion矛盾与旧MaterialBundle等语义差距；不能以机械包裹或core通过声称这些历史副本升级成功。
- 未覆盖的早期 legacy AST/forest 保留原件并review；不能推断为通用无损自动转换。真实旧src的最终退役依赖完整历史兼容与发行验证。
- compiler浅Catalog的缺口已由上游递归投影与产品membership/孤儿校验关闭（E246–E256）；后续迁移仍须以完整App实际发现验收，不用浅root的零行成功替代。
- clone三模式与两代消费者已由E174收敛；原输入快照保持，不能把snapshot变换等同完整产品metadata重命名。
- 冻结declared-entry UTF8字节代理的中位数下降38.05%已过线；实际运行期token/费用未测，不外推。必要迁移材料增加已计入，检查协议及独立负例推演另有证据。
- 历史各 release artifacts 在本地是否齐备；无法获取的真实版本需显式标明覆盖限制。
- 非本机平台是否有可用运行环境；cross-build 不代替 native smoke。

## Actual state

- Round45：用户确认执行真实E2E六步。旧runner调用旧bin/Skill、隔离不足、score不以失败退出，不能直接复用。开始project/e2e新runner；旧源/global保护不变。
- Round45新增观察：临时新workspace的docs profile仍引用已移走的references/std/skill/*/index.md，真实全局App只有references/std/methods/*.md。初始化宽泛替换遗漏重定位，既有migration也漏了此中间版本URI。先共享精确映射修复init/upgrade并补悬空链接负例，重建新candidate；原候选试跑只作为校准，不冒充新二进制验收。编码AttractorCheck路径正确，其停滞命令在外层187ms复现成功，暂按Codex子代理执行通道漂移观察，不删除检查。

- Round44当前：公共合同及受影响依赖闭包0.1.1，资源协议仍2。新不可变制品实际消费后H/C检查通过；新global bin与三agent Skill已覆盖安装，旧codument bin和原codument/未改。E288–E289覆盖以下历史阻塞/未安装状态。

- Round44：用户明确要求公共包要求改0.1.1，E287阻塞解除。按0.1.1要求更新上游合同和依赖闭包，protocolVersion保持2（不迁移业务schema），发布到新的本地不可变制品集合；不触碰旧registry集合。当前尚未业务写入。

- 最终E287：sg3oN5同源测试修正后的全量为625pass/26fail/7569assertions，lint通过，typecheck仍4个公共合同brand错误；本批布局、动态操作、安装替换恢复、迁移核心、成本门均通过。global未覆盖。当前阻塞是用户另一session的0.1.1制品与上游2.0.0协议绑定不一致；需要确认公共包兼容策略，不能擅自回滚版本或改协议号。阻塞不会撤销已验证的固定根App节点。

- Round43最新：20项布局/动态加载/native/多agent替换回滚定向通过；独立前向审查发现两处旧bin判断，已修。完整副本95Wv7U为625pass/26fail，主要失败为公共support仍要求contract2.0.0而应用0.1.1；另有serve错误文案及profile回归，不能称全绿。ZRXeCy成本门46/763通过，入口代理中位达25%以上，quick/mission/migration仍可能增加，不声称真实费用下降。类型错误已只剩两版contract brand冲突四处。实际CLI补测发现global/upgrade缺agent schema、migration standalone未嵌入新App，均已修源码，正在创建round-43-global-app-cli-gates新副本复验。尚未覆盖全局。

- Round43：已建立product-capsule/src/templates/agents/global/skills/depa-codument完整资产目录；公共ResourceEffect固定根读取源码/嵌入字节，公共CommandOperation准入派生元数据，安装按所选agent完整替换。路径/迁移引用及英文help接续修改中，尚未经本轮验证。正在执行verification/isolated-project.ts round-43-global-app-first，之后在返回的/tmp副本跑global-app-layout/global-guidance/native安装及迁移测试，再按失败证据纠偏。

- Round42最新：E284及design/global-app-layout-correction.md记录用户纠偏，布局/固定加载/整包替换尚未实施。以下Round39…41为历史观察，不是当前新目标PASS。global聚合节点已重开。
- 会话已验证版本权威改为project/package.json的0.6.0，且已覆盖新global bin；后来英文help、agent示例、去demo只完成两仓源码和/tmp验证，尚未覆盖全局。用户现授权后续bin+skill覆盖，本轮仅记录。合同0.1.1/2.0.0并存曾导致typecheck失败，恢复前重观察，不沿用E283全绿。

- Round41：用户确认已实现为legacy-declared/v1来源/内容绑定标记，原status/body保留，查询及strict validate显式not-reverified；默认list/status不变。XrSVT0宽check645/7086和成本门通过；最终缺失归档/越界负例在5n3Hrk副本check中。原codument/global指纹不变。历史其它冲突仍review，不把局部特性当整体升级成功。

- E280本轮最终副本KiiTC7：check 641pass/0fail/7046assertions/132files，typecheck/lint通过；context gate 46/763通过。原codument/与旧global指纹在验证后仍完全相同。历史upgrade exit2、0提交，最终发行/归档未做。blocked仅针对历史语义政策，不是Bun缺失、环境失败或普通进度停点。

- Round40进行中：验证仅在/private/tmp副本。修复upgrade receipt把计划数误报为已提交数；精确识别3份已提交历史std、备份后退休Finder元数据。副本定向测试13/154与CLI测试1/27通过。全量check首次639pass/4fail，失败为副本缺Git边界/原锁文件，正在修复准备器后重跑。dogfood语义升级仍review。实际global读取成本中位下降25.3%，quick/mission/migration存在增长；见E278。

- Round39最新：15旧Skill已全部转为顶层CommandOperation；仅validate-operation/migrate-operation处理冲突，既有原生命令不覆盖。global指导App与std聚合完成，workspace codument/仍为资产App。参见E277和verification/command-operation-conformance.md。
- 最终C源码check 639tests/7018assertions/132files、typecheck/lint通过；H此前最终check 555/5147通过。最终native测试3/198，实际dist/depa-codument构建与help通过；旧本机codument哈希不变。
- 当前H制品为host-release-round-38-command-operation，digest15ff6913c526f4f61f6b4ddaa60eca1656c3e72e57a8f4e7f756794d45ad4824；C十一包round-39-command-operation-product-artifacts，digest4a0777c53daf778f527f1c9fe02a97df5bf48910fb3bff97d08e902679451871。C实际普通registry安装263/2556及类型/产品CLI完整演练通过；独立Notes同set新Kind实际help/dispatch通过，H旧锁精确兼容通过。无源码alias/发布npm。
- init/status/upgrade-workspace已实际接入，source/native/packaged正例与source恢复负例有证据。未知std和改写旧Skill返回review并保留原件。三命令节点仍active：最终无scope gate和全量旧receipt/argv兼容尚未收口，不能称整个mission完成。
- 本批新版单指导App与CommandOperation功能已完成；按用户要求给出重名处理总结。长期mission保持active，不以本批交付冒充整体归档。
- 真实0.5.2/0.5.4/dogfood历史副本仍有未决语义，0.5.3本地tag缺失；当前候选产品版本仍0.1.0而非最终0.6.0。root发行切换、旧src退役、真实dogfood升级及最终all未做。原src中的用户修改保持，未触碰旧全局安装。

## Last action

- 最新已提交源码7b20c44，author/committer kongweixian <kong_weixian@163.com>；没有push/global安装。E334固定E2E策略688tests/typecheck/lint/native/Cv5MEC smoke过线。
- 活动Stream root=/private/tmp/depa-codument-e2e-xFEjgk，session53952；W=/private/tmp/depa-codument-verification-i6ECNV/depa-codument/project，冻结dist/depa-codument-r47-workflow-policy，日志父目录stream-fixed-policy.log。这是固定检查策略的新试次，不改其运行中源码/限额。
- 绑定隐私切片尚未提交：contract显式privacy Effect，support创建自有.local/.gitignore、保留已有规则/根ignore、冲突或已跟踪拒绝，不自动untrack；nested oracle明确两仓绑定检查失败。新副本L=/private/tmp/depa-codument-verification-lK5aRy/depa-codument/project，定向4tests/15assertions通过，session41127完整check运行，日志父目录binding-privacy-check.log。完成后native/smoke及新fresh Nested。
- 已结束V Stream vuM1YN首PASS但无GapLoop/AttractorCheck，不能等强度对比（E331/E332）；U Nested4Qt0XU终态blocked，不resume，E333明确第一失败为绑定未被忽略而非HTTP共享文件。S Stream94Yims纠偏后PASS，含隐藏文件误报成本（E326–329）。全部旧run原始结果/预算保留。
- Ego唯一TaskSpace4/p1仍工具故障，升级未获答复，不改现场/其它任务窗口；Todo/Blog/Ecommerce浏览器支路等待安全恢复。
- L复制前后原codument/指纹b631c719…与旧global bin字节05206bf0…未变；副本历史升级仍review-required，不计迁移PASS。

## Next

1. 完成W策略检查/提交，继续绑定忽略契约与错误定位，再用新快照fresh trials。vuM1YN与4Qt0XU均已终态，不resume、不重置原预算。基础设施、真实业务失败及模型误报分开。
2. 汇总当前版本的首次/最终交付结果与含排除试次的全部观测成本；版本不同不冒充受控A/B，源码check或小fixture不冒充业务PASS。
3. 浏览器支路仍需安全恢复；等待Ego升级授权，不把工具不可用冒充业务失败或PASS。
4. 长期兼容、历史语义review和完整gates仍以工作图为准；不自动退役旧src、切根发行、升级真实codument/、覆盖global旧bin或发布npm。

## Decisions and replans

- D22（E284，2026-09-11）：用户纠正global是固定位置Effect加载的真正CLI SkillApp；完整文件夹直接对应Halfcode VFS资产，安装复制/升级整包替换。当前能力动态查询；SKILL按需路由references/std/compat/operation-alias.md解决历史skill映射。references/std布局与项目std清理约束见MISSION17…20。助手手写第二份操作清单、单纯换资产目录名、保留旧global定制活动文件等建议被否定；E275–E277不作为新目标完成证明。新global安装已授权但本轮只记录，旧bin/原dogfood保护不变。

- D21（E272）：用户保留每workspace的codument/ SkillApp身份，用于项目自身迭代资产；global depa-codument指导CLI及标准operation。新增CommandOperation公共Kind，直接投影顶层plan-track/impl-track等，不以SOP list/detail为前置。同树生成帮助与执行，显式暴露不等于资源发现；与validate/migrate等原生命令的碰撞不得静默覆盖。新方向覆盖D20身份待定与纯SOP入口设计。
- D20（E271）：按最新用户方向改为global单Agent入口、旧Skill→SOP、std归全局，再接三命令。先区分Agent暴露与资源Kind身份；与此前“每workspace都是App”存在两种解释，不擅自删workspace身份或保留第二App冒称满足。待输入后更新MISSION/AT2与新预检；不把结构校验失败当不可修复问题，真正待定的是用户目标边界。
- D19（2026-09-07，E269–E270）：用户明确以新旧session隔离覆盖原双bin兼容方案，新版本仅depa-codument；bin不再派生workspace/demo身份。新增独立可做节点优先完成，不解冻三命令、不切root发行、不改全局旧安装。后续最终发行与分发命令说明必须遵守新bin合同；旧证据作为历史保留，不改写成新身份PASS。
- D17 E101：公共通用能力的最终源码 owner 改为 Halfcode，npm 前缀 halfcode-cli-lite-*；Codument 只保留领域和真实消费方封装，产品/包/资源版本分开。它覆盖 D7 的全 depa 前缀及旧临时不回写前提，不追溯改写已有测试结果；AT1 增加单一上游源码 owner 与资源身份不随包名机械变化的不变量。本轮仅设计，跨仓实施确认与三命令后置决定、真实 npm 发布授权互相独立。
- D18 E102/E103：独立 inventory 与收敛支持 14 个公共目标包（11 个已有真实能力边界，加 Skill App/live/HTTP 三个安装或生命周期差异边界），四 domain 包留 C，六 native 包名保留发行兼容例外。复用原 generic/runtime 节点并将未完 source work 排在上游归位之后，原 active→pending/Resume 不抹掉已有证据；领域未完工作排在 Codument 依赖采用后。采用顺序为 H 自消费→C 真实封装→同 set 第三消费者/正常传递解析→clone 三工作流；最终完整 Codument 发行仍在三命令 checkpoint 之后。新 gate 必须测试上游新包和不可变产物，不能只测 C 旧副本。完整 dirty snapshot 明示保留全部 tracked 和 eligible untracked/lock，默认 source allowlist 不替代显式完整模式。细节唯一真源为 cross-repo-host/convergence 与 recommendations，不在本图复制接口定义。

- D1 用户明确要求 Mission Lite：本目录为唯一迁移控制面，不创建产品 Track/Mission；优先于仓库自身 Codument planning 路由。
- D2 source clone 已获授权且完成：以本地 project 内容快照继续；源 HEAD+dirty 信息仅用于 provenance，不回滚到源 commit。
- D3 当前 contract/runtime 与 resource catalog 混合证据 → 先抽通用 ports 和垂直切片，再迁产品，避免整包平移后继续混合。
- D4 历史升级测试与 compiler 版本差异 → 历史 migration 作为独立节点，Skill bootstrap 与事务恢复列为硬验收。
- D5 用户保准确性要求 → 评审中降低默认验证强度的建议仅作参考，本次不启用；成本从上下文与有效证据投影减少。
- D6 当前 DEPA DataTopology 主文优先于 Mission Lite 内旧吸引子参考；三份 mission attractors 采用开放 authority 关系、不强制事件溯源。
- D7 方案暂定下一 minor 0.6.0，产品原名/bin 兼容；新能力包全用无 scope `depa-codument-` 前缀和 role。此项随整体规划等待用户确认。
- D8 用户确认整体规划并授权开始实现；本目录已整体移至 active。MISSION 中“本轮只规划”指建档回合，当前执行按已确认的工作图推进，外部发布仍未授权。
- D9 验收入口提前落地并显式区分 --scope cli 与完整 suite。首切片仅五包，不让尚未完成的 resource/domain/发行检查变成空 PASS；最终仍必须跑无 scope 的完整 gates。
- D10 compiler 0.3.0 发现阶段没有直接 code-owned Kind 输入选项，但提供公开 read-port。使用内存源投影完成 bootstrap，authentic tree/receipt 仍由 compiler 产生；保留物理 manifest 摘要，不把生成视图当物理来源。无须改外部 compiler/Halfcode。
- D11 E057–E059 已证明 11 个公共 Host 包与自定义 Kind 的完整 consumer 闭包，领域代码可开始依赖这些公开接口；Host 的最终产品绑定/文档门禁仍未全部收口，因此不提前标 done。将领域节点的前置改为已完成的 CLI 垂直切片，按 E058 的 resource/Kind API 继续；发行节点同时依赖 Host 收口和 context 节点，不能跳过未完成门禁。这是基于现有依赖可用性的工作图细化，不改变用户目标，也不把文档失败算成功。
- D12 旧 modeling/schema.ts 对 entity/object 强制 fact_grade/single_writer，并把 fact_grade 封闭为七级。当前 depa-expert 的 DataTopology 已明确取代固定阶梯，且 physical write site ≠ transition entry ≠ owner。迁移时保留旧字段及历史判定的可解释性；新作者规范采用开放 role/model/relation 与显式 authority 边界，不把七级枚举再包成新“DEPA 标准”。具体兼容作者合同在 modeling 迁入前补设计，无法证明等价的转换需 review；不为此删除旧知识或弱化既有准确性机制。不激活缺乏证据的 event-sourcing/reactive profiles。
- D13 用户新增要求覆盖 architecture 旧三命令组合方案：暂停 init/status/upgrade-workspace 合并，不以别名/host 命名空间/其它入口绕过。核心重构与最终 CLI 集成分期；保留原兼容验收作为后续用户决定门禁，不提前退役旧 src。
- D14 codument/ 为不可变的产品正式目录名；Host 私有 .codument/ 不承载 App 或正式业务状态。内部 installer 先证目录合同，最终 CLI init/upgrade 仍需确认后实测。
- D15 Omni 参考只取“精确 placement + 生命周期分面 + Server 复验 + 惰性释放”。本项目资源查询/校验和普通 LF 已 local；database 当前是 SQLite，仍 local。重点修聚合 runtime 与 LF pageWorkflow，不引入 Omni 特有 BaaS/通用 resource RPC。MCP stdio 允许独立长连接 owner；常驻不等于必经 HTTP Serve。
- D16 前一轮为 design-only 并已获用户继续实施授权（E092），不再等待该规划确认。已有实施证据不自动覆盖新 serve-placement/core suites；新增叶子门禁不得占位 PASS。规划确认与核心重构后的三命令决定仍是两个独立用户 checkpoint。
