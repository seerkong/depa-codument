---
status: proposed
last_verified: 2026-09-05
rec_id: rec-01
scope: package
---

# rec-01：冻结当前两树并建立逐项 reconciliation 凭据

## 背景问题

C 从 dirty working tree 克隆后继续抽取，H 又提交了 resource/clone 变化；旧 HEAD 不是完整 merge base。整树覆盖会丢掉 H allowlist 或 C 的替换优先级、公开 ports 与已修复生命周期行为（PD01/02/12、INC-01–04、OBS-06）。

## 目标

每个待迁公共能力、公开导出、身份值、测试与构建/clone 配方都有当前 C/H 输入 digest、来源选择和保留理由，能据此实施与撤回而不覆盖独立修改。

## 非目标

不搬源码、不 clone 新项目、不重建不存在的历史 dirty base、不查占 npm 名；不把快照材料升级成长期第二公共源码 owner。

## 输入证据

`C/` = `/Users/kongweixian/infra-dev/depa-codument/project/`；`H/` = `/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/`。两前缀以下 rec 通用。

- [PD01/PD02/PD08/PD12](../inventory/provenance-distribution.md)：`H/scripts/clone.ts:12,155,296`；`C/scripts/clone.ts:143,286`；两仓 `packages/skill-app-contract/src/resource.ts:68`。
- [C01–C21/H01–H12](../inventory/package-boundaries.md)：33 个 manifests；生成 builder 是派生物，不能视为独立源。
- [INC-01–04](../inventory/incidents.md)：`C/packages/skill-app-support/src/sqlite.ts:21`、`C/packages/browser-support/src/web-api.ts:10` 等已修复行为必须进入保留表。
- 决策 D01/D05/D09/D10；[architecture §9](../convergence/architecture.md)。

## 验收（conformance case）

1. 实施开始时只读重取两树 HEAD/status 与 tracked（含 tracked ignored）及 nonignored untracked 文件集合/hash；记录原 lock、33 manifests 对应项和 export/semantic identity 值。缺历史 bytes 明确 unknown，不能写成“可三方合并”。
2. 每个迁移单元有 `保留 H / 采用 C / 人工组合 / 暂缓`、输入 digest、目标 T 编号与验证入口。H source allowlist、C replacement precedence、SQLite/debug/Kind/close 修复各有专门保留证据；没有以 commit 行数代替语义差异判断。
3. 做写入前重新比较目标 digest；若有新修改先合并来源判断。未解释的冲突停止受影响单元，其他无冲突单元可继续。reconciliation 凭据不能宣称已经产生尚不存在的实现 output hash。

以上是未来验收，不在本轮运行。基线读命令沿用 `git -C <root> rev-parse HEAD`、`git -C <root> status --short` 与逐文件 bytes/manifest 枚举，输出落本 Mission 的 evidence/凭据；不写进第二工作图。

## 依赖前置

本方案获准实施；无源码实施依赖。C06 的 clone 产品功能不作为前置，只有其来源/回滚凭据合同在这里先行。

## 对应三面与层级

控制/数据/扩展面 × platform/application；Data 的版本化源码 owner 与派生记录，Effect 的现有修复保留。回溯 three-plane-map 的 PD01/02、PD08 行。

## 落地建议（由同一 Mission Lite 承接）

把本项作为跨仓第一动作，记录完整但有边界的来源账，不改两仓产品源。新 package topology 只读 T01–T14 表。此项可单独结束，回退只需弃用该 dated plan，保留历史证据；不复位用户目录。通过后再实施 rec-02。
