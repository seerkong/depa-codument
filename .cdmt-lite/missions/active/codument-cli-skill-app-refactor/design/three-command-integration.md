# 三个暂停命令：核心验收后的待确认方案

本文件前轮为待讨论方案；现由用户“global聚合后接入三命令”授权推进。下述历史差异保留作为基线，当前实施顺序与边界见本节。

## global 聚合后的实施合同（Round39）

- init-workspace创建正式codument/资产App，不再默认安装demo或workspace指导Skill；保留原agent/skills-dir配置及安全幂等，不用force覆盖未知业务。init延续Host的global→workspace组合，但global只写新的depa-codument Skill；独立init-workspace不写home。CLI调用测试一律隔离home。
- status用领域只读source投影恢复Track/Task统计、当前phase/task与下一Task；不从Host安装状态推断项目业务状态。未初始化exit1，未知/旧authority明确报需迁移；JSON新增明确产品投影，不伪称原0.5已有JSON。
- upgrade-workspace由现有完整App迁移器拥有资源备份/验证/发表；全局标准由独立upgrade-global管理，不把升级他人全局目录隐含进workspace命令。未知std/旧Skill修改不覆盖。根指令与旧薄Skill整理若与App发布不在同一提交范围，必须显式分阶段receipt，可恢复重跑，不能把局部成功说成完整升级。
- 升级参数保留agent/skills-dir解释；改变已有选择需精确确认差异，不默默重置。无备份跳过/任意强制覆盖不开放。真实历史缺业务依据时review并保留原件，不编造缺失内容。
- 此实施只动project与隔离fixtures；不切根发行、不改真实dogfood或旧全局session。后续完整兼容门必须真实调用新入口，不把内部API tests当入口已实现。

## 当前差异（以源码为准）

| 命令 | 旧 Codument | project/ 克隆入口目前仍做什么 | 已有可复用产品底层 |
|---|---|---|---|
| init | 当前项目创建 codument/；默认 Claude，支持六 Agent、--agent/--skills-dir/--force；保留非覆盖内容，刷新指令块/cli-tools/gitignore；help 写有 [path]，旧 handler 本身没有消费位置参数 | init-global 后 init-workspace；无旧参数，写全局及克隆 Host 的 .codument/ 模板和 demo Skills | product-capsule/workspace-install：真实 codument SkillApp、87个分发资产、内置Kinds、六Agent、自定义工作区内目标、重复零写、验证/恢复；尚无强制刷新/变更目标路径组合 |
| status | 只读展示项目/Track/任务总数、进度、当前phase/task、下一任务；未初始化退出1；旧实现没有稳定JSON合同 | Host 初始化/agent/demo Skill 摘要；未初始化也code0，JSON是Host安装状态 | domain list/show/ready已有只读投影，workspace inspector可读完整App及诊断；尚未组装旧status输出 |
| upgrade-workspace | 备份、受管std/Skill/根指令、原Agent选择、旧生命周期目录/资源迁移、用户配置保留、raw JSON receipt；资源review退出2 | 只备份及刷新Host模板/默认Agent，既无Codument历史迁移也无原receipt形状 | product-capsule/workspace-migration：全App观测→完整备份→隔离转换/全量验证→可恢复发表/冲突review；暂只发表codument/，不刷新根指令和Agent目标 |

源码入口：旧 src/cli/commands/{init,status,upgrade-workspace}.ts；新 project/packages/cli/src/cli/commands/ 同名文件；产品 API 在 project/packages/product-capsule/src/workspace-{install,migration,app}.ts。

`.codument/` 可继续用于Host私有状态/缓存/恢复，但不是正式App。当前克隆初始化入口尚未改造，不应对用户真实项目执行它来替代产品init。

## 推荐组合（需用户确认后实施）

### 1. init 以 Codument workspace 为主

- `codument init [path] --agent ... --skills-dir ...` 绑定产品installer，默认当前目录、正式App固定codument/；统一显式root解析，不 process.chdir。
- 默认不连带全局安装、Serve或浏览器。Host全局安装保留独立显式入口；最终对init-workspace/upgrade等现有组合入口一并清理，避免还有另一条暗中创建旧demo workspace的通路。
- 默认保留旧Claude及六Agent选择、存储配置、用户非受管指令；将root指令/Skills/cli-tools/gitignore与App纳入同一可恢复发布计划。
- `--force` 建议限定为“刷新产品受管模板/壳”，不覆盖业务资源、自定义attractors和未知文件；已改动受管文件先备份并给冲突，不直接抹掉。这个边界比旧help更窄，须显式确认并在升级说明写清，不能伪称逐字兼容。
- [path] 以帮助合同落实为真实目标路径；与全局workspace选择冲突时明确拒绝，不默默忽略。

### 2. status 以旧产品进度为主

- 默认文本继续展示Track/任务/当前进度；从领域投影派生，不维护第二份状态。
- Host安装与资源健康作为附加区，不用它代替产品进度。只读、无需Serve；未知/损坏资源不能伪称空项目。
- 增加明确版本的JSON投影，保留原Host状态字段并新增product区；这是克隆Host JSON的兼容扩展，不宣称旧0.5已有该JSON。
- 未初始化沿旧产品exit1；完整结果、App review与错误退出码在实现前固化fixture。

### 3. upgrade-workspace 以确定性迁移事务为主

- 保留--agent/--skills-dir/--json、raw历史receipt关键字段、review exit2。缺旧workspace返回1，不靠新manifest/std才能启动。
- 先观测全部来源和Agent目标，备份原codument及将修改的Skills/指令/config，形成完整candidate；内置Kinds替代旧App Kind副本；原业务/配置/attractors/历史扩展保真。
- 同事务刷新受管标准、迁移资源、刷新所选Agent和根指令；不同目录无法OS原子交换，采用日志化可恢复提交，失败恢复只限本次拥有的写入，独立编辑保留。
- 不对未知修改套force覆盖；进入review时保留完整原件及诊断，迁移Skill从包内协议启动语义兜底，再重扫/验证。语义review期间不假报整个workspace已升级。
- 两次执行必须幂等；0.5.2/0.5.4/当前dogfood副本、单资源旧格式、损坏/未知扩展、目标冲突、中途IO、来源漂移、CLI退出2和Agent选择一并通过。0.5.3本地tag缺失如实标覆盖限制。

## 不能隐藏的已知差距

三个真实历史副本目前都安全停在review，不是自动升级成功。包括旧归档缺design、完成标记与未勾选criterion矛盾、旧MaterialBundle，以及当前App全局资源ID下旧Track/Behavior同名冲突。完整输入和backup已验证保留。

全局ID冲突不能靠补造历史内容或盲目改#id修绿。后续需单独比较：保留物理业务ID的Kind限定发现身份/引用适配，或经用户明确决策的稳定ID迁移。前者涉及公共Host扩展时仍由Halfcode持有实现；不在Codument复制一套compiler。未解决前不退役旧src、不把真实dogfood切到新版本。

## 确认后执行顺序

1. 固化三命令及其组合入口的参数、读写范围、JSON、退出码兼容fixture。
2. 实现统一工作区安装/升级协调器及多目标备份/恢复，封装现有产品底层，不把领域迁回Host或HTTP。
3. 接入三命令，更新分发Skill bootstrap与帮助；在隔离目录执行新建、复入、迁移、review修复和恢复演练。
4. 对上述历史身份/语义差距逐项闭环，才做最终workspace-app/migration/capabilities全量门禁。
5. 统一根发行入口与版本，新版本仅提供depa-codument bin（2026-09-07用户更正，不再双bin），完成本地打包安装验证，再受控升级真实dogfood；源码退役须先证明无依赖并保留恢复材料。
6. 最终独立DEPA/行为审查、最宽回归及all验收，全部通过才归档mission。npm发布、全局安装和真实外部系统操作仍另需授权。
