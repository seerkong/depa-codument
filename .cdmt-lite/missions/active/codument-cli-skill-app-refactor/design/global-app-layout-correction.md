# 全局 SkillApp 布局与加载纠偏（2026-09-11）

本文件记录本轮讨论的证据、被否定方案与实施解释，不是第二套期望态或工作图。期望态以 ../MISSION.md 的期望-9、约束-17…20 为准；状态与后续行动以 ../loop.md 为准。最初为讨论记录；2026-09-11 用户授权按本合同实施，当前进度见 loop.md。

## 发现的偏差

1. **完整 App 被实现为拼装出来的指导文档。** `project/packages/product-capsule/src/global-guidance.ts` 从 `workspace-assets/codument/std/` 抽取正文，以字符串替换改路径，生成 SKILL、manifest 和 CommandOperation frontmatter；`createCodumentGuidanceOperations()` 又构造内存文件系统加载。这不能替代用户要求的“位于 Halfcode 原有可直接加载到 VFS 的资产位置的完整 skill 文件夹”。不能仅把生成目录改名为 global-guidance-assets 就宣称对齐。
2. **全局 App 的资源加载被与静态能力表混淆。** 助手先建议在 SKILL.md 手工维护 operation 清单并测试两份列表一致，用户明确否定。全局 App 仍是 CLI SkillApp：动态能力通过 depa-codument 命令获取；与 Halfcode 动态发现的差异是 Effect 从固定位置加载，而不是另建专用注册表/解析器/执行链。
3. **历史别名与当前能力混淆。** 旧 skill → 新 operation 的完整映射放在用户指定的 `references/std/compat/operation-alias.md`（用户最终修正：references/std/compat，而非 compact）；SKILL.md 指导遇到旧名称时按需加载该文件，再通过 CLI 获取当前操作。不能把别名文档当成资源注册 authority，也不能要求 AI 为正常新命令先遍历别名表。早先 description 含旧名称及简介的发现要求不被擅自删除，但详细映射和新位置由此文件承载，不在 description/body 再复制完整映射。
4. **全局目录仍有旧版残余。** 已安装 std/operations/ 只有生成索引和 _operation-spec.md，正式 15 个操作已在根 operations/；std/commands/ 有三个旧命令说明；std/skill/ 两个目录实际是分形知识编写指南；kernel-pointer.md 依赖不存在于独立 skill 内的 dynamic-workflow 相对目录。compat/README.md 仍把旧 std/actions 映到 std/operations，并描述刷新 workspace std 的旧升级模式。
5. **覆盖写不等于整包替换。** `project/packages/cli/src/cli/install.ts:installGlobalSkills` 逐个写当前资产，没有清除退役文件。助手提出逐文件保留修改的升级方案，用户否定：新全局 depa-codument 是发行包，应替换所选 agent 安装目录中的完整同名 skill，而不是与旧文件合并。
6. **workspace 清理不彻底。** 旧实现/验收允许未知 std 留在活动项目并 review；新用户要求升级成功后的 codument/ 仅有项目级资产，codument/std/ 必须删除，同时清理其他非项目级分发数据。备份保真不等于旧运行目录必须继续存在。不能以一个新 manifest 加旧分发目录冒充干净 SkillApp。
7. **引用是代码与数据合同，不仅是 Markdown。** `workspace-install.ts`、`workspace-migration.ts`、product index 的标准来源、测试及配置仍使用 std/ 或 skill://depa-codument/std/。只移动文档将造成失效引用；新建、升级、固定位置加载、CLI 返回的正文和安装资产需一起验证。
8. **源码、临时构建与全局安装状态未清楚区分。** 0.6.0 版本修复曾覆盖全局，但后续英文 help / init agent 示例 / 删除 demo 只在临时二进制验证，用户因此在全局 -h 看不到变化。用户现已明确授权后续覆盖新 bin 和 global skill；本轮仍只要求完整记录，不能借历史授权提前执行布局改造或安装。

## 修正后的整体合同

- 完整 global depa-codument 文件夹必须一一对应 Halfcode 原有直接加载 VFS 的资产文件夹机制。具体物理源码路径需在恢复实施时检查 Halfcode 现行 Effect 后确定，不凭目录名猜测。
- 同一份 App 资产供 VFS/CLI 加载与各 agent 安装使用。安装只复制文件，不生成/拼接/重写业务文档；构建允许无语义变化的字节打包。
- 全局加载 Effect 选择明确固定位置，复用公共 manifest/资源解析、校验和 CommandOperation 顶层 help/dispatch 机制；不通过全局/项目扫描碰运气发现此 App，不用并行硬编码操作表覆盖资源。
- 固定位置不意味着写死某一用户绝对路径。多 agent/home 与打包资产的固定根选择应由显式 Effect 配置决定；安装目的地与运行加载根的对应关系须验证。不能未经讨论假定只从 ~/.agents/skills 或只从 binary 内存生成视图加载。
- SKILL.md 保持入口、边界、动态 CLI 查询方式和按需别名路由；命令元数据由 App 资源拥有。references/std/compat/operation-alias.md 保留全部旧入口及新命令/正文位置，包括 validate → validate-operation、migrate → migrate-operation 两个撞名处理；原生 validate/migrate 不被覆盖。
- 全局升级备份后整包替换，不合并旧定制；失败可恢复。修改过的旧内容保存在备份而不自动放回新 skill。其它 skill 和旧 codument bin 不属于替换目标。
- 项目升级完成条件包含 codument/std/ 不存在、非项目级发行数据已退役、项目资产保留或按受控转换迁移、有效引用闭合。旧 std 定制先备份并分类；确需继续生效的项目规则迁入项目级位置，无法裁决则 review，不虚报干净升级成功。未知业务资产不能以“没列在 manifest”直接删除。
- 确定性 migration、语义兜底、历史完成声明、GapLoop/Hook/AttractorCheck/fresh 验证保持；布局精简不是削减这些机制。

## 目录建议与内容处置

以下细化沿用前轮建议，实施前需结合引用与实际 CLI 行为核实；用户明确的根布局、compat 映射、复制/替换/清理规则不可退回旧方案。

```text
depa-codument/
  SKILL.md
  manifest.xnl
  references/std/compat/operation-alias.md
  operations/                    # CommandOperation 正文与元数据
  references/
    host/
    migration/
    std/
      AGENTS.md
      attractors/
      compat/README.md
      methods/
      protocols/
      spec/
```

| 原路径 | 处置 |
|---|---|
| std/operations/README.md | 删除重复索引；入口只引导动态查询和按需别名映射 |
| std/operations/_operation-spec.md | 保留编写规范，建议迁至 references/std/protocols/operation-authoring.md；不留 std/operations/ |
| std/commands/archive-track.md | 去重后将必要事务/rollback 与 hook 归属说明并入 operations/archive-track.md |
| std/commands/modeling-engineering.md | 必要校验说明并入分形方法指南，由 docs-bootstrap/validate 引用；没有同名 operation，不硬造一个 |
| std/commands/upgrade-workspace.md | 旧行为已过时；按实际新版命令重写到 references/migration/，由 operations/migrate.md 路由，不复制一套迁移控制循环 |
| std/compat/README.md | 迁至 references/std/compat/README.md 并重写旧路径/协议/升级职责映射；历史 skill 详细别名表引用 operation-alias.md 文件，不重复维护 |
| std/kernel-pointer.md | 退役；如发现必要有效规则，先归入现有规范，禁止保留失效外部依赖 |
| std/skill/docs-modeling-fractal/index.md | 建议迁为 references/std/methods/modeling-fractal.md，修订全部相对链接 |
| std/skill/docs-engineering-fractal/index.md | 建议迁为 references/std/methods/engineering-fractal.md，修订全部相对链接 |
| 其他 std/ | 迁入 references/std/，保持实际规则及按需加载 |

## 链接、升级与验证要求

1. 建立原资产 → 新 App 资产 → 安装路径 → 资源/FQN 的映射，列出所有删除/合并项；保持 resource 元数据和命令暴露意图明确。
2. 校验 Markdown 相对链接、代码块/裸路径、manifest catalog 根、配置 skill:// 引用以及 CLI 指导正文。新输出使用 references/std/；旧有效配置路径必要时在解析或迁移边界显式映射，不通过旧目录副本实现兼容，不擅改历史归档正文。
3. 验证固定根真实加载：提供隔离 App，修改合法 operation 资源后 help/dispatch 随资源改变；缺失/损坏 App 明确失败，不能静默回退硬编码表；按路径位置和暴露策略拒绝无关 App 干扰。
4. 对每种受支持且选定的 agent 验证完整复制、字节/相对路径一致、整包替换后无退役文件、失败恢复；确认非目标 agent 和相邻旧 skill 不变。
5. 在 /tmp 本项目副本及隔离 home 验证历史升级、清理清单、定制规则保真、幂等、review 与中断恢复。正式 codument/ 仍受保护，不用真实项目试升级。
6. 复跑成本与完整验收，旧 E275–E277 的聚合 PASS 不证明本次固定根完整 App/整包替换/干净 workspace 目标达成。
7. 最后按已授权范围覆盖 /Users/kongweixian/.local/bin/depa-codument 与所选 agent 的同名全局 skill，核验实际 -h/动态 operation、安装树和旧 codument 指纹。npm 发布仍未授权。

## 尚待重观察的实现细节

- Halfcode 当前 VFS 资产根与固定加载 Effect 的准确接口；多 agent 安装后运行如何选择固定根，首次 init 前如何读取必要资源。
- 非项目级旧文件的逐路径清理清单；未知定制规则的迁入位置与 review 处理。
- 当前依赖树曾同时解析合同 0.1.1/2.0.0，类型检查失败；先重观察，不覆盖其他 session 改动，也不沿用旧宽测试 PASS。

这些是恢复时要解决的实现/观察项，不是把用户已明确的结构边界重新交回讨论。
