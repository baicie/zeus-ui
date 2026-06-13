# Zeus UI 高级组件设计与路线图

## 状态

本文档是 `packages/advanced/*` 的最终设计契约。

它定义 Zeus Web 高级组件的设计原则、包边界与路线图，覆盖虚拟滚动、AI Chat、高性能 Data Grid、RevoGrid 适配器与 Agent Console。

## 目标

高级组件的目标是让 Zeus Web 不只适用于小型基础组件，也能支撑产品级复杂界面。

高级组件必须支持：

- 面向大数据量或高频更新场景的高性能实现。
- 不依赖 React 或 Vue 的原生 Web Component 使用方式。
- 轻量 React / Vue wrapper。
- headless-first 的行为、状态与可访问性契约。
- 通过 registry 模板和 `@zeus-web/ui` 入口叠加最终产品样式。
- 对 AI 友好的元数据、示例与使用规则。

## 非目标

高级组件不应该：

- 在核心行为中依赖 React 或 Vue。
- 绑定某个特定 AI 服务商。
- 把默认实现做成 framework-only。
- 把大型对象或数组 props 反射为 attributes。
- 在大型列表、表格、聊天线程中渲染无边界 DOM。
- 把最终产品视觉样式塞进 headless 包。

## 工作区布局

```txt
packages/advanced/
  virtual/        @zeus-web/virtual
  chat/           @zeus-web/chat
  revogrid/       @zeus-web/revogrid
  data-grid/      @zeus-web/data-grid
  agent-console/  @zeus-web/agent-console
```

`packages/advanced/*` 是与 `packages/primitives/*` 平级的一等工作区。

Web Component 是第一等产物。React / Vue wrapper 只能做薄适配层。

```txt
packages/primitives/*
  小型 headless primitives：button、input、dialog、tabs、switch。

packages/advanced/*
  产品级高级组件：virtual、chat、data-grid、agent-console。
```

## 分层模型

每个高级组件都分为四层。

```txt
Headless advanced package
  -> @zeus-web/chat
  -> 负责状态、行为、事件、slots、methods 与 a11y

Registry source template
  -> zweb add chat
  -> React / Vue 可编辑带样式源码

Native styled UI entry
  -> @zeus-web/ui/chat
  -> 面向无框架使用的带样式 Web Components

AI metadata
  -> @zeus-web/ai
  -> 使用规则、示例、props、events 与反模式约束
```

同一规则也适用于 data-grid 以及未来的 agent-console。

## 包输出契约

每个高级组件包最终都应暴露：

```txt
@zeus-web/<name>
@zeus-web/<name>/wc
@zeus-web/<name>/wc/auto
@zeus-web/<name>/react
@zeus-web/<name>/vue
@zeus-web/<name>/custom-elements.json
@zeus-web/<name>/zeus.components.json
```

高级组件默认不加入聚合包。`data-grid`、`revogrid`、`agent-console` 这类大型或可选包应保持显式导入，避免污染轻量聚合包体积。

## 包内部结构

```txt
packages/advanced/<name>/
  package.json
  src/
    index.ts
    types.ts
    core/
      框架无关 engine。
    components/
      Zeus defineElement Web Components。
  __tests__/
```

`core` 层应避免依赖 React、Vue，也不拥有最终产品样式。`components` 层负责把 core engine 适配成 Web Component 的 props、properties、events、slots 与暴露方法。

## 跨框架契约

Web Components 是第一等运行时目标。

React 和 Vue wrapper 只应负责适配：

- props 到 properties，
- custom events 到框架回调，
- slots 到 children 或 named slots，
- refs 到底层 HTMLElement。

wrapper 不能拥有高级组件的状态机。

大型输入必须通过 property 设置：

```txt
messages
columns
rows
attachments
plugins
renderers
```

只有小型标量状态可以反射为 attributes：

```txt
disabled
loading
readonly
virtual
size
variant
```

## 通用性能规则

高级组件必须遵守以下规则：

1. 大型渲染表面只渲染可见 viewport 内容与 overscan。
2. 高频状态与 DOM 更新通过 `requestAnimationFrame` 或等价 scheduler 合并。
3. rows、messages、cells 必须使用稳定 key。
4. 尽量保持 DOM 节点稳定，避免不必要的全量替换。
5. 避免给每个 cell 或 message 挂载重事件监听，优先使用事件委托。
6. Markdown、语法高亮、导出、自定义渲染器等重功能必须懒加载。
7. streaming、scrolling、batch row updates 过程中避免全量重渲染。
8. 每个稳定高级组件都必须提供 native、React、Vue showcase。

## 样式契约

Headless advanced packages 只暴露样式钩子，不拥有最终视觉设计。

必须暴露的样式钩子：

- `data-slot`
- `data-state`
- 角色相关属性，例如 `data-role`
- 状态属性，例如 `data-selected`、`data-active`、`data-loading`
- `part` 名称
- 当布局或测量值需要外部控制时提供 CSS variables

最终样式放在：

```txt
packages/registry/templates/<framework>/<component>
packages/ui/src/<component>.css
```

## @zeus-web/virtual

### 目的

`@zeus-web/virtual` 是高级组件共享的虚拟滚动基础设施。

它应支持：

- Chat message thread 虚拟化。
- Data Grid 行虚拟化与列虚拟化。
- 大型 select / command / log viewer 列表。
- 动态 item 测量。

### 包结构

```txt
packages/advanced/virtual/
  src/
    core/
      virtualizer.ts
      size-cache.ts
      range.ts
      scheduler.ts
    components/
      virtual-list.tsx
      virtual-grid.tsx
```

### Core API

```ts
export interface VirtualRange {
  start: number
  end: number
  overscanStart: number
  overscanEnd: number
}

export interface VirtualItem {
  index: number
  key: string
  start: number
  size: number
  end: number
}

export interface VirtualizerOptions {
  count: number
  estimateSize: number | ((index: number) => number)
  overscan?: number
  horizontal?: boolean
  getItemKey?: (index: number) => string
}
```

### 组件

```txt
<zw-virtual-list>
<zw-virtual-grid>
```

### 路线图

```txt
Phase V0
  固定高度列表虚拟化。
  range-change 事件。
  scrollToIndex 与 scrollToOffset 方法。

Phase V1
  动态高度列表虚拟化。
  ResizeObserver 测量。
  size cache。

Phase V2
  面向 Chat thread 的 reverse mode。
  Sticky header / footer。

Phase V3
  二维 virtual grid。
```

## @zeus-web/chat

### 目的

`@zeus-web/chat` 是一组 ChatGPT 风格的 headless chat 组件族。

它应提供高质量 AI Chat 交互体验，但不绑定任何 AI 服务商。

组件可以参考 ChatGPT 网页版的交互模式：

- Conversation thread。
- Composer 支持 Enter / Shift+Enter 行为。
- Streaming assistant messages。
- Copy、retry、like、dislike 等 message actions。
- Code blocks。
- Attachments。
- Tool call status。
- Artifact / canvas panel。

组件不能复制任何服务商内部实现，也不能包含具体模型请求逻辑。

### 组件

```txt
<zw-chat>
<zw-chat-thread>
<zw-chat-message>
<zw-chat-composer>
<zw-chat-code-block>
<zw-chat-attachment>
<zw-chat-tool-call>
<zw-chat-artifact>
<zw-chat-typing>
```

### 消息模型

```ts
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export type ChatMessageStatus =
  | 'idle'
  | 'streaming'
  | 'complete'
  | 'error'
  | 'aborted'

export interface ChatMessagePartText {
  type: 'text'
  text: string
}

export interface ChatMessagePartCode {
  type: 'code'
  language?: string
  code: string
}

export interface ChatMessagePartToolCall {
  type: 'tool-call'
  id: string
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  input?: unknown
  output?: unknown
  error?: string
}

export interface ChatMessagePartArtifact {
  type: 'artifact'
  id: string
  title?: string
  kind: 'text' | 'code' | 'table' | 'chart' | 'custom'
  data?: unknown
}
```

### 事件

```txt
send
abort
regenerate
message-action
artifact-open
value-change
attachment-add
attachment-remove
```

### 方法

```txt
appendMessage(message)
updateMessage(id, patch)
appendMessagePart(id, part)
clear()
scrollToBottom(options)
```

### 性能要求

- Streaming chunks 必须先进入 buffer，每帧最多 flush 一次。
- Markdown 与语法高亮应懒加载。
- 长线程应使用 `@zeus-web/virtual`。
- 自动滚动必须尊重用户是否停留在底部锚点。
- 大型 code block 应支持折叠渲染。

### 产品化输出

```txt
@zeus-web/chat
zweb add chat
@zeus-web/ui/chat
@zeus-web/ai metadata
```

## @zeus-web/data-grid

### 目的

`@zeus-web/data-grid` 是一个高性能 headless data grid。

它应参考 AG Grid 和 RevoGrid 的设计方向：

- AG Grid 风格的 DOM virtualization、row buffer 与 viewport-only rendering。
- RevoGrid 风格的 Web Component 使用方式、virtual scroll、键盘支持、copy / paste、sticky columns 与面向插件的扩展点。

第一版实现不能试图覆盖 AG Grid 或 RevoGrid 的全部能力。

### 包结构

```txt
packages/advanced/data-grid/
  src/
    core/
      grid-engine.ts
      row-model.ts
      column-model.ts
      selection-model.ts
      focus-model.ts
      sort-model.ts
      filter-model.ts
      viewport-model.ts
      transaction.ts
      plugin.ts
    components/
      data-grid.tsx
      data-grid-header.tsx
      data-grid-row.tsx
      data-grid-cell.tsx
      data-grid-overlay.tsx
```

### 核心类型

```ts
export type DataGridRowKey = string | number

export interface DataGridColumn<T = unknown> {
  key: string
  title: string
  width?: number
  minWidth?: number
  maxWidth?: number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  filterable?: boolean
  resizable?: boolean
  pinned?: 'left' | 'right'
  readonly?: boolean
  data?: T
}

export interface DataGridProps<T = unknown> {
  columns?: DataGridColumn<T>[]
  rows?: T[]
  rowKey?: string | ((row: T, index: number) => DataGridRowKey)
  rowHeight?: number
  headerHeight?: number
  overscanRows?: number
  overscanColumns?: number
  selectable?: boolean | 'single' | 'multiple'
  sortable?: boolean
  filterable?: boolean
  editable?: boolean
  loading?: boolean
  emptyText?: string
  rowModel?: 'client' | 'viewport' | 'server'
}
```

### 事件

```txt
row-click
cell-click
selection-change
active-cell-change
sort-change
filter-change
column-resize
column-order-change
viewport-change
row-request
```

### 方法

```txt
scrollToRow(index)
scrollToColumn(index)
getSelectedRowKeys()
setSelectedRowKeys(keys)
clearSelection()
refresh()
autosizeColumn(key)
```

### P0 能力

P0 必须包含：

- 行虚拟化。
- 列虚拟化。
- 固定表头。
- 列宽。
- 行选择。
- Active cell。
- 键盘导航。
- Loading 与 empty overlay。
- 文本 cell renderer 快路径。
- Native、React、Vue 使用方式。

P0 不包含：

- Tree data。
- Row grouping。
- Pivot。
- Merged cells。
- Formula engine。
- Excel export。
- 完整 spreadsheet 级 copy / paste。
- 复杂 cell editor framework。

### 性能要求

- 只渲染可见 rows、可见 columns 与 overscan。
- 保留 max rendered rows / cells 安全阈值。
- 使用稳定 `rowKey` 做 diff。
- 批量合并 transactions 与 viewport updates。
- cell 事件优先使用事件委托。
- 复用单个 editor overlay，不为每个 cell 常驻 editor。
- 使用 `role="grid"` 与 roving tabindex 支撑可访问性。

### 产品化输出

```txt
@zeus-web/data-grid
zweb add data-grid
@zeus-web/ui/data-grid
@zeus-web/ai metadata
```

## @zeus-web/revogrid

### 目的

`@zeus-web/revogrid` 是一个适配器包，不是 Zeus 最终自研 Data Grid。

它用于验证：

- 大型第三方 Web Component 互操作。
- 对象与数组 property 透传。
- Custom event 桥接。
- React / Vue wrapper 在复杂组件上的行为。
- 在实现 `@zeus-web/data-grid` 前沉淀 Data Grid API 经验。

它默认不应进入 `@zeus-web/ui`，因为它基于第三方包，依赖与 bundle 体积需要单独控制。

## @zeus-web/agent-console

### 目的

`@zeus-web/agent-console` 是面向 AI Ops、RUM、SQL Agent 与可观测工作流的最终组合层。

它应组合：

- `@zeus-web/chat`
- `@zeus-web/data-grid`
- tabs
- dialog
- button
- input

### 组件

```txt
<zw-agent-console>
<zw-agent-thread>
<zw-agent-tool-call>
<zw-agent-artifact-panel>
<zw-agent-data-preview>
<zw-agent-inspector>
```

它只能在 Chat 与 DataGrid 稳定后开始建设。

## 完整路线图

| Phase | 名称                        | 输出                                                                                         |
| ----- | --------------------------- | -------------------------------------------------------------------------------------------- |
| 0     | Advanced workspace contract | `packages/advanced/*` 被 workspace、build、checks、release scripts 识别。                    |
| 1     | Virtual foundation          | `@zeus-web/virtual` 固定高度与动态高度列表虚拟化。                                           |
| 2     | Chat headless               | `@zeus-web/chat` Web Component / React / Vue headless 组件族。                               |
| 3     | Chat product                | `zweb add chat`、`@zeus-web/ui/chat`、docs、AI metadata、showcases。                         |
| 4     | RevoGrid adapter            | `@zeus-web/revogrid`，用于大型 Web Component 互操作验证。                                    |
| 5     | DataGrid Lite               | `@zeus-web/data-grid` 行/列虚拟化、选择、键盘导航。                                          |
| 6     | DataGrid product            | `zweb add data-grid`、`@zeus-web/ui/data-grid`、sorting、filtering、resize、pinned columns。 |
| 7     | DataGrid advanced           | Server row model、tree data、grouping、plugin system、export。                               |
| 8     | Agent Console               | `@zeus-web/agent-console`，面向 AI Ops / RUM / SQL Agent 产品工作流。                        |

## 推荐分支计划

```txt
feat/advanced-contract
feat/advanced-virtual
feat/advanced-chat
feat/advanced-chat-product
feat/advanced-revogrid-adapter
feat/advanced-data-grid-lite
feat/advanced-data-grid-product
feat/advanced-agent-console
```

## 验证清单

每个稳定高级组件都应通过：

```txt
pnpm check
pnpm check:exports
pnpm check:build-output
pnpm check:product-contract
pnpm showcase:ci
pnpm docs:check
```

每个组件至少包含：

- core engine 行为单测。
- Web Component 行为测试。
- Native showcase 覆盖。
- React showcase 覆盖。
- Vue showcase 覆盖。
- AI metadata 规则。
- 产品化后需要 registry template 检查。
