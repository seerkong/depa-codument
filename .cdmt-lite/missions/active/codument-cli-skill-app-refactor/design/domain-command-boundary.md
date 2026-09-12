# 领域命令接入边界

依照 AT1/AT2，不把旧CLI文件整包搬成万能support；按可验证的操作拆入现有四domain包和三个产品边界包。

- 生命周期：domain owner是唯一transition入口；support持有FS/CAS/进程，logic持有纯变换与语义判断。已接Track/Mission transition/task transition/gap-round、Track ready/verify/complete、Mission bind-track。mission archive仍须补旧linked-track检查和promotion，不能用现有archiveState冒充。
- Query：输入是显式目标声明，support观测源集合，logic生成投影，owner管理本次调用的admission/close。registry query不需要验证进程、Attractor profiles、Serve或Page；读取目标含文件/目录/命名Track或Mission，正常链只接新envelope，旧内容交migration边界。无默默跳过冲突/无效source。
- 输出：公共Host继续负责schema/dispatch/帮助。产品adapter持有业务JSON（含数组）与兼容文本，产品shell输出原始值，不用generic envelope改变旧脚本合同；stdout结果与stderr verifier诊断分列。不得引入另一套parser/dispatcher。
- 控制论：本文件是局部设计，不拥有执行状态。按loop图推进，失败归evidence，源码变化使相应旧pack证据仅剩历史适用范围。冻结三命令与最终发行gate不变。

## 创建与校验

创建的closure必须包含Kind必需文件，完整发布后才进入正式目录；已有目录或文件不是可覆盖的空位。BehaviorPatch创建允许保留目录里已有的notes等非authority文件，但不替换delta.xnl/xml。骨架的空TaskSpace/Mutations仍须后续编写，不能生成虚构DONE任务去获得绿色验收。

全量validate沿原范围观测pending/active Track、pending/active/archived Mission、Behavior与进程内Decision；canonical Decision forest和analysis工作forest独立校验，不合并成同一事实源。结构admission、领域semantic、companion/patch存在性、strict严重度各司其职；不得因为新scaffold尚未填写而降低校验。旧格式进入migration诊断，不恢复normal reader的XML旁路。

旧`validate --json`实际输出为文本诊断后追加findings数组，并非纯JSON文档（src/cli/commands/validate.ts:596起）。在本兼容阶段保留这条特例的输出排列，公共domain.validate API提供结构化结果；不可仅为formatter统一而静默改掉旧stdout协议。未来可讨论显式纯JSON选项，不能混淆本次兼容证据。
