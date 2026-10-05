# 公共包重命名与 npm 发行验收

## 结果

21 个共享包以 `0.2.1` 发布到 npmjs，`latest` 均为该版本。五个新名：

- halfcode-lite-cli-contract
- halfcode-lite-cli-logic
- halfcode-lite-cli-support
- halfcode-lite-cli-capsule
- halfcode-lite-cli-shell

原 Halfcode 产品专属 shell 改名为 `halfcode-lite-product-cli-shell`，本轮不发布产品包。源码目录保留 `packages/cli-host-*`，npm 身份与导入已迁移，当前源码旧包名引用为零。

depa-codument 21个公共依赖固定0.2.1；262个外部锁条目全部使用公开npmjs URL/官方完整性摘要。实际依赖解析位于本项目node_modules，不借用Halfcode源码。

## 独立证据

| 验收 | 结果 |
|---|---|
| npm公开元数据与tarball下载SRI | 21/21与测试候选一致，见npm-release-0.2.1.json |
| 独立npm安装/21入口/真实clone/Bun安装/生成产品tsc/Resource与SOP/未知命令 | 全部符合预期，见public-consumer-receipt.json |
| 干净Git临时depa副本公开源frozen install/typecheck/lint/test | 733 pass、0 fail、7785断言 |
| 临时depa构建及binary smoke | 143内嵌资源；0.6.0；init-workspace/Resource validate/status/discuss help/非法命令退出码通过 |
| Halfcode最终最宽回归 | 575 pass、0 fail、5518断言；typecheck/lint通过 |
| 唯一身份/闭合依赖/旧名与localhost负向扫描 | check-identities.mjs通过；发布白名单DAG审计通过 |
| 原件保护/既有工作 | 8路径指纹保持；两仓diff-check通过；未重置用户改动 |

原始日志和改名前逐文件备份：`/private/tmp/halfcode-cli-public-release-NRFNf0`。
最终公开消费者根：`/private/var/folders/qh/nm2y7v2s0jn7skv5_yphcbj40000gn/T/halfcode-npm-consumers-q0SCrk`。

## 失败保留与边界

- H一次重负载并发物化测试超时；定向复测与之后两轮单独完整回归通过，未放宽测试或改业务代码。
- 独立验收首次误判type-only合同空exports；第二次遗漏临时Git源；只修harness，第三次完整通过。已发布字节未修改/覆盖。
- npm部分包异步处理约5分钟；上传受理与公开可用分开记录，没有重复上传。
- 未发布产品launcher/native/vendor，未执行全局安装、Git提交、模型E2E或跨OS原生验证。
- 使用cdmt-mission-lite控制循环、depa-expert身份/职责边界和simplify新代码审阅；没有新增通用业务抽象。
