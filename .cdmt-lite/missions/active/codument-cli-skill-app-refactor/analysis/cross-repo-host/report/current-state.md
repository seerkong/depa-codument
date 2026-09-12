---
status: active
last_verified: 2026-09-05
scope: package
depth: deep
---

# 跨仓公共 Host：现状报告

## 1. 执行摘要

本仓已经抽出了可由独立消费者运行的通用能力，但其源码归属、产品私有运行时组合和发行检查仍未形成用户要求的跨仓公共包体系。Halfcode 当前 HEAD 比初始克隆参考前进了两个提交，初次输入又包含 dirty working tree，因此不能把现状当作一次普通分支合并或整目录重命名。包名还参与契约 owner、指纹和严格准入，迁移必须同时处理语义身份与发行身份。已有本地 tarball 测试是可保留的强基线，但不是实际 npm 发布、完整产品升级或所有平台运行成功的证据。新方案首先应解决可核对的源码归属与公开边界，再推进消费者和发行闭包；本轮不改源码。

## 2. 范围与深度

见 [scope](../scope.md)。package/deep：33 个物理 manifest（30 个非生成）、包级公开面与关键 authority 路径；不是全函数审计。三个独立主题盘点经两轮 fresh 复核（FIX_APPLIED → NO_GAP），见 [复核 1](../reviews/inventory-round-1.md)、[复核 2](../reviews/inventory-round-2.md)。现状五视图见 [图索引](index.md)，明确保留两仓当前身份，不把目标图当事实。

## 3. DEPA 四维符合度

| 维度 | 汇总（抽查范围） | 证据来源 |
|---|---|---|
| Data | 部分；source/projection 关系明确，legacy check-to-live-import 有静态竞态窗口，依赖树字节冻结仍不确定；未证实反写或双 runtime authority | [conformance Data](../inventory/depa-conformance.md)、[R04/R05](../boundary/backwrite-risks.md) |
| Effect | 部分；本仓 ports/support 已拆出；PageBuild 实例仍聚集依赖/配置/可变状态，Halfcode 仍组合其私有完整 runtime | [conformance Effect](../inventory/depa-conformance.md)、[IORC](diagrams/iorc.md) |
| Processor | 抽查 generic CLI dispatch 成立；完整 CLI-first ingress 尚未成为公共组合入口 | [R02](../boundary/backwrite-risks.md)、[执行流](diagrams/execution-flow.md) |
| Actor | 抽查 admission/drain 明确；跨进程保证受 record store 合同限制，不宣称 exactly-once 或所有 owner lifecycle 完成 | [conformance Actor](../inventory/depa-conformance.md)、[owner 边界](../boundary/single-writer.md) |

Data profile：EventSourcedStateProfile、ReactiveDataGraphProfile 均为 NOT_APPLICABLE；没有激活证据，不以缺少事件溯源或响应式图降低基本符合度。具体判据与例外见 [激活表](../inventory/depa-conformance.md)。

PackageRoleConformance：完整 declared/observed/port/closure/依赖判定见 [逐包表](../inventory/package-boundaries.md)。17 行 invalid-name 包含私有 root、产品、平台与派生副本的命名政策问题，不能相加成 17 个独立运行时故障；support 使用公开 codec 也不能机械当作私有跨层泄漏。

## 4. 事实源边界发现

- Authored source 是正式来源；虚拟 builtin Kind 输入和 catalog/materialized bundle 是受控投影，不是第二份用户资源。[F03–F11](../inventory/fact-nodes.md)、[事实图](diagrams/fact-source.md)。
- Kind subject/semantic owner/reader、发行 package identity、运行时实例/placement 分别有裁决边界；不能用一次 prefix replacement 同时改变它们。[R01](../boundary/backwrite-risks.md)。
- 领域 repository 的 lock/CAS/staging 是一个 owner 的多个物理写点，不是多写者，也不自动意味着 crash-atomic 多文件事务。[F15/F16](../boundary/single-writer.md)。
- 两仓存在同源实现是源码治理问题，本身不证明两个 runtime 同时写一个 workspace。单一上游源码 owner 是新的目标约束，运行实例仍各自隔离。[owner 边界](../boundary/single-writer.md)。

## 5. 关键问题

| ID | 现象与影响 | 证据真源 |
|---|---|---|
| P01 | 两仓已有独立演进；直接覆盖会丢 Halfcode clone allowlist 或本仓契约/生命周期/重命名优先级修复 | [PD01/02/12](../inventory/provenance-distribution.md)：H/scripts/clone.ts:12、C/scripts/clone.ts:286、两仓 MCP/Vue 公共面 |
| P02 | 包名进入 owner/fingerprint/exact admission；改名可能使旧 lock、脚本和资源加载不兼容 | [R01](../boundary/backwrite-risks.md)：C/packages/skill-app-contract/src/resource.ts:68、C/packages/skill-app-support/src/resources/package-protocol.ts:259 |
| P03 | 基础 CLI 的安装闭包仍包含 Skill App/compiler/AJV/YAML/Hono；惰性创建不等于可选安装 | [PD07](../inventory/provenance-distribution.md)：C/packages/cli-host-capsule/package.json:25、cli-host-shell/package.json:15 |
| P04 | 全部 CLI-first 准入/transport 组合仍在私有产品代码；已有低层公开能力不等于第三 CLI 可直接复用完整策略 | [R02](../boundary/backwrite-risks.md)：C/packages/cli/src/cli/runtime/local-function-execution.ts:30、http/app.ts:207 |
| P05 | release 检查存在依赖键顺序误判与 Vue 新文件白名单不匹配；嵌套 builder metadata 还保留 workspace:* | [PD03–05](../inventory/provenance-distribution.md)：C/scripts/check-release.ts:177、:203；build-release.ts:34。前两项只读重放，未跑整套 release |
| P06 | Domain Kind 注册已定义但产品默认 runtime 未注入；不能把通用 custom-Kind consumer 成功算成 Codument 接入完成 | [R03](../boundary/backwrite-risks.md)：C/packages/cli/src/cli/runtime.ts:86；正面能力见 [custom-Kind 证据](../inventory/provenance-distribution.md) |
| P07 | 当前证明不覆盖无 override 的发行解析、最低 Bun 版本或所有平台运行；完整 check 仍有三个继承文档失败 | [PD06/09–11](../inventory/provenance-distribution.md)、[INC-05/OBS-07/08](../inventory/incidents.md) |
| P08 | Legacy bundle digest check 后导入原实时路径；属于条件性执行准入风险，未做动态竞态复现 | [R04/R05](../boundary/backwrite-risks.md)：C/packages/skill-app-support/src/resources/bundle-materializer.ts:174、:192 |

C/H 的绝对根定义见 [scope](../scope.md)。本表汇总独立证据，不新建问题结论；完整路径和已排除原因在链接表中。

## 6. 改造建议索引

目标设计见 [architecture](../convergence/architecture.md)、[逐包处置](../convergence/package-disposition.md)、[10 决策 / 6 候选](../convergence/decisions.md)。首批 [rec-01](../recommendations/rec-01.md) 来源基线 → [rec-02](../recommendations/rec-02.md) 公共契约/安装闭包 → [rec-03](../recommendations/rec-03.md) CLI-first 生命周期与 [rec-04](../recommendations/rec-04.md) 执行材料一致性；后两项重叠时默认串行。后续产品采用/三消费者/clone 与最终用户 gate 见 [顺序](../recommendations/order.md)、[保留的后续义务](../recommendations/backlog.md)。现状问题不会直接触发源码修改。

## 7. 方法自检

- 每项问题回指独立 inventory；源码 locator 已经 fresh 抽查，不把字符串扫描当完整语义证明。
- Data profiles 有不适用判定；无要求替换 compiler、增加统一 Actor 框架或为每个功能强制六包。
- 包命名、源码 owner、runtime authority、publish 权限分开；本地 pack 不等于 npm 发布。
- 五图做过保守结构/链接检查，未运行 Mermaid parser/render，不声称渲染验收。
- 设计建议经过 [fresh 复核 1](../reviews/recommendations-round-1.md) FIX_APPLIED → [fresh 复核 2](../reviews/recommendations-round-2.md) NO_GAP；修正了两处上游门禁仍只引用旧 project 代码的计划缺口。它证明本分析范围的建议充分性，不证明产品运行、发布或升级完成。

## 8. 下一步

跨仓设计与建议复核已经完成。用户确认源码实施范围后，从 rec-01 的两仓基线重观察和来源对照开始，后续按唯一 loop 继续。最终 init/status/upgrade-workspace 合并仍为核心重构后的独立决定；公共 npm 发布也需另行授权。
