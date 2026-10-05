# Mission: Halfcode CLI 公共包改名与 npm 发布

终点: 五个 halfcode-lite-cli-host-* 公共包改名为 halfcode-lite-cli-*，完整共享包集合从 npmjs 可安装，depa-codument 使用新名称和公开 registry 制品。

期望态权威在本文件；循环见 [loop.md](loop.md)，证据见 [evidence.md](evidence.md)。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 结构与发行 | [attractors/package-identity.md](attractors/package-identity.md) | 包身份、依赖与不可变发布制品一致 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 每轮 skill: cdmt-mission-lite、depa-expert；新代码完成后 simplify。
- 用户已授权两个仓库的包名重构与 npmjs 发布；不授权全局安装、其他产品发布或提交。
- 候选名称 halfcode-cli-public-release / rename-cli-host-packages / publish-halfcode-libraries；选择第一个。
- 三组投影：源头库存是 21 个 shared 包和 Halfcode 产品壳；改造对象是五个包身份及全部当前引用、共享包正式版本、产品壳冲突；最终暴露是 21 个共享包，新五名与原其余十六名，不发布产品壳/launcher/platform/vendor。
- 产品包 halfcode-lite-cli-shell 与新公共名冲突，移至 halfcode-lite-product-cli-shell；保留其产品职责，不合并两层。
- 正式版本 0.2.1；发布前已核对版本未占用、权限和依赖，发布后独立核对下载字节。
- 只进行确定性回归与隔离安装，不跑模型 E2E。

## 期望结果

- 期望-1: 两仓当前源码、manifests、测试、clone 和发行入口一致使用五个新包名，产品壳身份唯一。
- 期望-2: 21 个正式共享制品仅含预期公共材料，包间依赖指向新名正式版本；按依赖顺序发布并核验 registry integrity。
- 期望-3: depa-codument 使用公开 registry 锁文件，隔离安装、类型检查、实际 CLI smoke 和两仓回归通过。

## 约束

- 约束-1: 遵循 AT1，不改变能力职责、资源协议身份或用户命令；历史证据不批量改写。
- 约束-2: 不修改全局 bin/skill、旧 codument workspace、第三方包或用户 npm 凭据；不发布 vendor、product 或测试材料。
- 约束-3: 不覆盖已发布 name@version；发布前验证候选，发布后以公开源独立验收；保留既有未提交工作。

## Acceptance

- [x] 期望-1、约束-1 → 当前代码旧名扫描、包名唯一性与依赖图审计（只读）→ 旧名零残留/无环、五个新公共身份和独立产品壳。E12/E14。
- [x] 期望-2、约束-2、约束-3、AT1 → tarball 白名单/依赖/integrity 审计 + npm view（只读），逐包 npm publish（已授权外部写入）→ 恰好 21 shared，新正式版本不可变。E4/E9，npm-release-0.2.1.json。
- [x] 期望-3 → 两仓 bun run typecheck、bun run lint、bun run test（本地测试写临时资产）→ exit 0；隔离 npm/Bun install 与 CLI smoke → 无源码链接/localhost 依赖。E13/E14，public-consumer-receipt.json。
- [x] 约束-2 → 全局 bin/skill 与原 codument/ 前后指纹核对（只读）→ 一致；发布清单无产品/vendor/secret。E4/E13/E14。
- [x] 约束-3 → git diff --check（只读）、既有工作保留审阅 → 通过。E14。

## 范围外

- Halfcode/depa-codument 产品二进制发布与全局安装、模型 E2E、其他消费仓库迁移、旧 npm 包删除或弃用。
