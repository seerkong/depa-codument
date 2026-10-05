# 当前兼容边界与发行限制

本表为最终候选状态。未授权 npm 发布、全局安装或迁移其他在用 App。

| 边界 | 当前处理 | 退出条件 / 限制 |
|---|---|---|
| 公共 npm family | 21 个 shared 包统一为无 scope 的 halfcode-lite-*；本地候选 0.2.1-composition.12 | 未发布 npm；不覆盖旧候选内容 |
| npm / descriptor ABI / resource protocol | package version 来自 manifest；ABI 0.1.1、protocol 2 保持独立 | 错版本、lock、integrity 仍 fail closed |
| 当前 resource authority | 用户批准 @halfcode-lite/skill-app-contract/resource-contracts/v1；owner 为 @halfcode-lite/skill-app-contract | 这是协议标识，不是 scoped npm 依赖 |
| 旧 CLI / APP authority | canonical 工厂可显式生成原 identity；CLI/APP golden fingerprints、旧 lock/profile 测试保留 | 不自动 alias 旧 code-first package，不改历史 fixture hash |
| @halfcode-app-lite/skill-app-contract facade | 只保留 APP 旧身份的薄兼容实现，不进入新 shared release 或主产品依赖 | 本候选保留；下个 stable release 前按外部 consumer 调查决定退役，不擅自删除外部仍可能使用的接口 |
| Halfcode 内置 demo | 14 个已迁移定义保留于显式测试夹具；不进入默认 workspace 安装 | Host 提供标准 Kind；未改用户其他安装实例或旧合同 fixture |
| halfcode-lite-apps / playground | 原样随容器移动；apps 的两个原 untracked 目录仍保留 | 旧 scoped dependency/FQN 属外部 App 的独立迁移，不机械修改 |
| reader/profile/browser session / App resource identity | halfcode-app-lite.host 等协议 ID、半旧 demo FQN/路径、OpenCLI plugin/session 保留 | 不属于 canonical npm family，变更要走单独协议/安装兼容决策 |
| depa 三个兼容 facade | contract@0.1.1、MCP、Vue wrappers 转发公开实现；无第二算法 | 保留当前产品既有消费面；后续外部使用调查后退役，不借本次 rename 破坏用户 App |
| Halfcode cli-shell | 保留产品 argv/agent/help dialect，调用中立公共 runCli/host | 不是第二 dispatcher；不把产品参数策略放入通用 shell |
| 全局 old/new binaries 与 skills | 不安装、不切换；测试安装和升级写入独立临时根 | 全局发行另需用户授权 |

| 借用式 legacy runtime | CommandRuntime 与 admitLegacyResourceFeature 保留测试/嵌入兼容；生产入口使用 ProductionRuntime 的 required profile 和静态 requireResourceFeature | 不能用显式 legacy admission 声称静态完备；真实 profile/clone 负例加入常规 tsc 与制品验收 |
| npm launcher / native payload | 两产品已在临时根通过 Bun 与真正 npm 安装和执行；payload 无 bin，launcher 独占 PATH | 只验证当前 macOS arm64；x64/Windows 的目标映射已定义，不宣称在对应 OS 运行通过 |

## 已验证候选与恢复

制品根：/private/tmp/halfcode-lite-migration-OYWITp/

- composition-12-release：186 个制品，21 shared + 6 product，其余 vendor；digest 87d602b1d02ff0f6f68917cc607a3c6ed4feafbb936b2dfa8f7a3f5028ac31d7。
- depa-composition-12-release：11 个产品制品；digest b0c5225b8bd8560fa10d514d40cccec79225043a447153b0b7fbd6cc2bbc32ec。
- 三消费者均从上述真实 tarball 安装、构建与执行；最小消费者额外验证公开 clone generator 的实际输出，不是另一份手写近似产品。
- halfcode-native-12 / depa-native-12 各含 launcher 与当前平台 tarball、content-addressed release-set。发行入口由根 manifest 版本与 release-targets 派生；Halfcode 二进制版本硬编码已修正。
- vendor 制品来自现有本机安装内容的打包，不冒充历史 npm publisher 认证；验证当前 macOS arm64，不宣称完成其他 OS 原生执行。

depa 开发 lock 中 localhost URL 是候选 registry receipt，不是 npmjs 地址。端口关闭后不能只运行一次普通 bun install 就期待远程可用。保留整个 release-set 后，在本 mission 目录执行：

```sh
bun verification/install-candidate.ts /private/tmp/halfcode-lite-migration-OYWITp/composition-12-release
bun verification/verify-products.ts /private/tmp/halfcode-lite-migration-OYWITp/composition-12-release /private/tmp/halfcode-lite-migration-OYWITp/depa-composition-12-release
```

install-candidate 重开闭合 registry 并由 Bun 重新生成当前端口 lock；不会伪造 tarball/integrity，不全局安装。临时制品被清理后，可先在 Halfcode 主根运行 scripts/prepare-release-set.ts 到新目录，再运行上述安装，最后在 depa project/ 根运行 scripts/prepare-release-set.ts 创建产品集。最终 npm 发布或长期制品托管不在本次授权范围内。

## 锁与备份

上游 Bun 保留旧 workspace metadata 的情况已显式纠正：只从 manifests 更新 workspace name/version 后由 Bun 重新序列化；packages 制品区与纠正前逐字一致。尝试移除 workspace 区导致 Bun 放弃锁并重新解析，已恢复原锁，没有采用那批重新解析结果。

迁移前完整备份 original/ 的 55,476 项已重新遍历，摘要仍为 362dceb52313b54ae8b10ada40b14edaa69d4c498e1c58333e0289a50f4f3f7d。上游 HEAD 保持 9666641；未提交其既有 dirty/untracked 修改。
