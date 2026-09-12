# Clone：范围、来源与产品变换分列

B05 实施合同；期望态与工作图仍分别在 MISSION.md / loop.md。

- 默认 `scaffold` 生成一个消费公共包的新产品，不复制生产者的实现或工作区。
- `source-only` 明示生产者 allowlist，保留选中文件的当前字节及原始 bun.lock。它不是完整备份。
- `full` 采用 Git eligible working-tree inventory：tracked（包括 tracked ignored）和未忽略 untracked；读取当前文件，不 checkout HEAD。保留删除事实、文件模式、二进制、符号链接本身；不递归跟随链接。只排除 Git metadata，不根据 docs/mission/dist 等名称偷减范围。
- 两种 snapshot 都要求 Git inventory（允许源是 Git 根的子目录）；非 Git 源明确失败，不退化成不等价的 FS 扫描。尚不展开 submodule，遇到 Gitlink 明确失败，不静默漏内容。
- E173发现本项目全局规则忽略未tracked的bun.lock。为满足“原锁保留”硬合同，原bun.lock/bun.lockb是唯一附加输入，未在Git inventory时明确记录additionalSource=original-lock；不扩大为所有ignored文件，symlink锁只保留链接并单独标symlink-only。
- Snapshot receipt 是投影，逐文件含 hash/mode/type 与 Git HEAD、included/excluded/deleted。写入额外的无冲突 receipt 文件；绝不覆盖源中同名文件。先固定字节，提交前重新读取来源，漂移则删除临时 stage 并拒绝提交。这是有界一致性检查，不声称 OS 原子快照或防御恶意并发文件系统。
- 目标只能是不存在或显式 force 的空目录；先写同父 stage，再 rename；拒绝 source 内目标、符号链接目标、非空目标。失败不污染目标或源。
- Rebrand 是显式、单独记录的产品变换，不能通过全文替换改变公共包、semantic owner、FQN 或 global key。原 lock 必须原字节保留，变换涉及依赖时明确 re-resolve-required；不会偷偷安装或修改源仓库。
- 自动变换范围明确收窄为 `--rebrand-metadata`：root manifest name/description + producer 显式绑定 identity module 的四常量，分别存原字节和 before/after receipt。输出 `required-before-build` / `review-required`，不冒充全产品重命名可直接发行。新可运行产品用默认scaffold；任意公共语义/模板/FQN替换不属于此自动变换。

DEPA 边界：T01 持有 snapshot/receipt/effect 合同；T02 持有范围选择与基于注入 port 的控制流；T03 实现 Git/FS 观测和 staged commit。两生产者只绑定 allowlist、产品 scaffold/identity 数据。此新增公共 API 需要新的不可变 release set 和消费回归，旧 B03 证据不能覆盖新内容；不另建公共包或第二套通用克隆实现。

验证按切片推进：先完整/源码快照的正负例，再默认消费脚手架、显式产品变换和两生产者实际入口；仅隔离 fixture，不重新覆盖当前 project/。
