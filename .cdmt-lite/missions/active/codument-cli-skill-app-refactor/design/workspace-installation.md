# 内部 Workspace 安装边界

Round31，固定 codument/，不注册或合并暂停的 init/status/upgrade-workspace。产品公开程序入口为 depa-codument-product-capsule/workspace-install；这不是替代 CLI 安装入口。

## Data / Effect / Processor / composition

- 模板文件是分发内容真源；静态 text import 索引只连接编译闭包。部署后 workspace 业务/config/attractor 是作者 authority，初始化不能刷新既有 App。
- domain-contract 声明定义、Agent 选项、prepared transaction 与结果；domain-logic 拥有选择策略、受管块合并与 prepare→inspect→commit/abort 流程，不读文件、不获取 cwd。
- domain-support 实现该文件安装 port：目录/文件安全、协作锁、隐藏 staging、source guards、发布和恢复。文本合并与 Agent 选择由组合根注入，而非 support 反向 import logic。
- product-capsule 选择产品模板、manifest、内置 Kind/reader 与 App inspector。普通资源/领域命令不 import 安装资产入口，不为查询加载全部模板或启动 Serve。
- 这里没有 mailbox/异步共享 owner 需求；文件协作排他是同步操作的 effect 生命周期，不增加 Actor 平台。

## 生命周期

workspace 根必须是现存真实目录，内部 installer 不负责最终 init 的路径创建/UI。准备阶段先检查薄 Skill 冲突、AGENTS/CLAUDE 标记、目标选择，再构建隐藏候选；正式业务目录不存在时，只在隐藏候选上跑完整 App 检查。所有待发布字节、原始 instruction 备份与 recovery.json 在一次事务目录中。新 App 与 Skill/受管块分别发布；并不声称多文件 OS 原子事务。

commit 复查目标源 identity/content/mode、候选文件/完整目录 closure 和配置；App 用己方空目录 reservation + 同文件系统 rename，新增薄 Skill 用 no-clobber hard link；既有 instruction 文件以保留未受管正文的候选 replacement 发布。失败回滚仅己方 exact inode/bytes/mode，不能覆盖独立编辑；App 若新增/删除/修改文件或目录则保留完整恢复位置，不递归删除他人材料。rename/unlink 成功后抛错需再观察结果，不把返回异常直接等同操作未发生。

这些是协作锁 + 操作前后 guards，不是针对任意恶意外部编辑器的 OS compare-and-swap。崩溃留下的锁不自动抢占；恢复材料不参与正式 Catalog，需先核验源/身份再处理。对现有 App 的再次安装验证其当前源，保留完整业务树；改变 App ID 或保存的 Agent 目标要求 migration，不静默接受不同期望态。

## Agent 与用户内容

保留六 Agent：claude / codeflicker / eidolon / opencode / sparrow / codex；默认 Claude，选 Claude 同时保留/安装 CLAUDE.md 指针，其它均有 AGENTS.md。所有 Skill 薄壳路由到同一 codument/std，不能复制业务 App。config/cli-tools.json 保存 tools；可保存 workspace-local 自定义 skills_directory。既有配置的扩展、顺序与原文保持，未知/冲突进入 review。

内部 API 不跨 workspace 安装到绝对外部目录；最终 CLI 旧 --skills-dir 的授权/多 root effect 组合仍属于三命令后置合同，未被删除或宣称验证完成。不删除旧 Skill 目录来隐式清理用户内容；deprecated route 清理须在 migration 中有来源与恢复证明。

## 度量

workspace-app --scope core：真实 installer API、新建/重入、默认/多目标/保存配置、源码与 staging 漂移、链接/未知 Kind/冲突、恢复/独立编辑、模板 closure、非空递归 knowledge 与 code-first LocalFunction 调用，以及隔离编译二进制。该 scope 显式将最终 CLI、tarball consumer 和 full mission 标 UNVERIFIED。
