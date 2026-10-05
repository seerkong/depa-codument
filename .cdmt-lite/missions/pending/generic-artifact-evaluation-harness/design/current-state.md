# 当前事实与边界库存

观察日期：2026-10-04。本文件是规划证据索引，不是新的状态 authority。

## 1. 已完成的公共化基线

- 已归档 `halfcode-lite-feature-composition`、`halfcode-cli-public-release`；它们记录了公共 CLI feature 组合与 npm 发布。
- 当前 `project/package.json` 版本 0.6.0，公共 `halfcode-lite-*` 依赖 0.2.1。旧对话中的 0.1.1 不能覆盖现在的依赖事实；资源 descriptor/protocol 有独立版本轴。
- 新源码容器是 `/Users/kongweixian/infra-dev/halfcode-lite/`；主项目在其 `halfcode-lite/`。产品 CLI 与公共 CLI shell 是不同所有者。
- 现有生产命令组合真源在 `project/packages/product-capsule/src/commands.ts`，CLI command registry 通过生产 runtime 分面绑定，不应再复制一套产品 dispatch。
- 部分公共 README 仍写“not published”；这是低于 package/发布核验的历史投影，不据此否定已完成发布，也不在本 mission 顺手跨仓修文档。
- `cli-host-contract/src/process.ts` 的 ProcessSpawnSpec/health 契约较小；support/process 提供 detached PID、stop、health、port。它们不是带 provenance 的完整评估 process observer，不能仅因名称像就直接替换整个 runner。
- 公共 browser support 导出 Ego 等实现，但受限 reviewer channel 是安全策略的一部分。能 browser eval 不代表满足 restricted observation 契约。

## 2. 可以复用的现有能力

| 库存 | 位置 | 规划去向 |
|---|---|---|
| argv 启动、deadline、进程释放、run provenance | `project/e2e/runtime.ts` | 评估 support；产品安装/身份保留适配器 |
| 原始目标锁定、交付指纹 | `project/e2e/integrity.ts` | 通用 frozen input 与 isolation 支撑 |
| Codex/Eidolon 调用和原生 usage/身份 | `project/e2e/agent-runtime.ts` | agent support 及薄 runtime adapter |
| 持久 browser owner、serial queue、dedup、fencing | `project/e2e/browser-owner.ts`、`browser-channel.ts` | browser observation adapter，不扩大 reviewer 权限 |
| 原生 observation IDs 与 protected trace admission | `project/e2e/ui-acceptance.ts` | evidence admission 的通道适配 |
| 一次表示修正且 semanticIdentity 冻结 | `project/e2e/acceptance-protocol.ts` | 复用协议，扩展到通用结果轴时保留旧语义 |
| 隔离只读复验根 | `project/e2e/ui-gate.ts` | eval-only 的历史浏览器消费入口 |
| fresh semantic review、策略/模型 provenance | `project/e2e/workload.ts`、`report.ts` | 通用判断调用 + 产品报告适配 |

现有默认业务闸门已不调用固定生成应用 oracle。旧 HTTP/DOM/Stream/Nested oracle 是历史材料与测试，不应误诊为当前主路径。

## 3. 需要隔离或验证的耦合

| 现象 | 位置 | 判断 |
|---|---|---|
| 五例白名单与 stream/nested 决定工具环境 | workload.ts、report.ts | 保留基准 adapter，不作为通用评估输入 |
| Track 完成、CLI validate、Hook/归档关联 | workload.ts | 产品工作流闸门，不是任意交付物评估的前提 |
| 非 stream/nested 假设 package.json test/typecheck/build | workload.ts | 工程能力发现应由 adapter 提供，不进入 core |
| api/ui/cross-boundary/artifact/unspecified 封闭分类 | acceptance-scenario.ts | browser scenario 分类，不是全领域的义务模型 |
| e2e-server.json 与 /health 启动探测 | ui-gate.ts | 当前应用 adapter 的契约，不要求库/CLI 仿造 |
| bun/npm/pnpm/node/python/pytest 命令观察范围 | execution-evidence.ts | 已知 runtime 兼容解析，不能作为真实执行或通用语义的充分条件 |
| source quote 与 requirement ID 全覆盖 | acceptance-scenario.ts、ui-acceptance.ts | 来源/引用规则有价值，但无法证明原始目标无遗漏 |
| substring/full-page 作为 receipt 条件 | ui-contract.ts、ui-acceptance.ts | 真实性/局部观察，不等于业务充分性；需校准异步和错误状态 |
| 手工 receipt 与 native automated receipt | ui-gate.ts | 保留 attestation 级别，禁止同等证明力混计 |

## 4. 已有真实反证

原 refactor mission 的 `verification/latest-e2e-round58.md` 记录最终 4/5、首外层 2/5。这是旧报告，不代表新的 npm 安装批次结果，也不是稳定统计。

- Todo：readonly 复验发现 UI 使用 URLSearchParams 的属性赋值，过滤条件未进入 URL；backend 正确仍不能证明真实 UI 入口正确。
- Stream：脚本桥接测试通过，真实入口缺工具定义/工具调用 transcript；提示需要验证真实因果闭环，而不是增加某行业模板。
- Ecommerce：失败任务阻塞后续 queued 作业；小演示通过未覆盖失败后的进展关系。
- 协议转义、select 预派发拒绝与基础设施超时曾掩盖业务判断；最新 adapter 已做过部分修复，本 mission 首轮需重观察，不盲目重复旧补丁。

这些只用于构造通用错误模式与验收器负向校准，不作为修改已生成应用的授权。

## 5. 并行工作与证据时效

- `npm-release-install-e2e/evidence.md` E4 记录 isolated check 733 pass；E5/E6 记录新全局 0.6.0/npm 0.2.1 安装与 probes；E7 记录五例 batch 已启动。本轮未执行这些命令，引用的是该 mission 证据。
- 批次来源 `/private/tmp/depa-codument-verification-WZ7LLa/depa-codument/project`，batch `/private/tmp/depa-codument-e2e-batch-PS1utS`，owner 记录 TaskSpace 6。不能由本 mission 复用、结束或计为完成。
- worktree 有大量共享改造。实现前需重新冻结 source hash 和 shared read dependencies；本规划不占有其他人的 edits。
- 历史 Todo 候选 `/private/tmp/depa-codument-e2e-6RHPUl/workspace` 的存在性与匹配需求尚待重观察。路径只是候选证据，不是永久实现配置。
