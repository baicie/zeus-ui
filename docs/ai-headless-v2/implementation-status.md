# AI Headless V2 实现状态（对照 2026-10-27 审查报告）

> 审查基线：[audit-2026-10-27.md](./audit-2026-10-27.md)（SHA-256 `cefb0a77923f5622cea807fbb59bba1bc594873d7637d1b297791c4e43f36c7a`，审查对象 `baicie/zeus-ui@25ed76e`）。
> 本文件只记录**可核对的事实**：状态为「完成（本轮）」的项必须能在 Evidence 列指到仓库文件；其余保持未开始，不因为存在设计文档而升级。

## 本轮范围

按审计建议「第一次合并只包含 `@zeus-web/ai-core` 与 Node-only 合同测试」，本轮交付：

- **M0**（AI2-001/002/003/004）：`docs/ai-headless-v2/` 下的故事、ADR、威胁模型、旧代码决策，设计原文逐字节存档于 `design-source/`。
- **M1**（AI2-101 ~ AI2-110）：`packages/ai-core`（private、零依赖、纯 Node），含领域类型、审批/执行状态机、Command 幂等、DomainEvent 校验、规范化 Store/Reducer、seq 恢复、细粒度 Selector、Mock/Replay Host 与 S1/S2/S3 录制流。
- 验证：`pnpm check`、`pnpm -F @zeus-web/ai-core build`（含 DTS）、`vitest --project unit` 与 `--project unit-jsdom` 下 85 项合同测试（含 2026-10-27 复审新增的 34 项回归）、`pnpm lint`、`format-check`、`release:verify`、`check:build-output`、`check:exports`、`check:product-contract`、文档门禁。

> **2026-10-27 复审**：首轮实现的 51 项测试全绿，但复审确认 M1 Gate 有 4 条未满足（终态可复活、审批可被请求事件伪造、无法应用的事件会卡死或被静默跳过、无跨会话隔离），另有 Mock Host 不幂等、Host 快照会跳号等问题。已全部修复并补回归测试，详见 [review-2026-10-27-ai-core.md](./review-2026-10-27-ai-core.md)。下表 AI2-104 ~ AI2-110 的证据已按修复后的实现更新。

未完成但审计要求先做的：AI2-005 交互原型、AI2-111/112（SSE/WS adapter、迁移策略），以及 M2 之后的全部任务。

## 54 项逐项状态

| ID        | 优先级 | 任务                                                    | 状态            | 证据                                                                                                                                                               |
| --------- | ------ | ------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AI2-001` | P0     | 明确 Chat / Agent / Coding 三个 Surface 与故事          | ✅ 完成（本轮） | `docs/product-stories.md`：S1/S2/S3 输入、事件序列、动作、终态与失败恢复已定义                                                                                     |
| `AI2-002` | P0     | 审查旧 Chat / AgentConsole 的数据与逻辑错误             | ✅ 完成（本轮） | `docs/legacy-decision.md`：6 个旧模块逐个「保留/不复用/抽取/迁移」决策 + V1 API 黑名单                                                                             |
| `AI2-003` | P0     | ADR：领域模型、Renderer 与 WC 边界                      | ✅ 完成（本轮） | `docs/adr-001-domain-and-renderer.md`：D1 平级聚合 / D2 Renderer 安全边界 / D3 不强制 WC / D4 零 DOM                                                               |
| `AI2-004` | P0     | 定义安全模型、Host Capability 与威胁清单                | ✅ 完成（本轮） | `docs/threat-model.md`：12 项 Capability + 35 条威胁与可验证防线                                                                                                   |
| `AI2-005` | P1     | 交互 Prototype：Chat 与 Agent + Approval                | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-101` | P0     | `@zeus-web/ai-core` 包骨架与纯 Node 环境                | ✅ 完成（本轮） | `packages/ai-core`：私有纯 TS 包，零依赖；Node import 与源码零 DOM 引用受测试保护                                                                                  |
| `AI2-102` | P0     | Domain Types：Conversation/Message/Execution/Step/Tool  | ✅ 完成（本轮） | `packages/ai-core/src/domain/types.ts`：Conversation/Message/Execution/Step/Tool 及 revision 契约                                                                  |
| `AI2-103` | P0     | Asset、Artifact、ChangeSet、Workspace 类型              | ✅ 完成（本轮） | `packages/ai-core/src/domain/types.ts`：AssetRef/Artifact/ChangeSet/Workspace；大对象一律走 AssetRef                                                               |
| `AI2-104` | P0     | Approval 模型与转换表                                   | ✅ 完成（本轮） | `packages/ai-core/src/domain/approval.ts` 状态机；复审后 Reducer 保证审批只能以 `pending` 创建、只由 `approval.resolved` 改状态、scope/operation 不可变（复审 F2） |
| `AI2-105` | P0     | Command Envelope、Ack、幂等字段定义                     | ✅ 完成（本轮） | `packages/ai-core/src/protocol/commands.ts`：Command/CommandAck；复审后幂等追踪器支持 `release`、不淘汰 in-flight、按命令指纹识别键复用（复审 F6）                 |
| `AI2-106` | P0     | DomainEvent schema / validation / versioning            | ✅ 完成（本轮） | `packages/ai-core/src/protocol/{events,validation}.ts`：schemaVersion=2、隔离与拒绝分类；复审后为逐类型结构校验 + 信封/payload id 绑定 + 变更路径校验（复审 F4）   |
| `AI2-107` | P0     | 规范化 Store + Reducers + Entity Revision               | ✅ 完成（本轮） | `packages/ai-core/src/store/{state,reducers}.ts`：规范化 Store + 逐事件 Reducer；复审后重发实体不能绕过状态机、聚合内引用完整（复审 F1/F5）                        |
| `AI2-108` | P0     | seq 去重、乱序缓冲、Gap / Snapshot recovery             | ✅ 完成（本轮） | `packages/ai-core/src/store/{store,snapshot}.ts`：seq 去重/乱序缓冲/gap；复审后无法应用的事件进入 `desynced` 并由快照恢复，Host 快照可直接载入（复审 F3/F7）       |
| `AI2-109` | P0     | Fine-grained subscribe(selector) 与稳定 ViewModel       | ✅ 完成（本轮） | `packages/ai-core/src/store/{selectors,store}.ts`：按切片通知；复审后步骤列表可用、审批列表引用稳定、无模块级缓存泄漏（复审 F8/F9）                                |
| `AI2-110` | P0     | Mock Host / Replay Host / 可复现测试 Fixture            | ✅ 完成（本轮） | `packages/ai-core/src/host/*`：Mock/Replay Host + S1/S2/S3 录制流；复审后 Mock Host 按幂等键最多执行一次，快照与游标一致（复审 F6/F7）                             |
| `AI2-111` | P1     | SSE + WebSocket 通用 Adapter                            | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-112` | P1     | Protocol compatibility / migrations 策略                | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-201` | P0     | Controller 基类 / dispose / subscribe / controlled API  | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-202` | P0     | Composer Controller：Draft Revision、IME、附件          | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-203` | P0     | Conversation Controller：可见分支与 message route       | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-204` | P0     | Message Part Delta、文本 Scheduler、终态 flush          | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-205` | P0     | Timeline Controller：Follow/锚点/可变高度               | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-206` | P0     | `AiComposer` 和 `AiAttachmentTray` 原语                 | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-207` | P1     | `AiContextPicker` @ / Slash 选择器                      | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-208` | P0     | `AiMessageTimeline` / `AiMessage` 原语                  | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-209` | P1     | `AiMessageContent` + Renderer Registry + Markdown       | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-210` | P1     | `AiCitationList` / `AiArtifactList` / Preview 基础      | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-211` | P1     | Chat E2E Story + 模拟多轮对话                           | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-301` | P0     | Execution Controller / 状态迁移 / Capabilities          | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-302` | P0     | Step / Tool 投影 Selectors                              | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-303` | P0     | Approval Controller / 幂等与超时                        | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-304` | P0     | `AiApprovalPrompt` + 风险和 scope 显示                  | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-305` | P1     | `AiExecutionStatus` / `AiStepList` / `AiToolInvocation` | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-306` | P1     | 多 Execution 同时可见和 Run Switcher                    | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-307` | P0     | Agent / Approval E2E Story + 可信 Mock Host             | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-401` | P1     | Workspace / Repo / Worktree 选择模型                    | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-402` | P1     | ChangeSet / Diff / Hunk Index + Parser 接口             | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-403` | P1     | `AiFileChangeTree` / `AiDiffViewer` 文本版              | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-404` | P1     | Review Controller / Hunk Comments / Outdated            | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-405` | P0     | `AiChangesetActions` 服务端 Apply / Conflict            | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-406` | P1     | Test Report / Diagnostic Renderer                       | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-407` | P1     | Coding Review E2E Story                                 | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-501` | P0     | React Headless Adapter：Hooks、Compound Parts           | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-502` | P0     | Vue Headless Adapter：Composables、Scoped Slots         | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-503` | P1     | WC Adapter：组件注册、Prop Bridge、Slot                 | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-504` | P1     | JSON / Markdown / Code / Artifact Renderers（可选）     | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-505` | P1     | WC / React / Vue 三端相同行为 Contract Suite            | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-506` | P0     | Security Regression Harness（XSS/Approval/Path）        | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-507` | P1     | Accessibility / Screen Reader / Keyboard Test           | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-508` | P1     | Performance Harness（流、长列表、多 Run、Diff）         | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-509` | P1     | Build & Publish Matrix + npm pack Consumer Tests        | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-510` | P1     | API Docs / Storybook 类 Showcase / Examples             | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-511` | P2     | Legacy compatibility Adapter / Migration Guide          | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |
| `AI2-512` | P2     | 扩展 Voice / Cost / Parallel Board / CommandPalette     | ⬜ 未开始       | 审计报告 2026-10-27 判定未实现                                                                                                                                     |

## 门禁（G0–G6）

| Gate               | 状态        | 说明                                                                                                                                                                 |
| ------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0 Domain          | ✅ 本轮通过 | S1/S2/S3 录制流在纯 Node 重放得到同一 Canonical State，乱序输入收敛到同一结果，且在各自会话/执行 scope 下重放不越界（`replay.spec.ts`、`review-2026-10-27.spec.ts`） |
| G1 Headless        | ⬜ 未开始   | 依赖 M2 Controller                                                                                                                                                   |
| G2 Conversation    | ⬜ 未开始   | 无浏览器 E2E                                                                                                                                                         |
| G3 Agent           | ⬜ 未开始   | 无 Approval UI                                                                                                                                                       |
| G4 Coding          | ⬜ 未开始   | 无 Diff/Review                                                                                                                                                       |
| G5 Cross-framework | ⬜ 未开始   | 无 React/Vue/WC adapter                                                                                                                                              |
| G6 Release         | ⬜ 未开始   | `ai-core` 仍为 private，未进入发布矩阵                                                                                                                               |

## 明确的非声明

- 不声称 V2 已可用、已发布或已通过 G1–G6；`ai-core` 为实验性私有包。
- 不把 `@zeus-web/ai`（组件元数据包）与 `@zeus-web/ai-core` 混为一谈。
- 旧 `@zeus-web/chat` / `@zeus-web/agent-console` 保持现状，V2 不继承其数据结构（见 `adr-001` 与 `legacy-decision`）。

## 下一步（依赖顺序）

1. AI2-201/202/204：Controller 基类 + Composer（ACK 前保留草稿）+ 流式 Part Delta。
2. AI2-303/304/307：Approval Controller 与 `AiApprovalPrompt`，加可信 Mock Host 的 S2 E2E。
3. AI2-111/112：SSE/WebSocket adapter 与协议迁移策略，补齐 M1 剩余两项。
4. M2 剩余原语 → S1 E2E；之后 M4/M5 按产品需求分批。
