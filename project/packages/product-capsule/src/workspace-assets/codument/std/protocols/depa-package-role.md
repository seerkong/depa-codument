# 测量尺 3 — package role 协议（命名 + 职责 + 依赖判定）

> 本尺服务 `package` 范围：判断一个 package 的名字是否表达真实职责、依赖方向是否符合 DEPA、拟新建/拆分/迁移的 package 应取什么 role。role 的语义本源见 [DEPA 架构吸引子](../attractors/depa-attractor.md) §8；本文件只把它变成可执行的命名语法、盘点字段与 conformance checks。

---

## 0. 适用范围与非目标

- 适用于 npm scope 内外、monorepo workspace、语言级 package/module 等具有稳定公开边界的单元；检查时先取 package basename。
- 本协议不要求每个项目同时创建六种 package，也不因一个函数级 adapter 就强制拆独立 package。只有形成真实、可复用的 package 边界时才使用对应 role。
- package role 描述架构职责，不决定 public/private、npm 发布、部署或商业策略；这些由项目治理另行裁决。
- `implementation`、`runtime`、`provider` 等仍可作普通技术词或 capability 名；它们不能替代本协议的最终 role。

## 1. 包名语法

```text
<family>-<capability-path>-<role>
```

对 scoped npm package，`@scope/` 不参与 role 判定；只检查 `/` 后的 basename。role 必须是 basename 最后一个以 `-` 分隔的词，且只能取：

```text
contract | logic | support | adapter | capsule | shell
```

例：

```text
holarchy-core-contract               PASS
holarchy-file-xnl-support            PASS
holarchy-eidolon-adapter             PASS
holarchy-file-xnl-capsule            PASS
holarchy-http-shell                  PASS
@scope/holarchy-member-runtime-logic PASS

holarchy-runtime-file-xnl            FAIL  缺少 role
holarchy-support-file-xnl            FAIL  role 不在最后
holarchy-file-xnl-impl               FAIL  impl 不是 role
holarchy-runtime-composer            FAIL  composer 已由 capsule 取代
```

`family` 与 `capability-path` 由项目领域决定；本协议不规定必须含 `core`，也不为尚不存在的未来能力预建空 package。

## 2. declared role 与 observed role

每个 package 必须分开记录：

- **declared role**：从 package basename 最后一个词读取。
- **observed role**：从公开 API、直接依赖、side-effect path、authority responsibility 与组合/交互入口观测。

判定不能只信包名：

| verdict | 含义 |
|---------|------|
| `match` | declared role 与 observed role 一致 |
| `mismatch` | 名称声称的 role 与主要职责不一致 |
| `mixed` | 多个首要职责混装，无法指出单一主 role |
| `invalid-name` | 缺 role、role 不在最后或使用非闭合 role |
| `uncertain` | 证据不足，必须补公开 API/依赖/effect path 观测 |

`mismatch`/`mixed` 不靠重命名掩盖：先按 authority 与职责决定迁移、拆分或归位，再命名目标 package。

## 3. 六种 role 的可观测判据

| role | observed role 的主要证据 | 不应出现 |
|------|--------------------------|----------|
| `contract` | 公开 schema/type/port/command/event/Processor signature | 业务实现、IO、bootstrap、具体 vendor client |
| `logic` | 领域规则、纯变换、runtime-first Processor | 直接 IO、隐式全局 client、具体 support |
| `support` | 对 contract side-effect capability 的具体实现与 binding/factory | 找不到 effect contract；领域决策；反向 import 本能力 logic internals |
| `adapter` | outer↔inner runtime/input/config/output、协议或领域形态转换 | 被转换事实的独立 authority；只为同构透传存在 |
| `capsule` | 选择并组合真实 contract/logic/support/adapter closure，提供稳定构造/运行入口 | 空 re-export；最终 HTTP/CLI/UI 协议表面 |
| `shell` | 面向人、CLI、SDK、HTTP、UI 或 host 的真正外部入口 | 领域 authority、核心规则、底层 IO 细节 |

### support 的机械判据

只要 package 的首要职责是实现 contract 中声明的 side effect，它就是 `support`：

1. 能定位被实现的 contract port/capability；
2. 具体实现经 runtime 注入给 Processor 使用；
3. 可以包含文件、DB、网络、时钟、随机、消息、codec、事务、锁、CAS、重试和恢复；
4. 表示转换（domain record→row/XNL bytes）不自动使它成为 adapter；
5. 找不到 effect contract 的 helper/utils 集合不得命名为 support。

保留 `support` 而不采用其它候选词，是因为 role 要表达**架构关系**而不是某种技术：

| 候选 | 不作为闭合 role 的原因 |
|------|------------------------|
| `effect` | effect 是 contract 声明的能力/边界；用它命名具体实现会把契约与实现混为一层 |
| `port` | port 属于 contract 一侧，不是 port 的具体实现 |
| `driver` / `provider` | 语义依赖框架或使用习惯，无法稳定覆盖文件、DB、网络、时钟、事务与恢复 |
| `backend` / `storage` | 只覆盖部分技术形态，不能表达所有 side-effect implementation |
| `infrastructure` | 范围过宽，容易重新变成 IO、部署、工具和业务规则的混装包 |
| `impl` | 只说明“这是实现”，没有说明它实现的是 contract side effect，也容易吞入 logic |

因此 `support` 的精确含义不是“辅助工具”，而是“支撑某个 contract side-effect capability 的可替换实现”。

### adapter 的机械判据

adapter 是边界转换能力，不与 support 竞争分类：

1. logic、support、capsule、shell 均可依赖公开 adapter；contract 不依赖实现型 adapter；
2. 函数级 adapter 只有形成独立、可复用公开边界时才提取为 `-adapter` package；
3. adapter 放在执行封装适配的一方项目中。例如 Eidolon 封装 Holarchy 时，`holarchy-eidolon-adapter` 由 Eidolon 项目拥有；Holarchy 封装 depa-domain 时，`holarchy-depa-domain-adapter` 由 Holarchy 项目拥有；
4. 如果一个 package 既有可复用语义适配，又实现 side-effect contract，优先拆为 adapter + support，由 capsule 组合；若不值得拆，按首要公共职责命名并把次要职责登记为边界风险。

### support / adapter 快速裁决

| 问题 | `support` | `adapter` |
|------|-----------|-----------|
| 首要职责 | 实现 contract 的 side effect | 转换两个公开边界的形态/语义 |
| 必须能回指 | implemented effect contract | outer/inner public contract 或 Processor entry |
| 是否拥有 IO/recovery | 可以，是其实现的一部分 | 通常不拥有；只调用/转换既有公开能力 |
| 是否拥有被处理事实 | 只能按 contract 受控读写 | 否，不能成为第二 authority |
| project owner | 提供该 side-effect implementation 的能力项目 | 执行封装适配的一方项目 |
| 两者同时出现 | support 可以依赖 adapter | adapter 不因此变成 support |

## 4. 默认依赖矩阵

本矩阵是默认方向，不取代具体领域的证据裁决；所有依赖只能触及公开面且必须无环。

| from role | 默认可依赖 | 条件/禁止 |
|-----------|------------|-----------|
| `contract` | 更底层稳定 contract | 不依赖本能力 logic/support/adapter/capsule/shell |
| `logic` | contract、纯工具、必要的公开 lower logic/adapter | 不依赖具体 support；不直接 IO |
| `support` | contract、adapter、vendor/平台原语 | 不反向依赖本能力 logic internals；不承载领域决策 |
| `adapter` | 两侧 public contract、必要的公开 Processor entry/adapter | 不 import 任一侧 internals；不成为第二 authority |
| `capsule` | contract、logic、support、adapter、下层 capsule | 有真实选择/组装职责；无环 |
| `shell` | contract、adapter、capsule；简单场景可直接组装公开 logic/support | 不绕过 internals；不把交互表面变成领域 owner |

capsule 是推荐的可复用组合边界，但不能为了让 shell 只依赖 capsule 而强造空 capsule。真实变化点与复用需求优先。

## 5. capsule、shell 与发布策略

- `capsule` 对程序提供稳定的构造、生命周期或运行入口，隐藏所选 support/adapter closure。
- `shell` 把能力暴露为真正的外部交互表面；capability-path 应表达协议或宿主，例如 `http-shell`、`cli-shell`、`sdk-shell`。
- shell 可以是 public library，也可以是 private business app；`-shell` 不自动授权 npm publish。
- 业务 server/web 即使承担 shell 职责，也可继续位于 private `apps/`，不因规范而拆成可发布 package。

## 6. 迁移与命名纪律

- `composer` 作为早期 package role 一律迁移为 `capsule`；普通语义中的 compose/composition 不受影响。
- 旧 `*-impl` 若首要职责是实现 contract side effect，迁移为 `*-support`；普通语义中的 implementation detail 不受影响。
- `runtime` 是 Processor 的显式依赖载体，不是 package role；它可以留在 capability-path，例如 `member-runtime-contract`，但最后仍必须是闭合 role。
- 不做只改 package.json 的机械 rename：先验证 observed role、依赖、公开 API 和 authority，再决定 RETAIN/RELOCATE/SPLIT/REMOVE/ADD-CONTRACT。
- adapter 迁移到封装适配方项目时，必须同步检查依赖方向与发布边界，禁止两边各留一份可写实现。

## 7. PackageRoleConformance

对 package scope 的每个 package 逐项给 `PASS | GAP | BLOCKED | NOT_APPLICABLE`，并附 evidence locator：

- [ ] basename 最后一词是闭合 role，且无非闭合 role 冒充职责后缀。
- [ ] declared role 与 observed role 一致；没有未解释的 mixed role。
- [ ] contract 只承载稳定契约，不含实现/组装。
- [ ] logic 不直接 IO，也不 import 具体 support。
- [ ] support 能定位 implemented effect contract，经 runtime 注入且不承载领域决策。
- [ ] adapter 有真实 outer/inner 差异、只触公开面，并由封装适配方项目拥有。
- [ ] capsule 有真实组合闭包；shell 只负责真正外部表面。
- [ ] 依赖单向无环；没有跨 package internals、第二 authority 或衍生反写。
- [ ] role 与 public/private、发布/部署策略分开裁决。

任一 GAP 必须落 `inventory/package-boundaries.md`；目标 role/name 与处置落 `convergence/package-disposition.md`，不得只在报告里口头建议。

## 8. 与其他测量尺的关系

- 函数级 outer→inner 转换是否需要 adapter：[DEPA 架构吸引子](../attractors/depa-attractor.md) §7。
- module 是否形成单入口、internals 隐藏的组织单元：[DEPA 架构吸引子](../attractors/depa-attractor.md) I10。
- package 的 role/name/dependency 是否正确：本协议。
- side effect、runtime 注入与 core 纯度为何成立：[DEPA 架构吸引子](../attractors/depa-attractor.md) I1/I4。
