# 本批 CommandOperation 交付

## 入口映射

| 原 Skill | 新顶层命令 |
|---|---|
| codument-discuss | depa-codument discuss |
| codument-plan-track | depa-codument plan-track |
| codument-maintain-track | depa-codument maintain-track |
| codument-impl-track | depa-codument impl-track |
| codument-archive-track | depa-codument archive-track |
| codument-plan-mission | depa-codument plan-mission |
| codument-impl-mission | depa-codument impl-mission |
| codument-archive-mission | depa-codument archive-mission |
| codument-impl-quick | depa-codument impl-quick |
| codument-docs-bootstrap | depa-codument docs-bootstrap |
| codument-artifact-sync | depa-codument artifact-sync |
| codument-migrate | depa-codument migrate-operation |
| codument-validate | depa-codument validate-operation |
| codument-verify | depa-codument verify |
| codument-gap-loop | depa-codument gap-loop |

仅migrate、validate与既有原生命令碰撞。原生命令保留；新-operation入口只交付当前Agent应执行的指导，不声称业务已完成，不启动隐藏Agent或Serve。其余13项去除旧codument-前缀。

## 所有权与安装

- Halfcode公共contract拥有内置Kind，logic持有纯投影，support提供真正compiler/read-port准入；产品显式选择15项，workspace资源发现不获覆盖顶层命令的权限。
- 全局depa-codument SkillApp拥有operations/正文、std/标准和references/闭包。SKILL.md的description保留全部旧名称及功能摘要。项目codument/仍是独立资产SkillApp，无KindDefinitions/std/多指导Skill副本。
- init=全局指导安装+项目初始化；init-workspace无全局写入；status是领域读投影；upgrade-workspace先App事务再辅助指导事务。未知/修改std或薄Skill保留并review，已知退役文件在App备份或guidanceBackupRoot中可恢复。
- --force不再覆盖未知workspace authority；stored agent选择变化须review。旧workspace升级的全局指导更新另走upgrade-global；两阶段不是跨目录OS原子事务。

## 已观察证据与限制

E274–E276记录源码、负例和独立前向检查。固定H制品digest为15ff6913c526f4f61f6b4ddaa60eca1656c3e72e57a8f4e7f756794d45ad4824；C十一产品包digest为4a0777c53daf778f527f1c9fe02a97df5bf48910fb3bff97d08e902679451871，实际普通registry安装后关闭registry再执行，未使用跨仓source alias。

round-39-command-operation-replay.log包含263tests/2556assertions、安装19→0、typecheck、全部15操作、三命令、旧完整contract lock精确兼容，以及LF/Page/Vue/MCP/Serve关闭和领域CLI回归。native最终测试包含真实编译二进制、隔离global安装/旧Skill哨兵、15操作和三命令；workspace与migration门覆盖未知原件保护及故障恢复。

本批不等于整个长期mission最终发行收口：project产品版本仍是候选骨架0.1.0（领域包0.6.0），尚未切根发行入口、退役旧src、升级真实dogfood或发布npm。过去历史副本的未决语义保持review，未宣称无损自动解决。旧本机codument哈希仍为05206bf05959d0b10420a6cc5b5e6d2d67a5ba5cadee5f46ec1c178d69ddc3f8。
