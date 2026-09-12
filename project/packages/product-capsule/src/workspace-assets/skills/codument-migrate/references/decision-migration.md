# Decision review-required 修正协议

本文件只处理 `codument upgrade-resource <path> --json` 返回 `review-required` 后，程序无法证明的 Decision 语义。CLI 拥有确定转换、备份、ledger 与受控恢复；AI 对原文提出语义映射，不篡改 CLI receipt。Markdown 的语义候选由当前 Agent 在隔离目录编写并验证，不能声称 CLI 已自动完成其提交。

## 输入

- CLI receipt 与 diagnostics；
- receipt 指向的原 authority、backup 和 migration manifest；
- `codument migrate guide decision` 提供的当前内置 Decision spec；不查旧本地 KindDefinitions 自授版本；
- diagnostics 明确要求的 archive source 或 owner context。

## 修正原则

1. stable Decision `#id` 是 identity；文件名、日期目录和 Track id 不是 durable owner。
2. 优先从完整 XNL source 恢复 top-level tree closure、ancestor、嵌套关系、options、answer feedback、evidence 和 unknown extension。
3. Markdown-only source 只转换能直接证明的内容；无法证明的 hierarchy、option、status 或 provenance 保留为 ambiguity，不臆造。
4. 根 durable Decision 放在业务语义目录 `codument/decisions/<owner>/<topic>.xnl`；已明确的 process-local `decisions/<semantic-owner>.xnl` 也保留其归属，不无故再次要求迁到全局。直接旧 `decisions.xnl` 中的 durable owner 缺失时请求证据，不以日期 bucket 或 Track id 猜归属。
5. 普通节点属性放 `{}`；`()` 只放唯一槽位，Decision 的 `[]` 只放子 Decision，Options 的 `[]` 放多个 Option。
6. 不直接写 `apiVersion` 骨架。新 owner 文件的首个节点由 `codument decisions create <file> <decision-id>` 创建；现有节点的版本由 migration pipeline 维护。

## 循环

1. 根据 diagnostics 做最小语义修正，不改 CLI-owned backup/manifest。
2. 运行 `codument decisions validate <target>`。
3. 若原路径仍是 CLI 可继续转换的 XNL，重跑 `codument upgrade-resource <path> --json`。
4. 若原路径是只能由 AI 解释的 `decision.md` / `decisions.md`，目标验证通过后退役已备份的 Markdown authority，再运行 `codument upgrade-resource <target> --json` 并由 workspace 复扫确认旧文件不再出现。
5. 目标 receipt 为 `upgraded|noop` 后复核 diff 与 tree closure；`review-required` 继续处理新 diagnostics；`blocked` 先解决其明确外部前提。

## 完成

只有目标 authority 的 CLI receipt 为 `upgraded` 或 `noop`、Decision registry validate 通过、旧 Markdown authority 已退役且 workspace 复扫无遗留，所有 ambiguity 都有显式结论或明确 blocker 时，迁移才算完成。
