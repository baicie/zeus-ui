# Zeus AI Headless V2（从零重新设计）

这份资料**不沿用旧 Chat / AgentConsole 的总体结构**。新的设计从用户任务出发，以 Conversation、Execution、Artifact、Approval、ChangeSet 作为平级领域对象；通过事件协议与 Headless Controller，支持 ChatGPT 风格会话、Codex 风格任务工作台，以及可嵌入其它产品的 AI UI。

## 文件

- `01-ARCHITECTURE.md`：架构 RFC（领域模型、TS API、事件、状态机、包分层、安全与跨框架）。
- `02-INTERACTION-SPEC.md`：交互规范、文本线框、键盘、Streaming、Diff、审批、组件契约。
- `03-IMPLEMENTATION-BACKLOG.md`：分里程碑任务清单、依赖关系、优先级、验收门禁。

## V1 → V2 的核心变化

1. 不再把 Chat 和 AgentConsole 做为两个 UI 根容器。
2. 不再把 Message / Execution / Tool / Approval 全部塞入一个事件数组。
3. 不再要求 React/Vue 以 Web Component 为唯一渲染底座。**共享 Domain + Controller，不强制共享 DOM。**
4. UI 只发送意图，由可信 Host 校验执行、发出确定事件，支持重放与恢复。
5. 首先完整交付 Chat / Agent / Coding 三个用户故事，再考虑批量扩展组件数量。

## 实现建议

首先完成 M0 + M1（领域与事件），随后 M2 Chat，再到 M3 Agent；M4 Coding Review 按产品需求开发；M5 框架输出与工具测试分阶段落地。

## 注意

所有 API 名称和代码均为提案，**并非现有仓库已经存在**。产品参考包括 ChatGPT 与 Codex 的公开交互范式，方案不依赖它们的私有内部接口。
