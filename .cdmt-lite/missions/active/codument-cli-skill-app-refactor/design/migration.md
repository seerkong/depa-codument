# 历史 workspace 升级设计

2026-09-05 分期修订：历史升级能力继续实现，但 `upgrade-workspace` 与 Host 同名入口的合并暂停，核心重构后单独讨论。当前先通过公开 migration/installer API 与隔离 fixture 验证，不修改该命令语义，也不以 `upgrade` 或自动初始化旁路接入。下文 `upgrade-workspace` 的最终入口合同保留为后置验收，不能用内部 API PASS 代替。

全部确定性 inspect/plan/apply/verify 在 CLI 本地执行，无需 Serve 或新 App loader 已成功；正式目标目录始终为 `workspace/codument/`。私有 cache/backup/staging 不成为第二份业务 App。

## 已有合同

旧 migration registry 位于 `src/cli/migrations/index.ts:92`。inspect/plan/apply/verify 已识别 XML Track/Mission/config/Behavior/BehaviorPatch、未版本化 XNL、Decision tree/forest 和旧 Decision Markdown。

`upgrade-workspace` 在写之前备份、迁移 lifecycle 路径、刷新受管模板和 Skill，输出 review/semanticReviewRequired 信息；resource 命令有 `upgraded|noop|review-required|blocked`。旧升级 25 测试本轮已通过，见 evidence。

不是所有旧输入都能确定转换。Markdown Decision、owner 不清楚、冲突路径、扩展语义不可证明都要保留当前 Agent 兜底。

## 版本桥

分开四维：产品版本（旧 0.5.x→目标发行）、包版本、资源 envelopeVersion、每 Kind specVersion/contract fingerprint。不得拿 npm major 推导资源 schema 版本。

建议路径：

```text
legacy XML / Markdown / unversioned XNL
  → legacy inspect + deterministic normalization OR semantic review
0.5.x apiVersion resources
  → typed semantic model + source provenance
new envelope/spec resources + built-in contract references
  → workspace SkillApp membership + root/config/skill routing migration
  → complete resource/semantic validation → commit + receipt
```

中间模型只是转换内部数据/暂存产物，不是长期开启的第二套 reader authority。旧 parser 若需要 compiler 0.2.8，以明确命名的兼容依赖绑定在迁移边界；优先复用纯转换器，禁止全局替换版本后假定 AST 语义兼容。

## 操作合同

1. 从 filesystem 直接检测旧布局和格式；migration 命令必须能在新 SkillApp loader 拒绝旧资源时启动。
2. 生成确定性 plan：源路径、格式/Kind/版本、内容 digest、目标路径/Kind/版本、转换 id、受影响引用和诊断。
3. 在任何内容变更前对影响范围备份；ledger 记录计划 digest 和源快照。源变化则计划失效，重新观测。
4. 在目标隔离 staging 中转换，保持 ID、字段、目录 owner、provenance、DAG/ports/hook 顺序。schema 无法表示的扩展原文保留并进入 review，不能只写诊断后删除内容。
5. target 已存在：相同资源与语义证据可判 noop；不同内容拒绝覆盖并输出冲突。多 roots/forest 按真实 cardinality 处理。
6. 分别验证单资源、跨资源 references、SkillApp membership 与知识/决策语义；全部过线才提交该事务。
7. 支持确定范围的原子替换；跨文件事务写 ledger，故障发生后可恢复已提交/未提交阶段。backup/staging 不能被正式 catalog 发现。
8. 将 review-required 和语义复核项交给当前 Agent；新的正式 authority 验证前保持源和 backup。Agent 使用新 CLI scaffold/writer 获取正确 envelope/spec，而非手写版本。
9. 完成后再次 upgrade：业务资源保持相同，receipt 可以追加新历史但不得重复提升/重写语义。全量验证覆盖 active、pending、archived 和 owner-local registry。

## Skill bootstrap

新 CLI 分发包必须内含可在旧 workspace 上运行的 migration Skill/协议。第一次调用升级时，从发行包提供的 reference 获得入口；完成 managed std 更新后，按新 workspace operation 继续。

保留旧迁移 Skill 用户入口与 `upgrade-workspace --json`、`upgrade-resource <path> --json`，保持 exit 2 的语义。review 收据给 source/backup/target/contract/version/diagnostics，不能要求 Agent 先找到已被移除的本地 KindDefinitions。

兜底完成条件保持：review/conflict 为空，新 authority 验证通过，旧 authority 已安全退役，重扫不会再发现旧正式资源。

## 按结构覆盖历史，不承诺未知输入自动转换

| 输入组 | 夹具来源/补齐方式 | 预期 |
|---|---|---|
| 当前 0.5.4 | 根 dogfood 的隔离副本 + 现有测试 | 全域升级、字段保真、历史可读 |
| 0.5 系列版本化资源 | 本地 Git tags/历史可得版本 + 0.5.3 相关 fixture | 确定转换；无法取得 release 的版本标明来源缺口 |
| 早期 XML/plan.xml | test/cli/utils/fixtures、upgrade-track/migrate 测试 | 结构识别 + 既有转换或 review |
| Markdown Decision/嵌套 forest | decision-migration-fixtures、archive-decision-registry | 当前 Agent 语义兜底，ID/owner/options/feedback/证据保真 |
| 未知/未来/损坏资源 | 故障夹具 | 明确 review/blocked、原文与备份完整 |
| 冲突/中断/自定义配置 | 碰撞路径、故障注入、自定义 hooks/agent/扩展 | 可恢复，不覆盖，不恢复已退出的 obsolete 默认规则 |

fixtures 要覆盖 layout/Kind/version 三轴，不仅改版本字符串模拟历史。不能拿只跑 happy path 的新 init 代替历史升级矩阵。

## 确认的保护对象

项目 attractors、用户 config、Hook 顺序与参数、round/exhaustion、人类确认、unknown extensions、嵌套 TrackLink/ProjectRef、decision ownership、Artifact provenance、memory、archive IDs/引用、AGENTS/CLAUDE 非受管正文、既有 agent 安装目标。

恢复/备份保留规则是迁移实现的一部分。不得自动清理真实用户备份来满足“无旧 authority”；退役指退出发现/写入 authority，历史字节仍可审计。
