# 任务上下文投影协议

ContextView 是可丢弃的导航，不是新资源、任务状态或语义 verdict。适用于 quick/track/mission 的当前操作与迁移 review；旧 CLI JSON 不改形状。

## L0 → L1 → L2

- L0：用现有 `list/show --json`、`track ready --json`、`decisions frontier` 定位目标、当前 frontier、阻塞和路径。正文通过 `show --include-content` 或直接读来源展开。不要默认注入全 workspace、archive 或全 std。
- L1：**行动前完整读取当前 operation 明确要求的合同**：当前目标/Acceptance、proposal/design、MaterialBundle、前置产物、相关代码测试、有效配置与其引用闭包。不能只摘“有利章节”；缺源、冲突、缺 acceptance 必须记录并协调，不能靠 L0 猜测。
- L2：历史推理/归档全文按实际信息缺口展开；当前决定依赖历史来源时，该来源升级为 L1。完整历史始终保留，不设 decision/lesson 数量配额。短索引只放路径、主题与来源锚点，不覆盖原文。

每条阅读记录可用现有 findings/report：路径+内容 SHA256、当前用途、版本、展开依赖；当前目标/task/frontier、已知冲突、下一硬边界、证据引用。无需新状态文件。索引漏掉的真实来源必须加入；预算只报告，不截断 L1。

## 失效与续跑

同一仍在上下文中的完整原文无需重复注入，但复用前检查内容/成员清单未变化。task/goal、源内容、成员新增/删除、manifest/Kind/envelope/spec、hooks/profile、operation 协议、运行时/工具版本、证据内容或其前提改变时，相关投影失效；不能只比较 mtime 或上一轮文件名单。未记录或无法确认 freshness 时重新观测并读原文。

合法中断才写紧凑 continuation：目标、下一 ready、blocker、证据和展开路径。恢复后重建 XNL 状态及实际 source closure，摘要里的 completed/PASS 不能放行。没有合法停点则继续，不为节省 token 每 phase 返回。

## 检查不可压缩

先读配置再决定适用协议；hook 顺序、profile、max_rounds、on_exhausted、verify_round、HumanConfirm、fresh 要求不变。同点 GapLoop 与 AttractorCheck 分别执行；各自完整协议分别展开，不能复用同一 verdict。

已有 verification receipt 仅由 CLI 按同 Track、同 argv、内容前提判有效。目标/Acceptance/Hook/source 改变要失效；纯进度写回不是新验收合同。它不证明业务语义、hook 已运行或 fresh reviewer 已重读：这些仍按 operation 逐项做。fresh reviewer 自读当前适用原文、实际代码/测试与不利证据；实现者只提供路径/范围/问题，不传“已经通过”的结论作为依据。

错误、review-required、未知 migration extension 必须完整保留 diagnostics 并展开原输入。紧凑成功输出不可更改旧 JSON/退出码；只使用已有显式 detail 选项。无真实 usage 时只报告固定阅读轨迹的 UTF-8 bytes 代理，不宣称真实 token/费用减少。
