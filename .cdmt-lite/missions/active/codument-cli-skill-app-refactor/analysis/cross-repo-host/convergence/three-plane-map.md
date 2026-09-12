---
status: proposed
last_verified: 2026-09-05
scope: package
---

# 三面 × 层级

所有目标格子是拟议设计；现状依据来自已完成的 [inventory](../inventory/index.md)。`C/` = `/Users/kongweixian/infra-dev/depa-codument/project/`，`H/` = `/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite/`。package role 与下表的层级是不同维度，capsule 不是额外业务层。

| 层级 | 控制面：谁决定、何时执行 | 数据面：谁拥有、怎样派生 | 扩展面：怎样组合与替换 |
|---|---|---|---|
| 平台 / reusable Host | 当前 C 有公共 dispatch/drain，完整 placement/preflight/Serve 复验仍在私有 CLI；H 构造全图。目标：公共 CLI Host + Skill App + live host 组合，共用窄命令与执行协议，按叶子及 admitted backend 生命周期选 closure。D02/D03 | 当前 authored source、虚拟 Kind 输入、catalog、bundle 与 generation 已区分；H descriptor cache 仍全局，legacy import 有检查后读取窗口。目标：保留 source authority，实例持有派生与生命周期；执行只用与 admission 一致的闭包。D04/D07 | 当前命令/identity、Kind provider、materializer、effect bindings 接缝存在，但 CLI-only 安装还带 Skill App。目标：公共精确 exports、有限可验证 capability 合同、可独立安装的基本 CLI 与可选资源/live/HTTP/browser/Vue/MCP。D02/D05 |
| 领域 / Codument | 当前 domain owner 和 repository CAS 已分离，领域 Kind 默认注入缺失。目标：领域 Processor 决定 lifecycle、registry、迁移、验证语义；产品组合注册领域 reader/commands。D06 | 正式 `codument/` 文件是 durable authority；repository 经 lock/CAS/受控恢复写入；journal 是 recovery material。目标保持，新增读模型不能写回。D06/D07 | `depa-codument-host-adapter` 转换 Codument 公共领域命令/结果/资源身份与 Host 公共协议；领域 reader 保留语义裁决。旧解析器仅在迁移边界。D05/D06 |
| 应用 / product overlay | Halfcode/Codument/第三 CLI 各选择 commands、bindings、启用 closure 和退出策略；公共库不识别产品。Codument 的三命令最终组合保持后置。D01/D03/D06 | 产品 identity、配置、模板与发行 manifest 由产品拥有；公共源码和可复现制品由 Halfcode 拥有；不同产品不共享 runtime 实例。D01/D08 | 产品 capsule 负责实际选型；兼容 profile、legacy bridge、OpenCLI 插件适配属于封装方。scaffold 生成消费方薄源码，snapshot 复制明确边界内 working tree，两模式分离。D05/D09 |

## 问题映射与证据回溯

| 现状问题 / inventory 行 | 当前落点 → 目标落点 | 处置 | 可复核源位置 |
|---|---|---|---|
| PD01/PD02；OBS-06：两棵源码树独立演进 | application 内复制实现 → platform 唯一源码 owner + 产品版本依赖 | D01/D09，逐项 reconciliation；clone 语义分型 | `H/scripts/clone.ts:12`；`C/scripts/clone.ts:143` |
| PD07；OBS-09：小入口仍安装 8 个 workspace 包 | platform CLI capsule/shell 混装资源/HTTP closure → 独立 platform composition | D02，迁出资源/live/HTTP 入口及依赖 | `C/packages/cli-host-capsule/package.json:25`；`C/packages/cli-host-shell/package.json:15` |
| R02；F02/F13/F14；P05：完整 CLI-first 接缝私有 | application 私有 preflight/transport/server check → platform protocol/logic/support/capsule/shell | D03，产品仍决定叶子命令与 backend bindings | `C/packages/cli/src/cli/runtime/local-function-execution.ts:30`；`C/packages/cli/src/cli/http/app.ts:207` |
| conformance Data/Effect/Actor partial：全局 cache、实例方法持有混合编排、上游 aggregate close 缺口 | private implementation 隐藏状态 → instance runtime + Processor + owned close | D04，在既有真实组合中归位，不造 Actor 框架 | `H/packages/cli/src/cli/resources/app-package-materializer.ts:368`；`C/packages/cli-host-capsule/src/page-build.ts:20`；`H/packages/cli/src/cli/runtime.ts:108` |
| PD08/R01；F06/F07/F12：npm 名、owner 指纹、global 不同 | distribution 身份影响 semantic identity → 两轴显式合同 | D05，有限兼容 profile + 精确制品凭据；不宽松跳锁 | `C/packages/skill-app-contract/src/resource.ts:404`；`C/packages/skill-app-support/src/resources/package-protocol.ts:253` |
| R03；F18；P04.3：领域默认 provider edge 缺失 | domain contract 有声明，application 未组合 → product capsule 显式选择 domain registrations/readers | D06 | `C/packages/domain-contract/src/resources.ts:73`；`C/packages/cli/src/cli/runtime.ts:86` |
| R04/R05；F08/F09；P03.3/P03.4：admission 到执行字节一致性 | data 平台 loader 检查后仍依赖 live 路径 → captured closure 或一致性拒绝 | D07；已验证来源不等于依赖字节保证 | `C/packages/skill-app-support/src/resources/bundle-materializer.ts:192`；`C/packages/skill-app-support/src/resources/host-package-materializer.ts:298` |
| PD03/PD04/PD05：native metadata/content recipe 不匹配 | application 发行生成物 → product-owned 单一 artifact recipe | D08，结构比较、从实际闭包生成清单、重写发布依赖 | `C/scripts/check-release.ts:177`；`C/scripts/build-release.ts:33` |
| PD06/PD09/PD10；OBS-07/08：pack、engine 与平台证据不同 | application 局部验证 → 公共版本合同 + 三消费方及平台分层证据 | D08/D10，不宣称 registry/Node/未测平台支持 | `C/scripts/verification/consumer.ts:35`；`C/packages/cli/package.json:34` |
| PD11；INC-05：根测试漏包 / 历史全量 gate 红 | application 验证选择 → 完整工作图与真实 gate 状态 | D10，包测试入口与最终产品验收分开 | `H/package.json:19`；`C/scripts/verify-mission.ts:29` |
| C/H package role 表全部 33 行 | 当前 basename/observed role → 指定 role 包；私有根/插件/native 兼容例外有限 | D01，见全包处置表 | `C/package.json:2`；`H/package.json:2`；对应 manifest 行 |

Data profile：本 inventory 未建立 canonical event/replay 或 reactive graph 证据，两个可选 profile 均 `NOT_APPLICABLE`。不引入事件日志、Signal 图或默认 mailbox 来填满矩阵。零已证明 backwrite/authority conflict 的现状结论保持；源码唯一 owner 的目标不等于发现了 runtime 双写事故。
