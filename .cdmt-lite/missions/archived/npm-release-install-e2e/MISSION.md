# Mission: npm 公共依赖安装与真实 E2E

终点: 确认当前 depa-codument 消费已发布 npm 公共包，重新构建并安装全局新产品及完整 SkillApp，以五个真实 E2E 记录本次效果。

期望态权威为本文件；状态见 [loop.md](loop.md)，证据见 [evidence.md](evidence.md)。这是一轮发布后验收，不重开已完成的公共包发行，也不替代整体重构 mission。

## Attractors

| ID | 角色 | 路径 | 管什么 | 约束哪些环节 | 优先级 |
|---|---|---|---|---|---|
| AT1 | 质量/身份 | [attractors/release-evidence.md](attractors/release-evidence.md) | 安装与评估绑定同一真实制品，失败不洗白 | 计划 / 决策 / 实现 / 校验 | 1 |

## Notes

- 每轮加载 cdmt-mission-lite；浏览器使用 ego-browser。模型通过已有 E2E runner 启动，不另建代理调度器。
- 命名候选 npm-release-install-e2e / public-dependencies-e2e / published-runtime-validation；选前者以区分已归档发行 mission。
- 用户已授权安装及 E2E；默认五 case 各一个 fresh 正式试次，保留既有最多三 attempt 规则，不擅加重复批次。
- 源头库存：21 个 halfcode-lite 公共包 0.2.1、当前 project 产品代码与完整 global SkillApp。
- 需要改造：仅在发现依赖未消费公开版本时修正；安装新制品，测试在 /tmp 快照运行。
- 最终暴露：现有 depa-codument 二进制、Claude/Codex/Eidolon 全局同名 App；旧 codument 和其他 Skills 不变。

## 期望结果

- 期望-1: manifests、lock 和实际安装包均是 npmjs 发布的 0.2.1，不依赖本地 registry 或兄弟仓链接。
- 期望-2: 新全局 depa-codument 与候选字节一致，三个 agent 的完整 App 与正本一致。
- 期望-3: 五 case 的真实终态、首次/纠偏率、基础设施失败、时间及可观测 tokens 可追溯；产品失败可作为真实结果，不要求人为修成全绿。

## 约束

- 约束-1: 遵循 AT1，旧 codument、原仓 codument/、非目标全局 Skill 不变。
- 约束-2: 构建与验证在 /tmp 副本；gpt-5.6-terra/medium；不购买配额、不修改生成应用，不改需求、policy 或业务判据。
- 约束-3: Ego 单 TaskSpace，无 Chrome/OpenCLI fallback；保留失败，清理临时凭证和测试服务，不重置预算。

## Acceptance

- [x] 期望-1 → 公共 registry 元数据/lock/realpath 只读审计及隔离 frozen install → 21 包固定版本与公开源一致，无本地来源。E2/E4/E13。
- [x] 期望-2、约束-1 → 安装后 sha/treeHash、CLI --version/-h（全局写入已授权）→ 候选与正本一致，受保护对象指纹不变。E5/E6/E13。
- [x] 期望-3、约束-2 → 隔离 bun run check、smoke、probe、ui-probe、五 case runner/report → 回归过线；正式结果与成本记录完整，失败如实分类。E4/E6/E8–E13。
- [x] 约束-3、AT1 排除集 → 只读终态审计 → 原始失败保留、无额外业务重试、模型身份匹配、凭证移除、worker 结束、唯一空间正常收口或明确安全阻塞。E13/E14。

## 范围外

- 不再发布 npm，不重测旧版，不迁移真实 dogfood，不手改 E2E 应用，不新增产物评估系统。
