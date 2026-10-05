# Gap 2：halfcode-lite-feature-composition 修正后复核

检测日期：2026-10-04。

结论：**gap-1 的 C1、G1–G4 已闭合；本次任务范围内未发现阻止验收的残留 gap。**

方法：重新读取用户要求、MISSION、AT1、原 gap 反例以及实际源码/Agent 资产/制品与命令输出；没有采用旧 Acceptance 勾选或 checker 作为目标证明。实现冻结后的本阶段只观察并写报告，不再修改业务源码。独立重观察由当前 agent 完成，没有冒称 fresh 子代理审查。

路径约定：H=/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite；D=/Users/kongweixian/infra-dev/depa-codument/project。日志和不可变候选均位于 /private/tmp/halfcode-lite-migration-OYWITp。

## 权威冲突

无待裁决冲突。C1 按用户授权修正后的 D11 执行：之前获批迁移的 14 个 demo 定义保留在 H/packages/cli/test/fixtures/demo-kind-definitions，不默认安装到每个 App。没有删除历史协议夹具、改变 FQN 或迁移其他用户 workspace。

## 原反例的复验

| 项目 | 实际改向 | 可证伪证据 |
|---|---|---|
| G1 公共 live 副本 | PageWorkflow/PageObject HTTP 请求与 receipt 归 skill-app-logic/page-live-client；Serve lifecycle 和 Agent/control/Ego 结果规则归 cli-host-logic/agent-client；两产品 app/invoke 只绑定这些公共入口 | 同一 fake transport 下 stopped、HTTP failure、receipt、locked-thread、失败退出测试；两产品 Serve/MCP/HTTP 完整回归；原 PageWorkflow/PageObject endpoint/receipt 算法不再位于各产品副本 |
| G2 静态组合链 | 正式入口使用 ProductionRuntime 判别 union；completeRuntimeProfile 要求每个实际 profile 的必需端口；requireResourceFeature 为静态完整合同，显式 admitLegacyResourceFeature 留给借用兼容入口。LocalFunction catalog/invoke 与 MCP config/connect 分离 | 两仓 production-profile-types：basic→catalog、catalog→live、错误 placement/profile、原空 runtime 反例都产生类型错误；实际生产命令矩阵通过。独立真实 clone 生成物通过类型检查，删掉实际 producer 的 sop 后 tsc 失败 |
| G3 Kind/readable | 公共 createResourceHostRuntime/readers 支持 readableKinds；完整产品显式选择全部 inspection，最小 CLI 仅 SkillApp/SOP。可读 schema 不等于获得执行 effect | 子集 Kind 源只有两种；Page resolvePortableSpec 被拒绝；在真实生成 App 增加 Page catalog 后 Resource validate 非零。未选择 Browser/Serve/MCP/Vue/Hono/Vite 不进入最小闭包 |
| G4 npm 安装入口 | 公共纯 createNpmLauncher + 两产品 prepare-native-release，根 manifest 版本/目标表派生 launcher 和平台 metadata。launcher 是唯一 PATH bin，平台包只供 payload | Bun install 和真正 npm install 均从本地闭合集安装两产品，执行 --version/help、init-workspace、Resource validate、SOP list 和未知命令失败；depa status/discuss；移除依赖可达性后 launcher 明确报缺平台包。原生安装发现并修复 Halfcode 旧 0.1.0 硬编码 |
| C1 默认 Kind 副本 | demo manifest 移除 KindDefinitions catalog；标准定义由 Host 提供，显式夹具保留迁移后的原文件 | source 资源清单、embedded 安装与真实 npm 安装根都无默认 KindDefinitions；旧兼容锁/指纹回归仍通过 |

动态 registry policy 入参需要 admission；其中经过 placement/profile 检查的类型缩窄不用于伪造 capability。旧 CommandRuntime 和旧 dispatch 暂保留给借用/测试/嵌入端，不是正式进程组合的类型证明。生产命令与兼容树都来自同一 product factory，不另立命令 authority。产品特定 demo/status、workspace path、agent/env 策略没有强塞进公共 logic。

## 最终实际验收

- H 最宽 `bun run test`：574 pass / 0 fail / 5478 assertions，34.85s，135 files。
- D 同命令：733 pass / 0 fail / 7785 assertions，124.88s，147 files。
- 两仓 `bun run typecheck`、`bun run lint`、`git diff --check` 通过。
- audit-boundaries：44 packages、21 shared、889 public imports；DAG、直接依赖、有限 exports、无 shared→product 或跨仓源码依赖通过。此机械审计不代替上表行为与 ownership 复核。
- minimal-gap-12.log：真实 tarball、JS+d.ts、真实 clone generator、缺端口编译负例、未选 Kind 和未选 npm 能力负例通过；20 个基础消费者依赖。
- resources-gap-12.log / optionals-gap-12.log：公共资源 admission、可选 Vue worker、MCP、HTTP/Serve、workflow、borrowed/owned 生命周期与完整产品 CLI 通过。
- products-gap-12.log：两独立 source tarball 构建、registry 关闭后运行、模板隐藏后 embedded 仍工作（83/143 assets）；depa 历史 workspace upgrade/backup/noop 通过。
- native-products-12.log / native-products-npm-12.log：两产品 native 安装链通过；npm 根 halfcode-native-install-3nZ2HB，Bun 根 halfcode-native-install-qGJz1Q。
- 原备份再遍历 55,476 项，摘要仍 362dceb52313b54ae8b10ada40b14edaa69d4c498e1c58333e0289a50f4f3f7d。上游 HEAD 9666641、depa HEAD aab479c 未改变。
- 最终验收阶段的全局 bin/skill 摘要前后相同，见 verification/global-protection-gap12.json；不将它冒称为本任务最早开始时的快照。

## 产品面与边界

重新查看 Halfcode global host/authoring skill、depa global SKILL 与 clone SKILL/README：canonical CLI 指向 halfcode-lite/depa-codument；depa 的 codument-* description 是用户要求的旧入口兼容映射，动态操作仍通过 CLI 发现。项目目录仍 codument/，global 指导树仍由 depa 资产 owner 提供。旧半品牌 reader/FQN、APP facade 和外部 apps 按已登记兼容边界保留，不机械迁移。

本轮没有新增 npm 发布、全局安装、模型 E2E、真实浏览器调用或其他仓库改造。只在当前 macOS arm64 实际执行原生包；Darwin x64/Windows 目标映射与打包入口存在，不宣称完成其他 OS 的执行验收。Halfcode authoring skill 既有内容完整性等不在本轮 G1–G4 修正范围，未扩展为全面产品文档审计。

更完整的结果映射、候选摘要、恢复命令见 verification/acceptance.md、inventory/final-boundaries.md 和 inventory/compatibility-boundaries.md。

