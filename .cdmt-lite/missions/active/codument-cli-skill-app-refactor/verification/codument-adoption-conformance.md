# Codument 公开制品采用（B02）

当前证明只关闭包消费和既有产品接缝，不证明所有旧领域命令或最终发行完成。

- 公共 set：`host-release-round-15/release-set.json`，digest `7cadb628cdc10a12b74ce6ee9160db026284e1baabb1f8159714d6e5a945a973`，与 Halfcode B01 相同，未重包公共源码。
- 最新 C 十一包：`round-15-codument-final-adoption-artifacts/release-set.json`，digest `13feae1a8fd2ea77747888b0015ffdfddee792e4b84911ae9f53f7a6226220bd`。普通按名称/版本传递解析，不使用 overrides，安装后关闭临时 registry 才执行。
- `logs/round-15-codument-final-adoption.log`：99 领域回归、installed-source strict typecheck、旧 C 冻结 tarball 精确兼容、实际安装 CLI 的资源/LF/Page/Vue/MCP/Serve close 全通过。
- `logs/round-15-codument-final-adoption-check.log`：根 typecheck/lint/444tests 全部 exit0；继承文档失败已修复，无删断言跳过。
- `logs/round-15-codument-retired-architecture.log`：十一产品包无反向依赖、循环、跨仓 source alias、旧八包双源码；212tests 通过。后续 canonical HTTP 局部变更另由根 check 覆盖。
- `round-15-retired-generic-files.json`：153 项已退役副本均验证原快照与当前 bytes 相同；全部可由 `cross-repo-baseline/C.json.gz` 恢复。

DEPA 事实边界：四 domain 包持有领域契约/纯转换/文件支持/owner；host-adapter 持有产品命令及 reader identity 转换；product-capsule 显式组合 domain、正式 codument/ source、authoring policy 与 live record 协议；cli-shell 拥有领域入口 framing 和关闭。三个历史 native 包仅保留精确作者/worker/MCP 身份兼容，通用实现来自公共包。源 authority 不反写为缓存，九 Kind 内置。

保留条件：原 `src/`、真实 `codument/` 及用户 attractor 未改；init/status/upgrade-workspace 合并仍 DEFERRED。新 domain ready 目前只是内部公开接缝，不能冒充主 CLI 已包含全部旧命令。旧领域迁移、workspace installer、升级兜底、token 与最终双 bin/native 仍由工作图后继验收。
