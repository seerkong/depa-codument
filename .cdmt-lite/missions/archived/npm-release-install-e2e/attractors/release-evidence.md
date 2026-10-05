# 制品身份与实证吸引子

本文件定义质量关系，不是任务清单。方程是本体，本文是载体，安装与测试只是投影。

## 方程

```text
public dependency identity = package name + version + registry integrity
tested candidate = built frozen source + resolved public dependencies
installed runtime bytes = tested candidate bytes
acceptance = original requirements + independent observations
cost = all observed attempts, including failures
```

## 硬不变量与排除集

- I1 来源可证：✅ 公共 tarball 与 lock integrity 对应；❌ 名称版本正确但实际链接邻仓源码或 localhost 制品。
- I2 制品同一：✅ 安装和正式测试指向同一候选；❌ 装旧包却测新源码，或中途热改候选。
- I3 验收独立：✅ AI 从原始需求观察交付；❌ 控制者手改生成应用、将特定业务操作写入 harness、编造 PASS。
- I4 失败成本守恒：✅ 首次和纠偏分开，基础设施失败单列；❌ 丢弃失败、更换 run 根来重置同一试次预算。
- I5 权限与隔离：✅ 只升级目标产品，全局旧产品和真实业务资产不变；❌ 为验证便利升级旧 codument 或迁移原仓。
- I6 运行收口：✅ 原空间安全完成、凭证与 owned 服务退出；❌ 替换失控空间、购买配额或遗留认证。

## 真源与度量

用户目标与 MISSION 决定范围；源文件和 registry 决定制品身份；原始运行日志决定本次观察。报告不得反写原始结果。测试绿色不替代上述身份与负向检查。
