# 三消费者与库级发行配方（B03）

## 同一制品

最新公共/上游产品集合：`host-release-round-15-recipes/release-set.json`，digest `6e5bc29f3de89b1cb88b128f3c5debbd7534b15bd2641a138c3a87c2ebe0f8e4`（14 public + 6 H product + 160 vendor）。C 产品集合：`round-15-codument-engine-release-artifacts/release-set.json`，digest `719031d5733b13005c71534c55416957072680b9915fbc2b923bc699130f1752`（11 product）。旧 set 未覆盖；14 public 的 name/version/SRI 与旧7cadb628…完全相同。新set包含新的产品engine metadata以及重新包装的vendor payload，不能称整个180项set未变化。

| 消费方 | 当前 Bun 1.3.14 | 最低 Bun 1.3.0 | 实际能力 |
|---|---|---|---|
| Halfcode | logs/round-15-halfcode-engine-release.log | logs/round-15-engine-release-minimum-halfcode.log | 旧精确code-first身份/完整lock；真实CLI/模板/资源/LF/Page/Vue/MCP/Serve close |
| Codument | logs/round-15-codument-engine-release.log | logs/round-15-engine-release-minimum-codument.log | 99领域回归/独立类型检查、旧C语义与26reader组合、真实CLI/可选能力/close |
| Notes | logs/round-15-notes-engine-release.log | logs/round-15-engine-release-minimum-notes.log | CLI-only五包、14public exports、custom Kind负例、resource/code-first、mutation、local/live、browser/HTTP/Vue/MCP/owned close |

这些安装均不使用 overrides，不读两仓业务源码，安装后关闭临时registry才运行。测试代码可以由验证工具复制，产品运行 import 仅来自隔离安装制品。vendor 为本地已安装生产payload再包装，不表示原npm发布者认证。没有npm发布、真实browser/messages或全局安装。

## 产品验收入口与配方

- C `verify:mission consumer` 已移除旧generic源码pack/覆盖依赖；通过显式 `CODUMENT_VERIFY_RELEASE_SET` 使用本地封闭制品源。原模板/备份、Codex peer、detached service、SQLite、Page/Site/WebSocket、code-first lock、browser compiled assets、Vue/MCP验收保留。`logs/round-15-consumer-public-admission.log` exit0；domain-core及cli scoped另有独立日志。
- registry是测试基础设施，不是业务Serve；H工具与C自包含验证器都核对index digest、SHA256 filename、SHA512 payload、manifest identity和生产依赖范围，拒绝覆盖基础包/追加shared/重复artifact/未知包与source aliases。两仓各有负例测试，生产包不导入此测试server。
- 两产品native recipe用实际native bridge源、生产metadata投影和版本化公共builder。六原生包名/平台/bin保持；JSON依赖比较改结构相等，builder文件闭包由真实源核对，不漏worker-port/build-diagnostic。
- `logs/round-15-native-recipe-install-recovery.log` exit0：两个实际嵌套bridge，普通传递安装同一set，关闭registry后分别启动真实公共Vue worker构建并关闭。这是recipe fixture，没有替代或声称最终Codument binary验收。
- 根回归：H529pass/typecheck/lint（round-15-recipe-recovery-check.log）；C448pass/typecheck/lint（round-15-current-gates-check.log）。当前C consumer/architecture其余收口复验见evidence。

## 保留的边界

只证明库级制品与配方。最终Codument双bin、0.6产品版本、旧命令全集、三个冻结命令及真实dogfood切换仍未验收。native运行只测本机darwin-arm64的Notes编译资产与nested worker；其它平台不可据此宣称native smoke通过。发布权属/真实registry发布需独立授权。source唯一owner仍为H，C保留领域与真实产品绑定。
