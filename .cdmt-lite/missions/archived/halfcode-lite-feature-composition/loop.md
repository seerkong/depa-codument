# Loop: Halfcode Lite 公共能力与 CLI 产品组合

Status: completed
Round: 12

期望态：[MISSION.md](MISSION.md)。证据：[evidence.md](evidence.md)。恢复时完整加载 Notes 指定 skills。

## Work graph

### 修正公共 live 客户端副本

- Status: done
- After: none
- Covers: 期望-2, 约束-1, 约束-5
- Verify: 公共调用单测、两产品类型检查、重复实现扫描。
- Done when: G1 通用 live HTTP/结果规则只有一个公共实现；产品保留政策绑定。
- Outcome: E54 公共端口/协议单测及两产品调用链；demo/status 和产品环境策略保留产品侧。

### 修正类型链与 clone 骨架

- Status: done
- After: 修正公共 live 客户端副本
- Covers: 期望-3, 约束-5
- Verify: 实际产品/profile 和 clone 生成物类型负例、隔离 scaffold Resource/SOP 调用。
- Done when: G2 不再用 optional runtime/非空断言证明静态组合完整性。
- Outcome: E55/E59/E61，实际 profile/producer 与已安装 clone 负例通过。

### 收敛 Kind 选择和默认安装资产

- Status: done
- After: none
- Covers: 期望-3, 期望-5, 约束-4
- Verify: Kind 子集负例、demo 无 KindDefinitions 安装、旧合同夹具及产品回归。
- Done when: G3 与 C1 闭合；标准 Kind 由 Host 提供，保留显式测试夹具。
- Outcome: E56/E59/E60，未选 Page admission 拒绝、真实安装无标准 Kind 副本。

### 补齐 npm 产品安装链

- Status: done
- After: none
- Covers: 期望-1, 期望-4, 约束-3
- Verify: 本地隔离 launcher/platform tarball 安装与实际命令，无全局写入。
- Done when: G4 的两产品 launcher 和平台选择可实际消费。
- Outcome: E58/E60，正常 binary 构建、Bun/npm 本地安装链、版本与失败退出通过。

### 修正后独立联合验收

- Status: done
- After: 修正类型链与 clone 骨架, 收敛 Kind 选择和默认安装资产, 补齐 npm 产品安装链
- Covers: 期望-1, 期望-2, 期望-3, 期望-4, 期望-5, 约束-1, 约束-2, 约束-3, 约束-4, 约束-5, 约束-6, 约束-7
- Verify: 两仓完整 test/typecheck、边界扫描、新不可变制品与三消费者、全局保护摘要。
- Done when: gap-1 反例均被证伪，全部原验收重新过线，独立重观察无残留。
- Outcome: E59–E62，574/733 全量通过，三消费者、native npm 安装、保护摘要及 gap-2 复核完成。

### 当前快照与架构调查

- Status: done
- After: none
- Covers: 约束-2, 约束-3, 约束-6
- Verify: `git log -1 --format='%h %an <%ae> %s'` 与本 mission 的源码证据审查（只读）。
- Outcome: 已提交 aab479c；完成三仓库实际源码、历史方案与当前 Halfcode/depa 公开边界调查。
- Done when: 快照 author 正确，方案区分代码事实、历史经验与目标建议。

### 冻结迁移基线和身份清单

- Status: done
- After: 当前快照与架构调查
- Covers: 期望-1, 约束-2, 约束-3, 约束-4
- Verify: 各嵌套仓库 status、tracked/untracked/ignored inventory、身份/协议/制品版本矩阵（只读）。
- Done when: 用户确认方案及目录布局；上游既有未提交改动有可恢复快照，不擅自提交；移动目标确认不存在。

### 路径与首批可消费身份迁移

- Status: done
- After: 冻结迁移基线和身份清单
- Covers: 期望-1, 约束-2
- Verify: E15 完整移动清单零差异；E17 真实 identity-release 安装和两个产品类型检查通过。
- Done when: 内容完整迁移，首批新名公共包可真实安装，两边源码类型基线通过。

### 完成身份与资产闭包迁移

- Status: done
- After: 路径与首批可消费身份迁移
- Covers: 期望-1, 约束-2, 约束-4, 约束-7
- Scope: 两种旧前缀 halfcode-cli-lite-* / halfcode-app-lite-* 同时迁移；公开包/API/依赖按 design/npm-package-architecture.md，保留单列兼容别名与历史证据。
- Verify: 移动前后文件摘要/仓库状态比对，rename 扫描，真实 package/lock 制品安装测试（写临时输出）。
- Done when: 活跃引用采用 halfcode-lite-*，所有原内容保留，历史与协议保留有明确记录；消费者切换到真实新制品。
- Outcome: E45–E49；当前 @halfcode-lite authority、21 shared .9、两边 canonical imports/lock 与制品一致；旧身份分类保留，原完整备份重新摘要一致。

### 提取公共命令与能力闭包

- Status: done
- After: 路径与首批可消费身份迁移
- Covers: 期望-2, 期望-3, 约束-1, 约束-5
- Verify: 全链类型正负例、owner 生命周期与 local placement 测试、包依赖检查。
- Done when: Resource/SOP/CommandOperation 首批公共命令同源；其余已有 browser/page/serve 等能力按真实边界提取，不增加平行机制。
- Outcome: E18–E24 的实现与 E35 的全链类型负例、冲突/生命周期/资产测试通过；产品差异保留显式 bindings，不重复公共实现。

### 组装 Halfcode 与 Codument 产品

- Status: done
- After: 提取公共命令与能力闭包
- Covers: 期望-2, 期望-3, 期望-5, 约束-1, 约束-5
- Verify: 两个产品命令基线、冲突/缺失效应负例、source/embedded/安装资产一致性测试。
- Done when: 通用命令无需复制，depa 的 domain/operations/migration 留在自身，组合表面与协议和资产闭包一致。
- Outcome: E46–E48；两个产品从真实 tarball 构建并实际调用；565/732 全量回归通过，产品命令选择归自己的 capsule。

### 独立消费与隔离兼容验收

- Status: done
- After: 组装 Halfcode 与 Codument 产品, 完成身份与资产闭包迁移
- Covers: 期望-4, 期望-5, 约束-3, 约束-6
- Verify: 临时最小消费者真实 tarball 安装、构建与调用；临时 Codument 历史 workspace 迁移；外部 bin/skill 摘要比对。
- Done when: 无兄弟源码依赖、无未选择能力依赖、历史迁移无回归，所有排除集得到负向验证；未发布或全局切换。
- Outcome: E46–E50；三消费者、全量回归、类型负例、875 import 边界与全部 AT1 排除集完成独立重观察，详见 verification/acceptance.md。

## 尚未看清

- 无待裁决项。D10 的当前 authority 修正已落地；未来 npm 发布、全局切换和其他 App 迁移属于范围外。

## Actual state

- 当前 E59–E62 替代历史完成性声明；C1/G1–G4 已修复并独立重观察通过，详见 reports/gap-2.md。
- 21 shared 当前本地候选 0.2.1-composition.12，depa 从真实 tarball 安装；当前 authority @halfcode-lite，ABI/协议和 legacy fixture 不联动。
- 两仓完整测试 H574/D733 均零失败，tsc/lint/diff check、889 imports 边界、31/15 workspace lock metadata 通过。
- 三消费者 source/embedded、真实 clone 缺端口与 Kind 子集负例、历史 upgrade/backup/noop 通过；两产品 Bun/npm launcher→平台包→binary 安装链通过。原生执行只声明 macOS arm64。
- 原备份 55,476 项摘要与两仓 HEAD 保持；全局旧/new bin 和 skills 未修改。不发布、不全局安装、不跑模型 E2E。

## Last action

- normal native 安装验收发现并修复 Halfcode 版本硬编码；重新生成不可变 .12，而非覆盖失败候选或放宽断言。
- 完整重跑所有原验收与新增反例；冻结业务源码后重读目标、源码和 Agent 产品面，gap-2 无阻止本轮验收的残留。
- 所有测试、registry 与 native 打包进程已收集完成；completion 与 archived 闸门均通过，目录已整体归档，不留后台 registry。

## Next

- completion 已通过，进入 archived；本 mission 无待实施节点。
- npm 发布、全局切换、其他 App 迁移和其他 OS 原生验收不在本次执行授权内。

## Decisions and replans

- D12: native 安装的真实失败推翻 .11 版本一致性；Halfcode 改为根 manifest 权威 + source 打包冻结，不改变产品号或协议。保留失败候选，最终 .12。通用静态组合入口与显式 legacy admission 分离；不以兼容借用接口宣称静态能力完备。

- D11: 用户“如果存在gap, 则进行修正”授权执行 reports/gap-1.md 的纠正。C1 采用保守方案：标准 Kind 归 Host，已批准 demo 定义保留显式夹具而非每个 workspace 默认副本。G4 实现本地安装链，不作 npm 发布。

- D1: 沿用现有 host 与 XNL 编译协议，不移植 ACE 的具体 FS-native 协议或新建一套 skeleton。
- D2: 将 Halfcode 完整产品与 depa 视为公共能力的两个组合；不强制 depa 包含全部可选能力，也不未经批准移除当前功能。
- D3: 身份迁移与能力提取分开验证/提交，避免把上游 0.2.0 的行为变化误归因于改名。
- D4: 目标包边界与 API/依赖真源为 design/npm-package-architecture.md，package-disposition.md 仅保留迁移处置索引；旧前缀不能作为新的 canonical 依赖。
- D5: E15/E17 支持首批身份闸门完成；将剩余身份/资产闭包单列节点，避免用 active 前置节点暗示 ready。完整组装仍依赖两个分支完成。
- D6: public package 新增 API 后使用不可变本地 prerelease 0.2.1-composition.N，产品版本与 contract semantic version 不联动。候选仅本地制品，不发布；每轮改包后新建 release-set。打包从实际 manifests 显式解析 workspace 依赖，不能信任旧 Bun lock 的 workspace version 投影。
- D7: E35 已证明 capability extraction 的窄合同；产品组合迁移可独立于上游 demo 协议指纹决策推进。将最终身份闭包依赖移到独立验收节点，不擅自更改旧 demo 协议。
- D8: 已完成不依赖协议裁决的当前收敛动作；剩余身份/资产一致性与最终集成验收被 E33 冲突阻断。按 cdmt-mission-lite §7「卡住」返回：需要协议 authority 选择，不能通过放宽 admission、自动重编号合同或改测试指纹绕过。目录留 active/，Status=blocked；收到明确裁决后再恢复。
- D9: 用户“同意你的建议进行修改”批准显式更新内置 demo 至当前 APP reader；恢复 active。范围仅现有 14 个 Kind 定义，不改其他 workspace、旧 CLI fixture/hash、schema revision 或全局安装。
- D10: 用户进一步裁决当前协议 authority 为 @halfcode-lite，而非 @halfcode-app-lite。这项明确授权替代 D9 的目标 identity，不迁移外部 App/全局安装，不把 scope 标识误作 npm scope；旧 readerId 独立管理，不随本次合同 owner 修正机械替换。
