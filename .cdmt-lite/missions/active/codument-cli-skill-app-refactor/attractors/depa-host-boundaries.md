# 可复用 Host 与 DEPA 边界吸引子

本文件定义可复用 CLI Host 的稳定结构。局部代码可以变化，依赖、事实归属和副作用关系持续满足下列不变量。

本体是方程及排除集；本文件是载体；包、代码和测试是当前投影。

## 0. 使用边界

本文件管技术结构；领域语义由 AT2 约束，验证与上下文成本由 AT3 约束。
包数量不代表符合度。每个新增包应拥有可命名的真实公共职责。
架构文档不拥有 workspace 业务事实。

## 1. 方程

```text
product = host(public contracts, injected capabilities) + domain registrations
output = processor(runtime, input, config)
effect implementation → effect contract ← processor
derived = project(authority, version); derived cannot replace authority
consumer imports public packages; generic host has no product knowledge
one reusable implementation → one upstream source owner → versioned artifacts → independent products
```

## 2. 基本原语

| 原语 | 含义 | 不属于它 |
|---|---|---|
| contract | 结构、语义、port 和稳定签名 | bootstrap 和具体 IO |
| runtime | 显式依赖、实例状态引用、effect 能力 | 业务方法容器 |
| processor | 接收显式依赖的处理函数 | 全局 service locator |
| support | 某 port 的具体实现 | 未定义职责的 utils 集合 |
| capsule | 真实能力闭包的构造与生命周期入口 | 空 re-export |
| shell | CLI/stdio 等最终交互适配 | 正式领域 owner |
| registration | 调用方注入的能力与声明 | 底层硬编码产品分支 |

## 3. 硬不变量

### I1 · 产品只通过公开扩展接入

✅ Codument 传入 root、Kinds、commands、templates；第二应用传入自己的等价声明。
❌ 通用包出现 `if (app === "codument")`、直接 import domain 或默认指向本项目源码。

### I2 · 依赖可替换

✅ logic 只经注入 port 读写；相同 runtime/input/config 产生可解释结果。
❌ logic 自取 `process.cwd()`、修改进程 cwd、构造具体浏览器或文件 client。

### I3 · 数据与执行分列

✅ identity/source/spec 为数据；执行 reader/provider 为 bindings；runtime 只承载能力。
❌ 静态 config 藏 callable、多处重复维护同一依赖、runtime 方法直接包含业务规则。

### I4 · 包身份表达职责

✅ 新能力包以 contract/logic/support/adapter/capsule/shell 收尾，公开 exports 与 observed role 一致。
❌ 只改 package.json 掩盖 mixed role，或把每个函数拆六包。
历史 npm 产品名、现存平台发行身份与 vendor-facing plugin 名是须逐项声明的窄兼容例外，不能扩大为新公共能力包的命名例外；不因命名协议额外制造无关的产品迁移。

### I5 · 一个事实只有一个裁决边界

✅ catalog/cache 从 authored resources 单向构建；更新经正式 owner 的 transition。
❌ 编译输出、ContextView 或旧 registry 成为并行写入来源。

### I6 · 实例与生命周期显式

✅ 两个 Host 各有 root/registry/session，启动和释放资源可追踪。
❌ 查询 Track 隐式启动浏览器、跨 workspace 共用可变全局。

### I7 · Actor 由已有需求支撑

✅ 现有异步 PageWorkflow/浏览器会话用明确 owner、投递、取消及释放协议。
❌ 为每次本地 CLI 同步操作引入 mailbox，或用隐式注入隐藏依赖环。

### I8 · 跨仓复用不制造双源码真源

✅ 通用实现归 Halfcode，所有产品经公开版本化契约消费；消费方 adapter 拥有真实的产品边界转换，资源身份独立于包名。
❌ 两仓长期各维护一份同义通用实现；通过源码绝对路径、永久 vendor 拷贝或全量重命名维持兼容；把修改包名当作修改资源身份的授权。

## 4. 排除集

跨包私有路径依赖；通用包包含产品特例；依赖旧 src 才能运行；假 contract/空 capsule；第二套 dispatch 或 compiler；未声明生命周期的共享状态。

## 5. Authority 关系

owner → transition → authored resource → catalog/read model；read model 可请求 transition，不能绕过它覆盖来源。这里使用开放 DataTopology，不建立固定七级阶梯。

## 6. 误读

无 scope 不妨碍公共包复用。公共包归 Halfcode 并使用 halfcode-cli-lite-*；Codument 包只持有其领域或真实产品封装职责，不能用换前缀掩盖职责泄漏。没有事件日志不自动构成 Data GAP。公共源码唯一 owner 不要求两个产品共用同一个 workspace/runtime 实例。

## 7. 与验收关系

本文件定义结构；独立 consumer、exports 检查、mock-port 单测和 lifecycle 用例测量投影。命令与阈值统一放在 MISSION Acceptance 和 verification。
