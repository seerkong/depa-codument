# 最终独立重观察与验收（gap-1 修正后）

此文件是当前验收投影，替代被 E53 作废的 Round10 完整性声明；历史测试保留在 evidence.md。目标来自 MISSION 五项期望、七项约束与 AT1，不来自勾选或结构 checker。独立复核见 [gap-2](../reports/gap-2.md)。

PATH 包含 /Users/kongweixian/.bun/bin。B=/private/tmp/halfcode-lite-migration-OYWITp；H、D 分别为 Halfcode 主根和 depa 的 project/。

## 最终命令及信号

| 覆盖 | 命令 | 实际结果 / 日志 |
|---|---|---|
| 期望-1，约束-2/7 | 原备份 snapshot；audit-boundaries；manifest/lock 对照 | 55,476 项原内容摘要不变；canonical family 统一；889 public imports，44 packages，21 shared；HEAD 未改 |
| 期望-2/3，约束-1/5 | H/D：bun run typecheck；bun run lint | exit 0；包含 actual production-profile-types 和原空 runtime 反例 |
| 期望-2/3/5 | H/D：bun run test | H 574/0，D 733/0；upstream-gap-final-12.log / depa-gap-final-12.log |
| 期望-3/4 | H：bun scripts/verify-feature-composition.ts B/composition-12-release | minimal-gap-12.log；公开 clone generator 生成物类型/运行/缺 sop 负例、未选 Page 负例、20 依赖闭包均通过 |
| 期望-3/4，约束-4 | H：bun scripts/verify-public-cli.ts --resources --release-set=B/composition-12-release | resources-gap-12.log；resource admission、closed capture、安全负例通过 |
| 期望-2/3/4 | H：bun scripts/verify-public-optionals.ts --halfcode-product-cli --release-set=B/composition-12-release | optionals-gap-12.log；Vue/MCP/Serve/HTTP/模拟 browser、owner/borrowed 关闭及完整 Halfcode CLI 通过 |
| 期望-4/5 | mission：bun verification/verify-products.ts B/composition-12-release B/depa-composition-12-release | products-gap-12.log；两 source tarball 关闭 registry 后构建运行；83/143 embedded assets；历史迁移备份、原记录与第二次 noop |
| G4，期望-4 | H/D：bun run pack:native B/<product-native-12> | 正常 build 生成 payload，根版本派生 launcher；native-halfcode-12.log / native-depa-12.log |
| G4/C1，约束-3 | mission：bun verification/verify-native-products.ts B/composition-12-release B/depa-composition-12-release B/halfcode-native-12 B/depa-native-12，另加 --npm 再跑 | Bun 与真正 npm 安装均通过；版本、唯一 bin、命令执行、无 Kind 副本、缺 optional 失败；native-products-12.log / native-products-npm-12.log |
| 约束-3/6 | global-protection-gap12.json；执行路径审查；两仓 git diff --check | 摘要前后相同；无 global install/发布/真实模型或浏览器；全部验证写独立临时根 |

AT1 各排除项的负向证据见 [final-boundaries](../inventory/final-boundaries.md)。宽回归过程中发现的 runtime 注入回归与 launcher 版本错误已纠正，旧失败日志保留；不把定向测试代替最终完整回归。

## 不可变候选

| 目录 | SHA-256 release-set digest |
|---|---|
| composition-12-release | 87d602b1d02ff0f6f68917cc607a3c6ed4feafbb936b2dfa8f7a3f5028ac31d7 |
| depa-composition-12-release | b0c5225b8bd8560fa10d514d40cccec79225043a447153b0b7fbd6cc2bbc32ec |
| halfcode-native-12 | 0d5ef8f6f38f61982638e46a0bfe0953eb4f4994323a0c4c982c756d657b7f13 |
| depa-native-12 | c3b59fbee9eb962f2984cbc2769ce05778a57f29128baa18399e9f613a002224 |

公共候选为 0.2.1-composition.12，descriptor ABI 仍 0.1.1，协议版本未联动；产品版本为 Halfcode 0.2.0、depa 0.6.0。候选没有发布到 npm；vendor tarball 来源仍是本机现有安装重打包，不冒充 publisher 认证。只声明 macOS arm64 原生运行验证。

开发 bun.lock 中 localhost URL 是关闭后的本地候选源；需要重新安装时用 install-candidate.ts 重开 registry 并由 Bun 更新 receipt，不手写 tarball/hash。恢复和兼容期限见 [compatibility-boundaries](../inventory/compatibility-boundaries.md)。
