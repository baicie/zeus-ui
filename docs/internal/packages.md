# Zeus 包公共 API

本文件是 Zeus 包公共 API 的唯一权威来源。当前覆盖 `@zeus-web/zeus-compat`、
`@zeus-web/chat`、`@zeus-web/agent-console` 与 `@zeus-web/data-grid`；尚未迁移到本文件的包
继续保持现有发布出口，后续变更公共 API 时必须补充对应章节。

## `@zeus-web/zeus-compat`

状态：`0.1.0-beta.3`，MVP 阶段，不承诺向后兼容。

Zeus 兼容基线：`0.1.1-beta.1`。该包只转发 Zeus 当前公共 API，不暴露 Zeus 内部实现。

入口：

- `@zeus-web/zeus-compat`
- `@zeus-web/zeus-compat/capabilities`

### 根入口 API

响应式值：`createSignal`、`createMemo`、`createEffect`、`createRoot`、`batch`、`onCleanup`。

响应式类型：`Accessor`、`Setter`。

组件与 DOM runtime 值：`For`、`Host`、`Show`、`Slot`、`defineElement`、`render`。

context 值：`createContext`、`inject`、`provide`、`useContext`。

DOM context 值：`provideDOMContext`、`resolveDOMContext`。

capability 值：`ZEUS_CAPABILITIES`、`getMissingZeusCompatRequirements`、
`assertZeusCompatRequirements`。

公共类型：`Component`、`Context`、`ContextBridgeProps`、`ContextProviderProps`、
`DefineElementContext`、`DefineElementMeta`、`DefineElementOptions`、`DefineElementSetup`、
`ForProps`、`HostProps`、`JSXValue`、`ShowProps`、`SlotProps`、`DOMContext`、
`ZeusCapabilities`、`ZeusCompatRequirement`。

```ts
function getMissingZeusCompatRequirements(): ZeusCompatRequirement[]
function assertZeusCompatRequirements(): void
```

### `./capabilities` API

值：`ZEUS_CAPABILITIES`、`getMissingZeusCompatRequirements`、
`assertZeusCompatRequirements`。

类型：`ZeusCapabilities`、`ZeusCompatRequirement`。

```ts
function getMissingZeusCompatRequirements(): ZeusCompatRequirement[]
function assertZeusCompatRequirements(): void
```

历史 alias `computed`、`effect`、`nextTick`、`scope`、`state`、`untrack`、`watch` 已删除，且不提供
兼容转发。

## 所有组件包共享契约

状态：`0.1.0-beta.3`，MVP 阶段，不承诺向后兼容。

本节适用于 `packages/primitives/*` 和 `packages/advanced/*` 的 25 个公开组件包。
每个组件包都必须提供以下入口：

- 包根入口
- `./wc`
- `./wc/auto`
- `./react`
- `./vue`
- `./vue/global`
- `./custom-elements.json`
- `./zeus.components.json`

React 和 Vue 生成入口会分别直接导入
`@zeus-js/output-react-wrapper/runtime` 与
`@zeus-js/output-vue-wrapper/runtime`。因此组件包必须把两个 wrapper 包声明为普通
`dependencies`；消费者只需安装目标 `@zeus-web/*` 组件包和实际使用的框架，不得被要求
手工安装 `@zeus-js/output-*` 实现包。

`react >=18 || >=19` 与 `vue >=3` 是 optional peer dependencies。只使用 Web Component
入口的消费者不需要安装 React 或 Vue。

具名 slot 会映射为 React wrapper prop。组件 prop 与非默认 slot 不得同名，否则生成的
React 类型会产生重复属性，wrapper runtime 也会截获本应传给自定义元素的数据 prop。
存在语义冲突时保留数据 prop，并为 slot 使用独立的 `*Content` 名称。

## `@zeus-web/chat`

状态：`0.1.0-beta.3`，MVP 阶段，不承诺向后兼容。

入口：

- `@zeus-web/chat`
- `@zeus-web/chat/wc`
- `@zeus-web/chat/wc/auto`
- `@zeus-web/chat/react`
- `@zeus-web/chat/vue`
- `@zeus-web/chat/vue/global`
- `@zeus-web/chat/custom-elements.json`
- `@zeus-web/chat/zeus.components.json`

### 根入口 API

组件值：`Chat`、`ChatArtifact`、`ChatCodeBlock`、`ChatComposer`、`ChatMessage`、
`ChatThread`、`ChatToolCall`、`ChatTyping`。

组件类型：`ChatProps`、`ChatElement`、`ChatArtifactProps`、`ChatArtifactElement`、
`ChatCodeBlockProps`、`ChatCodeBlockElement`、`ChatComposerProps`、
`ChatComposerElement`、`ChatMessageProps`、`ChatMessageElement`、`ChatThreadProps`、
`ChatThreadElement`、`ChatToolCallProps`、`ChatToolCallElement`、`ChatTypingProps`、
`ChatTypingElement`。

聊天数据类型：`ChatRole`、`ChatMessageStatus`、`ChatToolCallStatus`、
`ChatArtifactKind`、`ChatMessagePartText`、`ChatMessagePartCode`、
`ChatMessagePartToolCall`、`ChatMessagePartArtifact`、`ChatMessagePart`、
`ChatMessageData`、`NormalizedChatMessageData`、`ChatAttachmentData`、
`ChatSendDetail`、`ChatAbortDetail`、`ChatRegenerateDetail`、`ChatMessageAction`、
`ChatMessageActionDetail`、`ChatArtifactOpenDetail`、`ChatValueChangeDetail`、
`ChatAttachmentChangeDetail`、`ChatCodeBlockAction`、`ChatCodeBlockActionDetail`。

虚拟列表类型：`ChatThreadScrollAlign`、`ChatThreadVirtualRange`、
`ChatThreadVirtualItem`、`ChatThreadVirtualSnapshot`、
`ChatThreadRangeChangeDetail`、`ChatThreadScrollOffsetChangeDetail`、
`ChatThreadVirtualizerOptions`、`ChatThreadVirtualizer`。

状态与流式 API：`ChatStore`、`ChatStoreSnapshot`、`ComposerState`、
`ComposerStateSnapshot`、`StreamBuffer`、`StreamBufferOptions`、`createChatStore`、
`createComposerState`、`createStreamBuffer`、`createChatThreadVirtualizer`、
`normalizeChatMessage`、`normalizeChatMessages`、`patchMessage`、
`appendMessagePart`、`getMessageText`、`hasMessageId`、
`areChatThreadVirtualItemsEqual`、`shouldSubmitFromKeyboardEvent`、
`shouldUpdateChatThreadVirtualSnapshot`。

#### 状态接口

```ts
interface ChatStoreSnapshot {
  messages: NormalizedChatMessageData[]
}
interface ChatStore {
  getSnapshot: () => ChatStoreSnapshot
  getMessages: () => NormalizedChatMessageData[]
  setMessages: (messages: ChatMessageData[]) => NormalizedChatMessageData[]
  appendMessage: (message: ChatMessageData) => NormalizedChatMessageData[]
  updateMessage: (
    id: string,
    patch: Partial<ChatMessageData>,
  ) => NormalizedChatMessageData[]
  appendMessagePart: (
    id: string,
    part: ChatMessagePart,
  ) => NormalizedChatMessageData[]
  clear: () => void
}
interface ComposerStateSnapshot {
  value: string
  attachments: ChatAttachmentData[]
}
interface ComposerState {
  getValue: () => string
  setValue: (value: string) => string
  clearValue: () => void
  getAttachments: () => ChatAttachmentData[]
  setAttachments: (attachments: ChatAttachmentData[]) => ChatAttachmentData[]
  addAttachment: (attachment: ChatAttachmentData) => ChatAttachmentData[]
  removeAttachment: (id: string) => ChatAttachmentData[]
  clearAttachments: () => void
  getSnapshot: () => ComposerStateSnapshot
}
interface StreamBufferOptions {
  onFlush: (value: string) => void
  requestFrame?: ((callback: FrameRequestCallback) => number) | undefined
  cancelFrame?: ((handle: number) => void) | undefined
}
interface StreamBuffer {
  push: (chunk: string) => void
  flush: () => void
  cancel: () => void
  getPendingValue: () => string
  isScheduled: () => boolean
}
```

#### 函数签名

```ts
function createChatStore(initialMessages?: ChatMessageData[]): ChatStore
function createComposerState(
  initialValue?: string,
  initialAttachments?: ChatAttachmentData[],
): ComposerState
function shouldSubmitFromKeyboardEvent(
  event: KeyboardEvent,
  submitOnEnter: boolean,
): boolean
function normalizeChatMessage(
  message: ChatMessageData,
): NormalizedChatMessageData
function normalizeChatMessages(
  messages: ChatMessageData[] | undefined,
): NormalizedChatMessageData[]
function getMessageText(message: NormalizedChatMessageData): string
function appendMessagePart(
  message: NormalizedChatMessageData,
  part: ChatMessagePart,
): NormalizedChatMessageData
function patchMessage(
  message: NormalizedChatMessageData,
  patch: Partial<ChatMessageData>,
): NormalizedChatMessageData
function hasMessageId(
  messages: NormalizedChatMessageData[],
  id: string,
): boolean
function createStreamBuffer(options: StreamBufferOptions): StreamBuffer
function areChatThreadVirtualItemsEqual(
  left: ChatThreadVirtualItem[],
  right: ChatThreadVirtualItem[],
): boolean
function shouldUpdateChatThreadVirtualSnapshot(
  current: ChatThreadVirtualSnapshot,
  next: ChatThreadVirtualSnapshot,
): boolean
function createChatThreadVirtualizer(
  options: ChatThreadVirtualizerOptions,
): ChatThreadVirtualizer
```

下表使用 JavaScript prop 名、DOM event 名和具名 slot 名；`-` 表示该组件没有对应的
公开能力。

### 组件契约

| Web Component        | props                                                                                                            | slots                                                                            | events                                                           | methods                                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zw-chat`            | `autoScroll`, `disabled`, `emptyText`, `loading`, `messages`, `virtual`                                          | `artifact`, `composer`, `empty`, `header`, `loadingContent`, `sidebar`, `thread` | `abort`, `artifact-open`, `message-action`, `regenerate`, `send` | `appendMessage`, `appendMessagePart`, `clear`, `emitAbort`, `emitArtifactOpen`, `emitMessageAction`, `emitRegenerate`, `emitSend`, `getMessages`, `scrollToBottom`, `setMessages`, `updateMessage` |
| `zw-chat-thread`     | `ariaLabel`, `count`, `empty`, `estimateSize`, `loading`, `overscan`, `virtual`                                  | `default`                                                                        | `range-change`, `scroll-offset-change`                           | `getItems`, `getRange`, `getTotalSize`, `measure`, `resetMeasurements`, `scrollToBottom`, `scrollToIndex`, `scrollToOffset`                                                                        |
| `zw-chat-message`    | `interactive`, `messageId`, `role`, `selected`, `status`                                                         | `actions`, `avatar`, `default`, `footer`, `header`                               | `message-action`                                                 | `emitAction`                                                                                                                                                                                       |
| `zw-chat-composer`   | `ariaLabel`, `defaultValue`, `disabled`, `loading`, `maxLength`, `placeholder`, `rows`, `submitOnEnter`, `value` | `attachments`, `prefix`, `submit`, `suffix`                                      | `attachment-change`, `send`, `value-change`                      | `clear`, `focus`, `submit`                                                                                                                                                                         |
| `zw-chat-code-block` | `copied`, `filename`, `language`                                                                                 | `actions`, `default`, `filenameContent`, `languageContent`                       | `code-action`                                                    | `emitAction`                                                                                                                                                                                       |
| `zw-chat-tool-call`  | `name`, `open`, `status`, `toolId`                                                                               | `actions`, `error`, `input`, `output`, `summary`                                 | -                                                                | -                                                                                                                                                                                                  |
| `zw-chat-artifact`   | `artifactId`, `kind`, `open`, `title`                                                                            | `actions`, `default`, `footer`, `header`                                         | `artifact-open`                                                  | `openArtifact`                                                                                                                                                                                     |
| `zw-chat-typing`     | `active`, `text`                                                                                                 | `default`                                                                        | -                                                                | -                                                                                                                                                                                                  |

## `@zeus-web/agent-console`

状态：`0.1.0-beta.3`，MVP 阶段，不承诺向后兼容。

入口：

- `@zeus-web/agent-console`
- `@zeus-web/agent-console/wc`
- `@zeus-web/agent-console/wc/auto`
- `@zeus-web/agent-console/react`
- `@zeus-web/agent-console/vue`
- `@zeus-web/agent-console/vue/global`
- `@zeus-web/agent-console/custom-elements.json`
- `@zeus-web/agent-console/zeus.components.json`

### 根入口 API

组件值和组件类型：`AgentConsole`、`AgentConsoleProps`、`AgentConsoleElement`。

控制台数据类型：`AgentConsoleRole`、`AgentConsoleStatus`、
`AgentConsoleMessageStatus`、`AgentConsoleToolCallStatus`、
`AgentConsoleArtifactKind`、`AgentConsoleDiagnosticLevel`、
`AgentConsoleEventType`、`AgentConsoleMetadata`、`AgentConsoleMessage`、
`AgentConsoleToolCall`、`AgentConsoleArtifact`、`AgentConsoleDiagnostic`、
`AgentConsoleEvent`、`AgentConsoleState`、`AgentConsoleAppendMessageInput`、
`AgentConsoleUpdateMessageInput`、`AgentConsoleStartToolCallInput`、
`AgentConsoleFinishToolCallInput`、`AgentConsoleAddArtifactInput`、
`AgentConsoleAddDiagnosticInput`、`AgentConsoleSnapshotOptions`、
`AgentConsoleEventDetail`、`AgentConsoleStatusChangeDetail`、
`AgentConsoleArtifactSelectDetail`、`AgentConsoleResetDetail`、
`CreateAgentConsoleEventInput`。

状态与模型 API：`createEmptyAgentConsoleState`、`cloneAgentConsoleState`、
`resetAgentConsoleState`、`setAgentConsoleStatus`、
`appendMessageToAgentConsoleState`、`updateMessageInAgentConsoleState`、
`startToolCallInAgentConsoleState`、`finishToolCallInAgentConsoleState`、
`addArtifactToAgentConsoleState`、`addDiagnosticToAgentConsoleState`、
`selectAgentConsoleArtifact`、`createAgentConsoleMessage`、
`appendAgentConsoleMessage`、`updateAgentConsoleMessage`、
`getAgentConsoleMessageById`、`createAgentConsoleToolCall`、
`startAgentConsoleToolCall`、`finishAgentConsoleToolCall`、
`getAgentConsoleToolCallById`、`createAgentConsoleArtifact`、
`addAgentConsoleArtifact`、`getAgentConsoleArtifactById`、
`removeAgentConsoleArtifactById`、`createAgentConsoleDiagnostic`、
`addAgentConsoleDiagnostic`、`getAgentConsoleDiagnosticById`、
`getAgentConsoleDiagnosticsByLevel`、`createAgentConsoleEvent`、
`appendAgentConsoleEvent`、`filterAgentConsoleEventsByType`、
`getLatestAgentConsoleEvent`、`getLatestAgentConsoleMessage`、
`getLatestAgentConsoleToolCall`、`getLatestAgentConsoleArtifact`、
`getLatestAgentConsoleDiagnostic`、`createAgentConsoleId`、
`normalizeAgentConsoleId`、`resetAgentConsoleIdCounter`。

Provider API：`AgentProviderEventType`、`AgentProviderEvent`、
`AgentProviderRequest`、`AgentProviderRun`、`AgentProviderAdapter`、
`CreateMockAgentProviderOptions`、`createMockAgentProvider`、
`createReplayAgentProvider`。

#### 状态与 Provider 接口

```ts
interface AgentConsoleState {
  status: AgentConsoleStatus
  messages: AgentConsoleMessage[]
  toolCalls: AgentConsoleToolCall[]
  artifacts: AgentConsoleArtifact[]
  diagnostics: AgentConsoleDiagnostic[]
  events: AgentConsoleEvent[]
  selectedArtifactId?: string | undefined
}
interface AgentProviderRequest {
  input: string
  messages?: AgentConsoleMessage[] | undefined
  metadata?: Record<string, unknown> | undefined
}
interface AgentProviderEvent {
  type: AgentProviderEventType
  message?: AgentConsoleMessage | undefined
  delta?: string | undefined
  toolCall?: AgentConsoleToolCall | undefined
  artifact?: AgentConsoleArtifact | undefined
  diagnostic?: AgentConsoleDiagnostic | undefined
  status?: 'idle' | 'running' | 'waiting' | 'complete' | 'error' | undefined
  error?: string | undefined
  metadata?: Record<string, unknown> | undefined
}
interface AgentProviderRun {
  events: AsyncIterable<AgentProviderEvent>
  cancel: () => void
}
interface AgentProviderAdapter {
  name: string
  run: (request: AgentProviderRequest) => AgentProviderRun
}
interface CreateMockAgentProviderOptions {
  name?: string | undefined
  events?: AgentProviderEvent[] | undefined
}
```

#### 函数签名

```ts
function createAgentConsoleArtifact(
  input: AgentConsoleAddArtifactInput,
): AgentConsoleArtifact
function addAgentConsoleArtifact(
  artifacts: AgentConsoleArtifact[],
  input: AgentConsoleAddArtifactInput,
): AgentConsoleArtifact[]
function getAgentConsoleArtifactById(
  artifacts: AgentConsoleArtifact[],
  id: string,
): AgentConsoleArtifact | undefined
function removeAgentConsoleArtifactById(
  artifacts: AgentConsoleArtifact[],
  id: string,
): AgentConsoleArtifact[]
function createEmptyAgentConsoleState(
  status?: AgentConsoleStatus,
): AgentConsoleState
function cloneAgentConsoleState(
  state: AgentConsoleState,
  options?: AgentConsoleSnapshotOptions,
): AgentConsoleState
function resetAgentConsoleState(
  status?: AgentConsoleStatus,
  maxEvents?: number,
): AgentConsoleState
function setAgentConsoleStatus(
  state: AgentConsoleState,
  status: AgentConsoleStatus,
  maxEvents?: number,
): AgentConsoleState
function appendMessageToAgentConsoleState(
  state: AgentConsoleState,
  input: AgentConsoleAppendMessageInput,
  maxEvents?: number,
): AgentConsoleState
function updateMessageInAgentConsoleState(
  state: AgentConsoleState,
  input: AgentConsoleUpdateMessageInput,
  maxEvents?: number,
): AgentConsoleState
function startToolCallInAgentConsoleState(
  state: AgentConsoleState,
  input: AgentConsoleStartToolCallInput,
  maxEvents?: number,
): AgentConsoleState
function finishToolCallInAgentConsoleState(
  state: AgentConsoleState,
  input: AgentConsoleFinishToolCallInput,
  maxEvents?: number,
): AgentConsoleState
function addArtifactToAgentConsoleState(
  state: AgentConsoleState,
  input: AgentConsoleAddArtifactInput,
  maxEvents?: number,
): AgentConsoleState
function selectAgentConsoleArtifact(
  state: AgentConsoleState,
  artifactId: string | undefined,
): AgentConsoleState
function addDiagnosticToAgentConsoleState(
  state: AgentConsoleState,
  input: AgentConsoleAddDiagnosticInput,
  maxEvents?: number,
): AgentConsoleState
function getLatestAgentConsoleMessage(
  state: AgentConsoleState,
): AgentConsoleMessage | undefined
function getLatestAgentConsoleToolCall(
  state: AgentConsoleState,
): AgentConsoleToolCall | undefined
function getLatestAgentConsoleArtifact(
  state: AgentConsoleState,
): AgentConsoleArtifact | undefined
function getLatestAgentConsoleDiagnostic(
  state: AgentConsoleState,
): AgentConsoleDiagnostic | undefined
function getLatestAgentConsoleEvent(
  state: AgentConsoleState,
): AgentConsoleEvent | undefined
function createAgentConsoleDiagnostic(
  input: AgentConsoleAddDiagnosticInput,
): AgentConsoleDiagnostic
function addAgentConsoleDiagnostic(
  diagnostics: AgentConsoleDiagnostic[],
  input: AgentConsoleAddDiagnosticInput,
): AgentConsoleDiagnostic[]
function getAgentConsoleDiagnosticById(
  diagnostics: AgentConsoleDiagnostic[],
  id: string,
): AgentConsoleDiagnostic | undefined
function getAgentConsoleDiagnosticsByLevel(
  diagnostics: AgentConsoleDiagnostic[],
  level: AgentConsoleDiagnostic['level'],
): AgentConsoleDiagnostic[]
function createAgentConsoleEvent(
  input: CreateAgentConsoleEventInput,
): AgentConsoleEvent
function appendAgentConsoleEvent(
  events: AgentConsoleEvent[],
  input: CreateAgentConsoleEventInput,
  maxEvents?: number,
): AgentConsoleEvent[]
function filterAgentConsoleEventsByType(
  events: AgentConsoleEvent[],
  type: AgentConsoleEventType,
): AgentConsoleEvent[]
function createAgentConsoleId(prefix?: string): string
function resetAgentConsoleIdCounter(): void
function normalizeAgentConsoleId(
  value: string | undefined,
  prefix?: string,
): string
function createAgentConsoleMessage(
  input: AgentConsoleAppendMessageInput,
): AgentConsoleMessage
function appendAgentConsoleMessage(
  messages: AgentConsoleMessage[],
  input: AgentConsoleAppendMessageInput,
): AgentConsoleMessage[]
function updateAgentConsoleMessage(
  messages: AgentConsoleMessage[],
  input: AgentConsoleUpdateMessageInput,
): AgentConsoleMessage[]
function getAgentConsoleMessageById(
  messages: AgentConsoleMessage[],
  id: string,
): AgentConsoleMessage | undefined
function createAgentConsoleToolCall(
  input: AgentConsoleStartToolCallInput,
): AgentConsoleToolCall
function startAgentConsoleToolCall(
  toolCalls: AgentConsoleToolCall[],
  input: AgentConsoleStartToolCallInput,
): AgentConsoleToolCall[]
function finishAgentConsoleToolCall(
  toolCalls: AgentConsoleToolCall[],
  input: AgentConsoleFinishToolCallInput,
): AgentConsoleToolCall[]
function getAgentConsoleToolCallById(
  toolCalls: AgentConsoleToolCall[],
  id: string,
): AgentConsoleToolCall | undefined
function createMockAgentProvider(
  options?: CreateMockAgentProviderOptions,
): AgentProviderAdapter
function createReplayAgentProvider(
  name: string,
  events: AgentProviderEvent[],
): AgentProviderAdapter
```

### 组件契约

| Web Component      | props                                                                                                         | slots                                                         | events                                                     | methods                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zw-agent-console` | `ariaLabel`, `artifacts`, `diagnostics`, `maxEvents`, `messages`, `selectedArtifactId`, `status`, `toolCalls` | `artifactsContent`, `diagnosticsContent`, `timeline`, `tools` | `agent-event`, `artifact-select`, `reset`, `status-change` | `addArtifact`, `addDiagnostic`, `appendMessage`, `finishToolCall`, `getEvents`, `getState`, `reset`, `selectArtifact`, `setStatus`, `startToolCall`, `updateMessage` |

## `@zeus-web/data-grid`

状态：`0.1.0-beta.3`，MVP 阶段，不承诺向后兼容。

入口：

- `@zeus-web/data-grid`
- `@zeus-web/data-grid/wc`
- `@zeus-web/data-grid/wc/auto`
- `@zeus-web/data-grid/react`
- `@zeus-web/data-grid/vue`

Web Component 标签：`zw-data-grid`。

### 组件属性

| 属性                 | 类型                               | 默认值   | 说明                   |
| -------------------- | ---------------------------------- | -------- | ---------------------- |
| `rows`               | `DataGridRowData[]`                | `[]`     | 客户端行数据           |
| `columns`            | `DataGridColumn[]`                 | `[]`     | 列定义                 |
| `rowHeight`          | `number`                           | `40`     | 固定估算行高           |
| `overscan`           | `number`                           | `4`      | 行窗口前后额外渲染数量 |
| `overscanColumns`    | `number`                           | `2`      | 列窗口前后额外渲染数量 |
| `virtual`            | `boolean`                          | `false`  | 同时启用行、列虚拟化   |
| `selectionMode`      | `'none' \| 'single' \| 'multiple'` | `'none'` | 行选择模式             |
| `selectedKeys`       | `DataGridRowKey[]`                 | `[]`     | 受控选择键             |
| `sortColumn`         | `string`                           | -        | 受控排序列             |
| `sortDirection`      | `'asc' \| 'desc'`                  | -        | 受控排序方向           |
| `ariaLabel`          | `string`                           | -        | Grid 可访问名称        |
| `resizable`          | `boolean`                          | `false`  | 启用列宽调整           |
| `keyboardNavigation` | `boolean`                          | `true`   | 启用单元格键盘导航     |
| `activeRowKey`       | `DataGridRowKey`                   | -        | 受控活动行             |
| `activeColumnId`     | `string`                           | -        | 受控活动列             |
| `diagnostics`        | `DataGridDiagnostics`              | -        | 可选性能诊断回调       |

`rows`、`columns` 与 `selectedKeys` 使用 shallow reactivity。读取这些 property 会保留调用方传入数组的
referential identity，Zeus 不会为数组或其中的对象创建 deep proxy。替换顶层数组引用会触发更新；直接修改
`rows[index]`、row/column 字段，或对 `selectedKeys` 执行 `push` / `splice`，不会触发响应式刷新。调用方必须
采用 replace-on-write，或通过 `setRows(nextRows)`、`setColumns(nextColumns)` / `setSelection(keys)` 提交
新的状态。

`diagnostics` 仅作为 DOM property 使用，不映射 attribute。未配置回调时 Data Grid 不读取诊断时钟，也不创建
DOM mutation observer。配置后可按需接收两类只读样本：

```ts
interface DataGridDiagnostics {
  onModelBuild?(sample: Readonly<DataGridModelBuildTiming>): void
  onCommit?(sample: Readonly<DataGridCommitTiming>): void
}
```

`onModelBuild` 报告 model version、row/column 总量、可见列数量、sort state 是否启用以及是否直接复用
row model。
`onCommit` 报告 input、handler、range calculation、layout read 与 DOM commit 的单调时间点、当前二维 range
以及本次 commit 在 Data Grid header/body 渲染区插入或移除的 DOM 子树节点数。观察区间在每次 commit
开始时重置，不包含 empty slot 等外部投影变化。节点 churn 不等同于 Zeus effect 创建或释放数量。
若延迟完成的 data commit 已完成 DOM reconciliation，Data Grid 会在后续同步调用开始前先生成独立
sample，避免后一次调用的 timing 覆盖前一次 DOM churn。若多次调用仍处于同一个外层 reactive batch，
DOM 尚未提交，则它们会合并为一个 sample，并保留全部 layout read 区间、最新二维 range 和累计 DOM
churn。

### 组件方法

行窗口方法：

```ts
getRange(): DataGridVirtualRange
getItems(): DataGridVirtualItem[]
getTotalSize(): number
scrollToIndex(index: number, align?: VirtualScrollAlign): void
scrollToOffset(offset: number): void
measure(index?: number, size?: number): void
resetMeasurements(): void
```

列窗口方法：

```ts
getColumnRange(): DataGridColumnVirtualRange
getColumnItems(): DataGridColumnVirtualItem[]
getTotalColumnSize(): number
scrollToColumn(index: number, align?: VirtualScrollAlign): void
```

数据、状态与交互方法：

```ts
setRows(rows: DataGridRowData[]): void
setColumns(columns: DataGridColumn[]): void
getRows(): DataGridRow[]
getColumns(): NormalizedDataGridColumn[]
getVisibleRows(): DataGridRow[]
getSelection(): DataGridSelectionState
setSelection(keys: DataGridRowKey[]): void
clearSelection(): void
toggleRowSelection(key: DataGridRowKey): void
setSort(columnId: string, direction?: DataGridSortDirection, nativeEvent?: Event): void
clearSort(): void
getSort(): DataGridSortState | undefined
resizeColumn(columnId: string, width: number, nativeEvent?: Event): void
resetColumnWidths(): void
getColumnWidths(): Record<string, number>
setActiveCell(rowKey: DataGridRowKey, columnId: string, nativeEvent?: Event): void
getActiveCell(): DataGridActiveCell | undefined
moveActiveCell(key: DataGridNavigationKey, nativeEvent?: Event): void
focusCell(rowKey: DataGridRowKey, columnId: string): void
focusActiveCell(): void
refreshViewport(): void
```

### 事件与插槽

事件：`range-change`、`scroll-offset-change`、`viewport-resize`、
`selection-change`、`sort-change`、`row-action`、`cell-action`、
`column-resize-start`、`column-resize`、`column-resize-end`、
`active-cell-change`。

`range-change` 保持原有纵向语义，只报告行窗口。横向窗口变化会触发重渲染，消费者通过
`getColumnRange()` 和 `getColumnItems()` 读取当前列窗口。

唯一公开插槽是 `empty`。

### 二维虚拟化契约

- `virtual=false` 时渲染全部行和全部可见列。
- `virtual=true` 时渲染行窗口与列窗口的笛卡尔积。
- 列偏移使用前缀宽度表与二分查找，范围查询为 `O(log n)`。
- 真实 `clientWidth` 不可用时使用 `640px` fallback，避免宽表首帧完整渲染。
- DOM 单元格数量受 viewport 与 overscan 控制，不随总行列数线性增长。
- `aria-colindex`、active cell 和键盘导航始终使用可见列集合中的真实索引。

### 列虚拟化内核

```ts
createDataGridColumnVirtualizer(options: {
  columns: NormalizedDataGridColumn[]
  overscan?: number
}): DataGridColumnVirtualizer

interface DataGridColumnVirtualizer {
  getSnapshot(scrollOffset: number, viewportSize: number): DataGridColumnVirtualSnapshot
  getRange(scrollOffset: number, viewportSize: number): DataGridColumnVirtualRange
  getItems(range: DataGridColumnVirtualRange): DataGridColumnVirtualItem[]
  getTotalSize(): number
  getOffsetForIndex(
    index: number,
    align?: VirtualScrollAlign,
    viewportSize?: number,
  ): number
}
```

相关公共类型：`DataGridColumnVirtualRange`、`DataGridColumnVirtualItem`、
`DataGridColumnVirtualSnapshot`、`DataGridColumnVirtualizerOptions`、
`DataGridColumnVirtualizer`。
