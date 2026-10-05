# 包身份与发行吸引子

本文件定义结构关系，不是操作清单。文件是载体，源码和制品是投影。

## 方程

```text
public identity = unique(package name, role)
release identity = immutable(name, version, integrity)
consumer resolution -> verified published release -> compiled source
product shell != reusable shell
```

## 不变量与排除集

- I1 身份唯一：✅ 每个共享职责只有一个当前包名；❌ 产品壳与共享壳同名或把产品语义塞回公共壳。
- I2 依赖闭合：✅ 所有发布依赖可从公开源解析；❌ workspace/file/localhost/旧名依赖流入正式共享制品。
- I3 来源明确：✅ 从源码编译的字节验收后原样发布并核对 integrity；❌ 同版本覆盖或只验证工作区软链接。
- I4 范围收敛：✅ 发布白名单仅自有共享包；❌ 本地 registry 内 vendor、产品、测试或凭据被一起上传。
- I5 历史不可变：✅ 历史制品与证据保留，当前引用单向迁移；❌ 改写旧验收证据伪装新名已验收。

## 边界

包 manifest 是当前身份与依赖的源码权威；registry 元数据与 digest 是发行观察证据，不反写业务协议。MISSION 声明目标，loop 管工作图，测试只测量是否收敛。
