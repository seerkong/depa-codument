# npm 公开依赖版安装与 E2E 结果

运行日期：2026-10-04 至 2026-10-05（Europe/Istanbul）。五例已结束；未重新运行旧版，未修改生成应用来修成绩。

## 安装与依赖

- 项目在本轮开始时已经使用 21 个 npmjs 已发布 `halfcode-lite-* @0.2.1`。本轮重新核验公开元数据、lock tarball/SRI、隔离安装实体路径；不存在 localhost registry 或兄弟仓链接。
- 全局旧安装仍保留改名前的本地页面构建器依赖；本轮已完整替换运行时和依赖，而不是只换 bin。
- 已安装 `/Users/kongweixian/.local/bin/depa-codument`，产品版本 **0.6.0**，与本次 `/tmp` 构建候选字节相同：`24cef075108a3f7c09f87ddb97d054e085b5c543d2cafe82f542ebffc9305cc8`。
- Claude、Codex（`.agents/skills`）、Eidolon 各46文件的完整 global SkillApp 已更新，hash `452fe6aed91b3b6f6936be51bcda32d9b0e903b3e3f90aff24fdf36987f1b80e`。自有未发布的 `depa-codument-skill-app-contract` 随本地产品安装；这不改变公共 halfcode 包来自 npm 的事实。
- 已实际导入安装后的 builder，公开 builder 版本0.2.1，导出 build/watch API 正常。
- 旧 `codument` bin/link、原仓 `codument/` 指纹不变。未提交 Git，未再次发布 npm，未迁移真实 workspace。
- 恢复备份：`/Users/kongweixian/.local/share/depa-codument-local/npm-021-stage-aedreN-previous`；Skill 备份：`/Users/kongweixian/.tmp/depa-codument/upgrade-global-14h54E`。

## 正式结果

模型：所有观测上下文均为 `gpt-5.6-terra / medium`。同一冻结候选，原始需求与 policy 不变，各 case 一个 fresh 试次，最多 initial + 两次外层纠偏。

| Case | 正式终态 | 外层 attempts | 首次外层 | 分钟 | 输入（含缓存） | 缓存输入 | 输出 |
|---|---|---:|---|---:|---:|---:|---:|
| Todo | passed | 2 | 否 | 33.60 | 8,836,945 | 8,229,888 | 88,165 |
| Stream pipeline | passed | 1 | 是 | 22.56 | 5,574,413 | 5,217,024 | 56,098 |
| Blog | failed / business | 3 | 否 | 44.74 | 12,464,577 | 11,667,968 | 128,390 |
| Ecommerce | infrastructure-failed / protocol-cost | 1 | 否 | 17.05 | 3,235,348 | 2,952,192 | 41,397 |
| Nested mission | passed | 1 | 是 | 16.37 | 4,271,626 | 3,967,232 | 49,022 |
| 合计 | 3 passed / 1 business fail / 1 infra | 8 | 2/5 | **134.32** | **34,382,909** | **32,034,304** | **363,072** |

全样本口径：首次外层 **2/5=40%**，最终 **3/5=60%**。排除一个基础设施失败时，有效业务分母4，首次2/4、最终3/4；不能将排除后的75%冒充全样本成功率。首次外层仍可包含内部 fresh verifier 和修复，不等于第一次生成即无缺陷。

43个有usage会话、44份模型上下文，按原生 per-response delta 去重，覆盖可观测父/子/中断会话。输入已含缓存，不能再加缓存。未知usage样本0，不代表提供方账单完整；货币成本不估算。表中包含全部正式失败成本，不含本控制会话、构建/安装/preflight。单独模型预检为输入30,211、缓存24,064、输出390；浏览器fixture/smoke无模型成本。

## 失败与纠偏

### Todo：纠偏后通过

首次外层review通过，但真实UI发现 logout 后仍显示 Signed in。实现模型在原 Track 内修正状态消息并补回归；第二轮独立review与UI通过。首次失败和两轮成本保留。

### Stream：首次外层通过，存在内部修复

内部 fresh verifier 检出词法错误未传到 bridge，以及工具请求事实的消费顺序；模型修复并复验。外层首次独立评审通过，不能据此声称从无内部缺陷。

### Blog：三次预算耗尽，正式业务失败

1. attempt0 外层review：stored XSS，可在编辑者同源会话执行不可信文章/评论内容；模型改为安全DOM/text-node渲染并补回归。
2. attempt1 外层review通过，但真实UI发现提交评论后退回未登录表单，无法完成评论流程；模型进一步纠偏。
3. attempt2 外层review：缺少已登记验收要求的登录能力；已注册用户 POST `/api/login` 实际返回404，工作台只有注册。正式 failed，不追加第四次、不手改应用。

此前内部 verifier 也曾发现阅读详情/讨论视图和角色工作台遗漏。连续修复局部 finding 未能在预算内保障完整交付。

### Ecommerce：收据协议失败，不等于业务失败

外层独立review通过，真实浏览器建议给出PASS，但正式准入拒绝，原因是 `validateUiActions()` 要求 `observed.includes(expected)`。

只读对照原生快照：

| expected | 原生文本 | 精确包含 |
|---|---|---|
| `"Order shop"` | `"Order shop"` | 是 |
| `"Signed in"` | `"Signed in"` | 是 |
| `"× 1"` | `"sku_<id> × 1"` | 否 |
| `"pending total 2599"` | `"Order <id> pending total 2599"` | 否 |
| `"paid"` | `"Order <id> paid"` | 否 |

这是模型把局部文字当成完整带引号文本的表达错误，**不是反斜杠解码问题，也不是浏览器卡死**。一次协议修正又冻结 `expected`，同样的表达仍被拒绝。原生快照显示数量和订单状态，不足以将未准入的建议改成正式PASS。该问题应后续在通用收据表示/诊断/受限表达修正中处理，不能通过业务用例专属断言、放宽业务判断或修改应用来解决。本轮未热改 harness、未重跑或改写原结果。

### Nested：首次外层通过

主 Mission 完成，跨仓选定 Track 交付；库存子 Mission 保持 active，未选 backlog 保留。内部独立验证及外层评审通过。

## 工程与安全验收

- `/tmp` 副本 `bun run check`：类型/lint通过，**733 pass / 0 fail / 7,785 assertions**，147文件。
- frozen public install、build、darwin-arm64 release、二进制一致性、无模型smoke、模型probe、真实浏览器fixture均通过。
- 本轮没有修改产品代码或E2E业务判据；仅新增mission监督/安装/审计脚本。安装脚本首次解析错误在任何全局写入前退出，修正后安装成功，失败未隐去。
- 正式审计：44上下文 Terra/medium、需求与policy不变、candidate/harness/global App一致、旧bin/workspace不变；15个正式 owned 端点均已不可达。校准worker也已关闭，所有运行临时auth已移除。
- 唯一 TaskSpace **6**，结束前确认 agent ownership；`finish({keep:[]})` 调用一次并resolve。没有替代空间、Chrome/OpenCLI fallback、购买配额或修改其他工具。

## 历史对照边界

上一轮 Round58 为最终4/5、首次2/5、161.62分钟；本轮最终3/5、首次2/5、134.32分钟。不能据时间下降声称编码效果改善：本轮有业务失败和收据失败，且每case仅一个样本，不是因果A/B。全局App提示词及最终harness哈希与上一轮最终资产相同；公开依赖/包组合发生了变化，随机生成也不同。既有benchmark的GapLoop/AttractorCheck/HumanConfirm均关闭，不外推到启用它们的检查强度。

## 可追溯入口

- [最终只读审计](/private/tmp/depa-codument-e2e-batch-PS1utS/observation.json)
- [原始五例报告](/private/tmp/depa-codument-e2e-batch-PS1utS/report.json)
- [批次监督状态](/private/tmp/depa-codument-e2e-batch-PS1utS/suite-status.json)
- [安装收据](/private/tmp/depa-codument-verification-WZ7LLa/global-install.json)
- [公开依赖证据](/private/tmp/depa-codument-verification-WZ7LLa/public-dependencies.json)
- [工程回归日志](/private/tmp/depa-codument-verification-WZ7LLa/check.log)
- 原始根均为 `/private/tmp/depa-codument-e2e-<suffix>`：Todo `zbXBo4`、Stream `9jbFYd`、Blog `q82uQ3`、Ecommerce `jsFhQI`、Nested `MwfnFL`。
- 预检根：模型 `BD3NFo`，浏览器 `KG1LNS`。副本与候选：`/private/tmp/depa-codument-verification-WZ7LLa/depa-codument/project`。
