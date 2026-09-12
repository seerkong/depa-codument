---
name: codument-impl-track
description: 按 track.xnl 的 TaskSpace + Schedule 执行实现——普通任务由 AI 自主选择本地或委派执行，统一验证并通过 CLI 回写状态，运行生命周期 hook，支持中断续跑。开始或继续实现已批准的 track 时使用。
---

# Codument · impl-track

这是 codument **impl-track** 操作的 skill 壳。**权威提示词在工作区** body——打开并**严格遵循**：

`@/codument/std/operations/impl-track.md`

完整读取其中的执行协议；按当前事件展开它引用的方法和检查协议，不预读整个 std。方法论见 `@/codument/std/methods/{tdd,dag-execution}.md`，上下文来源与失效规则见 `@/codument/std/protocols/context-loading.md`（均由 body 路由）。

- **前置**：项目已通过 `codument init` 初始化，目标 track 提案已批准。
- **用法**：实现 track: `<track-id>` [phase]（缺省从第一个未完成 phase 起）。

> 壳只做路由，不重述规则。一切以 `@/codument/std/operations/impl-track.md` 为准。
