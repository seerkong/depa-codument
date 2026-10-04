# Round55 对照结果解读

完整数据见 [指标报告](paired-e2e-round55.md)、[原始证据投影](paired-e2e-round55.json)。模型为 gpt-5.6-terra/medium，各版本各用例一个 fresh 样本；不人为修生成应用。

## 可以观察到的差异

两版总体最终通过率都为4/5（80%），首次外层通过率都为1/5（20%）。首次指外层attempt，不意味着内部独立验证从未发现问题或没有修复。最多两次外层纠偏，失败成本全部保留。

新版五项合计144.17分钟，旧版161.14分钟，少10.5%；input少24.0%、output少21.6%、非缓存input少13.3%。但两组基础设施失败不是同一个项目，这不是同质量成功交付的纯效率对照。

事后只看两版都正式通过的stream、ecommerce、nested：新版88.35分钟、旧版79.83分钟，新版多10.7%；input多2.0%、非缓存input多19.4%、output多0.5%。这个按结果选择的子集也不是无偏/因果估计，不能替代五项总体率；它说明“合计token下降”不足以证明架构或编码效率普遍提升。

## 逐项摩擦

| 用例 | 新版 | 旧版 |
|---|---|---|
| Todo | 内部fresh验证发现认证submitter缺陷并修复；一个外层attempt正式业务/UI通过 | 内部发现PATCH/dueBefore UI缺口；外部发现失效知识code map与DELETE 204 JSON解析问题；末轮review通过，但UI代理没有在规定位置产出proposal，正式infra |
| Stream | 外部发现OpenAI空tools与后续请求缺assistant tool_calls消息，一次纠偏通过；21.96分钟 | 首次外层通过；17.14分钟 |
| Blog | 首轮缺发布/下线/评论/审核UI，纠偏后review通过；Ego fill被aside遮挡并timeout/fence，正式infra | 同样首轮缺完整工作台；第二轮违背自己生成并批准的状态机设计；两次纠偏后review/UI通过 |
| Ecommerce | 应用测试的异步支付竞态；随后UI启动声明不合规；两次纠偏后通过 | 首轮只有静态storefront；一次纠偏后review/UI通过 |
| Nested | 取消订单仍可支付、库存不扣；纠偏后又发现验证receipt的非local绝对路径；两次纠偏后通过，34.21分钟 | 初始local binding未ignore；实现中自行修reservation ID编码；外部发现测试金额/数量未随机化；两次纠偏后通过，28.10分钟。实现与review都曾误用repo-relative服务命令cwd，记录了恢复成本 |

因此，本轮没有复现“旧版全部首次顺利交付”。旧版也发生业务遗漏、工作流/知识缺口、执行摩擦和协议infra。低首次率是完整spec工具流程交付指标，不能全部叫“模型编码能力下降”；也不能用两版都有问题就否认新版在Stream/Nested这两个样本中的退步。

## 不能省略的边界与未决问题

- 相同需求原文、模型、公共workflow policy、阶段/外层预算与业务/UI验收代码；但旧封套准入和中断处理是在新版五项后修正，两个harness SHA不同。不是严格同字节A/B。无效旧pilot另列9.11分钟与全部token，不计旧版正式失败。
- 旧版启用历史modeling/engineering preset；每版自动生成的批准计划可有不同约束。旧Blog的一些禁用状态转换来自自己的设计，而非固定API验收逐条规定。不能把知识/计划强度差异都算成CLI架构因果。
- 本轮公开policy禁用Track GapLoop/AttractorCheck/HumanConfirm，保留fresh独立验证。这不是这些机制启用后的效果/成本结论；没有改产品的默认能力或删机制。
- 当前Blog真实动作超时与旧Todo缺proposal，说明harness仍有基础设施/协议摩擦。两者都不是正式业务PASS，也没有为infra启动额外实现修复。
- 新版Nested模型删除了两份失效应用验证JSON，再补相对命令的真实验证；原CLI身份/round、外层结果、执行日志及旧JSON内容仍可追溯，但不能声称应用内全部历史收据都保留。需要另行讨论收据撤回/保全策略，本轮不手工改App或重判。
- Token是父子会话每response实测delta，cached是input子集；包含失败，不包含编排对话，不代表订阅账单。
- 104项harness回归、类型与lint通过。最宽check仍有既有发行版本断言失败，不归档整体重构Mission。

## 生命周期与保护

终态只读审计通过：96条实际模型上下文、11个安装Skill根指纹、19个自有browser endpoint和6个UI origin释放、临时auth清除、原codument目录/两global bin/目标global Skills指纹保持。TaskSpace4确认agent ownership后仅finish一次并关闭p1，见 [生命周期记录](paired-e2e-round55-taskspace.json)。

本次用户请求的十项测试与准确对照交付完成。更宽重构Mission仍active；不自动扩展样本、修被测产品、发布、覆盖global或升级真实dogfood。
