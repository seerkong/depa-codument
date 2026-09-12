# Execution handoff and earlier feedback

Round47，基于E310及用户实施授权。范围为Codument领域与真实E2E，不向公共Halfcode包塞入Track特例。

1. Track XNL仍为生命周期authority；`track context <id>`从现有repository精确load，返回身份、目录、来源revision、ready任务、完整合同AST及必读伴随文件位置。它是只读观察，不是批准、hook verdict或可跨调用复用的验证receipt。ready复用现有纯函数，不另写调度器。配置/外部引用不内联冒充完整闭包，明确要求按operation继续读取。`list`保持active-only兼容。
2. E2E规划验证通过后产生parent-owned identity receipt；实现prompt显式传递所有repo/Track/Mission身份和路径，重新观察而非按默认list猜测。预算内恢复读取当前同identity authority；重复ID或缺失必须报错，禁止自动生成替代Track。交接记录不是状态写入owner。
3. 无ID的impl-track先做明确pending/active候选发现，唯一且已批准才继续；零候选不自动新建，多个不能猜。精确ID用context和transition的真实目录，不拼生命周期目录。
4. 每个实现任务在DONE前检查该任务可观察行为：UI必须事件交互、网络必须实际边界、流必须逐事件时序、业务必须负例及状态变化。命令成功并不证明criteria匹配；AI仍负责语义映射和fresh检查。不给公共CLI硬编码五个case，也不取消final oracle。
5. nested的modeling/engineering要求与普通case相同，acceptance明确descriptor JSON字段，避免计划/执行与runner协议不一致。

Negative checks: pending不出现在旧list仍可context；重复authority拒绝；archived上下文只读且不当ready工作；source变更新观察反映；handoff身份丢失/碰撞拒绝；投影不自动批准或写DONE；hooks/GapLoop/Attractor/fresh不减配。sourceRevision为repository实例CAS token，不是稳定跨调用hash，不据此缓存语义结果。

## Follow-up: explicit attractor references

qUXNoE实测暴露：模型先读profile配置，但直到末端AttractorCheck才读coding profile指向的DEPA正文，导致已实现代码架构返工。下一切片把当前配置source作为显式输入交给纯context投影，列出Track实际引用的profile、enabled状态和正文URI。未引用profile不装载，disabled不激活；配置缺失明确unknown，不把空数组当无约束。依旧不缓存正文或fresh verdict，不改已有hook生效时机，只将设计/实现必须遵循的依据提前暴露。运行中的旧候选/harness保持冻结。
