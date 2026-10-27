# Zeus AI Headless V2 — 开发任务与验收清单

> 基于全新设计，并非旧包重构任务清单。所有新包和 API 均处于 Proposed 阶段。
>
> 优先级：P0 = 阻塞 MVP / 安全；P1 = 首版可用性；P2 = 进阶体验。工作量为相对大小 XS(半天内)、S(1–2 天)、M(3–5 天)、L(1–2 周)，**不是日历交付承诺**。以单人开发可分段合并为前提，代码质量与浏览器回归优先。

## 0. 先定停止条件

- 不追求一次性做完全部 28 个 Primitive：首批验证 14 个，后续按故事迭代。
- 每个任务的 `Definition of Done`：类型检查、单元测试、必要 E2E、文档示例、API 快照、无敏感日志。
- 如果 M1 Domain 层无法做到事件幂等和可重放，则停止上层 UI 开发，先修协议。
- UI 未经服务器授权执行副作用属于 P0 安全问题；禁止发布。
- 新系统与旧 `@zeus-web/chat`、`@zeus-web/agent-console` 逻辑隔离，不因为兼容性妥协领域模型。

## M0. 从产品故事确认抽象

| ID | P | Size | 任务 | 前置 | 验收标准 |
|---|---|---|---|---|---|
| AI2-001 | P0 | S | 明确 Chat / Agent / Coding 三个 Surface 与故事 | — | 三个 E2E 用例有输入、事件、动作、终态定义 |
| AI2-002 | P0 | M | 审查旧 Chat / AgentConsole 的数据与逻辑错误 | — | 每个旧模块标记复用/废弃/迁移；不存在默认沿用 V1 API |
| AI2-003 | P0 | S | ADR：领域模型、Renderer 与 WC 边界 | 001 | 决议：Conversation/Execution 不合并，React/Vue 不被 WC 强制依赖 |
| AI2-004 | P0 | S | 定义安全模型、Host Capability 与威胁清单 | 001 | 至少包含命令、文件、审批、日志、跨租户风险 |
| AI2-005 | P1 | M | 交互 Prototype：Chat 与 Agent + Approval | 001 | 快照演示与键盘流程；不连接真实模型亦可操作 |

## M1. Domain / Protocol / Store（必须先做）

| ID | P | Size | 任务 | 前置 | 验收标准 |
|---|---|---|---|---|---|
| AI2-101 | P0 | M | `@zeus-web/ai-core` 包骨架与纯 Node 环境 | 003 | 无 DOM/React/Vue import；Node 直接 import 成功 |
| AI2-102 | P0 | M | Domain Types：Conversation/Message/Execution/Step/Tool | 101 | ID、版本、可选关联和状态区分明确；TS 类型测试 |
| AI2-103 | P0 | S | Asset、Artifact、ChangeSet、Workspace 类型 | 102 | 大数据用 AssetRef；不能把任意路径当授权资源 |
| AI2-104 | P0 | S | Approval 模型与转换表 | 102,004 | Pending/Submitted/Approved/Rejected/Expired/Revoked 合法迁移受限 |
| AI2-105 | P0 | M | Command Envelope、Ack、幂等字段定义 | 102,004 | Ack 不标记执行完成；相同 key 重试行为可预测 |
| AI2-106 | P0 | M | DomainEvent schema / validation / versioning | 102,103,104 | 缺字段与未授权事件被拒绝/隔离，未知版本可诊断 |
| AI2-107 | P0 | L | 规范化 Store + Reducers + Entity Revision | 106 | 每类事件存在测试；只更新被影响实体，不全量克隆 |
| AI2-108 | P0 | M | seq 去重、乱序缓冲、Gap / Snapshot recovery | 106,107 | 任意重复、断线和 gap 可恢复或明确失败，不能静默丢消息 |
| AI2-109 | P0 | M | Fine-grained subscribe(selector) 与稳定 ViewModel | 107 | 更新 1 条 Message 不导致所有 Message 订阅被触发 |
| AI2-110 | P0 | M | Mock Host / Replay Host / 可复现测试 Fixture | 105–109 | 同一事件流重放得到同一 Canonical State；CI 可运行 |
| AI2-111 | P1 | M | SSE + WebSocket 通用 Adapter | 108,110 | Abort、Reconnect、Cursor、错误码、序号验证齐全 |
| AI2-112 | P1 | S | Protocol compatibility / migrations 策略 | 106–110 | 明确版本策略、破坏变更、Snapshot 兼容测试 |

## M2. Headless Controllers 与 Conversation

| ID | P | Size | 任务 | 前置 | 验收标准 |
|---|---|---|---|---|---|
| AI2-201 | P0 | M | Controller 基类 / dispose / subscribe / controlled API | 109 | 无 DOM 运行，dispose 无泄漏，不隐式取消 Host 任务 |
| AI2-202 | P0 | M | Composer Controller：Draft Revision、IME、附件 | 201,105 | 中文输入法、提交中编辑、失败保留草稿通过 |
| AI2-203 | P0 | M | Conversation Controller：可见分支与 message route | 201,102 | 编辑旧消息不破坏原分支；重试产生新 Execution |
| AI2-204 | P0 | M | Message Part Delta、文本 Scheduler、终态 flush | 107,108 | 同一 part revision 按序更新；不可重复或丢 token |
| AI2-205 | P0 | L | Timeline Controller：Follow/锚点/可变高度 | 201,204 | 阅读旧消息时 stream 不抢滚动；增加旧消息不跳动 |
| AI2-206 | P0 | M | `AiComposer` 和 `AiAttachmentTray` 原语 | 202 | 只发 Intent；焦点与无障碍行为正确，无 LLM SDK 依赖 |
| AI2-207 | P1 | M | `AiContextPicker` @ / Slash 选择器 | 202,206 | APG Combobox 键盘测试，IME 与 Enter 优先级正确 |
| AI2-208 | P0 | M | `AiMessageTimeline` / `AiMessage` 原语 | 203,205 | Stream 更新单条内容；键盘阅读/复制/跳转可用 |
| AI2-209 | P1 | M | `AiMessageContent` + Renderer Registry + Markdown | 208,103 | 不可信 Markdown 不执行脚本；允许外部 Renderer |
| AI2-210 | P1 | S | `AiCitationList` / `AiArtifactList` / Preview 基础 | 209 | 缺失来源有降级；危险文件只通过安全预览器打开 |
| AI2-211 | P1 | M | Chat E2E Story + 模拟多轮对话 | 206–210 | S1 端到端通过；停止/重试/附件/重连/分支可测试 |

## M3. Agent Execution / Approval

| ID | P | Size | 任务 | 前置 | 验收标准 |
|---|---|---|---|---|---|
| AI2-301 | P0 | M | Execution Controller / 状态迁移 / Capabilities | 201,104,105 | Stop/Resume/Pause 只发命令；按钮根据 capability 显示 |
| AI2-302 | P0 | M | Step / Tool 投影 Selectors | 107,301 | 可渲染嵌套 Step，晚到事件不能逆转终态 |
| AI2-303 | P0 | M | Approval Controller / 幂等与超时 | 104,105,201 | 重复批准不重复执行；离线不会假批准 |
| AI2-304 | P0 | M | `AiApprovalPrompt` + 风险和 scope 显示 | 303 | 审批对象、操作、风险、有效期可被用户完整感知 |
| AI2-305 | P1 | M | `AiExecutionStatus` / `AiStepList` / `AiToolInvocation` | 301,302 | 步骤更新不重挂整个视图；工具明细脱敏且按需加载 |
| AI2-306 | P1 | M | 多 Execution 同时可见和 Run Switcher | 301,305 | 任务隔离，切换不会 stop，审批仍可发现 |
| AI2-307 | P0 | M | Agent / Approval E2E Story + 可信 Mock Host | 303–306 | S2 完整；非法审批不能解锁执行；误发/重连处理 |

## M4. Coding Review（可延后单独发布）

| ID | P | Size | 任务 | 前置 | 验收标准 |
|---|---|---|---|---|---|
| AI2-401 | P1 | M | Workspace / Repo / Worktree 选择模型 | 103,301 | 不与运行的 Executor 隐式绑定，切换仅改变可见上下文 |
| AI2-402 | P1 | M | ChangeSet / Diff / Hunk Index + Parser 接口 | 103,107 | 大 Diff 懒加载；文件版本与 Review 锚点可追踪 |
| AI2-403 | P1 | L | `AiFileChangeTree` / `AiDiffViewer` 文本版 | 402 | 文件树键盘访问、Unified/Side-by-side、定位稳定 |
| AI2-404 | P1 | M | Review Controller / Hunk Comments / Outdated | 402,403 | 重基/变更后评论标识过期；进度与 Apply 分开 |
| AI2-405 | P0 | M | `AiChangesetActions` 服务端 Apply / Conflict | 404,105,004 | 只有 Host 能写文件；baseRevision 冲突可恢复 |
| AI2-406 | P1 | S | Test Report / Diagnostic Renderer | 403 | 失败摘要可定位并按需展开原始输出 |
| AI2-407 | P1 | M | Coding Review E2E Story | 401–406 | S3 完整：查看 → 评论 → 采纳 → 冲突反馈 |

## M5. Multi-framework / Tooling / Release

| ID | P | Size | 任务 | 前置 | 验收标准 |
|---|---|---|---|---|---|
| AI2-501 | P0 | M | React Headless Adapter：Hooks、Compound Parts | 211,307 | React SSR Import 安全，复杂 ReactNode 原生渲染 |
| AI2-502 | P0 | M | Vue Headless Adapter：Composables、Scoped Slots | 211,307 | Vue SSR Import 安全，复杂 VNode 原生渲染 |
| AI2-503 | P1 | L | WC Adapter：组件注册、Prop Bridge、Slot | 211,307 | 单组件按需注册；复杂对象仅 Property；disconnect 清理 |
| AI2-504 | P1 | M | JSON / Markdown / Code / Artifact Renderers（可选） | 209,501–503 | 不可信内容安全，按需加载，缺少 Renderer 可降级 |
| AI2-505 | P1 | M | WC / React / Vue 三端相同行为 Contract Suite | 501–504 | same Fixture：Composer/Message/Approval/Execution |
| AI2-506 | P0 | M | Security Regression Harness（XSS/Approval/Path） | 303,405,505 | 无脚本注入、无前端绕权、文件操作始终 Host 校验 |
| AI2-507 | P1 | M | Accessibility / Screen Reader / Keyboard Test | 505 | 至少 Combobox、Dialog、Tree、Timeline 的规范测试 |
| AI2-508 | P1 | M | Performance Harness（流、长列表、多 Run、Diff） | 204,205,305,403 | 可复现基线，测量 commit/内存/DOM 数量，回归有门禁 |
| AI2-509 | P1 | S | Build & Publish Matrix + npm pack Consumer Tests | 505 | 依赖隔离、exports、d.ts、SSR、CJS/ESM 策略一致 |
| AI2-510 | P1 | M | API Docs / Storybook 类 Showcase / Examples | 505–509 | S1/S2/S3 示例可独立运行，明确“API proposed / stable” |
| AI2-511 | P2 | M | Legacy compatibility Adapter / Migration Guide | 110,505 | 旧包仅显式转换，不伪造事件序号或权限事实 |
| AI2-512 | P2 | M | 扩展 Voice / Cost / Parallel Board / CommandPalette | 509 | 独立可选依赖，核心包零多媒体 SDK |

## 第一轮只开 12 个 Issue（推荐启动顺序）

1. `AI2-001` Product Stories / Boundary RFC
2. `AI2-003` Domain & Renderer ADR
3. `AI2-004` Threat Model / Permission Contract
4. `AI2-101` Core Package Setup
5. `AI2-102` Domain Entity Definitions
6. `AI2-104` Approval State Machine
7. `AI2-105` Command / Ack Protocol
8. `AI2-106` DomainEvent Schema
9. `AI2-107` Normalized Store / Reducer
10. `AI2-108` Replay / Gap Recovery
11. `AI2-109` Fine-grained Selectors
12. `AI2-110` Mock Host / Replay Fixture

这些完成前不建议大规模增加 UI Component 数量。

## 首个公开可用版本的范围

**AI Headless v0.1.0-beta.0** 建议只承诺：

- Pure Domain + Event/Command / Mock Host;
- Composer + Conversation + Markdown Text Streaming + Attachment + Citations;
- Execution + Steps + Tool + Approval;
- React 适配 + 基础 WC 适配（若 WC 合约测试通过）；
- 一套 Chat 与一套 Agent 真实消费示例；
- 事件回放、审批、SSR Import、安全/键盘测试门禁。

**不承诺** Coding Diff 全功能、Monaco/Terminal、复杂 Voice、多框架同天发布、完整 Agent Runtime、SSR Hydration。

## 与 Zeus 主仓库的分工

- Zeus Compiler/Signal/Runtime 只需要提供稳定的 TSX、细粒度绑定、Scope 生命周期以及组件发布能力；无需为 AI UI 内建专用语法。
- `ai-core` 可被任何框架复用，不能引用 Zeus 私有 Signal 实现。
- WebC Generator 可以承担 WC 包构建，但不能把它的局限直接升格为 Headless API 的局限。
- 旧 `@zeus-web/chat` 和 `@zeus-web/agent-console` 可保持现有版本，V2 通过新包实验并验证后，再提供迁移路径。
