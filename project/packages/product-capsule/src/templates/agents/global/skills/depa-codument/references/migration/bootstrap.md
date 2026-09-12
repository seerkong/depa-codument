# Codument migration bootstrap

期望态：目标拥有当前内置 contract、明确 owner，完整业务内容与历史依据可追溯；相关结构、跨资源和语义验证通过。receipt 是机械事实，不是 Agent 的语义 verdict。

本协议随 CLI 分发；`depa-codument migrate guide resource` 不要求旧 workspace 的 manifest、config 或 std 已能加载。不要先执行 init 覆盖旧目录。当前 Agent 自己承担语义 review，不让 CLI 启动另一个 Agent。

## 模式与当前入口

- 一个资源路径：`depa-codument upgrade-resource <path> --json`。
- 旧 track-id/archive-id：`depa-codument upgrade-track <id> --mode wave|sequential --json`。早期 plan.xml 的 schedule、依赖、混合正文无法证明等价时返回 review，不删除依赖来生成假成功。
- 整 workspace：`depa-codument upgrade-workspace --json`。先迁移并验证项目 `codument/` SkillApp，再独立升级受管根说明并备份退役已知旧薄 Skill。两个阶段不是一个 OS 原子事务；`phase=guidance` 且退出码 2 表示 App 阶段可能已完成，必须按 receipt 检查，不能重置已验证项目资产。全局标准由 `depa-codument upgrade-global` 单独更新。

## Observe → Reconcile → Act → Verify

1. 观察 CLI 版本、目标位置、原文和 `upgrade-resource`/`upgrade-track` receipt。退出码 2 是 review-required：解析 stdout 后继续处理；命令错误退出码 1 不等于已生成 backup。
2. 核对 receipt 的 source、target、backup、planDigest、diagnostics。backup 是文件时读取该文件，是目录时按原 workspace 内路径定位。没有可验证 backup 不改原 authority；先解决机械备份失败。
3. `upgraded`：对照原件与目标，复核 IDs、owner、DAG、ports、hook 顺序/round/耗尽行为、unknown extension、附件与历史引用；`noop` 仍须验证，不能把当前 header 当语义 PASS。
4. `review-required`：区分未知版本、路径冲突和真正需要语义解释的内容。读取完整受影响原文及其 owner/引用闭包；不要猜业务关系。Decision 执行 `depa-codument migrate guide decision`，早期 Track 执行 `depa-codument migrate guide track` 获取当前包内协议与 spec，无需本地 KindDefinitions。
5. 通过当前 CLI scaffold/writer 创建目标骨架，保持源文件与原备份；AI 只补有依据的语义映射。无法容纳的字段不丢弃，保留原文和显式 ambiguity。遇到既有不同目标，不覆盖任一方。
6. 在隔离候选上运行当前 CLI 完整验证。互相依赖的旧资源作为同一候选闭包审查，不能在真实 workspace 上逐个放行半升级集合。正文映射完成不代表可以自动提交整个 workspace；只更新用户授权的目标，保留未解决的 review。
7. 获得验证通过的候选后，按已授权范围更新唯一 authority；旧格式文件移入 App 发现范围外的已备份恢复目录，不能把 `.bak.xnl` 留在 registry。保留原 bytes、source→target 映射和判定依据；备份不是第二份可写 App。
8. 重跑 `depa-codument migrate verify <target> --json` 与对应领域 validate；再次 `upgrade-resource` 应为 noop。重扫原范围，确认无旧格式竞争 authority、未处理 review 或引用缺口。有 ready 项立即下一轮，不在单个资源完成后询问继续。

## 验证边界

按实际存在的领域运行 `depa-codument validate --strict`、`depa-codument decisions validate <owner-or-directory>`、`depa-codument modeling validate <directory>`、`depa-codument engineering validate <directory>`。原始 Markdown 的完整性比较和 Agent 的语义判断是独立要求，不可由 CLI PASS 代替。未配置的检查不凭空添加；已有 GapLoop/Hook/AttractorCheck/fresh verify/人工 gate 不删、不缓存为通用 PASS。

当前版本强制保留备份：`upgrade-track --no-backup` 明确拒绝；`--backup-dir` 只接受 workspace 内、codument/ 外的位置。两个目录 rename 是带 ledger/guard 的可恢复事务，不是跨文件 OS 原子交换。独立编辑导致恢复不确定时保留两侧材料并停止该写入，不覆盖别人的变更。

完成条件：每个授权目标的新 authority 验证通过，旧 authority 安全退役，语义复核有原件对照，重跑无业务变更；所有 ambiguity 有证据结论。缺必要输入、无法安全恢复或没有可行修正时返回精确 blocker，其余持续循环。

## 历史完成声明不是当前验收证据

归档资源用明确路径查询，避免与活动同名资源混淆：`depa-codument show archived/<归档相对目录> --json`、`depa-codument validate archived/<归档相对目录> --strict --json`；默认list/status仍只投影活动Track。

旧归档 completed Track 迁入时，CLI 可写入 `completion_basis="legacy-declared/v1"` 和来源/内容摘要。正文和完成状态保留，不替缺失的 Criterion 补 checked。`show` 的 `historicalCompletion.currentVerification="not-reverified"` 和 `validate` 的 `track.history.not-reverified` notice 表示历史声明，不能作为新版任务验收或 fresh verification 的证据。

这不是 archived 通用豁免：显式 checked=false、未完成任务、缺必需文件、重复ID、非法端口、失效引用等仍须处理；当前/新建资源规则不变。历史标记内容变更或移出归档后失效，普通生命周期写命令不得重开或改写它。需要重新进入当前工作流时，必须显式语义复核并保留原历史来源，然后履行当前验收，不可直接删标记或补勾制造PASS。

