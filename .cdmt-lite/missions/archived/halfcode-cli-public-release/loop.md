# Loop: Halfcode CLI 公共包改名与 npm 发布

Status: completed
Round: 7

## Work graph

### 包身份与引用迁移
- Status: done
- After: none
- Covers: 期望-1, 约束-1, 约束-3
- Verify: 包唯一性/旧引用扫描、两仓类型检查
- Done when: 五个新包名、产品壳冲突消解且当前引用闭合。

### 制品构建与发布前验收
- Status: done
- After: 包身份与引用迁移
- Covers: 期望-2, 约束-2, 约束-3
- Verify: 两仓完整回归、打包白名单与独立候选安装、registry 权限/版本检查
- Done when: 可发布的 21 包闭合集合与无泄密候选通过验证。

### 发布与公开源消费
- Status: done
- After: 制品构建与发布前验收
- Covers: 期望-2, 期望-3, 约束-2, 约束-3
- Verify: npm publish、npm view integrity、公开源干净安装/CLI smoke、两仓回归和保护审计
- Done when: 公开依赖可用，depa 使用公开源，全部验收过线。

## 尚未看清
- 无；剩余为明确的公开源消费者验收。

## Actual state
- 两仓之前的未提交改动保留；21 shared 当前为正式0.2.1且npmjs全部可下载，五个新名与产品壳身份唯一。
- .npmrc保持原样；npmjs.com接受21次提交，公开tarball SRI已核验，无重复上传。
- depa锁262个外部条目全部指向npmjs，精确版本图不变；原仓重新公开安装及typecheck/lint通过。
- 独立npm安装、21入口加载、实际clone的类型/Resource/SOP/unknown负例通过；第三轮临时depa完整733测试/类型/lint/build/bin smoke通过。首两轮探针缺陷与失败记录保留，未修改发布制品。
- H最终独立完整575测试/类型/lint通过，两仓diff-check/身份审计/8路径保护审计通过。

## Last action
- 按用户目标/MISSION/AT1独立重观察并跑完最终验收；completion结构闸门通过，归档本mission。持久收据在verification，原始日志在/private/tmp/halfcode-cli-public-release-NRFNf0。

## Next
- 无剩余实现节点；公共包发布与消费目标已完成。未发布产品二进制、未安装全局、未提交Git、未跑模型E2E。

## Decisions and replans
- 以新独立 mission 承接已归档架构任务的后继发行目标，不重写历史验收。
- 保留现有源码目录，改变 npm identity；产品壳改为 halfcode-lite-product-cli-shell。
- npm PUT202仅表示受理；异步公开观察与上传账本分离，避免重复发布或假完成。
