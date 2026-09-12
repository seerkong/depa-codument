# Codument 新 CLI 骨架

此目录承载正在迁移的 Codument 产品。公共机制通过精确版本的 `halfcode-cli-lite-*` 制品消费；领域操作、资源身份和产品装配留在 `depa-codument-*` 包。开发需要 Bun >= 1.3.0。

正式 workspace App 位于 `codument/`；`.codument/` 只保存 Host 私有状态。资源查询与领域操作在 CLI 本地执行，Page/Workflow 的长生命周期才需要 Serve。内置领域 Kind 不复制到 workspace。

新版本仅提供 `depa-codument` 可执行命令（Windows 为 `depa-codument.exe`），不安装 `codument` 别名，以保留旧版 session 的命令入口。`bun run build` 输出 `dist/depa-codument`；平台发行包同样只暴露新名称。仓库根的旧版构建入口尚未切换，不用于构建新版本。不要把旧发行制品当作当前版本重新安装；本次未更改本机全局安装。

当前是核心重构阶段：旧产品 `src/` 尚未退役，`init`、`status`、`upgrade-workspace` 的最终组合等待独立确认。这里的构建产物不等于已完成旧命令迁移或已经发布 npm；不要用它升级真实 workspace。

开发检查：`bun run typecheck`、`bun run test:cli`、`bun run check`。隔离制品消费及完整兼容门禁在独立 Mission Lite 的 evidence 中记录，窄测试通过不替代完整验收。

产品版本只在本目录 `package.json` 的 `version` 维护。CLI 帮助、`--version`、HTTP/MCP 元数据共享该值，独立二进制在构建时嵌入，不读取运行目录的清单。`bun run build:release` 在成功构建各平台后自动投影版本到对应发行包清单，`check:release` 校验清单与二进制一致；无需手改 `src/version.ts` 或平台包版本。私有源码包、领域/公共依赖包版本以及资源协议版本独立管理，不随产品显示版本批量修改。修改产品版本后须重新构建和安装，已安装二进制不会自动变化。仓库外层清单仍属于旧发行入口，不是新 CLI 的版本来源。

公共包尚未发布时，消费验收显式指定预先准备的不可变制品目录：`CODUMENT_VERIFY_RELEASE_SET=/absolute/release-set bun run verify:mission -- consumer`。目录须包含 `release-set.json` 与内容寻址 tarballs；验证器校验摘要、普通传递安装后停止本地包源，再执行独立 Notes。`consumer --scope cli` 验五包基础闭包，`consumer --scope domain-core` 另打包当前四领域包并消费同一公共 set。测试包源只服务本地已准入制品，不代理 npm，不构成产品 Serve。缺少制品时明确 UNVERIFIED，不回退源码路径。最终 native 发行仍待后续兼容验收；Vue worker 需要 Bun >= 1.3.0，可通过 `BUN_BIN` 指定。

参见 [使用示例](USAGE-DEMO.md)。Codex 可使用 Page 界面，Claude Desktop 可使用 MCP App；二者借用同一资源与执行能力，不拥有第二套正式数据。
# Clone modes

Original `bun.lock`/`bun.lockb` files are retained even when gitignored, with an explicit `additionalSource: original-lock` receipt entry. This exception does not collect other ignored files.

`bun run clone /absolute/new-product --bin example --package example` creates a small public-package consumer (product capsule, CLI shell and resource-first `app/`), not another copy of Codument's implementation. Package prefixes may be unscoped. Public mechanisms are provided by exact `halfcode-cli-lite-*` dependencies. This generic third-product scaffold does not change Codument's formal workspace directory: that remains `codument/`.

`--mode source-only` copies the explicit source allowlist with a receipt; `--mode full` copies all Git-eligible current files, including dirty tracked/eligible untracked files, tracked ignored outputs, and the original lock. Nested Git roots work. Deleted tracked paths are recorded; symlinks are retained without following them. Neither mode changes identities or installs dependencies. Non-Git input and unexpanded submodules fail explicitly. Targets must be absent or `--force`-allowed empty ordinary directories; source drift or destination conflicts abort without publishing a partial target.

Optional `--rebrand-metadata --bin example --package example-product` on a snapshot is deliberately limited to root product metadata and four identity constants. Separate receipts and original changed bytes are retained; the original lock/public package identities/resource owners/FQNs/global keys are not rewritten. Package/import/native distribution mappings still require review and dependency re-resolution before building. Use scaffold for a new runnable product; no global replacement is performed.
