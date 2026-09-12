---
status: proposed
last_verified: 2026-09-05
scope: package
---

# Halfcode 公共 Host 与三个独立产品

把通用实现归回 Halfcode，并让 Halfcode CLI 自己也通过公共包运行。Codument 保留领域规则、资源 reader、历史兼容和产品装配；第三 CLI 只提供自己的 commands、Kind registrations、runtime bindings 与产品配置。复用单位是版本化的公共 API 和完整制品闭包，不能依赖另一仓私有源码、永久 vendor 副本或全局替换前缀。

本方案基于 2026-09-05 已经两轮独立复核的 [inventory](../inventory/index.md)，是 **proposed design**。源码未迁移，公共包未发布，三消费者和最终发行验收尚未完成。精确包处置唯一真源在 [33 行包表](package-disposition.md)，三面归位在 [矩阵](three-plane-map.md)，10 条决策及 6 个候选边界在 [decisions](decisions.md)。下文 API 是目标接缝草图，不是现有可调用签名。

## 1. 两种 owner 不应混淆

| 事实 | 最终 owner | 允许的变化 / 读者 |
|---|---|---|
| 通用 Host/Skill App/browser/Vue/MCP 源码、exports 与 library release metadata | Halfcode 仓库 | 受控源码变更 → 不可变包版本 → 各产品显式升级依赖；Codument 不另存可写通用实现 |
| Halfcode/Codument 的 commands、identity、defaults、模板、启用哪些 providers、bin/native recipe | 各消费产品 | product capsule 组合公开能力；shell 呈现外部协议；公共库不感知产品名字 |
| 通用 Skill App/Host Kind subject 语义 | 上游相应 contract owner | compiler 注册 owner/revision/readers；包移动不等于改变 subject/owner 语义 |
| Codument Kind、lifecycle、registry、migration 的领域语义 | Codument domain | domain contract/logic/reader 决定；Host 通用 admission 不替代领域验证 |
| workspace 正式 `codument/` 文件 | workspace author + 受控 domain repository transition | load → proposal → lock/CAS/commit；catalog/ContextView/报告仅派生，无旁路写回 |
| catalog、虚拟 Kind 输入、materialized definitions、Page generation | 各 instance 的 projector/materializer | 可重建、可失效；持有生成物的生命周期，不拥有 authored source |
| Serve instance/workflow run | 对应 live capsule/Serve 进程 | 显式 command、取消、drain、close；rendezvous record 只用来核验/找到当前实例 |

依据：F01–F18、P01–P08、C14–C17、PD01/02、R02/R03。两仓当前存在相近代码属于源码演进风险；inventory 没有证明运行中的业务事实双写，不能把源码治理目标当成已发生的 authority conflict。

## 2. 目标拓扑与包粒度

目标公共包共 14 个：五个基本 CLI Host、三个 Skill App 基础包、三个已有可选 browser/Vue/MCP 包，加三个新 composition/protocol 边界 `skill-app-capsule`、`live-host-capsule`、`http-shell`。新增理由是 PD07 的安装闭包与 R02 的完整 execution/live 公共接缝。并非每种 feature 都创建六角色。

```text
Halfcode 源仓库
  public halfcode-cli-lite-*                         源码 owner
    CLI contract ← logic / support ← CLI capsule/shell
    Skill App contract ← logic / support ← Skill App capsule
    live-host-capsule ← 显式 runtime bindings
    http-shell；browser-support；Vue support；MCP capsule  可选安装
                  │ 只发布 exports + versioned artifacts
                  ├── Halfcode product capsule → Halfcode CLI shell
                  ├── Codument product capsule → Codument CLI shell
                  │      ├── Codument host adapter
                  │      └── domain contract/logic/support/capsule
                  └── Notes/第三 CLI 自己的产品组合与领域
```

这表示依赖与制品消费方向，不表示把 14 包串成 14 层。`contract` 声明 ports；`logic` 是 runtime-first Processor；`support` 实现 effect；`capsule` 选择真正 closure 并管理 owned handles；`shell` 适配 argv/HTTP/stdio。产品 adapter 只在两侧真实语义不同处存在，不替同构数据再套一层。

公共包禁止 import `depa-codument-*`、硬编码 `codument/` 或依赖产品 internals。contract 不依赖实现；logic 不直接 IO/导入具体 support。既有 support→public pure codec 的条件边允许但须逐边证明纯净且无环，不能为了删除箭头复制 codec。包所有权与 publish/private 是正交的：两个 product capsule 可以 private，仍必须仅消费公共 exports。

## 3. 安装闭包、装配闭包、运行生命周期分开验证

| 使用场景 | 选择的公开闭包 | 不发生的实例初始化 / 必须成立的边界 |
|---|---|---|
| 普通第三 CLI，只有自有命令 | T01–T05 基本 CLI Host | package-manager 闭包无 T06–T14、compiler/AJV/YAML/Hono/Vue/MCP/browser；这项由打包依赖检查证明，不靠 tree-shaking |
| 资源发现/解析/校验 | 基本 CLI + T06/T07/T08/T12 | 可以安装 compiler/AJV/YAML 等资源能力；不创建 browser、Page runtime、Serve process/HTTP client |
| local 一次性 LocalFunction | 上行 + 按 admitted capability 选择的 bindings | runtime 在调用前创建、finally 释放；普通 local 路径不得读取 Serve record/probe/start/HTTP。局部可按需调用一个真正本地 browser provider，但生命周期必须由该 binding 合同证明 |
| Codument 领域操作 | 上行或最小 domain closure + 四 domain 包 + host adapter | repository lock/CAS/codec 由 domain 拥有；不因读 Track 而启动 Page/Serve |
| Page/live workflow/必要 browser 协调 | T13 + 必要 T09/T10 bindings；HTTP ingress 加 T14 | 已准入叶子/backend 需要长生命周期才装配 live owner；HTTP 与 browser/Vue 不成为基本 CLI 的无条件安装依赖 |
| MCP Apps | 显式加 T11 与调用方 transport | MCP transport 的创建/stdio policy 归 shell，capsule 只借用或按所有权约定关闭；不自动引入全部 Page/browser closure |

T13 依赖 live 所需的公共 contracts/logic/stores，但不无条件依赖具体 T09/T10/T11。产品 capsule 通过 runtime bindings 选择这些实现。单个产品可以选择全功能发行，此时产品本身的依赖会更宽；这不能倒推基本公共 Host 也必须安装全部能力。依据 PD07、OBS-09、F13/F14 与 P05；以上目标闭包仍需实际 pack 后复核。

## 4. 公共扩展接缝：runtime / input / config

serializable descriptor 声明身份、schema、capability ID 和静态值；运行函数、reader、repository、provider factory、client、clock 与可变状态引用属于 runtime。单次 argv/FQN/payload 在 input；调用开关/上限在 config。不得把 handlers/factories 塞入 JSON config，也不能让 runtime 变成拥有业务方法的 facade。

```ts
// Proposed public contract sketch; names require implementation API review.
type ProductSpec = Readonly<{
  identity: CliIdentity;
  sourceRoots: readonly string[];
  privateDirectory: string;
  commands: readonly CommandDescriptor[];       // data only; handlerId reference
  compatibilityProfileId: string;
}>;

type ProductBindings<R> = Readonly<{
  commandHandlers: ReadonlyMap<string, CommandProcessor<R>>;
  resourceRegistrations: ResourceContractRegistrations; // executable readers here
  runtimeFactory: RuntimeFactory<R>;
  effects: HostEffectBindings;
}>;

// Composition binds dependencies; Processor performs the operation.
type InvokeInput = Readonly<{ fqn: string; payload: unknown }>;
type InvokeConfig = Readonly<{ includeDiagnostics: boolean }>;
declare function invoke(runtime: InvocationRuntime,
  input: InvokeInput, config: InvokeConfig): Promise<InvocationReceipt>;
```

`ProductSpec` 是装配时不可变数据，产品拥有 defaults；bindings 在 runtime 槽位注入；配置只能引用已登记实现 ID，不能把一段任意脚本作为 provider。现有 `CommandDefinition<R>` 可保留为兼容的 composition API，新 serializable projection 必须从同一注册定义派生，不能出现两套独立命令真源。协议草图只是澄清字段归属，不强制把现有每个对象机械改成新类型。

三类扩展具有不同承诺，不能笼统称为“插件均可任意扩展”：

1. **命令**：消费者通过公共 command definition/handler 注册自己的叶子，由同一 validator/dispatcher 执行，不复制 Host 命令树。
2. **声明式资源 Kind**：可通过公开 owner/revision/reader/resolution registrations 加新领域 subject，不枚举所有未来业务 Kind；重复 owner、未声明 reader、schema 不兼容必须拒绝。Codument 内置 domainKinds 由 Codument 拥有，共享 core/Skill-App/Host Kinds 由上游拥有，正式 App 中不复制 KindDefinitions。已有 Notes fixture 证明这类接缝确实存在，Codument 默认 binding 仍需补齐。
3. **可执行模型/capability/backend**：materializer provider 是已有接缝，但当前 executable leaf Kinds 和能力集合有限。保证的是已定义 ABI 上的 provider 替换与明示 capability 扩展；新增执行语义要有 contract revision、admission/placement/release case。不能把注册一个新资源 Kind 等同于任意代码立即可执行。

依据：boundary/fact-roles 的八条 ingress、PD06 的 custom-Kind fixture、R02/R03。Codument adapter 的外侧是 domain public commands/resources/receipts，内侧是 Host public command/resource/invocation contract；它拥有转换，不拥有被转换的业务事实。

## 5. CLI-first 的决策与生命周期

产品定义叶子 command 的软件 policy；Host 根据实际已准入 resource、capability requirements 和所选 backend 生命周期计算 placement。用户输入不能直接要求绕过为 local，资源业务配置也不新增 placement 裁决项。相同命令在不同 admitted backend 下可能需要不同生命周期，这个变化由 capability 合同和运行绑定产生。

```text
leaf command + resource admission + backend capability declaration
    → public preflight / placement / digest
    → local: build narrow runtime → Processor → finally release
    → live: exact instance request → server re-admission → live owner → receipt
```

local 分支不加载 Serve record、不 probe、不启动、不走 HTTP。live request 仅带 FQN/input/config、workspace/agent/instance/profile 与 admitted source/contract digest 等必要身份；不提供万能 argv/code RPC，也不允许客户端传 placement 作为裁决。Serve 用自身当前实例与重新准入的资源独立复验；缺实例、错 root、旧 digest、能力/协议不兼容均 fail closed，不偷偷降级 local。

generic preflight/placement/receipt 归 T06/T07，transport effect 归相应 support，资源执行与 drain 归 T12，live instance/coordination 归 T13，HTTP 映射归 T14。产品仍选择命令表与实际 provider。现有公共 placement 函数只是其中一部分，private runtime/HTTP 提取完成前不得称第三方已得到完整 CLI-first。

close 顺序按依赖反向：停止新 admission → drain 已接受 invocation/workflow → 关闭 live/page/codex owner → 释放自有 browser/provider handles → 释放 resource catalog/materializer generations。borrowed handles 保持 borrowed；单个 close 失败仍尝试释放其他 owned handles并汇总错误。同步 parser 不需要 Actor；现有异步 owner 保留串行/取消/drain，而不是引入第二调度系统。依据 R02、F09–F14、P03.7/P05.7、conformance Effect/Actor。

## 6. 包身份变化的兼容合同

当前两个 contract 都写 `2.0.0`，但 public exports 与 authority identity 不同；subject FQN 中的 `Halfcode.ResourceKind.*` 又是独立轴。新无 scope npm 包必须把 **安装制品 provenance** 和 **语义 owner identity** 分成两组数据，不能做全局前缀替换。

| 身份轴 | 核心迁移默认策略 |
|---|---|
| distribution package name/version/integrity、exports | 迁为目标公共包，精确验证其 tarball、锁定解析与依赖闭包；这是新的包来源 |
| subject FQN、specVersion、owner contract authority、schema/reference/compiler fingerprint、reader profile | 对已有资源冻结；由消费产品选择有限历史 compatibility profile，不能凭包名换了就重算并接受新 hash |
| formal resource root `codument/` | 固定；private `.codument` 只放 Host 自有状态，不产生第二 App |
| `globalThis.Codument` / `HalfcodeCliLite`、Vue injection key | 明确列为 legacy script/UI API；产品桥接原有 key 到同一 canonical implementation，不可静默换 key 或装两个不同 owner |
| package protocol、contract package version、compiler version、Kind specVersion、reader profile、Serve protocol、产品版本 | 各自有独立兼容规则；版本数字相同不是兼容证明 |

有限兼容 profile 建议先覆盖已盘点的 Halfcode legacy 与 Codument extraction 两族，由各产品提供数据，公共库不硬编码 Codument 分支。一个 resource runtime 对同一 subject 只选择一个 owner profile；不能同时注册两套 owner 再“最后一个覆盖”。profile 的有限性仅限制 **旧身份兼容集合**，不限制显式注册新领域 Kind。

compatibility receipt 至少关联 `(installed package name, exact version, artifact integrity, public API compatibility version)` 与 `(legacy declared package identity/version, subject owner/revision, schema/reader fingerprints, lock/profile)`。这张映射由可信产品发行合同提供，并由 conformance fixtures 验证；包自身宣称“我是旧包 alias”不构成信任。旧 code-first descriptor 依赖精确旧名称时，要保留可解析的受限兼容入口/转发包或执行明确迁移，不能删掉 exact name/version/integrity 检查让它碰巧运行。兼容入口只转发同一 implementation，不复制第二实现；是否需要真实发布旧名桥接另行核对现存消费者与发布权。

本轮目标选择 **read-compatible / preserve-existing-write**：支持经上述精确映射认证的旧输入，迁移前重写已有资源仍保留原 profile/identity。新 workspace 由产品明确选择受支持 profile，不随机跟随最新 dependency。需要统一 owner identity 或改变 fingerprint 时，另外执行可审计 migration：备份 → 检查旧精确值 → 转换 → 写新 lock/profile → 失效派生 cache → 复验；旧 reader 是否可读新版本有单独 case。未知 owner、同 subject 冲突、错误完整性、未登记旧版本全部拒绝，不提供 blanket bypass。依据 PD08、R01、F06/F07/F12、P02.2/P04.2。

## 7. source admission 到执行字节

保留现在的正向链：authored source → 只读虚拟 Kind 输入 → compiler resolved snapshot → materialized executable → definition cache。resource-first 的 physical manifest digest 与 virtual projection digest 分开；code-first descriptor 的业务字段仍由 package source 拥有，Host 拒绝同时从 XNL inline 定义相同字段。不能为公共 API 方便把 projection 变成回写接口。

R04 需要把 legacy execution 改为加载 **本次已准入的 captured closure**，或在无法保证闭包一致时明确拒绝；只在 import 前再次 hash entry 仍不能自动保证依赖文件一致。R05 要把另行复制的 package metadata、依赖 lock 和实际 build dependency bytes 的保证说清楚。允许受控不可变 dependency stage 或等价的稳定访问机制，但必须通过“在 admission 与 build 之间修改 metadata/dependency”的负例证明会固定旧闭包或拒绝；不能声称 source staging 已经固定整个 node_modules。

这是一组有边界的 loader consistency 工作，不是完整 supply-chain 系统。F09/F10 的 artifact/cache owner 按 instance 释放；H 的 process-global descriptor cache 迁到相同 owner 模型。现有 domain journal 继续由 repository 恢复，不误当成 general migration ledger。依据 R04/R05、F03–F11/F15/F16、P02/P03、INC-01/03。

## 8. 公开分发与独立版本合同

第一版承诺应是 **Bun 消费公共 TypeScript exports**，明确最低支持版本并用最低版/当前版运行；当前依赖链要求至少 Bun 1.3，而部分根包写 1.0，不能照抄不一致 metadata。Node/npm 作为 JS runtime 支持尚无证据，不做承诺。若以后要提供 compiled JS/declarations，作为独立出口设计和验收，不因 npm 可安装就自动宣称 Node 可执行。

公共包按能力发布版本；产品版本按产品兼容性演进，两者不强制联动。可用一个 release-set manifest 锁定经过组合验证的一组 library versions，但每个包仍声明真实 dependencies，不能要求所有消费者“全部装一遍且 overrides”才解析成功。0.6.0 是 Codument 产品的暂定下一 minor，需重新核对实施基线；不是让所有公共库或 `specVersion` 自动改成 0.6.0。

公共 contract identity、compiler coupling 与 code-first admission 若要求 exact version，必须照实声明并在兼容矩阵中测；普通 runtime dependency 的 semver range 由公开 API 的兼容保证决定。API/schema/reader/Serve protocol 的不兼容变更分别有升级与拒绝行为。release set 记录每包 name/version/integrity、public exports、runtime floor、peer/optional/production dependencies 和生成资产摘要。

公开库 gate 与产品 native gate 分开：

1. **库制品 gate**：pack 后只有声明的 public files/exports/assets；无 `workspace:`、私有源路径或缺漏 transitive dependency。隔离环境清空源码搜索路径，通过普通包解析运行；三个消费者安装同一 immutable set。
2. **真实依赖解析 gate**：现有 tarball overrides fixture 保留为快速证据；另加隔离临时 registry 或等价的受控包源，让内部 transitive 依赖按发布名/版本正常解析，消费端不手动覆盖每一个依赖。它验证拟发布 metadata，不代表已经 public npm publish。
3. **产品 native gate**：保持现存六个 native package names，只调整 product recipe；metadata 按结构比较，payload allowlist 从实际声明闭包生成。builder 从 T10 的已打包闭包消费，不能复制一个仍含 `workspace:*` 的嵌套 manifest；支持外部 Bun/BUN_BIN 与 browser executable 的契约写进产品说明。
4. **平台 gate**：binary header/交叉编译是格式证据，目标 OS 实机 smoke 才能承诺该平台运行；Darwin arm64/x64、Windows x64 分别记录，未覆盖 Linux/Windows ARM 不扩大声称。

真正 npm 可用性/账号权属/发布是未来外部动作，当前未知；本轮不查询占用或发布。artifact tarballs 可以作为发布前闭包验证，不可描述为已公开发布。依据 PD03–PD11、OBS-07/08、INC-04。

## 9. reconciliation、clone 与回滚

当前 C 是 depa-codument 内的嵌套目录，H 是独立仓。原 clone 来自 dirty working tree；旧 HEAD 加总 hash 不能重建逐文件 base。实施先重新记录两树 HEAD、status、tracked/untracked 文件内容与 manifests，再按公开能力、tests、模板、clone/release recipe 建逐项来源表。每项记录 `保留 H / 采用 C / 人工组合 / 暂缓及原因`、输入 digest、输出与验证。优先保留 H 新 allowlist，同时吸收 C 的 replacement precedence、public ports、close/SQLite/debug 修复；不能从两个提交统计直接推导哪些代码缺失，更不能 whole-copy 或全局 rename。

clone 明确提供三种不同结果；**完整 dirty snapshot 的用户需求不能被 source allowlist 偷换**：

| 工作流 / scope | 复制与依赖语义 | provenance / 目标归属 |
|---|---|---|
| consumer scaffold | 只生成 product-owned shell/capsule/config/templates/App，加版本化公共包依赖；不复制公共实现、mission、仓库历史材料 | receipt 记录模板与 public release set；生成项目拥有产品源，通用源仍归 H |
| source-only working-tree snapshot（默认 clone source 模式） | 保留 H 的 source root allowlist，在该边界内读当前 tracked + eligible untracked bytes；确切排除清单与 lock 保留/显式 re-resolve 策略写入 receipt | 不宣称这是完整 working tree；用于受控源码 export/实验，不能自动成为另一长期公共 source owner |
| **full eligible-working-tree snapshot（显式完整模式）** | 包含用户要求的全部 tracked bytes（含已跟踪但匹配 ignore 的路径）和未被 ignore 的 untracked bytes，保留 dirty 修改与 lock；不能静默删 `codument/`、docs、规划文件或将 tracked 生成物丢弃。`.git` 管理元数据不是普通源快照；若用户另要备份它，独立说明 | receipt 列全部 included/excluded paths 与内容 hash。秘密/巨大生成物需排除时必须显式报告/选择 scope，不能称为“完整”却悄悄删；本次没有执行新 clone |

完整 snapshot 与 rebrand 又是两个动作：先保留可复现输入 bytes，再对明确的 product-owned tokens 做有清单的变换并记录结果；公共 package names、semantic identity/FQN/lock/global key 不参与字符串全局替换。若选择 re-resolve dependencies，先保留原 lock 和 receipt，新的解析结果另记，不能拿它当原快照。来源 PD01/PD02 证明 current clone 有 dirty/allowlist/replacement/lock 差异；以上完整模式同时落实用户此前“modified tracked + untracked not ignored 全部”的约束。

以下是采用与回滚的合同阶段，不取代 recommendations 的就绪排期：

| checkpoint | 必须看见的退出证据 | 可回滚边界 |
|---|---|---|
| 基线冻结 / reconciliation 表 | 当前两树 bytes + public surface + identity/profile 矩阵、每项来源与差异 | 尚无源码迁移，保留两树原状 |
| H 公共包准备 | 14 包 role/exports/dependency gate、核心 CLI closure、identity 负例、相关包 tests | revert 本次 H 变更或保留实验分支；尚无产品采用，不覆盖独立用户变更 |
| immutable release set / 三消费方 core fixture | 同一 tarball 名称/版本/完整性被 H/C/Notes 隔离消费；custom Kind、local 无 Serve、live 缺实例、close 与 admission 负例 | 各 fixture/product dependency manifest + lock 回到前一 release set；保留失败证据 |
| 产品隔离采用 | C domain reader/provider/旧命令合同、H 本产品功能、native recipe 分层验收；full-check 红灯有真实结论 | 产品采用可分别撤回；公共版本无需随产品降版或改写；cache 可丢弃重建 |
| 后续真实 workspace/最终入口迁移 | 三命令讨论与用户确认后，历史升级、备份/冲突/幂等、完整 bins/JSON/exit 与全量 mission gate | 不能只降依赖回滚已改 authored source；使用迁移备份/receipt 和受控 restore，未知或冲突显式停止 |

发布后回滚通过产品 pin 旧不可变版本或发布新修正版本，不覆盖已经发布 tarball。源迁移回滚也不能覆盖随后新增的用户修改。真实 workspace 的 profile/hash/schema 改变必须走 domain migration recovery，与可重建 cache/artifact 清理分开。最后一阶段仍被 mission 的三命令冻结约束挡住；本轮设计完成不解除它。

## 10. 本轮可以作出的结论

已知缺口足以支持这套方向：安装闭包过宽、完整 CLI-first 私有、两族 identity 耦合、领域 provider 未接入、两类 admission 一致性问题，以及发布/clone recipe 差异，都有 inventory 回溯。既有 source projection、domain CAS、tarball consumer 与自定义 Kind coverage 是应保留的基础。下一步按 6 个候选做 readiness、依赖与验收切片；包括 historical full-check 红灯在内的未完成项继续可见，不把设计收敛或历史 scoped PASS 写成产品完成。
