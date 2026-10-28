# Legacy Decision — 旧 AI 模块的保留 / 不复用 / 抽取 / 迁移

> **任务：AI2-002（M0 · P0 · M）**
> 验收标准（`design-source/03-IMPLEMENTATION-BACKLOG.md` §M0）：**每个旧模块标记复用/废弃/迁移；不存在默认沿用 V1 API**。
> 另一条硬约束（`03` §0）：**新系统与旧 `@zeus-web/chat`、`@zeus-web/agent-console` 逻辑隔离，不因为兼容性妥协领域模型。**
> **状态：Proposed（提案）** ｜ **文档时点：2026-10-27** ｜ 本文所有代码事实均来自当前工作区，路径可点击核对。

---

## 0. 判据与决策四分类

| 决策                    | 含义                                                    | 对本仓库意味着                                                                            |
| ----------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **保留（keep）**        | 继续作为 V1 资产发布与维护                              | V2 不依赖它、不改它、不承诺它的未来                                                       |
| **不复用（drop）**      | V2 明确不继承其 API、数据模型或实现                     | 需要写清楚"为什么不能用"，避免后人重新引入                                                |
| **抽取能力（extract）** | 只提取某个算法/模式/工具函数进 V2，且必须带前置测试条件 | 抽取物必须重新设计接口，不能整文件照搬                                                    |
| **迁移（migrate）**     | 需要一次性把旧数据/调用方转换                           | 只允许 **legacy-to-v2 adapter**，且**禁止伪造 `seq`/`approval`/工具执行结果**（`01` §19） |

**判定原则**（来自 `01` §19 与 `03` §0）：

1. 目标架构**不继承旧 API**；实现阶段允许"按测试结果有条件复用"。
2. 不以兼容性为由妥协领域模型；旧包可保持现有版本，通过新包实验并验证后再谈迁移路径（`03` §与 Zeus 主仓库的分工）。
3. 任何"复用"都必须能指出**复用什么、在什么条件下、用哪个测试证明**。

> 补充（2026-10-27 观测）：M1 并行任务已在 `packages/ai-core`（`private`、实验性）落地领域/协议/Store 骨架，其状态以 [该包 README](../../packages/ai-core/README.md) 为准。本文的"V2 对应"列仍按设计原文的**提案包名**描述（`ai-core` / `ai-primitives` / …），不表示这些包已发布。

---

## 1. 审计范围（实际读过的源码）

| #   | 模块                                 | 入口                                                                                                                                                                           | 文件数 / 代码量                                          |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| 1   | `@zeus-web/chat`                     | [packages/advanced/chat](../../packages/advanced/chat)                                                                                                                         | `src/` 16 文件 / 2026 行（8 组件 + 5 core + types）      |
| 2   | `@zeus-web/agent-console`            | [packages/advanced/agent-console](../../packages/advanced/agent-console)                                                                                                       | `src/` 15 文件 / 1366 行（1 组件 + 7 core + 3 provider） |
| 3   | `@zeus-web/ai`                       | [packages/ai](../../packages/ai)                                                                                                                                               | `src/` 6 文件 / 3409 行（其中 `metadata.ts` 2698 行）    |
| 4   | `@zeus-web/headless`                 | [packages/headless](../../packages/headless)                                                                                                                                   | `src/` 1 文件 / 147 行（纯聚合入口）                     |
| 5   | `@zeus-web/data-grid`（AI 相关部分） | [packages/advanced/data-grid](../../packages/advanced/data-grid)                                                                                                               | `src/` 21 文件 / 5329 行（**无 AI 代码**）               |
| 6   | 示例页面                             | [ChatPage.tsx](../../examples/advanced-showcase/src/pages/ChatPage.tsx) 252 行、[AgentConsolePage.tsx](../../examples/advanced-showcase/src/pages/AgentConsolePage.tsx) 258 行 | 2 文件 / 510 行                                          |

---

## 2. `packages/advanced/chat`（`@zeus-web/chat@0.1.0-beta.34`）

### 2.1 代码事实

| 事实                                                                                                                                         | 证据                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 单一根容器 `zw-chat`，通过命名 Slot 组装（`header/sidebar/thread/artifact/composer`），宿主需要在 slot 里自渲染消息                          | [chat.tsx](../../packages/advanced/chat/src/components/chat.tsx)（`Slot name="thread"` / `"composer"`）                                     |
| 命令式外部 API：`setMessages` / `appendMessage` / `updateMessage` / `appendMessagePart` / `clear` / `scrollToBottom`                         | [chat.tsx](../../packages/advanced/chat/src/components/chat.tsx#L26-L44)、`ctx.expose` 段                                                   |
| 消息模型是"万能 part"：`text` / `code` / **`tool-call`** / **`artifact`** 都是同一个 Message 的 part                                         | [types.ts](../../packages/advanced/chat/src/types.ts#L32-L54)                                                                               |
| 消息无 `revision`、无 `parentMessageId`（无分支）、无 Execution 关联；状态是 `idle/streaming/complete/error/aborted`                         | [types.ts](../../packages/advanced/chat/src/types.ts#L9-L14)、[types.ts](../../packages/advanced/chat/src/types.ts#L56-L64)                 |
| 时间戳由客户端 `Date.now()` 兜底                                                                                                             | [message-model.ts](../../packages/advanced/chat/src/core/message-model.ts#L34-L45)（`createdAt: message.createdAt ?? Date.now()`）          |
| 每次变更后 `getSnapshot()` 全量深克隆所有消息与 parts                                                                                        | [chat-store.ts](../../packages/advanced/chat/src/core/chat-store.ts#L40-L56)                                                                |
| 每次消息变更即 `queueMicrotask` 滚到底（无 follow 策略、无阅读锚点）                                                                         | [chat.tsx](../../packages/advanced/chat/src/components/chat.tsx#L76-L80)                                                                    |
| Composer 提交时 `trim()` 后立即清空输入与附件，**没有 Ack、没有草稿版本、失败不会恢复**                                                      | [chat-composer.tsx](../../packages/advanced/chat/src/components/chat-composer.tsx#L67-L80)                                                  |
| Composer 的 IME 判定是独立纯函数（`isComposing` / `keyCode === 229`）                                                                        | [composer-state.ts](../../packages/advanced/chat/src/core/composer-state.ts#L96-L108)                                                       |
| 流式节流器是独立模块（RAF 批处理 + `flush()` + `cancel()` + `getPendingValue()`）                                                            | [stream-buffer.ts](../../packages/advanced/chat/src/core/stream-buffer.ts#L32-L87)                                                          |
| 线程虚拟化只是对 `@zeus-web/virtual` 的薄封装（`measure` / `resetMeasurements` / `getOffsetForIndex`）                                       | [thread-virtualizer.ts](../../packages/advanced/chat/src/core/thread-virtualizer.ts#L73-L139)                                               |
| `./react` 与 `./vue` 入口由 `@zeus-js/output-react-wrapper` / `output-vue-wrapper` 生成，包内**没有** React/Vue 源文件                       | [package.json](../../packages/advanced/chat/package.json)                                                                                   |
| `__tests__/` 有 8 个 spec 文件，但 `package.json` 的 `test` 脚本只列了 7 个——`chat-composer-runtime.spec.ts` **未纳入脚本**；**无 e2e 目录** | `packages/advanced/chat/__tests__/`、[package.json](../../packages/advanced/chat/package.json)（`scripts.test`）；`e2e/advanced/` 下无 chat |

### 2.2 决策

| 对象                                                   | 决策                             | 理由                                                                                                                                              |
| ------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 整体组件 API（`Chat` 根容器 + 命令式方法 + Slot 组装） | **不复用**                       | 与 V2 "无强制主组件、UI 只发 Command" 冲突（`01` §1、§3.3）；命令式 `setMessages` 让宿主直接改事实，绕过 Ack 与事件                               |
| `ChatMessagePart`（含 `tool-call` / `artifact`）       | **不复用**                       | `tool-call` 不是 Message 的 ContentPart 默认类型（`02` B2）；工具必须是独立 `ToolInvocation` 实体（ADR-001 D1）                                   |
| `ChatStore`（数组 + 全量克隆）                         | **不复用**                       | 违反 `01` §5.3「禁止全量深克隆」与 AI2-107「只更新被影响实体」                                                                                    |
| `chat-composer` 的提交/清空逻辑                        | **不复用**（行为反例）           | 提交即 `trim` + 清空，无法满足 `02` B1「Ack 只清理已提交版本」「`trim` 不得破坏原始 Markdown 空白」；保留为 **V2 的反例用例**                     |
| `chat.tsx` 的自动滚底                                  | **不复用**（行为反例）           | `02` B3/`01` §11.2 要求 `follow: always\|when-near-bottom\|never` + `{messageId, offset}` 锚点；无条件滚底会抢用户阅读                            |
| `stream-buffer.ts`                                     | **抽取能力**（候选）             | 属视图节流而非协议正确性（`01` §19）。前置条件：补"终态 flush 同步处理余量 + cancel 不丢已确认内容"的测试（对应 AI2-204）                         |
| `composer-state.ts` 的 `shouldSubmitFromKeyboardEvent` | **抽取能力**                     | IME/组合键判定与协议无关，可直接作为 `ai-primitives` 的键盘 intent 工具（`02` B1 表格的键盘语义）                                                 |
| `thread-virtualizer.ts`                                | **只抽取算法**，不抽 UI 数据模型 | `01` §19：「只复用算法，经可变高度/焦点锚点测试」。底层 `@zeus-web/virtual` 可继续用，但 follow/锚点归 Timeline Controller（`01` §11.2、AI2-205） |
| `chat-code-block` 的"复制纯代码文本"语义               | **抽取能力（语义）**             | `01` §12 要求复制按钮保留纯代码文本；实现可重写                                                                                                   |
| `ChatMessageStatus` 的五态                             | **不复用**                       | 缺 `cancelled`/`failed` 语义对齐；消息状态必须与 `Message.status` 的提案枚举一致（`01` §5.1：`pending/streaming/complete/failed/cancelled`）      |

### 2.3 V2 对应与迁移动作

- V2 对应：`ai-primitives` 的 `AiComposer` / `AiMessageTimeline` / `AiMessage` / `AiMessageContent`（`01` §9.1），由 `ai-core` 的 `ConversationController` + `ComposerController` 驱动（`01` §8.3）。
- 迁移动作：**无强制迁移**。V1 包保持发布（`01` §19「可以保留为 legacy 包，避免破坏已发布下游使用者」）；如需旧数据进入 V2，只能在 AI2-511（P2）实现一次性 adapter，且缺失信息填 `unknown / non-replayable` 并给诊断。
- 风险：V1 有单测但**无 e2e**，且 `chat-composer-runtime.spec.ts` 未接入 `test` 脚本；抽取 `stream-buffer` / composer 行为前，必须先把该 spec 纳入 CI 并用测试固定"终态 flush""提交后不清空新输入"等边界，否则抽取等于**丢失回归保护**。

---

## 3. `packages/advanced/agent-console`（`@zeus-web/agent-console@0.1.0-beta.34`）

### 3.1 代码事实

| 事实                                                                                                                                                        | 证据                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 状态是**单个对象五数组**：`messages / toolCalls / artifacts / diagnostics / events` + `status` + `selectedArtifactId`                                       | [types.ts](../../packages/advanced/agent-console/src/types.ts#L100-L108)                                                                                                                         |
| 状态只 5 态：`idle / running / waiting / complete / error`，**没有** `queued / awaiting-approval / paused / cancelled`                                      | [types.ts](../../packages/advanced/agent-console/src/types.ts#L3-L8)                                                                                                                             |
| 每次快照全量克隆（`messages.map` / `toolCalls.map` / …）                                                                                                    | [console-state.ts](../../packages/advanced/agent-console/src/core/console-state.ts#L46-L64)                                                                                                      |
| ID 由**客户端自增计数器**生成（`agc-1`、`event-2`…），进程内唯一而已                                                                                        | [id.ts](../../packages/advanced/agent-console/src/core/id.ts#L1-L6)                                                                                                                              |
| 事件日志以 `Date.now()` 为时间，并按 `maxEvents` **静默丢弃最旧事件**                                                                                       | [event-log-model.ts](../../packages/advanced/agent-console/src/core/event-log-model.ts#L14-L16)、[event-log-model.ts](../../packages/advanced/agent-console/src/core/event-log-model.ts#L46-L56) |
| Provider 事件是**可选字段袋**：`{type, message?, delta?, toolCall?, artifact?, diagnostic?, status?, error?}`，无 `seq`、无 `schemaVersion`、无 Command/Ack | [provider/types.ts](../../packages/advanced/agent-console/src/provider/types.ts#L25-L44)                                                                                                         |
| 有 mock / replay provider（`AsyncIterable` + `cancel`）                                                                                                     | [mock-provider.ts](../../packages/advanced/agent-console/src/provider/mock-provider.ts)、[replay-provider.ts](../../packages/advanced/agent-console/src/provider/replay-provider.ts)             |
| 组件暴露命令式 API：`appendMessage` / `startToolCall` / `finishToolCall` / `addArtifact` / `addDiagnostic` / `setStatus` / `reset` / `selectArtifact`       | [agent-console.tsx](../../packages/advanced/agent-console/src/components/agent-console.tsx)（`ctx.expose` 段）                                                                                   |
| 有 e2e（`e2e/advanced/agent-console/agent-console-runtime.spec.ts`）与 9 个单测                                                                             | `e2e/advanced/agent-console/`、`packages/advanced/agent-console/__tests__/`                                                                                                                      |

### 3.2 决策

| 对象                                                | 决策                                             | 理由                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `AgentConsoleState`（单对象五数组）                 | **不复用**（明确不作为 V2 Store 根）             | `01` §19 原文：「全量 state clone + 单数组事实不适合长期增长」；V2 需要规范化实体 + 引用（`01` §5.3）                                     |
| 5 态 status                                         | **不复用**                                       | 与 `ExecutionStatus` 七态（`01` §5.1）不兼容；缺审批挂起与取消语义，无法表达 S2 故事                                                      |
| `AgentProviderEvent` / `AgentProviderAdapter`       | **不复用为协议**；只允许作为**兼容输入 Adapter** | `01` §19：「废弃为通用协议；仅用于兼容输入 Adapter；缺少可靠序号、命令与审批端到端语义」                                                  |
| 客户端自增 ID（`id.ts`）                            | **不复用**                                       | V2 实体 ID 与 `seq` 必须来自 Host 权威（`01` §5.1、§7.1）；客户端只能生成 `idempotencyKey` / `commandId`                                  |
| `maxEvents` 截断事件日志                            | **不复用**                                       | 会**静默丢历史**，与"可重放、缺口可诊断"直接冲突（`01` §7.2-3/4；`03` AI2-108「不能静默丢消息」）                                         |
| `AgentConsoleDiagnostic`（info/warning/error 文本） | **不复用类型**，只借鉴"有诊断通道"这一点         | V2 诊断事件只记录 ID/类型/耗时/字节，不含正文（`01` §15.2）                                                                               |
| mock / replay provider 的**可回放思路**             | **抽取能力（模式）**                             | 对应 AI2-110「Mock Host / Replay Host / 可复现 Fixture」；但必须重写为带 `seq` + `cursor` + `getSnapshot` 的 `AiHostAdapter`（`01` §7.4） |
| 组件命令式 API                                      | **不复用**                                       | 与 CQRS-lite 冲突：UI 不能直接写入执行事实（`01` §3.3）                                                                                   |

### 3.3 V2 对应与迁移动作

- V2 对应：`Execution` / `ExecutionStep` / `ToolInvocation` / `Approval` 四个独立聚合（`01` §5.1、§5.2）+ `ExecutionController` / `ApprovalController`（`01` §8.3）。
- 迁移动作：数据 migration 可写**一次性 Adapter**（`01` §19），把旧 `AgentConsoleState` 转成 V2 实体；**必须显式标注**：无 `seq`、无审批事实、无工具执行确认 → 填 `non-replayable` 并产出诊断，**绝不伪造**。
- 风险：现有 e2e 保护的是 V1 行为（命令式驱动），V2 不能把"e2e 全绿"当作可复用证据。

---

<a id="legacy-packages-ai"></a>

## 4. `packages/ai`（`@zeus-web/ai@0.1.0-beta.34`）

### 4.1 代码事实

| 事实                                                                                                                                              | 证据                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 包描述即定位：**"AI metadata and LLM usage guide for Zeus Web"**                                                                                  | [package.json](../../packages/ai/package.json)                                                                                           |
| 导出物是 `aiMetadata`（组件 Props/Events/Slots/示例/aiRules）、`renderAiMarkdown`、`renderAiJson`、`validateAiMetadata`                           | [index.ts](../../packages/ai/src/index.ts)                                                                                               |
| 组件名联合类型是**表单控件**（input/button/dialog/tabs/…），并另列 advanced 组件（chat / virtual / data-grid / revogrid-adapter / agent-console） | [types.ts](../../packages/ai/src/types.ts#L1-L32)                                                                                        |
| `advancedComponents` 段含 chat 与 agent-console 的 AI 使用提示词                                                                                  | [metadata.ts](../../packages/ai/src/metadata.ts#L2077)（`chat` 在 L2079-2080、`agent-console` 在 L2623-2624、`data-grid` 在 L2377-2378） |
| 与任何 AI 运行时/协议无关：无 transport、无 store、无 controller                                                                                  | 全包 grep 无 `fetch`/`seq`/`approval`                                                                                                    |

### 4.2 决策

| 对象                                              | 决策                                                     | 理由                                                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 整个包                                            | **保留**（与 V2 无关系）                                 | 它是"给 AI 编码助手读的组件元数据"，不是 AI UI 运行时；V2 的 `ai-core` 与之语义不同                                   |
| 把 V2 API 提前写进 `aiMetadata`                   | **明确不做**                                             | V2 API 全是 Proposal（`design-source/README.md`）；提前写进元数据会让 AI 编码助手生成**不存在的 API**，等于制造幻觉源 |
| `advancedComponents` 中 chat / agent-console 条目 | **保留但标注 legacy**（建议动作，需与包维护者确认）      | 它们仍在发布；但应在提示词中避免引导新项目采用 V1 容器模型（对应本文 §7 黑名单）                                      |
| 包名                                              | **保留现有 `@zeus-web/ai`**，V2 用 `@zeus-web/ai-*` 前缀 | 命名相近但语义不同；`01` §4 已提示"包名为规划名，发布前检查 npm 可用性"。风险点见下                                   |

### 4.3 风险与后续动作

- **命名混淆风险（中）**：`@zeus-web/ai`（元数据）与 `@zeus-web/ai-core`（V2 领域层）在 npm 上相邻，用户/AI 都容易误取。动作：V2 发布时在 README 与包描述里明确分工；`@zeus-web/ai` 增加一行"本包不是 AI UI 运行时"的说明。
- **提示词漂移风险（中）**：V2 的 Primitive 命名（`AiComposer` 等）若最终定稿，需要在 M5（AI2-510）统一补进元数据，而不是现在预写。

---

## 5. `packages/headless`（`@zeus-web/headless@0.1.0-beta.34`）

### 5.1 代码事实

- 单文件 [index.ts](../../packages/headless/src/index.ts)：24 个 `import '@zeus-web/<primitive>/wc/auto'`（L11-L34）+ 各 primitive 的 `Element` 类型再导出（L36-L147）。
- 无任何 AI 相关代码。

### 5.2 决策

| 对象                                          | 决策                                                    | 理由                                                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 整个包                                        | **保留**；**不进入 V2 依赖路径**                        | V2 的 `ai-wc` 依赖的是 `ai-core` + `ai-primitives` + Zeus WC Runtime（`01` §4 职责表），不是 general-purpose primitive 聚合包                      |
| "聚合入口 + 按组件 auto entry"的发布形态      | **抽取能力（模式）**                                    | `01` §16 要求"WC 包将注册置于显式客户端入口，避免顶层读 `HTMLElement`"；`ai-wc` 应采用同样的按需注册 + 聚合入口双形态（AI2-503「单组件按需注册」） |
| 其依赖的 primitive 包（button/input/dialog…） | **可作为 `ai-primitives` 的下游实现参考，但不构成依赖** | `ai-primitives` 必须框架无关（`01` §4）；WC 具体实现属 `ai-wc`                                                                                     |

---

## 6. `packages/advanced/data-grid`（AI 相关部分）

### 6.1 代码事实

- `grep -rn -i "ai\b|agent|assistant" packages/advanced/data-grid/src` → **零命中**：包内没有 AI 代码。
- 与 AI 的关联只有两处：
  1. `@zeus-web/ai` 的元数据把它列为"生成结构化表格时优先使用"的 advanced 组件（[metadata.ts](../../packages/ai/src/metadata.ts#L2377-L2378)、L2507 提示词）；
  2. 它的渲染器适配器与 V2 的 `ContentRenderer` 契约**同构**（`mount/update/dispose` + 稳定 key）：[cell-renderer-adapter.ts](../../packages/advanced/data-grid/src/core/cell-renderer-adapter.ts#L16-L56)；以及 host 生命周期桥接：[host-adapter.ts](../../packages/advanced/data-grid/src/components/host-adapter.ts#L12-L22)。

### 6.2 决策

| 对象                                                                        | 决策                               | 理由                                                                                                                                                       |
| --------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 整个包进入 V2 依赖                                                          | **不做**                           | 与 `01` §4 职责表冲突：`ai-core`/`ai-primitives` 禁依赖 UI 框架/重组件；表格渲染属可选 Renderer                                                            |
| 作为 `AiArtifactPreview` 的 table/structured 内容渲染方案                   | **可选 Renderer 插件（按需加载）** | `01` §12 的 Renderer 插件体系；`01` §9.3 明确不把重型渲染器塞进核心包                                                                                      |
| `DataGridCellRenderer`（mount/update/dispose）                              | **只借鉴模式，不复用代码**         | 容器所有权不同（grid 拥有 cell 容器，Renderer Registry 由宿主提供容器），`TNode` 语义不同（ReactNode/VNode/DOM）；直接复用会把 grid 的数据模型拖进 AI 契约 |
| `host-adapter.ts` 的 connect/disconnect + `clear`（可重连，不永久 dispose） | **借鉴语义**给 `ai-wc` 的生命周期  | 与 `01` §16「WC 断开连接时清理但不销毁 host 事实」一致；仍以 Zeus WC 生命周期为准                                                                          |
| `@zeus-web/ai` 中"生成表格优先用 data-grid"的提示词                         | **在 V2 语境需改写**               | AI 内容表格应由 `AiArtifactPreview` + table renderer 渲染；直接让 AI 生成 `zw-data-grid` 会绕过 Renderer 安全边界与领域契约                                |

---

## 7. 示例页面：`examples/advanced-showcase`

### 7.1 `ChatPage.tsx` 代码事实

| 事实                                                                                      | 证据                                                                              |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 用 `chat.componentOnReady()` 后 `setMessages(chatMessages)` 注入数据                      | [ChatPage.tsx](../../examples/advanced-showcase/src/pages/ChatPage.tsx#L34-L44)   |
| 提交走 `chatRef.current?.emitSend(input.value, event.nativeEvent)`，然后手动清空 textarea | [ChatPage.tsx](../../examples/advanced-showcase/src/pages/ChatPage.tsx#L72-L80)   |
| Markdown/表格/代码块由页面手写解析（`startsWith('```')` 与 `\|` 判断），不是包的渲染能力  | [ChatPage.tsx](../../examples/advanced-showcase/src/pages/ChatPage.tsx#L82-L176)  |
| 复制用 `navigator.clipboard` 直接写                                                       | [ChatPage.tsx](../../examples/advanced-showcase/src/pages/ChatPage.tsx#L52-L70)   |
| 消息 DOM 由 React 在 `slot="thread"` 内自行渲染                                           | [ChatPage.tsx](../../examples/advanced-showcase/src/pages/ChatPage.tsx#L183-L247) |

### 7.2 `AgentConsolePage.tsx` 代码事实

| 事实                                                                                                                                                   | 证据                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 直接给 WC 属性赋值：`el.messages = …; el.toolCalls = …; el.status = 'idle'`                                                                            | [AgentConsolePage.tsx](../../examples/advanced-showcase/src/pages/AgentConsolePage.tsx#L40-L45)  |
| 监听 `agent-event` / `status-change` / `artifact-select` 自定义事件                                                                                    | [AgentConsolePage.tsx](../../examples/advanced-showcase/src/pages/AgentConsolePage.tsx#L76-L78)  |
| 页面按钮直接调用命令式方法（`appendMessage` / `startToolCall` / `finishToolCall` / `addArtifact` / `addDiagnostic` / `setStatus` / `reset`）驱动状态机 | [AgentConsolePage.tsx](../../examples/advanced-showcase/src/pages/AgentConsolePage.tsx#L87-L144) |
| 无 Provider、无网络、无审批、无 Execution 概念                                                                                                         | 全文件（含 grep 无 `fetch`）                                                                     |

### 7.3 决策

| 对象                                                                                    | 决策                            | 理由                                                                                                                                                     |
| --------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ChatPage                                                                                | **不复用**（含其手写 Markdown） | 手写解析属示例内实现，不是包能力；V2 需要 Renderer Registry（AI2-209/504）与 `AiMessageContent`。页面结构与"Slot 组合"思路可作参考，但不作为 API 基线    |
| AgentConsolePage                                                                        | **不复用**                      | 直接属性注入 + 命令式驱动，正是 V2 要禁止的"UI 直接改事实"（`01` §3.3）；V2 的 Agent 示例必须由 Mock Host + Controller 驱动（AI2-307）                   |
| 现有示例整体                                                                            | **保留**（演示 V1），**不改造** | 改造会让 V1 示例耦合 V2 提案；V2 另建 `examples/ai-conversation` / `ai-agent-workbench` / `ai-coding-review` / `ai-embedded-copilot`（`01` §4 拟议目录） |
| 示例源码断言测试模式（`showcase-source.spec.ts` 用字符串断言约束源码，如禁止 `fetch(`） | **抽取能力（模式）**            | 可作为 V2 示例的"反例门禁"：断言示例源码中不出现 `fetch(`、不出现 provider SDK、不出现直接属性注入                                                       |

---

## 8. 汇总表

| 模块                             | 决策                           | 可抽取物                                                                                       | 前置条件                                                 |
| -------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `@zeus-web/chat`                 | **不复用 API / 组件模型**      | `stream-buffer`（UI 调度）、`shouldSubmitFromKeyboardEvent`（IME）、虚拟化算法、代码块复制语义 | 终态 flush + cancel 测试；可变高度/锚点测试              |
| `@zeus-web/agent-console`        | **不复用 state / 协议 / 组件** | mock & replay 的"可回放 + cancel"**思路**                                                      | 重写为带 `seq`/`cursor`/`getSnapshot` 的 `AiHostAdapter` |
| `@zeus-web/ai`                   | **保留**（与 V2 无关）         | —（不抽取）                                                                                    | 禁止预写 V2 API；补"非 AI 运行时"说明                    |
| `@zeus-web/headless`             | **保留**；不进 V2 依赖         | 聚合入口 + 按组件 auto entry 的**注册形态**                                                    | 需保持客户端显式注册                                     |
| `@zeus-web/data-grid`（AI 相关） | **不依赖**；可选 Renderer 插件 | `mount/update/dispose` 生命周期**模式**                                                        | 容器所有权与 `TNode` 语义重定义                          |
| `examples/advanced-showcase`     | **不复用**；V2 另建示例        | 源码断言门禁**模式**                                                                           | 断言不得出现直接属性注入 / `fetch(`                      |

---

## 9. V1 API 黑名单（V2 中不得出现）

> 依据 AI2-002 验收标准"**不存在默认沿用 V1 API**"。任何 PR 引入下列形状即视为回归。

| 黑名单项                                                                      | 来源                                                                                                                                                                                | 为什么禁止                               |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `ChatElement.setMessages / appendMessage / updateMessage / appendMessagePart` | [chat.tsx](../../packages/advanced/chat/src/components/chat.tsx#L26-L44)                                                                                                            | UI 直接写事实，绕过 Command/Ack          |
| `ChatMessagePart` 中的 `tool-call` / `artifact` 成员                          | [types.ts](../../packages/advanced/chat/src/types.ts#L32-L54)                                                                                                                       | 万能 Message，违反 ADR-001 D1            |
| `ChatThreadVirtualizer` 公开类型（`ChatThreadVirtualSnapshot` 等）            | [types.ts](../../packages/advanced/chat/src/types.ts#L157-L182)                                                                                                                     | 虚拟化是实现细节，不应成为跨包契约       |
| `AgentConsoleState`（五数组）                                                 | [types.ts](../../packages/advanced/agent-console/src/types.ts#L100-L108)                                                                                                            | 非规范化 Store，全量克隆                 |
| `AgentProviderEvent` / `AgentProviderAdapter`                                 | [provider/types.ts](../../packages/advanced/agent-console/src/provider/types.ts#L25-L44)                                                                                            | 无 `seq`/版本/命令/审批，无法 replay     |
| 客户端自增 ID（`createAgentConsoleId`）                                       | [id.ts](../../packages/advanced/agent-console/src/core/id.ts#L1-L6)                                                                                                                 | 实体 ID 必须权威来源                     |
| `maxEvents` 静默截断历史                                                      | [event-log-model.ts](../../packages/advanced/agent-console/src/core/event-log-model.ts#L46-L56)                                                                                     | 与"缺口可诊断"冲突                       |
| 提交即清空草稿 + `trim()` 原文                                                | [chat-composer.tsx](../../packages/advanced/chat/src/components/chat-composer.tsx#L67-L80)                                                                                          | 违反 `02` B1                             |
| 无条件滚底（无 follow 策略）                                                  | [chat.tsx](../../packages/advanced/chat/src/components/chat.tsx#L76-L80)                                                                                                            | 违反 `02` B3                             |
| 用 `Date.now()` 作为事件/消息的权威顺序                                       | [message-model.ts](../../packages/advanced/chat/src/core/message-model.ts#L34-L45)、[event-log-model.ts](../../packages/advanced/agent-console/src/core/event-log-model.ts#L14-L16) | 违反 `01` §7.1（顺序只来自服务端 `seq`） |

---

## 10. 抽取能力清单（extract，带验收条件）

| #   | 抽取物                                    | 落点（提案）                                        | 验收条件                                                                 |
| --- | ----------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| E1  | `stream-buffer`（RAF 批处理）             | `ai-primitives` 内部 scheduler 或 `ai-testing` 工具 | 终态 flush 同步；cancel 不清掉已确认内容；切换会话不泄漏（AI2-204）      |
| E2  | `shouldSubmitFromKeyboardEvent`           | `ai-primitives` 键盘 intent 工具                    | IME 组合、Shift/Ctrl/Meta 组合、`defaultPrevented` 全覆盖（AI2-206/207） |
| E3  | 虚拟化算法（`@zeus-web/virtual`）         | `ai-primitives` 的 Timeline 实现细节                | 可变高度测量 + 焦点 pin + 锚点恢复（AI2-205）                            |
| E4  | mock / replay 的"可回放 + cancel"思路     | `ai-testing` + `ai-adapters`                        | 同事件流重放得到同一 Canonical State（AI2-110）                          |
| E5  | 聚合入口 + auto entry 注册形态            | `ai-wc`                                             | 单组件按需注册；disconnect 清理（AI2-503）                               |
| E6  | `mount/update/dispose` 渲染器生命周期模式 | `ai-primitives` 的 Renderer Registry                | 容器所有权明确；`dispose` 幂等（AI2-209）                                |
| E7  | 示例源码断言门禁                          | V2 示例的测试                                       | 禁止直接属性注入 / `fetch(` / provider SDK                               |

---

## 11. 时间点与任务映射

| 动作                                  | 里程碑             | 任务                       |
| ------------------------------------- | ------------------ | -------------------------- |
| 抽 E1/E2/E3                           | M2                 | AI2-204、AI2-206、AI2-205  |
| 抽 E4                                 | M1                 | AI2-110                    |
| 抽 E5/E6                              | M5/M2              | AI2-503、AI2-209           |
| 抽 E7                                 | M2/M5              | AI2-211、AI2-510           |
| legacy-to-v2 数据 Adapter（可选）     | M5（P2）           | AI2-511                    |
| `@zeus-web/ai` 增加"非 AI 运行时"说明 | 与 V2 首次发布同批 | 未单列任务，建议随 AI2-510 |

---

## 12. 未确认 / 需要后续决策

1. **`@zeus-web/chat` / `@zeus-web/agent-console` 的最终归宿**：`01` §19 只说"可以保留为 legacy 包"，未给弃用时间表。本文件按"保留、不改、不承诺"处理，是否有 EOL 计划需要产品决策。
2. **`stream-buffer` 的抽取方式**：整文件移动 vs 在 V2 内重写。倾向重写（V1 无 e2e 覆盖、且 composer runtime 的 spec 未接入脚本），但需要一个"行为等价"测试证明没有回退。
3. **`@zeus-web/ai` 的元数据是否要走 deprecation 标注**：涉及已发布包的文案变更，需包维护者确认，不宜由 V2 文档单方面决定。
4. **data-grid 作为 Renderer 插件的形态**：是复用一个通用 table renderer，还是允许宿主直接注册 `zw-data-grid`。倾向后者需加"容器由宿主提供、不暴露 grid 命令式 API"的约束，需 M2/M5 定。
5. **示例目录命名**：`01` §4 给的是 `examples/ai-conversation` 等四个目录，与现有 `examples/advanced-showcase` 平级；是否并入现有 showcase 路由（如 `/ai/*`）未定。
