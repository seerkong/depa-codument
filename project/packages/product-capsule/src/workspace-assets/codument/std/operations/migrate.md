# skill: codument-migrate（自主迁移）

运行 `codument migrate guide resource`，读取当前发行自带的控制循环协议。该入口不依赖 workspace manifest、config 或 std 已经升级。

有一个路径参数时处理该资源；无参数时按协议进入 workspace 模式，遵守当前产品入口可用性和人工 gate，不调用另一套同名 Host 初始化/升级命令。

Decision review 按 `codument migrate guide decision`；早期 plan.xml 按 `codument migrate guide track`。本 operation 不另存一套迁移步骤、Kind 定义或语义 verdict。
