# Gap 报告：XNL 作者面（废弃 fill / schema 发现 / 文档去脏）

检测日期：2026-09-16
方法：目标态来自 authority，实际态来自代码 / 测试 / 产品面；不采信已勾 Acceptance。
本轮不改业务代码，等确认后再修。

定位：`.cdmt-lite/missions/` 没有本专项的 pending/active/archived mission。现有 active `codument-cli-skill-app-refactor` 是 CLI Skill App 大迁移，终点不是本专项。目标态按用户当场需求重建，不把那条 mission 的 Acceptance 当本合同。

## 目标态（authority）

- 用户原始需求（当场、高于任何 MISSION）：
  1. 磁盘格式必须仍是 XNL；不得降级为纯文本 / Markdown / JSON / XML。
  2. 完善 `xnl-format.md`，并在 SKILL.md 高优显示。
  3. **彻底废弃 `depa-codument fill`**。JSON `--input` 不得再当作者面；继续直接编写 XNL。
  4. 告知每个 domain：用 XNL 表示时的结构示例、schema。
  5. 发现 CLI 这次就要做：`depa-codument schema track|mission|decision`，stdout 是 XNL 不是 JSON。
  6. 文档层去脏：SKILL、xnl-format、plan-track、operations README 不再教 fill。
  7. `behavior|modeling|engineering` 在新版彻底删掉，不补回；不给这三域加 Kind spec。
  8. 范围：`project/packages/` 新版作者面（domain-logic / contract / host-adapter / cli / product-capsule 双树）。不删旧 `src/` 的 modeling/engineering/behavior CLI、e2e `modeling-engineering/`、`codument/behaviors/`。
  9. 作者工作流：CLI scaffold → 对照 Kind spec + `schema` 槽位原地编辑 XNL → `validate`。禁止整文件 Write / `</Given>` / `?</?>` / perl/sed/strings。
  10. Kind spec = 字段表 + 指向 schema CLI 的槽位片段 + 一份完整投影（标明不要复制 `#id`/envelope）。Operations 只路由，不重抄 XNL 骨架。

- MISSION 终点 / 期望：无本专项 MISSION（合同缺项，见 C0）。
- 吸引子排除集：无本专项 attractor。负向仍按当场约束判：不得复活 fill；不得把 JSON 当作者语言；新版不得再教三废弃域。

## 实际态摘要

- 验收命令：本专项无独立验收表。抽查：
  - fill 实现文件：`project/packages` 下无 `*fill*` 领域实现（`source-fill.ts` / `fill.ts` 已不在树）。
  - `createSchemaCommand` 已挂到 host-adapter 命令表；`KIND_SCHEMA_KINDS = ['track','mission','decision']`。
  - `TRACK_MATERIAL_DOMAINS = ['code','test','docs','artifact','memory']`。
  - `inspectStdDocumentation` 对 workspace `codument/std` 的 `fill --input` 规则当前为绿（测例 `workspace-assets.test.ts` 断言 findings 为空），但规则字面只匹配 `fill --input`。
- 源码面：`domain-logic/src/kind-schema.ts` 打印 XNL 根形状 + 槽位；`host-adapter/src/schema.ts` 默认 `message` 为无尾换行的 XNL，`--json` 另包 `{kind,schema}`。`DomainOwner.fill` / fill 命令不在新版包。`std.legacy.fill-json` 是负向守卫。
- 产品面（skill / 文案）：全局 SKILL 已高优链到 xnl-format 并写 scaffold→schema→原地编辑。双树 xnl-format / track|mission spec / decision-registry / operations README 已改口。plan-track 主体已改口，但 §3.7 仍教 fill JSON。双树 AGENTS 仍路由到不存在的 `docs-bootstrap.md`。

## 权威冲突（先于具体 gap）

### C0 · 本专项没有 cdmt-lite mission
| 源 | 说法 |
|---|---|
| 用户当场 | 用 gap-loop 验本专项是否打到、是否还有残留 |
| `.cdmt-lite/missions/` | 只有 `active/codument-cli-skill-app-refactor`（大迁移） |
| gap-loop.md | 报告写入该 mission 的 `reports/gap-<round>.md` |

合同缺项：没有 MISSION/Acceptance/attractor 可勾。本报告写在 `.cdmt-lite/reports/gap-xnl-authoring.md`，不改那条无关 mission 的 Status。

### C1 · 旧 Skill 名保留 vs 新版废弃三域
| 源 | 说法 |
|---|---|
| 用户当场（本专项） | `behavior\|modeling\|engineering` 新版彻底删掉；文档去脏 |
| 大迁移约束-18 / 全局 SKILL description | 承接全部旧 Skill，description 保留历史名称（含 `codument-docs-bootstrap（建立领域及工程 registry）`） |
| 双树 `AGENTS.md` / `operation-alias.md` / workspace `skills/README.md` | 仍把 `docs-bootstrap` 当作**当前**入口 |

冲突点：历史别名表可以留旧名；当前路由表把已删 operation 当活入口则与「新版删掉」打架。本轮不擅自选边删 SKILL description 里的旧名。

## Gaps（issues-first）

### G1 · 跑 plan-track 的 Agent 会用已删除的 fill 写 Hooks
- 对标：当场 3/6（废弃 fill；文档去脏）；作者工作流是 schema + 原地编辑 XNL
- 失败情景：Agent 执行 plan-track §3.7，读到「挂好后用 fill 写入对应 TaskGroup 的 Hooks」，按 JSON 示例去找 `codument fill` / `depa-codument fill`。命令不存在 → 卡住，或退回整段抄 XNL / 手写 JSON 补丁，正好是本专项禁止的作者面。
- 证据：
  - [plan-track.md:366](project/packages/product-capsule/src/workspace-assets/codument/std/operations/plan-track.md:366)（workspace）
  - [plan-track.md:385](project/packages/product-capsule/src/templates/agents/global/skills/depa-codument/operations/plan-track.md:385)（global）
  - 同段 JSON：`{"id":"P3","extend":{"Hooks": ...}}`
  - `find project/packages -name '*fill*'`：无领域 fill 实现

### G2 · 负向守卫抓不到 G1，测试绿会掩盖文档脏
- 对标：当场 6（文档层现在是脏的需要修改）；测试断言须覆盖合同
- 失败情景：作者以为 `inspectStdDocumentation` + `workspace-assets.test.ts` 已保证 operations 不再教 fill；plan-track 用的是「用 fill 写入」而不是 `fill --input`，绿测仍过。
- 证据：
  - [std.ts:17](project/packages/domain-logic/src/std.ts:17) `pattern: /fill --input/`
  - `isCurrentStdDocumentation` 排除 `spec/`，但 G1 在 `operations/` 本应被扫到——字面量不匹配所以漏
  - [workspace-assets.test.ts:31](project/packages/product-capsule/test/workspace-assets.test.ts:31) 断言 findings 为空

### G3 · plan-track 仍把已删的 behavior delta 当前置门
- 对标：当场 7（三域删掉）；operations 只路由
- 失败情景：Agent 走到 §3.4「behavior delta 确认后，现在我将创建完整的变更提案」，去找不存在的 behavior delta 产物或停下来等确认。流程块 `s3`/`s4` 都写「起草 proposal.md」，没有 `### 3.3`，是删步后的编号残留。
- 证据：
  - workspace [plan-track.md:186](project/packages/product-capsule/src/workspace-assets/codument/std/operations/plan-track.md:186)
  - global [plan-track.md:205](project/packages/product-capsule/src/templates/agents/global/skills/depa-codument/operations/plan-track.md:205)
  - 同文件流程块 s3/s4 重复 proposal；章节从 3.2 跳到 3.4

### G4 · 当前路由仍把 docs-bootstrap 当活入口，文件不存在
- 对标：当场 7；产品面双树必须一起看
- 失败情景：Agent 读 AGENTS「现状知识初始化」→ 打开 `docs-bootstrap.md` / 跑 `docs-bootstrap` 命令 / 按 skills README 找 `codument-docs-bootstrap/` 壳。operation 与 skill 壳都不在树里 → 初始化知识失败，或以为还要建领域/工程 registry。
- 证据：
  - 双树 AGENTS.md 第 17 行：`docs-bootstrap.md / artifact-sync.md / migrate.md`
  - [operation-alias.md:16](project/packages/product-capsule/src/templates/agents/global/skills/depa-codument/references/std/compat/operation-alias.md:16) `codument-docs-bootstrap | docs-bootstrap`
  - [skills/README.md:28](project/packages/product-capsule/src/workspace-assets/skills/README.md:28) 映射到 `@/codument/std/operations/docs-bootstrap.md`
  - `find ... -name '*docs-bootstrap*'`：无文件；`workspace-assets/skills/` 也无该壳
  - 与 C1 交叠：别名表留旧名 vs 当前入口表当活命令

### G5 · archive CLI 文案仍声称晋升 behavior delta 并处理 modeling/engineering
- 对标：当场 7；decision-registry §6 已改成「decision registry 的归档事务」
- 失败情景：Agent 读 `std/commands/archive-track.md`，以为 `codument archive` 还会晋升 behavior delta、跑 modeling/engineering archive。archive 实现侧未再匹配这些词，文案与代码不一致，Agent 可能去找已废弃域文件或报缺失。
- 证据：[archive-track.md:10](project/packages/product-capsule/src/workspace-assets/codument/std/commands/archive-track.md:10)
- 对照：`archive.ts` / `archive-decisions.ts` / `host-adapter/src/archive.ts` 对 behavior|modeling|engineering|fill 无命中；operation `archive-track.md` 已改口只谈 decisions/memory

### G6 · 多份 operation / protocol 仍要求读「behavior deltas」
- 对标：当场 7；Agent 产品面
- 失败情景：impl-track / gap-loop 把 behavior deltas 与 proposal/design/Acceptance 并列当必读权威；Agent 在 track 目录找 `behaviors/` 或 delta 文件，没有则认为规划不完整。discuss / impl-quick 把「不写 behavior delta」当边界，反向承认该产物仍存在。
- 证据（双树均有）：
  - `operations/impl-track.md`（读 behavior deltas；显著影响吸引子时改 attractors）
  - `operations/gap-loop.md`
  - `operations/discuss.md`
  - `operations/impl-quick.md`
  - `protocols/validation.md`
  - workspace 壳 [codument-plan-track/SKILL.md:3](project/packages/product-capsule/src/workspace-assets/skills/codument-plan-track/SKILL.md:3) `起草 behavior delta + proposal + track.xnl`

### G7 · plan-mission 未接到 schema 发现（弱于 G1）
- 对标：当场 4/5；约定 operations 路由到 schema 槽位
- 失败情景：Agent 按 plan-mission「在 scaffold 内填写」+ 只读 mission-xnl-spec，不跑 `schema mission`。spec 里有指针，所以不一定写错，但发现 CLI 对 mission 作者不是操作正文里的一步。
- 证据：双树 plan-mission 有 `mission create` 与「按 spec 填充」，无 `schema mission`。maintain-track 同样无 schema。

## 已打到（不作为 gap）

- fill API 已从新版包删除：无 `host-adapter/src/fill.ts`、`domain-logic/src/source-fill.ts`、`domain-contract` fill 导出；`source-patch.ts` 是 XNL 源码定位补丁，不是 JSON fill。
- `depa-codument schema track|mission|decision` 存在：stdout 默认 XNL；未知 kind（含 `behavior`/`fill`）usage 拒绝；不写文件（CLI 测例在空 tmpdir 断言）。`--json` 是可选包一层，默认作者面仍是 XNL。
- Kind 输出不含三废弃域 MaterialBundle；`parseKindSchemaKind('behavior')` 抛错。
- 全局 SKILL 高优段落：XNL 不可降级 + xnl-format 链接 + create → schema → 原地编辑。
- 双树 `xnl-format.md`：磁盘不得降级、填写清单、JSON 不是作者语言、MaterialBundle 枚举并点名废弃三域。
- 双树 track/mission spec：schema 指针 + 完整投影标明不要复制 identity；根字段表仍在；已无 `modeling_base_commit` / `engineering_base_commit`。
- 双树 decision-registry：schema decision 指针；§6 不再与 behavior/modeling/engineering 共用事务。
- operations README：schema 列入 CLI 确定性能力；「不把 JSON 当作资源作者语言」。
- plan-track 除 G1/G3 外，create/schema/禁止整文件 Write/`</Given>`/`?</?>` 已写入 §3.2/3.5/3.6。
- 负向守卫 `std.legacy.fill-json` 故意保留（防回归），不是教 fill。
- 旧 `src/` modeling/engineering/behavior CLI、e2e `modeling-engineering/`、产品 `codument/behaviors/`：按当场范围 8 **有意保留**。
- migration bootstrap 仍写 `modeling validate` / `engineering validate`：「按实际存在的领域运行」。属旧迁移路径，**不纳入本专项必修**，除非把范围扩到 migrate skill。

## 建议确认项（不修，只问）

1. G1+G2+G3：是否作为本专项必须修的文档残留（推荐：是）。
2. G4+C1：当前路由表是否改掉 `docs-bootstrap`；SKILL description / alias 旧名是否允许保留。
3. G5+G6：operation 里「behavior delta」是废弃产物名（删）还是普通「行为变化」口语（改措辞即可）。
4. G7：plan-mission / maintain-track 要不要补一句 `schema mission`（弱）。
5. migration bootstrap 的 modeling/engineering validate：保持 legacy 还是从新版 migrate 文案拿掉。
