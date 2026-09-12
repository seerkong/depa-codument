---
status: proposed
last_verified: 2026-09-05
scope: package
---

# 决策与候选边界

本表消费 inventory round 2 `NO_GAP` 的九个叶子文件；是方案，不是实施批准或运行 PASS。源码前缀 `C/`、`H/` 的绝对根见 [包表](package-disposition.md)。权威分工：本文件定处置与候选边界；architecture 解释接缝合同；recommendations 才做 readiness 与第一批顺序。

| 决策 | 三面 × 层级 | 处置与可观测目标 | vendor 取向 | inventory 回溯及源 locator | 候选 |
|---|---|---|---|---|---|
| D01 公共源码归 Halfcode；产品保留真实封装 | 全三面 × platform/application | RELOCATE/SPLIT；14 个目标公共包由 H 维护，三消费方仅版本化 public exports；33 manifests 的动作、命名与有限例外见包表。Codument 领域和 adapter/capsule 自持 | 沿用已有提取成果，逐项 reconcile H 改动 | package C01–C21/H01–H12；PD01/02/12；`H/packages/cli/src/cli/runtime.ts:36` | C01/C03 |
| D02 安装闭包与实例初始化分开 | extension/control × platform | SPLIT；基础 CLI 五包闭包不含 Skill App、Hono、browser、Vue、MCP；资源/live/HTTP 分到 T12/T13/T14；各 profile 只构造请求所需实例 | 不引入万能 registry；沿用 command host 和已存在的真实 runtime/provider 多态 | PD07、OBS-09；`C/packages/cli-host-capsule/package.json:25`；`C/packages/cli-host-shell/package.json:15` | C01/C02 |
| D03 完整 CLI-first 成为公共协议 | control/extension × platform/application | ADD-CONTRACT + RELOCATE；preflight/digest/placement、窄传输、Serve 复验、drain 对第三 CLI 可用；叶子及 admitted backend 生命周期决定 placement。local 不触达 Serve record/probe/start/HTTP | T06/T07 contract/Processor；T03 transport effect；T12/T13/T14 组合/协议 | R02；P05.1–P05.7；`C/packages/cli/src/cli/runtime/local-function-execution.ts:30,66`；`http/app.ts:207` | C02 |
| D04 实例 owner 与 Processor 明确 | data/control × platform | RELOCATE；H global descriptor cache 归 catalog instance；PageBuild 的依赖/可变状态放显式 runtime，Processor 归 T07；capsule 负责选型、关闭和 owned/borrowed 契约 | 保留已有 queue/drain；不引入事件溯源、响应式图或新 actor framework | conformance Data/Effect/Actor；F09–F14；`H/packages/cli/src/cli/resources/app-package-materializer.ts:368`；`C/packages/cli-host-capsule/src/page-build.ts:20` | C02 |
| D05 distribution provenance 与 semantic identity 分离 | data/extension × platform/domain/application | ADD-CONTRACT；有限 legacy profiles 冻结既有 subject/owner/revision/reader 指纹；精确 artifact/name/version/integrity 与映射验证；不因新 npm 名放宽 exact admission；真正 hash 变化走迁移 | compiler owner/reader/lock 原语继续裁决，产品 adapter 提供兼容数据 | R01；PD08；F06/F07/F12；P02.2/P04.2；`C/packages/skill-app-contract/src/resource.ts:404`；`C/packages/skill-app-support/src/resources/package-protocol.ts:253` | C01/C03 |
| D06 Codument 领域、产品 root 与旧行为保留 | 全三面 × domain/application | RETAIN + ADD-CONTRACT；四 domain 包保持 owner/transition，adapter 映射 public contracts，product capsule 显式装入有 reader/validation 的 domain provider；正式 root 固定 `codument/` | 复用 Host discovery/compiler/materialization；领域 codec、CAS policy 与 migration semantic fallback 自持 | C14–C17；F15/F16/F18；R03；`C/packages/domain-contract/src/resources.ts:73`；`C/packages/domain-support/src/lifecycle-repository.ts:141` | C03 |
| D07 执行材料与 admission 闭包一致 | data/control × platform | ADD-CONTRACT；legacy import 使用 admitted captured closure 或在不能保证时拒绝；package metadata/dependency closure 同样纳入可证明的 staging/recheck 合同，不能仅校验源后读 live 依赖 | 沿用 compiler/Bun materializer；有限一致性修复，不扩成供给链平台 | R04/R05；P03.3/P03.4；`C/packages/skill-app-support/src/resources/bundle-materializer.ts:192`；`host-package-materializer.ts:297` | C04 |
| D08 公开包和 native 产品分别发布验证 | data/extension × platform/application | ADD-CONTRACT；公开 exports、精确依赖、Bun floor、assets 与 optional closure；native recipe 从同一打包闭包生成 payload，结构比较 metadata；版本轴分离，发布另需授权 | Bun pack/build 与现有 vendors；不声称支持 Node、未测平台或已占 npm 名 | PD03–PD10；OBS-07/08；`C/scripts/build-release.ts:33`；`C/scripts/check-release.ts:177,203` | C05 |
| D09 clone 分成消费方 scaffold 与两种 snapshot scope | data/control/extension × application | SPLIT；scaffold 不复制公共实现；source-only snapshot 保留 H allowlist；显式 full eligible-working-tree snapshot 保留全部 tracked（含 tracked ignored）与 nonignored untracked dirty bytes、lock，不能静默过滤；吸收 C replacement precedence，记录 provenance，不全树覆盖回灌 | 现有 clone 文件枚举与 Git 记录；无伪造 merge base；详细三模式见 architecture §9 | PD01/PD02；OBS-06；`H/scripts/clone.ts:12,155,296`；`C/scripts/clone.ts:143,286` | C06 |
| D10 采用门与回滚材料逐层成立 | control/data × application | ADD-CONTRACT；同一不可变公共 tarball 集由 H/C/第三 CLI 隔离消费，再按产品 gate 采用；修复或明确处置历史全量红灯，不拿 scoped PASS 替代最终验收；阶段退出保留可回退 artifact + lock + source/provenance | 现有 verifier 扩展并补最低 runtime/目标平台矩阵；不弱化负例 | PD06/PD11；INC-01–05；OBS-07/08；`C/scripts/verification/consumer.ts:35`；`H/package.json:19`；`C/scripts/verify-mission.ts:29` | C01–C06 |

## 候选改造边界

### C01 — 公共包边界、身份合同与单一源码基线

- 边界：全部 manifests/public exports 的处置、两树 semantic/API reconciliation、T01–T14 名称与 D05 最小兼容 profile。
- 目标：H 是唯一通用源码 owner；基础 CLI 无资源/HTTP 安装依赖；旧身份无法被机械换名破坏。
- 非目标：实际 registry publish、正式产品入口切换、全目录复制、改变 Kind 业务语义。
- 依赖：实施时重新冻结两树 bytes/manifest/HEAD；先把同名 subject 的旧 owner 指纹差异列成有限兼容输入再搬 contract。不能假装拥有完整历史 merge base。
- owner：H owns public source/release metadata；产品 owns semantic legacy-profile choice；compiler registries admit only the chosen exact set。artifact manifest 记录结果，不反写源码。

### C02 — 可组合的 CLI-first 与 live 生命周期

- 边界：private preflight/transport/server recheck 提取，T12/T13/T14 组合，PageBuild runtime 与 catalog cache owner。
- 目标：同一 public admission 语义可由第三 CLI 在无 Serve 环境运行 local 叶子，live-required 安全失败；所有 owned effects 精确释放。
- 非目标：第二 daemon、万能 argv/code RPC、用户可写 placement 配置、每个同步命令 Actor 化。
- 依赖：C01 的 contract/exports closure；具体 runtime metadata 由已登记 capability/backend 提供，服务端独立计算，不信客户端 placement。
- owner：CommandHost owns admitted calls/per-root runtimes；resource capsule owns catalog generations/drain；live capsule owns live instances/workflow runs；support owns allocated IO handles；借用句柄不被重复关闭。

### C03 — 产品消费、Codument provider 与兼容适配

- 边界：H/C product capsule、C host adapter、domain registrations/readers/commands、legacy bins/JSON/exit contract 的隔离 fixture。
- 目标：两产品与第三 CLI 都不读另一仓私有源码；Codument 保留完整领域能力和 formal `codument/` authority。
- 非目标：当前合并或绕道注册 `init/status/upgrade-workspace`、最终发行切换、旧 `src/` 退役、真实 dogfood 升级、削弱验证机制。
- 依赖：C01/C02 公共闭包；领域 draft contract 要先补 reader/semantic conformance，存在导出并非集成完成。
- owner：Domain repository 单独 owns durable transitions；adapter 只转换 input/config/output/identity；product capsule 选择 bindings；Host 只读源与派生视图。

### C04 — admitted executable closure 一致性

- 边界：R04 legacy dynamic import 窗口、R05 staged metadata/live dependency 读取；对应两个 deterministic mutation fixtures。
- 目标：执行字节与声明的 admission closure 相同，或拒绝且释放暂存；明确“源文件固定”与“依赖闭包固定”的不同承诺。
- 非目标：完整 supply-chain audit、替换 compiler/Bun、任意新增执行 Kind、声称 R05 已复现失败。
- 依赖：C01 public bundle/materializer contract；若 C02 复用其 admission digest，必须在产品采用前合流。
- owner：workspace/package author owns source；materializer owns immutable captured artifacts；catalog cache 仅观察修订，无源写入权。

### C05 — 可打包分发、三消费者与 native recipe

- 边界：public export/engine/dependency/asset metadata、pack closure、同一制品集的三消费者、native builder recipe 与平台声明。
- 目标：脱离两树可安装并运行公开入口；PD03/04 的确定性 gate 问题消失，PD05 嵌套 workspace metadata 无泄漏。
- 非目标：npm 占名/发布、全局安装、添加 Linux/Windows ARM 支持、凭交叉编译声称 target smoke 通过。
- 依赖：C01 API/identity contract；C02/C03 核心 fixture；C04 在执行包采用前通过。native 组合可后于 library proof，不要求同一发布号。
- owner：H owns immutable public library release set；每产品 owns own binaries/manifests/defaults；构建复制只是 derived payload，没有第三份源。

### C06 — clone/source reconciliation 与可回滚采用

- 边界：两个 clone 脚本的 allowlist/dirty enumeration/rebrand/lock policy 差异、source ledger 与采用 checkpoint。
- 目标：source-only snapshot 重现 allowlist 内 bytes；显式 full snapshot 重现全部 tracked（含 tracked ignored）与 nonignored untracked bytes、lock，不以 allowlist 偷换用户完整快照要求；scaffold 只产生 product-owned app；迁移每步可解释来源与撤回范围。
- 非目标：把两个独立仓假装普通 branch merge、整树覆盖、修改示例 App、把受管文档与 mission 默认注入新产品。
- 依赖：C01 明确 source boundary/public-versus-product ownership；C05 可复现 artifacts 支撑采用回滚。
- owner：clone producer owns provenance receipt；destination author owns cloned product source；公共实现仍以 H 为 canonical source，snapshot 不授予双侧长期维护权。

## 未就绪与范围外事项（交 recommendations/backlog）

1. 三命令最终组合、旧 `src/` 退役、真实升级：用户明确后置，不能作为本次 core recommendations 的默认动作；最终完整兼容验收仍保留。
2. registry 名称/账号权属、真实 publish、最低 Bun 与目标 OS 实机支持：现证据未建立。设计包名是目标，发布前独立核验；本回合不外部查询或写入。
3. 任意 executable leaf Kind / 自定义 capability ABI：当前有 provider 与 Notes resource-Kind fixture，但固定叶子与能力集合仍在，不能包装成无限插件承诺。新增执行语义另走 contract/version/验收设计。
4. general migration ledger：F16 是 lifecycle journal，不是已完成的全产品迁移账本。保留 mission 的历史迁移能力目标，实施时按旧能力清单补证据，禁止把 F16 冒充完成。
5. INC-05 的全量文档相关红灯：需后续重观察和实际修复/恢复依据；本轮不猜删除责任，也不删除断言。
