# Round40：隔离 dogfood 的历史语义边界

## 验证位置与保护

代码仍在原仓库修改。最终本轮副本：`/private/tmp/depa-codument-verification-KiiTC7/depa-codument`，隔离 HOME 为同级 `home/`；源清单及完整升级 receipt 在同级 `snapshot.json`。原 `.git` 不复制，副本创建独立空仓用于 clone 测试，不带原 hooks/remotes。原锁文件和依赖内容独立复制；拒绝外部软链接和共享文件 inode。

完整 `codument/`（含空目录、被忽略附件与 Finder 元数据）复制后先核对指纹，再运行副本源码 CLI。源码 inventory 不含 MissionLite 控制面；清单摘要只证明这次副本内容，不能冒充原仓 Git commit 或最终发行包。

## 已修复的确定性问题

- review-required 未提交时，不再把计划升级/删除数量报成已执行；计划量单列。
- 三份历史标准文件与已提交模板完全一致，精确 hash 纳入已知托管资产。用户改过的未知标准仍保留 review。
- `codument/std/**/.DS_Store` 仅允许备份后的退休；不允许创建隐藏文件、删除其它隐藏文件或穿越隐藏父目录。原二进制附件按原字节备份。
- 新版 global 成本测量包含聚合 `SKILL.md`、对应 operation 和迁移兜底材料，不继续使用旧多 Skill 入口作为当前测量对象。

## 不能由确定性转换器补写的事实

副本实际 upgrade-workspace 返回 exit 2、review-required，业务资源未提交。初始完整诊断有593条，包含编译失败产生的 membership 级联，不能说是593个独立问题。

| 源头观测 | 能安全做的事 | 不能冒充确定性迁移的事 |
|---|---|---|
| 两份2026-01归档 Track 没有 design.md | 保留现存 proposal、Track 与缺失事实 | 编造当年设计文档并称原件恢复 |
| 多份 completed Track 的 Gate Criterion 没有 checked 字段 | 保留历史完成声明与未记录的字段；区分缺失与显式 false | 批量补 checked=true 当成已有验收证据 |
| nested-mission-lifecycle/projection 的 Behavior 与 Track 同 stable ID | 列出双方来源与全部引用，规划显式身份转换 | 静默覆盖或仅按最后发现者入库 |
| 历史 MaterialBundle domain=doc/codument | 保留原值与路径，按有证据的规则另提转换 | 因非法枚举直接丢弃端口 |
| modeling://domain/todo/user_store 无目标 | 保留引用，定位真实目标或标未决 | 删除关系使验证变绿 |
| delegation 的两个 durable decision 无 Reversibility，归档副本亦然 | 保留原答复、confidence、evidence 和未记录事实 | 替用户补写当时的可逆性判断 |

已经尝试两条不同的安全路径：严格字节匹配解决旧std识别；保持现行完整App校验并检查原始归档来源。前者解决机械误拦，后者仍揭示缺失的历史事实。现有 `currentRoot` 仅转换 envelope，不改业务语义；现行 lifecycle validator 对 completed 中缺失 checked 同样报错。不能用关闭校验绕过。

## 需要明确的产品政策

建议区分“历史声明完成”和“本次按新规范验证通过”：对只能证明旧声明、无法补证的历史记录，保留原文与来源，显式标记未重新验收，不能被新工作流当成当前验收通过；当前/新建资源继续严格验证。

这可能需要版本化的历史兼容表示与对应 reader，而不是给所有 archived 文件豁免。当前未实现、未默认启用；需要确认该语义边界后再设计。另一条路径是每份旧记录补齐独立验收证据后迁入当前严格表示，无法补证的继续 review。

## 未完成，不由本轮测试代替

历史副本升级尚未成功提交；完整旧 receipt 兼容（结构化 review/cleanup/kept 等）、无 scope gates、最终版本与根发行入口、最终制品重打和独立验收仍未收口。没有升级原 codument/、退役旧 src、安装全局命令或发布 npm。
