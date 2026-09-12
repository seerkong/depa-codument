---
status: proposed
last_verified: 2026-09-05
rec_id: rec-04
scope: package
---

# rec-04：使执行材料符合已准入闭包

## 背景问题

R04 的 legacy material 在校验后仍从原 live module path import；R05 的 package source staging 之外，metadata 与 node_modules 读取保证不清楚。这是两个不同强度的发现：前者有静态窗口，后者有界不确定，均未在设计回合运行 mutation reproducer。

## 目标

legacy 和 package 执行只使用本次准入闭包的 bytes，或明确拒绝并释放暂存；不再把只固定 source entry 表述成固定整个执行闭包。

## 非目标

不替换 Bun/compiler，不扩展执行 Kind，不建设全供应链系统；不改 authored source、不把派生 catalog/cache 当写回 authority。

## 输入证据

- [R04/R05](../boundary/backwrite-risks.md)、[P03.3/P03.4](../inventory/read-write-paths.md)：`C/packages/skill-app-support/src/resources/bundle-materializer.ts:167,192`；`C/packages/skill-app-support/src/resources/host-package-materializer.ts:283,297,298`。
- [F08–F11](../inventory/fact-nodes.md)、[INC-03](../inventory/incidents.md)：`C/packages/browser-support/src/web-api.ts:10` 保留真实 resolver/导入闭包语义；C/H 前缀见 rec-01。
- D07，C04，architecture §7；对应 three-plane-map R04/R05 行。

## 目标包与角色边界

源码归 H。T06 `halfcode-cli-lite-skill-app-contract` 声明 bundle/materialization receipt 与可保证的 closure identity；T08 `halfcode-cli-lite-skill-app-support` 实现 BundleMaterializer/Catalog/临时 artifact ports，包含稳定 stage、检查和清理；T12 `halfcode-cli-lite-skill-app-capsule` 选择 materializer/index，并持有 invocation/drain closure。workspace/package author 仍是 source owner，materializer 只 owns 分配的 artifact；无 product 或 private logic import。

## 验收（conformance case）

1. 用 deterministic barrier 在 legacy admission 与 load 之间修改入口及其相对依赖，分别观测：执行原 admitted closure，或返回明确 source-changed/unsupported-closure 拒绝；绝不能执行修改后的未准入 bytes。只再 hash entry 不足以通过依赖文件 case。
2. package 路径分别在 admission 与 build 之间修改 package metadata、锁定依赖材料和实际依赖 bytes。每个 case 执行固定旧闭包或拒绝；receipt 明确覆盖哪些内容。若现有机制无法给保证，受影响 profile fail closed，而不是声称 node_modules 不会变。
3. 无变更的 resource-first/code-first、multi-file relative import fixture 仍可运行；schema、精确 package/lock/integrity 校验不放宽。mutation/异常/取消后 staging 只清理自身目录，另一实例 artifact 和 authored files 不变，失败 promise 可重试且不复用污染 cache。
4. rec-03 admission digest 与这里实际 closure receipt 一致：过期/缺失 receipt 不得被 server 重新准入为成功。对最终组合重跑相关 public consumer 和 loader case，记录 artifact hash、命令和进程 exit；不只看 PASS 文本。

当前均 PLANNED / NOT_RUN。实施入口应补在迁入 H 的 loader/materializer package tests 与 public consumer fixture；现有 C 路径仅为来源，不虚构已存在的新 suite。

## 依赖前置

rec-02 的 public bundle/materializer contract。可在 rec-03 之后执行以避免相交文件并行；不需要先切换任何产品。两者全部通过才打开 Halfcode 自消费门。

## 对应三面与层级

数据/控制面 × platform；Data 的 authority→captured artifact→cache 有向关系、Effect 的 IO 与 release、Processor 的准入边界。不推导出现行 source backwrite 或运行事实双 owner。

## 落地建议（由同一 Mission Lite 承接）

优先给两条 mutation case 建可复现 barrier，再选 captured stage 或等价稳定访问机制，合同以证据为准。范围限 T06/T08/T12 接缝；超出可保证 profile 必须显式停用且保留诊断。回退为前一 artifact/lock，不恢复或覆盖真实作者文件；不能以回退消除已记录的一致性风险。
