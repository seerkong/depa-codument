# Loop: npm 公共依赖安装与真实 E2E

Status: completed
Round: 2

期望态：[MISSION.md](MISSION.md)。证据：[evidence.md](evidence.md)。恢复加载 cdmt-mission-lite。

## Work graph

### 公共来源与冻结候选
- Status: done
- After: none
- Covers: 期望-1, 约束-2
- Verify: registry/lock/realpath 审计，隔离 frozen install + bun run check + build + smoke
- Done when: 当前公开依赖和可执行候选有证据。
- Evidence: E4；prepared.json，check.log 733 pass，所有准备阶段 exit 0。

### 定向全局安装
- Status: done
- After: 公共来源与冻结候选
- Covers: 期望-2, 约束-1
- Verify: 全局 bin/app 哈希及旧产品保护指纹
- Done when: 新 bin 与 App 一致，旧对象不变，有备份。
- Evidence: E5；global-install.json passed，全局 hash 与候选一致，138 文件和正本一致，保护指纹不变。

### 五例真实 E2E
- Status: done
- After: 定向全局安装
- Covers: 期望-3, 约束-2, 约束-3
- Verify: probe/ui-probe + 串行五例 + report + 身份/清理审计
- Done when: 五例终态和成本记录齐全，或客观外部阻塞记录清楚。
- Evidence: E8–E14；五个真实终态，3 passed/1 business failed/1 protocol-cost，首次2/5；结果和成本完整。

### 独立重观察与收口
- Status: done
- After: 五例真实 E2E
- Covers: 期望-1, 期望-2, 期望-3, 约束-1, 约束-2, 约束-3
- Verify: 从目标与原始记录重读所有验收，check_mission completion/archived
- Done when: 结果真实且无未完成授权动作。
- Evidence: E13–E14；从目标与排除集重读后实际运行 observe.ts、global builder 导入和预检资源审计；模型/身份/保护/清理全部过线，未将失败样本改为PASS。

## 尚未看清
- 无；Ecommerce 的表示协议缺口已定位，后续改造属本轮范围外，不阻止本次真实测量结束。

## Actual state
- 21 个公共包确认 npmjs 0.2.1，当前全局产品0.6.0和完整App已安装，旧codument与原workspace不变。
- 五例终态：Todo passed/2、Stream passed/1、Blog failed/3、Ecommerce infrastructure-failed/1、Nested passed/1。总134.32分钟，正式模型输入34,382,909（缓存32,034,304）、输出363,072。
- 44模型上下文均Terra/medium，43有usage会话。原始报告及安装收据见 result.md。
- 所有正式/预检owned端点和临时认证收口；唯一Space6已finish一次并resolve，不可重启它。

## Last action
- 独立审计 exit0；全局builder实际导入成功；原始失败不变；最终报告 result.md 已写入。

## Next
- completion 闸门已通过，整体归档交付。无活跃运行，不恢复37137/73154，不重跑已结束用例。后续harness表示修复或产品提示词优化需另行明确范围，不修改当前历史结果。

## Decisions and replans
- 保持原有 E2E 模型运行器，不引入另一套代理协议；本轮仅一个五例批次。
- E3 → 全局采用新 stage 安装 npm 依赖后替换精确 runtime 目录，旧目录保留为备份；自有未发布 depa-codument-skill-app-contract 留在安装目录内，公共包全部 npmjs。
