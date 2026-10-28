# AI Headless V2 实现状态（对照 2026-10-27 审查报告）

> 审查基线：[audit-2026-10-27.md](./audit-2026-10-27.md)（SHA-256 `cefb0a77923f5622cea807fbb59bba1bc594873d7637d1b297791c4e43f36c7a`，审查对象 `baicie/zeus-ui@25ed76e`）。
> 本文件只记录**可核对的事实**：标为「完成」的项必须能在证据列指到仓库文件或可运行的检查；做了一部分的项标为「部分」并写明缺口。

## 范围与结论

- 六个包：`@zeus-web/ai-core`、`ai-adapters`、`ai-primitives`、`ai-react`、`ai-vue`、`ai-wc`，全部为 **`private`、API proposed**。是否发布、何时发布由维护者决定。
- 示例 / 原型：`examples/ai-showcase`（S1 Chat、S2 Agent + 审批、S3 Coding review、三端并排）。
- 54 项任务：**52 项完成、2 项部分**（AI2-507 缺真实屏幕阅读器人工抽样；AI2-509 发布矩阵已校验但未发布）。
- 门禁：G0–G5 通过，G6 部分（见 [quality-gates.md](./quality-gates.md)）。
- 复审记录：[review-2026-10-27-ai-core.md](./review-2026-10-27-ai-core.md)（F1–F19）。
- API 权威说明：[docs/internal/packages.md](../internal/packages.md) 的「AI Headless V2」章节。

## 54 项逐项状态

| ID        | 优先级 | 任务                                                    | 状态    | 证据                                                                                      |
| --------- | ------ | ------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `AI2-001` | P0     | 三个 Surface 与故事                                     | ✅      | `product-stories.md`；故事由 `e2e/ai-browser/s1/s2/s3` 执行                               |
| `AI2-002` | P0     | 审查旧 Chat / AgentConsole                              | ✅      | `legacy-decision.md`                                                                      |
| `AI2-003` | P0     | ADR：领域模型、Renderer 与 WC 边界                      | ✅      | `adr-001-domain-and-renderer.md`                                                          |
| `AI2-004` | P0     | 安全模型、Host Capability 与威胁清单                    | ✅      | `threat-model.md`；防线由 `e2e/ai/security.spec.ts` 回归                                  |
| `AI2-005` | P1     | 交互原型：Chat 与 Agent + Approval                      | ✅      | `examples/ai-showcase`（`pnpm --filter @zeus-web/example-ai-showcase dev`）               |
| `AI2-101` | P0     | `ai-core` 包骨架与纯 Node 环境                          | ✅      | `packages/ai-core`；`node-environment.spec.ts`；`pnpm ai:pack-check` Node import          |
| `AI2-102` | P0     | Domain Types                                            | ✅      | `ai-core/src/domain/types.ts`                                                             |
| `AI2-103` | P0     | Asset、Artifact、ChangeSet、Workspace 类型              | ✅      | `domain/types.ts`、`domain/changeset.ts`；路径校验 `protocol/validation.ts`               |
| `AI2-104` | P0     | Approval 模型与转换表                                   | ✅      | `domain/approval.ts`；Reducer 不变量（复审 F2、F18）                                      |
| `AI2-105` | P0     | Command / Ack / 幂等                                    | ✅      | `protocol/commands.ts`；`controllers/session.ts`                                          |
| `AI2-106` | P0     | DomainEvent schema / validation / versioning            | ✅      | `protocol/{events,validation}.ts`                                                         |
| `AI2-107` | P0     | 规范化 Store + Reducers + Revision                      | ✅      | `store/{state,reducers,entity-map}.ts`（持久化集合，复审 F13）                            |
| `AI2-108` | P0     | seq 去重、乱序、Gap / Snapshot                          | ✅      | `store/{store,snapshot,integrity}.ts`；`sequence.spec.ts`                                 |
| `AI2-109` | P0     | 细粒度 subscribe 与稳定 ViewModel                       | ✅      | `store/{selectors,projections}.ts`；`e2e/ai/performance.spec.ts`（流式不触及其他消息）    |
| `AI2-110` | P0     | Mock / Replay Host / Fixture                            | ✅      | `host/*`；`replay.spec.ts`、`compat.spec.ts`                                              |
| `AI2-111` | P1     | SSE + WebSocket Adapter                                 | ✅      | `packages/ai-adapters`；`__tests__/{sse,websocket}.spec.ts`                               |
| `AI2-112` | P1     | 协议兼容 / 迁移策略                                     | ✅      | `protocol-compatibility.md`；`protocol/compat.ts`；`compat.spec.ts`                       |
| `AI2-201` | P0     | Controller 基类 / dispose / subscribe / controlled      | ✅      | `controllers/view-store.ts`、`session.ts`；`controllers-conversation.spec.ts`             |
| `AI2-202` | P0     | Composer：Draft Revision、IME、附件                     | ✅      | `controllers/composer.ts`；S1 浏览器故事（IME）                                           |
| `AI2-203` | P0     | Conversation：可见分支                                  | ✅      | `controllers/conversation.ts`；S1 regenerate / 版本切换                                   |
| `AI2-204` | P0     | Part Delta、文本调度、终态 flush                        | ✅      | `controllers/streaming-text.ts`                                                           |
| `AI2-205` | P0     | Timeline：Follow / 锚点 / 可变高度                      | ✅      | `controllers/timeline.ts`（含 1k+ 窗口化）；S1 scroll follow 故事                         |
| `AI2-206` | P0     | `AiComposer` / `AiAttachmentTray`                       | ✅      | `ai-primitives/src/composer.ts`；三端适配器                                               |
| `AI2-207` | P1     | `AiContextPicker`                                       | ✅      | `context-picker.ts`、`combobox.ts`；键盘测试（jsdom + 浏览器）                            |
| `AI2-208` | P0     | `AiMessageTimeline` / `AiMessage`                       | ✅      | `conversation.ts`、`views.ts`；三端                                                       |
| `AI2-209` | P1     | `AiMessageContent` + Renderer Registry + Markdown       | ✅      | `markdown.ts`、`content.ts`；XSS 语料                                                     |
| `AI2-210` | P1     | Citation / Artifact 列表与预览                          | ✅      | `ai-core/controllers/artifacts.ts`；各端 `AiArtifactPreview`                              |
| `AI2-211` | P1     | Chat E2E                                                | ✅      | `e2e/ai-browser/s1-chat.spec.ts`（三引擎）                                                |
| `AI2-301` | P0     | Execution Controller / Capabilities                     | ✅      | `controllers/execution.ts`                                                                |
| `AI2-302` | P0     | Step / Tool 投影                                        | ✅      | `store/projections.ts`                                                                    |
| `AI2-303` | P0     | Approval Controller / 幂等与超时                        | ✅      | `controllers/approval.ts`                                                                 |
| `AI2-304` | P0     | `AiApprovalPrompt`                                      | ✅      | `ai-primitives/src/agent.ts`、`views.ts`；S2 浏览器故事                                   |
| `AI2-305` | P1     | `AiExecutionStatus` / `AiStepList` / `AiToolInvocation` | ✅      | 三端适配器；工具参数脱敏                                                                  |
| `AI2-306` | P1     | 多 Execution 与 Run Switcher                            | ✅      | `controllers/run-switcher.ts`；S2 运行隔离                                                |
| `AI2-307` | P0     | Agent / Approval E2E + 可信 Mock Host                   | ✅      | `e2e/ai-browser/s2-agent.spec.ts`；`examples/ai-showcase/src/demo-host.ts`                |
| `AI2-401` | P1     | Workspace 选择模型                                      | ✅      | `controllers/workspace.ts`                                                                |
| `AI2-402` | P1     | ChangeSet / Diff / Hunk Index                           | ✅      | `diff/parser.ts`                                                                          |
| `AI2-403` | P1     | `AiFileChangeTree` / `AiDiffViewer`                     | ✅      | `ai-primitives/src/coding.ts`；三端                                                       |
| `AI2-404` | P1     | Review Controller / 评论 / 过期                         | ✅      | `controllers/review.ts`；S3 过期评论                                                      |
| `AI2-405` | P0     | `AiChangesetActions` 服务端 Apply / Conflict            | ✅      | `controllers/changeset-actions.ts`；S3 冲突 → rebase → apply                              |
| `AI2-406` | P1     | Test Report                                             | ✅      | `controllers/test-report.ts`；S3 报告                                                     |
| `AI2-407` | P1     | Coding Review E2E                                       | ✅      | `e2e/ai-browser/s3-coding.spec.ts`                                                        |
| `AI2-501` | P0     | React Adapter                                           | ✅      | `packages/ai-react`                                                                       |
| `AI2-502` | P0     | Vue Adapter                                             | ✅      | `packages/ai-vue`                                                                         |
| `AI2-503` | P1     | WC Adapter                                              | ✅      | `packages/ai-wc`                                                                          |
| `AI2-504` | P1     | JSON / Markdown / Code / Artifact Renderers             | ✅      | `content.ts`、`views.ts`；沙箱预览                                                        |
| `AI2-505` | P1     | 三端 Contract Suite                                     | ✅      | `e2e/ai/contract.spec.ts`、`e2e/ai-browser/frameworks.spec.ts`                            |
| `AI2-506` | P0     | Security Harness                                        | ✅      | `e2e/ai/security.spec.ts`                                                                 |
| `AI2-507` | P1     | Accessibility / 屏幕阅读器 / 键盘                       | ⚠️ 部分 | 自动化完成（`e2e/ai/accessibility.spec.ts` + 浏览器 axe）；**真实屏幕阅读器人工抽样未做** |
| `AI2-508` | P1     | Performance Harness                                     | ✅      | `e2e/ai/performance.spec.ts`；基线见 `quality-gates.md`                                   |
| `AI2-509` | P1     | Build & Publish Matrix + npm pack                       | ⚠️ 部分 | `pnpm ai:pack-check` 全部通过；包仍 `private`，未进入 release 计划，体积预算未设          |
| `AI2-510` | P1     | API Docs / 示例                                         | ✅      | `docs/internal/packages.md`；各包 README；`examples/ai-showcase`（标注 API proposed）     |
| `AI2-511` | P2     | Legacy Adapter / Migration Guide                        | ✅      | `ai-core/src/legacy/import.ts`；`migration-guide.md`                                      |
| `AI2-512` | P2     | Voice / Cost / Parallel Board / Command Palette         | ✅      | `ai-primitives/src/extensions`                                                            |

## 明确的非声明

- 不声称 V2 已发布：六个包均为 `private`，版本号沿用仓库版本，尚未进入发布计划。
- 浏览器 E2E 在本机运行的是缓存中较新的浏览器版本（Playwright 固定版本的浏览器无法下载）；CI 上应安装固定版本。
- 旧 `@zeus-web/chat` / `@zeus-web/agent-console` 保持现状；V2 只提供单向导入，不提供兼容层。

## 剩余工作

1. 真实屏幕阅读器（VoiceOver / NVDA）与移动端缩放人工检查（AI2-507）。
2. 决定是否发布：去掉 `private`、加入发布计划、设定体积预算（AI2-509）。
3. CI 中接入 `pnpm test-e2e:ai` 与 `pnpm ai:pack-check`。
