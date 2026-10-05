# Evidence: Halfcode CLI 公共包改名与 npm 发布

- E1 — 只读盘点 — 两仓共享包共 21 个、版本 0.2.1-composition.12，五个 cli-host-* 与产品 cli-shell 重名风险；Weaver 两个 Git 根均命中 infra-dev 排除规则，不采集。npmrc 只检查字段名未输出值。
- E2 — npm 预检 — npmjs.com whoami = kongweixian；21 个新公共包名公开元数据均 404，无已发布 0.2.1。第三方直接依赖均可从 npmjs.org 解析。npmjs.org 不带 .com 配置凭据的失败不代表用户 token 无效。
- E3 — 身份迁移 — migrate-names.mjs protect/rename exit 0；244 文件机械改名与正式版本更新，逐文件旧内容备份在 /private/tmp/halfcode-cli-public-release-NRFNf0/before；补齐 .ts.txt fixture。产品壳独立为 halfcode-lite-product-cli-shell。Halfcode bun install 与 typecheck exit 0。
- E4 — 发布前候选 — candidate digest 0bcb49e9a2cc4e3d3111fb1dda3f0b4fe6fcc7e6e0663e7f97e970f23ed59635；21 shared、其余 product/vendor 不允许发布。audit.json 全部通过（首次严格白名单拒绝了合法 browser assets 与 EXECUTION.md，明确按包补白名单后通过）。最小消费者/真实 clone missing-port 与未选 Kind 负例通过；optionals-candidate.log 同 digest 的浏览器模拟/MCP/HTTP/Workflow/Vue/实际 Halfcode 产品CLI通过，非真实浏览器或模型 E2E。
- E5 — 迁移回归 — H 原有574测试通过；两仓 typecheck/lint exit0。新增 identity 回归先发现测试目录计算错误，修正后1 pass/37assertions，最终全量待回收。simpify 审阅仅新脚本/测试，未重构已有业务能力。
- E6 — 完整验收反馈 — depa 733 pass/0 fail/7785 assertions（141.25s）。H 新增测试后的全量574 pass/1 fail，文件并发物化用例5000ms超时；同用例隔离4 pass（其中并发20ms），正在其他重负载任务结束后串行重跑最宽命令，未改测试超时/断言或业务代码。公开依赖盘点262项中只有待发布21项404，其余241项精确版本均可用。
- E7 — 最终发布前回归 — halfcode-test-serial.log 575 pass/0 fail/5518 assertions，36.06s；半编码变更为重命名，产品职责未合并。候选共享代码之后未修改；新增身份测试与root README不影响已审计tarball。两仓最终类型/lint过线。准备按用户授权发布21包0.2.1。
- E8 — npm 异步发布反馈 — 首包 skill-app-contract PUT202/exit0，返回 processing notice，公开元数据仅0.0.0-stage；npm stage list=[]，无可审批stage。原脚本立即读后断言失败，未重复上传；据此改为持久 upload-acknowledged 与 live integrity 分离，重跑跳过已受理包，只读最终核验。首包受理证据追录至 verification/upload-ledger.json；其余包按同一拓扑提交，完成上传不宣称公开可用。
- E9 — 公开发行 — 21次受理全部记录，未重复上传；观察10→18→19→21可用。2026-10-04T18:32:04.811Z registry-observation-5.json：21/21官方tarball下载SHA512与candidate完全一致，版本0.2.1，全部latest=0.2.1。最慢cli-logic/skill-app-support约5分钟异步处理；stage list均空，不需要更改认证或人工审批。
- E10 — 公开锁与探针反馈 — 262个外部锁条目精确版本全部公开可用；public-lock只替换URL/SRI，原仓强制公开源frozen install exit0（516包）。独立npm install成功；首次probe错误要求所有包都有非空运行时exports，被纯类型合同包证伪。只修harness允许type-only模块，新增真实生成产品tsc；未修改或重新发布任何库。
- E11 — 隔离公开源回归反馈 — 第二轮公开npm安装/21入口/clone功能与类型负例、depa frozen install/typecheck/lint通过；完整回归730 pass/3 fail，均为snapshot clone要求Git仓而测试副本未初始化Git。修正验收副本构造：只在临时copy执行git init（不复制原仓.git，不提交），保留业务的非Git拒绝规则。没有发布包变更。
- E12 — 证据精度补充 — E11“类型负例”表述不精确：公开源第二轮执行的是生成产品正向tsc和unknown-command退出码负例；missing-port类型负例在E4精确同字节候选中执行，不冒充公开源独立再次运行。check-identities.mjs exit0：21 shared/五个新名/产品壳独立/当前源码旧引用零/公开lock；21实际依赖realpath均在project/node_modules内。H最终typecheck/lint、两仓diff-check通过。
- E13 — 公开源完整消费者验收 — public-consumers-3 exit0/passed=true，证据复制至verification/public-consumer-receipt.json。全新npm安装21包、入口解析/加载、真实clone生成物Bun安装/tsc/about/Resource/SOP/未知命令负例通过；全新Git临时depa副本公开源frozen install/typecheck/lint/test/build全部通过，编译bin的version/init-workspace/Resource validate/status/discuss help/未知命令负例通过。8个原全局/工作区保护指纹仍一致。
- E14 — §7最终独立重观察 — 重新读取用户目标/MISSION/AT1，以实际manifest/源引用/公开tarball/干净消费而非勾选重建结论。H最终575 pass/0 fail/5518assertions（40.59s），D公开源733 pass/0 fail/7785assertions（112.71s）；143内嵌资源的0.6.0 binary隔离smoke通过。类型/lint、两仓diff-check、check-identities与8路径verify-protection均exit0。全部排除集已覆盖：唯一身份/闭合公开依赖/真实下载SRI/只发布21共享白名单/历史与原workspace保护。无欠验done节点。
- E15 — 归档 — check_mission --phase completion exit0；Status completed，整个mission目录active→archived，check_mission --phase archived exit0。返回条件为§7已完成，不以npm上传受理或结构checker单独充当成功。
