# Operation 提示词规范

每个产品操作是 global depa-codument SkillApp 的 `CommandOperation` 资源，正文放在 App 根的 `operations/<file>.md`，由根 manifest 的 Catalog 接纳。文件不是另一个独立 Skill，不创建逐操作的 Skill 壳。

frontmatter 保留当前契约的 `envelopeVersion`、`specVersion`、`kind: CommandOperation`、`metadata.fqn` 与 `spec.command` / `spec.description`。命令身份由 `spec.command` 拥有，help 和 dispatch 从同一资源投影；不能从文件名、FQN 或历史别名推断命令，也不在代码/文档维护第二份注册表。

先用 `depa-codument -h` 发现当前入口，再用 `depa-codument <command> [arguments...]` 读取完整指导，由当前 Agent 执行。CommandOperation 的 exit 0 不代表业务完成；确定性读写仍调用正文规定的原生 CLI。标题使用当前 operation 名，不使用独立 Skill 身份。旧调用的发现简介只保留在 `SKILL.md` description，详细映射按需读 compat 引用。

## 文档形态

- 默认使用普通 Markdown 写背景、规则、表格、示例、注意事项。
- 内嵌 XML / code 使用对应 fenced code block，例如 ```` ```xml ````。
- 程序化执行流程使用 flow notation 的 `text` 流程块。

flow notation 的权威规范见：

`references/std/spec/flow-notation.md`

不要在每个 operation 里重复完整 flow notation 说明；只在需要时引用该 spec。

## 何时使用流程块

当一段内容是明确控制流时使用流程块：

- 串行 / 并行步骤。
- 条件分支。
- 循环 / 重试 / 收敛。
- spawn 子代理。
- 等待回执。
- 返回 / 退出 / 失败处理。

当内容只是解释“是什么、为什么、注意什么、字段含义、示例”时，继续使用 Markdown prose。

## 引用约定

- 标准规范引用 `references/std/spec/...`。
- 执行套路引用 `references/std/methods/...`。
- 其他 operation body 引用 `operations/<file>.md`；交接当前操作使用实际 `depa-codument <command>`，不要求加载同名独立 Skill。
- `operations/migrate.md` 和 `operations/validate.md` 的命令分别为 `migrate-operation`、`validate-operation`；原生 `migrate` / `validate` 仍是确定性入口。
- 旧名称映射见 [operation aliases](../compat/operation-alias.md)，不能以兼容文档注册或覆盖命令。
- operation body 应自包含关键规则，不依赖聊天历史。

## 编写纪律

- operation body 是给 AI 执行的，不只是人类文档；流程必须可恢复、可判定、可验证。
- 涉及外部状态的长流程，应明确状态真源，不依赖 chat history。
- 复杂 actor / 控制论流程优先拆成全局路由 + actor 局部 drive，不把所有细节塞进一个巨大流程块。
