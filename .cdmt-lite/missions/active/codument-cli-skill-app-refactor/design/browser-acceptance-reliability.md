# 浏览器验收通道：Round52

目标是独立AI根据完整需求验证任意生成应用，不是运行预设Todo/Blog脚本。

## 证据与根因

E389–E391真实工具trace：短命Ego nodejs调用的events缓冲不跨调用；连续prompt阻塞snapshot/info中的CDP，代理又在上一shell session未结束时回答第二次。固定fixture在持久SDK上下文能完整观测并处理prompt，证明运行协议而非必然工具不可用。E393进一步确认JS实际执行于共享浏览器NodeService：退出CLI进程不等于释放远程worker，CLI Seatbelt也不能约束任意远程Node代码。

## 最小修复与事实边界

| 节点 | 角色/owner | 写入口与关系 |
|---|---|---|
| 页面与dialog | external authority / 浏览器 | 原生用户交互；SDK receipt/events为观察 |
| 通道队列、pending dialog、超时栅栏 | runtime control / harness session | 一个持久连接的串行消息入口；事件更新dialog投影 |
| 原生执行日志 | historical record / harness | owner-only append；不可由代理写入，不作为业务真源 |
| 测试计划、预期、finding | fresh reviewer判断 | 原完整需求+页面观察；不包含harness固定业务流程 |
| official receipt | harness admission | 校验身份、来源、真实观察；不代替fresh语义判定 |

- 持久Ego nodejs进程只通过原有公开API操作TaskSpace1/p1，不修改Ego/OpenCLI，客户请求为有限通用操作，不接受任意JS/eval/fetch。
- 多客户端请求串行执行；request id幂等，不能自动重放副作用。原生调用超时后session标uncertain，拒绝后续副作用，避免迟到操作与下一动作竞争。
- 持久连接收集真实dialog事件；snapshot时若pending dialog，直接返回dialog状态，不发必然阻塞的DOM/CDP请求。prompt的答案由AI选择，不自动接受、猜测或复制业务代码。
- 当前只有Ego一个具体adapter，不创建公共抽象包/新通用daemon。通道是一次验收scope的临时Effect；finally先发送owner认证的close结束远程lifetime，再停止CLI wrapper。owner异常消失由90秒heartbeat watchdog释放，不杀共享NodeService；owner统一管理TaskSpace lifecycle。
- Reviewer禁止执行原生Ego入口及realpath，仅能访问有限typed通道。owner能力存于只允许harness读取的0600配置文件，不出现在argv；原生日志不可由reviewer写入。timer/deadline等Effect注入到Processor，不混入业务判断。
- admission改用harness-owned原生通道日志，而非从shell字符串猜方法调用；必须导航到lease origin，观察与后续动作同session，input和dispatch receipt不冒充结果。

## 验证

单测注入Page port证明串行、幂等、超时隔离、dialog投影、越界与非法操作拒绝；真实自有fixture跨CLI调用完成两段prompt并重复至少三次。生成应用只读fresh Terra验收，保留旧失败及新cost，不修改交付源码或造PASS。

## 实际结果与覆盖限制

E394及[Round52报告](../verification/ego-persistent-terra-round52.json)：最新源码74项相关回归通过，typecheck/lint通过；YoHKIY真实fixture三轮通过且端点释放，6vzYC4异常owner退出后watchdog释放。Fq8mwC的fresh Terra正常终止并产出可准入的业务FAIL：55次请求，编辑连续prompt完成，退出后仍显示Signed in的页面反馈矛盾。不是基础设施FAIL，也不证明认证安全失效。

原Todo源指纹保持，历史结果不改写。未复验其他业务App，当前未找到历史Blog根，不重生成。新通道不追溯管理修复前实验遗留listener，不为清理而重启共享浏览器。以上是已复现故障路径的闭包，不是所有浏览器或应用的通用可靠性保证。

## Round53：参数拒绝与不确定执行必须分开

用户另行授权四个其他case的fresh完整试次；上述Round52覆盖限制是历史观察，不限制本次已批准的生成。四个试次使用冻结harness，修复版另存/tmp验证副本，不能热改在途试次。

Blog第二轮暴露click options传成JSON字符串的SDK TypeError。错误帮助文字包含`timeout?`，但并没有浏览器执行超时。把它误判成uncertain会无端丢弃一个仍可用的session；反过来，放过真实超时又会允许重复副作用。

- `validateRequest`是纯输入准入：可选options必须JSON object，非法参数零Page effect；客户端可修正输入并使用新request ID。
- `reportedBrowserTimeout`是纯诊断分类：先尊重typed late-effect/timedOut与provider timeout名称，再排除同步TypeError帮助文本。实际deadline保持原栅栏，不重放、不放宽等待预算。
- 真实自有fixture验证“非法参数拒绝→同session可snapshot→有效click生效”，不加入任何生成业务App的操作脚本。
- 原Blog infrastructure-failed记录及成本保留。修复后只读复验用独立run/receipt/cost和同一候选身份，不把该复验转成原trial的PASS、首次通过或预算重置。

E400追加：默认快照改为full_page，避免把视口外控件误判不存在；保留显式scope。确切`ElementResolutionError: page.click … element is disabled`属于文档规定的等待actionability失败，允许重新观察而非盲重放；未知timeout、CDP timeout和任何late-effect标志仍关闭通道。真实fixture需要证明视口外控件可发现且可操作、禁用控件未触发handler及后续有效动作可执行。

Ecommerce末轮还有非连续的findingEvidence被admission拒绝，原infra终态不改写。新只读复验同时重新评估UI缺口与工具诊断，不靠放宽真实引文准入“修好”一个失败试次。

## Round54：范围、准备与收据的 authority 边界

- Data：原request/acceptance不变；scope plan只投影原文引用、API/UI/跨端/artifact职责与准备能力，不能发明UI控件要求。scope map不是第二规格，按同channel合并但完整源仍由fresh reviewer读取。
- Processor：plan/route准入、request幂等、seal、错误分类和native observation引用验证无业务脚本；Effect经显式runtime传入。准备HTTP结果不能代替UI观察，API合同不自动要求UI按钮，artifact由交付review检查。
- Effect：临时localhost准备gateway只能调用已准入origin/route，有限次数和deadline；关闭后不可复用。持久Page通道按lease串行，未知副作用仍fence。真实非输入target的fill拒绝仅精确诊断可恢复，并用本方fixture证明未产生input effect。
- Actor：fresh Terra分别解释/准备和独立UI判定。协议修正只获已关闭通道的只读catalog，一次且冻结判定/expectation，不执行业务、不补造覆盖。缺范围覆盖不能通过格式修正；缺原生reference可在冻结业务finding下补格式，再由同一admission/controller验证。
- Projection：官方receipt/controller状态仍由harness持有；advisory JSON不拥有PASS写权限。report分别保留原trial、各只读复验、准备/格式修正费用、真实模型及失败分类，不抹掉历史infra或改首次率。

预算来自单一UI_BUDGETS，lease求和包含准备/原UI/一次协议阶段。真实观察证伪了初设180s准备预算；校准为360s，同时先去除计划正文重复、给出entry级诊断与@file输入。该调整不增加business retries，也不替代功能验证。验证记录见E406起与Round54报告；只有已实际跑过的snapshot才有效，不热改在途harness或App。
