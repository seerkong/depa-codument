# Clone 三模式验收（Round 16）

固定公共候选：`host-release-round-16-clone-lock/release-set.json`，digest `3e28f0c8207d19076ba2c26c48034e02202c1d8c68ce8aec6359bfee1675524c`。候选未发布 npm；不覆盖先前失败候选。

| 合同 | 证据 |
|---|---|
| full：Git 当前 tracked、eligible untracked、dirty bytes、删除项、链接、原锁 | 两生产者根测试及已安装 T02/T03 snapshot probe；ignored 原锁以 additionalSource 单列，其它 ignored 不采集 |
| source-only：显式子集、原锁、排除理由 | 相同 snapshot probe 与 producer clone tests，非 Git 拒绝、nested Git 实测 |
| 默认 scaffold：仅公共版本依赖、产品两包、无重复 Kind | H/C 各两代正常 registry 安装；关 registry 后 about/resources、strict TS、Skill quick_validate、owned close |
| rebrand 独立且保留语义身份 | 显式 metadata-only，原字节备份、独立 receipt、锁与公共包/FQN 不变；不是全产品重命名，required-before-build/review-required |
| 目标及并发安全 | 源内/别名/非空/符号链接目标拒绝；输入变化拒绝；stage 清理及空目录恢复 |
| 既有产品能力 | 同 set H/C/Notes 真正安装运行、99 domain tests、Page/Vue/MCP/LF 与 close；Bun 1.3.14 和 1.3.0 |

最终根回归 H 541/5060、C 448/3699；C architecture domain-core 213/1240。C 664 个原 src/codument 文件相对冻结基线零变化。

边界：源码快照保留原锁，不宣称换名后可直接构建；完整 XNL/native 跨平台发行尚未运行。三个产品命令合并、真实 workspace 升级、最终旧 src 退役仍未获后置授权。本节点完成不表示整个 mission 完成。
