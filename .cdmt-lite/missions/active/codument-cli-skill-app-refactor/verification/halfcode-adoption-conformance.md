# Halfcode 自消费闭合（B01）

这是 B01 的证据投影，不是第二工作图或整个 mission 的验收声明。

## 已观察的采用

| 公共能力 | Halfcode 实际产品绑定 | 证据 |
|---|---|---|
| T01–T05 CLI contracts/dispatch/按调用 runtime/关闭/service controller | 实际 registry 57 叶子、product cli-shell、原 CLI entry、Serve manager；原参数/JSON/消息保留 | E145–E147、E160、525 项根回归 |
| T06–T08/T12 Kind/catalog/descriptor/materializer/capability execution | product-capsule 固定旧身份与精确 authoring 名，CLI 只绑定软件配置；SQLite/profile/LF public executor 实际采用 | E148–E154、E160、公共及完整 CLI 隔离安装 |
| T09 browser/effects/compiled/debug | product-capsule 选择旧 marker/plugin/task-space；无旧 global client_fetch 注入器 | E141/E157/E158 |
| T10/T11 Vue/MCP | 原生包只转发 public implementation，Halfcode URI/页面名/stdio/worker 定位保留为产品边界 | E155/E157、完整安装 CLI 的真实 Vue 构建/MCP 资源读取 |
| T13/T14 Page/live/HTTP | product Page host、HTTP listener/router、明确 owner 关闭顺序；普通 LF 不构造 Page/Codex/Serve | E154–E160、实际 CLI→loopback HTTP→Workflow 与关闭负例 |

产品 CLI 包保留 final bootstrap、命令定义和产品特有 Agent/Page 协议；它们不成为通用包默认值。product-capsule 实际组合资源、Page 与可选 effects；共享机制不反向导入产品包。原生 scoped authoring/Vue/MCP 名称是已批准的有限兼容入口，不恢复第二实现。

## 验证边界

- `round-14-native-recovery-*` 七组全部 exit 0；根 check 525 pass/0 fail/2882 assertions/117 files。
- 最低 Bun 1.3.0 镜像下载 SSL timeout 已保留；换原始 npm artifact 地址且验证相同 SRI/binarySHA256 后，`round-14-minimum-recovery-origin-*` 三组 exit 0。
- 新 release tooling 后根 `bun run check`（53023）再次 525 pass/0 fail，typecheck/lint 通过。
- immutable set `host-release-round-15/release-set.json` digest `7cadb628cdc10a12b74ce6ee9160db026284e1baabb1f8159714d6e5a945a973`：14 shared + 6 product + vendor，共180项。制品有逐项 SRI，消费不重新 pack。
- `round-15-halfcode-release-manifest.log`：同 set 正常 registry 安装，无 overrides；关闭 registry 后运行完整 CLI，以及固定历史旧制品→当前同名转发包的 name/version/SRI/API/完整旧 lock/profile 校验。错误版本、名称、API、完整性和未知 profile 拒绝；真实旧名 code-first App/HostBundle 经 CLI validate/invoke 成功，作者 bytes 不变。
- 旧输入来自 rec-01 gzip 中原始文件并逐文件校验，不从现有 H 源码再生成“历史”。两个冻结 tarball 及其 provenance 见 `legacy-frozen-fixtures.json`。该 frozen 版本的 resource-first→新公共包映射也已通过（14135）。旧名 code-first 直接改成新公共名仍明确 migration-required；产品同名转发与公共改名准入是不同 case。

## 后继而非 B01 缺口

Codument 依赖采用、同 set 第三消费方、clone 模式、native OS 配方/实机 smoke、三暂停命令、真正全局安装/产品入口切换仍按工作图后继验收。此处未 npm publish、未运行真实浏览器或发送消息、未改两个外部示例。vendor 为已安装依赖的本地重打包，不能外推为历史 npm 发布者认证或跨平台证明。
