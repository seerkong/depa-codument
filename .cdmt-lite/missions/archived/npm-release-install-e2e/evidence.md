# Evidence: npm 公共依赖安装与真实 E2E

- E1 — 2026-10-04 只读观察：当前 project 公共依赖固定 0.2.1；前次已归档 halfcode-cli-public-release 含 npm tarball 核验。旧 bin 与新 bin 是不同目标的软链接。本轮需重新观察和构建，不复用旧效果结论。
- E2 — preflight exit 0；prepare.ts 已创建 /private/tmp/depa-codument-verification-WZ7LLa，21 包公开元数据与 lock integrity 全部匹配，frozen install exit 0。完整 check 进行中。原 codument 字节 05206bf05959d0b10420a6cc5b5e6d2d67a5ba5cadee5f46ec1c178d69ddc3f8，真实 workspace 指纹见 snapshot.json。
- E3 — Ego 实际创建唯一 TaskSpace 6，ownership=agent，p1。全局旧 runtime manifest 仍含 halfcode-cli-lite-page-builder-vue-support 的 file 依赖；因此新安装需要完整阶段目录和 npm 公共依赖安装，不可沿用 round58 的保留旧依赖策略。
- E4 — prepare 全阶段 exit 0：公开元数据21包匹配、frozen install、check 733 pass/0 fail/7785 assertions、build/release 同 SHA、smoke。根 WZ7LLa 的 prepared.json 和分阶段日志是本轮证据。
- E5 — 安装首次脚本解析错误在写入前退出，改成清晰循环后执行 exit 0。global-install.json passed：bin 24cef075108a3f7c09f87ddb97d054e085b5c543d2cafe82f542ebffc9305cc8；三 agent 各46文件，App hash 452fe6…；完整新 runtime 49 个依赖安装自 npmjs，自有未发布合同包安装内置本地副本。备份 npm-021-stage-aedreN-previous，Skill backup upgrade-global-14h54E。旧 codument link/bytes、真实 codument/ 不变。
- E6 — 实际全局 --version/-h exit 0，显示0.6.0、默认 agents 示例和英文 operations，无 demo。ui-probe KG1LNS exit 0，model-probe BD3NFo exit 0，模型原生 usage 输入30211/缓存24064/输出390，非正式业务样本。
- E7 — batch.ts 启动唯一五例正式批次 PS1utS，PID56727，工具session37137。候选 SHA24cef075…，harness b89fb610…（与上一轮最终修复版一致），Terra/medium、Space6。不得将仍进行中的结果计为通过。
- E8 — Todo zbXBo4 正式 passed，2 个外层 attempts。首次 UI 正式 business FAIL：logout 后状态区域仍显示 Signed in，与登录/注册界面矛盾；模型在现有 Track 内纠偏，第二次独立评审/UI 通过。未手改应用，首次失败保留。批次自动进入 stream-pipeline-ai-agent，根 9jbFYd。
- E9 — Stream 9jbFYd 正式 passed，首次外层通过；内部 fresh verifier 曾检出词法错误桥接、tool-request fact 消费顺序问题，模型修复并复验。首次外层通过不等于零内部修复。已进入 Blog q82uQ3。Todo 两个 UI 服务端口已实际不可达，auth.json 已移除。
- E10 — Blog q82uQ3 正式 failed，3 次外层预算耗尽，总44.7373分钟。attempt0 外层发现 stored XSS；attempt1 外层PASS但真实UI发现评论提交后退回未登录表单；attempt2 外层独立HTTP复现 POST /api/login=404，登录能力缺失。三者均为业务finding而非基础设施失败；没有追加第四次或手改应用。批次进入 Ecommerce jsFhQI。
- E11 — Ecommerce jsFhQI 正式 infrastructure-failed，1 attempt，总17.0544分钟。外层业务review PASS，浏览器建议声称PASS但正式准入拒绝：Invalid browser action contract / Visible browser assertion failed；一次格式修复后仍拒绝，正式 ui-receipt failureClass=protocol-cost。不按业务失败启动纠偏，不将建议PASS冒充正式PASS。最后 Nested MwfnFL 已开始。
- E12 — Ecommerce 只读根因对照：5个 action 的 expected 中2个精确匹配、3个不匹配；并非反斜杠解码错误。实际快照文本为 `"sku_<id> × 1"`、`"Order <id> pending total 2599"`、`"Order <id> paid"`，建议将局部片段包成 `"× 1"`、`"pending total 2599"`、`"paid"`；这些含包围引号的局部串不是原快照子串。ui-contract.ts:19 精确 includes 拒绝，ui-acceptance.ts:347 修正协议冻结 expected，修正结果保持原错误。原生快照确实显示数量、pending、paid，但不能把这次不获准的建议改为正式PASS。只分析，不热改harness、不重置试次。
- E13 — Nested MwfnFL passed/首次外层，batch.ts exit0（监督流程完成，不表示五个业务全绿）。observe.ts PS1utS exit0：五正式样本最终3/5、首次2/5、1 business fail、1 infra；8,059,136ms；输入34,382,909/缓存32,034,304/输出363,072；44个Terra/medium上下文，15个owned端点不可达，所有正式auth移除；candidate/global/App/原需求/policy/harness/旧bin/workspace指纹过线。另已实际核对21包 .bun store realpath/version，未链接邻仓；全局builder实际导入0.2.1与build/watch导出成功。
- E14 — 预检KG1LNS worker实际不可达，KG1LNS/BD3NFo临时auth不存在；模型预检raw usage单独30,211/24,064/390。唯一TaskSpace6仍agent-owned，finish({keep:[]})实际调用一次并resolve。最终 result.md 如实呈现两类失败，未热修harness、追加试次或修应用。依据§7重读用户目标与AT1：本轮目标是公开依赖安装和真实测量，不是保证五应用无缺陷；授权内所有节点闭包，允许进入完成闸门。
- E15 — check_mission completion exit0；Status 改 completed，整体移动 archived/npm-release-install-e2e；check_mission archived exit0。报告与全部监督脚本在同一归档mission，无另一套执行状态。
