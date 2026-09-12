# Round43：完整全局 SkillApp 验证

## 验证基线

代码在原仓 project/ 修改，执行在 `/private/tmp/depa-codument-verification-sg3oN5/depa-codument/project`。
来源快照 digest：`5c0dee2481a9aa048fb5f417a74a40388b515ca61b6e8fd2f5681430cffc92da`。
最终仅追加同源测试修正：global-guidance.test.ts 的 description 检查不再强制等于完整英文 CLI summary，而检查每个旧名称带非空简介；源/副本 SHA256 均为 afe9757bf384ab0cbd39f9d35086721538e8c98fee78bf673eea26c3bc2157af。业务资产和代码未再变，最宽回归重跑到 full-test-final.log。
复制报告：`logs/round-43-global-app-cli-gates.json`；每次验证的独立 home 与源文件清单见该临时根的 snapshot.json。

## 已验证的当前实现

- 完整 App owner：`project/packages/product-capsule/src/templates/agents/global/skills/depa-codument/`，59 个文件。源 ResourceEffect 与 BunFS 固定根同源；公共 CommandOperation 编译负责资源准入和 help/dispatch。
- `SKILL.md` 保留全部旧名称及简介，但当前命令从 CLI 获取；详细映射仅在 `references/std/compat/operation-alias.md`。迁移、验证撞名分别用 migrate-operation、validate-operation，不覆盖原生命令。
- 无根 std/、std/commands、std/operations、std/skill、kernel-pointer。规范迁至 references/std/；命令补充并入操作/方法，升级说明归 references/migration/；分形指南归 methods/。
- global-guidance 不再从旧 workspace 文档生成/替换正文。workspace-assets 内旧 std/skill 仍是历史指纹/冻结成本基线，不是发行全局指导真源。
- source/embedded 两条读路径，缺失/损坏 manifest 拒绝、合法修改资源元数据反映到命令、无关 App 不参与加载，Markdown 相对链接闭包测试通过。
- 全局安装先校验完整 App，跨所选 agent 备份后整目录替换；失败恢复，旧内容仅留备份，邻近旧 skill 不改。隔离 actual init、upgrade-global、upgrade 均接受 `--agent=claude,codex,eidolon`，全部 exit0。
- 三个安装目录逐文件名和 Buffer 比较：每个59文件、字节一致、无根 std/。新项目 codument/ 保持项目资源 App，无本地 std/。
- 实际二进制定向：4 tests / 359 assertions / exit0，涵盖全部15指导操作及单全局 App 安装。完整回归另记，不用这组替代。
- migration --scope core：41 tests / 752 assertions，并通过同一生产资源打包器构建的 standalone consumer 的 guide、旧XML迁移、原文备份、幂等、不复制KindDefinitions；exit0。
- 独立前向审查以旧 impl-track、validate、migrate 请求跟随文档及 CLI：发现两处“找不到 codument”的旧bin判断，已修为 depa-codument。fresh实跑、Hook恢复、GapLoop/AttractorCheck分离、迁移备份与review均保留。技能结构检查通过。
- lint exit0。成本门46 tests / 763 assertions / exit0：入口UTF-8字节代理中位减少26.57%，包含完整SKILL和旧名映射阅读。quick增加45.50%、mission增加17.44%、migration增加152.10%；不声称所有场景下降或真实token费用下降。

## 反例与修复

1. Bun 的 new File([embeddedFile], name) 保留旧name，导致manifest缺失；独立native实验后改slice Blob的显式name视图，字节不改。使用node:buffer类型避免环境Blob声明缺slice。
2. 旧分形配置URI缺映射；补两类旧路径到新methods位置。
3. std lint测试仍期待旧来源URI；按实际新authority更新断言。
4. 首轮alias和SKILL冗余使成本门不足25%；压缩重复描述与映射表，不削减检查协议。description仍保留15个旧名和简介，并满足1024字符限制。
5. 实际多agent命令补测发现schema漏agent；补init-global/upgrade-global/upgrade的正式option，组合upgrade仅向global传agent。
6. 迁移standalone fixture未嵌入新App；改用生产build机制的显式entrypoint，而非另写文档生成旁路。

## 未过线与安全边界

- 本地真实dogfood副本upgrade仍review-required，0提交；不可声称已成功清理全部历史项目。未知定制std不擅自删除；仅升级成功态保证无std，原件可在备份追溯。
- typecheck仍4处合同brand不兼容：应用使用0.1.1，public support/automation等解析2.0.0。公共package-protocol又要求合同精确版本2.0.0。
- 只覆盖lock/安装0.1.1不是安全恢复：公共源码还比较package major与protocolVersion（0与2不相等）。Halfcode源码合同仍2.0.0；另一session新增0.1.1 tarball不代表完整兼容发布闭包。
- 保持0.1.1需要在上游明确包版本与协议版本分离的兼容合同，并发布新的本地制品闭包；不能原地替换已存在0.1.0包字节、类型强转绕过、直接降级protocol或回滚用户0.1.1修改。
- 另外serve/profile两个错误文案预期漂移必须在完整验收中核实；不把所有失败归咎于本轮布局，也不掩盖真实失败。
- 未发布npm、未覆盖全局新bin/skill，旧bin SHA256仍05206bf05959d0b10420a6cc5b5e6d2d67a5ba5cadee5f46ec1c178d69ddc3f8；新bin仍7b5abdf078cd211e3e56630e978be016814fc51ea08e6ee4f1453e89e2503d90。
- 原codument指纹b631c71946ecff6cba752ee096bcec1b24b195d24b9d16fddf2deb1eab3bd11f；没有真实workspace升级，根src用户修改保留。

本报告不是第二份工作图；状态与待决输入以loop.md为准。
