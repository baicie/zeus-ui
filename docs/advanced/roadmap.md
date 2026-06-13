## 最终结论

需要做，而且最终方案应该定为：

```txt id="w3q7yr"
packages/advanced/*
  放 Zeus UI 高级组件

高级组件全部 headless-first
  先做结构、状态、交互、性能、可访问性、跨框架协议
  不和视觉主题强绑定

样式与开箱体验由两层补齐
  packages/registry     -> React/Vue 可复制源码组件
  packages/ui           -> 原生 Web Component 自带样式入口
```

你补充的三点我会这样落：

```txt id="47vk7a"
1. 列表 / 表格
   参考 AG Grid 的 DOM virtualisation、row buffer、max rendered rows 思路
   参考 RevoGrid 的 Stencil/Web Component、高性能虚拟表格、Excel-like 交互能力

2. AI Chat
   参考 ChatGPT 网页版的 conversation thread、composer、message actions、code block、attachments、canvas/artifact、agent/tool 状态
   但不复制内部实现，也不绑定 OpenAI provider

3. 高性能 + 无框架 / 跨框架
   Web Component 是第一等产物
   React/Vue wrapper 只是薄适配
   核心 engine 不依赖 React/Vue
```

当前你已经把 `packages/advanced/*` 纳入 workspace，后续高级组件可以直接放这里。 这个目录的职责也已经明确：放 `virtual`、`chat`、`data-grid`、`agent-console` 这类高阶组件，简单基础组件继续放 `packages/primitives/*`。

---

# 1. 最终分层架构

```txt id="71jfke"
packages/advanced/
  virtual/
    @zeus-web/virtual
    高级组件共用虚拟滚动底座

  chat/
    @zeus-web/chat
    ChatGPT-style headless chat 组件族

  data-grid/
    @zeus-web/data-grid
    参考 AG Grid / RevoGrid 的高性能数据表格

  revogrid/
    @zeus-web/revogrid
    可选：RevoGrid adapter，用于验证大型 Web Component 互操作

  agent-console/
    @zeus-web/agent-console
    Chat + DataGrid + ToolCall + Artifact 的组合组件
```

每个 advanced 包都要有三类产物：

```txt id="tw7kag"
@zeus-web/chat/wc
@zeus-web/chat/wc/auto
@zeus-web/chat/react
@zeus-web/chat/vue
```

不建议高级组件默认进入：

```txt id="cmhmlv"
@zeus-web/react
@zeus-web/vue
@zeus-web/headless
```

原因是高级组件体积重、依赖多、使用场景更垂直。建议默认独立安装：

```bash id="f8hxd6"
pnpm add @zeus-web/chat
pnpm add @zeus-web/virtual
pnpm add @zeus-web/data-grid
```

---

# 2. 高级组件产品层输出

每个高级组件最终都有 4 层输出。

## 2.1 Headless Advanced Package

```txt id="0h11ce"
packages/advanced/chat
  @zeus-web/chat
```

职责：

```txt id="80kxko"
结构
状态
事件
方法
slot
a11y
性能策略
跨框架协议
```

不负责：

```txt id="v6zwp9"
固定视觉主题
业务请求模型
OpenAI / Anthropic / DeepSeek 供应商逻辑
业务存储
鉴权 token
```

## 2.2 Registry Source

```txt id="o0lgxz"
packages/registry/templates/react/chat.tsx
packages/registry/templates/vue/chat.vue
```

通过：

```bash id="spc89n"
zweb add chat
```

复制到用户项目。

职责：

```txt id="enjjmc"
给 React/Vue 用户开箱即用的 styled source
可自由改源码
使用 Tailwind token
```

## 2.3 Native Styled UI Entry

```txt id="abq18z"
packages/ui/src/chat.ts
packages/ui/src/chat.css
```

使用：

```ts id="mjo09g"
import '@zeus-web/ui/chat'
```

职责：

```txt id="il9mrq"
无框架用户直接 import 后写 <zw-chat>
自带默认样式
不需要 React/Vue
```

## 2.4 AI Metadata

```txt id="401xjn"
packages/ai/src/metadata.ts
```

职责：

```txt id="76c9vb"
告诉 AI:
  该组件怎么安装
  React/Vue/native 分别怎么用
  哪些 props/events/slots 可用
  哪些模式不能生成
```

---

# 3. 构建策略

现在 advanced 包已经被构建脚本识别为独立类型，`primitive` 和 `advanced` 都走 Zeus 组件构建链路。

因此高级组件不要另起构建系统，直接复用：

```txt id="7vzk90"
@zeus-js/bundler-plugin
@zeus-js/output-wc
@zeus-js/output-react-wrapper
@zeus-js/output-vue-wrapper
@zeus-js/component-dts
```

但高级组件内部可以分两层：

```txt id="5kvm62"
src/core/
  纯 TS engine
  不依赖 DOM
  不依赖 React/Vue
  方便测试

src/components/
  Zeus defineElement Web Components
  调用 core engine
```

例如：

```txt id="trd6ra"
packages/advanced/data-grid/src/
  core/
    grid-engine.ts
    row-model.ts
    column-model.ts
    selection-model.ts
    virtual-ranges.ts

  components/
    data-grid.tsx
    data-grid-cell.tsx
    data-grid-header.tsx

  index.ts
```

这个分层非常关键。否则高级组件会被 DOM / 框架耦合死，后续性能优化很难做。

---

# 4. 高性能总原则

高级组件统一遵守这些性能约束：

```txt id="az82gy"
1. Engine 不依赖框架
2. Web Component 是主产物
3. React/Vue wrapper 不接管核心状态
4. 大数据只渲染 viewport + overscan
5. 高频更新用 requestAnimationFrame 合并
6. object / array props 走 property，不走 attribute reflect
7. 大型功能按需 lazy import
8. markdown / syntax highlight / exporter 这种重功能延迟加载
9. 内部节点稳定复用，避免整棵 DOM replace
10. 所有高级组件必须有 native / React / Vue 三端 showcase
```

AG Grid 的核心性能思想是 DOM virtualisation：只渲染用户可见 viewport 中的行列，滚动时动态插入需要的 DOM 并移除不可见 DOM。([AG Grid][1]) 它还使用 row buffer，默认在可见行前后额外渲染缓冲行，避免慢设备滚动时看到空白。([AG Grid][1]) 这套思想应该成为 Zeus `virtual` 和 `data-grid` 的基础。

RevoGrid 也验证了 Web Component 路线是可行的：它是基于 StencilJS 的 data grid，宣称可高效渲染 1M+ 行、数百万单元格和数千列。([GitHub][2]) 它的 README 也明确提到 virtualization keeps DOM focused on visible viewport，并支持 keyboard、copy/paste、virtual scroll、sorting、filtering、export、pinned/sticky 等能力。([GitHub][2])

---

# 5. `@zeus-web/virtual` 详细设计

## 5.1 定位

`virtual` 是所有高级组件的底座，不是普通 UI 组件。

```txt id="kvx08h"
@zeus-web/virtual
  给 Chat / DataGrid / LogViewer / Select large list 复用
```

## 5.2 包结构

```txt id="8ap2gr"
packages/advanced/virtual/
  package.json
  src/
    index.ts
    core/
      virtualizer.ts
      size-cache.ts
      range.ts
      scheduler.ts
    components/
      virtual-list.tsx
      virtual-grid.tsx
    types.ts
  __tests__/
    virtualizer.spec.ts
    size-cache.spec.ts
    virtual-list.spec.ts
```

## 5.3 核心 API

```ts id="omtm7v"
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

export interface Virtualizer {
  getRange(scrollOffset: number, viewportSize: number): VirtualRange
  getItems(range: VirtualRange): VirtualItem[]
  getTotalSize(): number
  measure(index: number, size: number): void
  scrollToIndex(index: number, align?: 'start' | 'center' | 'end'): number
}
```

## 5.4 Web Component

```html id="rtxqn2"
<zw-virtual-list
  count="100000"
  estimate-size="36"
  overscan="8"
></zw-virtual-list>
```

方法：

```ts id="l7gsgq"
interface VirtualListElement extends HTMLElement {
  scrollToIndex(index: number, align?: 'start' | 'center' | 'end'): void
  scrollToOffset(offset: number): void
  measure(): void
}
```

事件：

```txt id="6axpmv"
range-change
scroll-offset-change
```

## 5.5 性能验收

```txt id="bgb4mb"
固定高度:
  100,000 items
  DOM 节点数量稳定在 visible + overscan

动态高度:
  ResizeObserver 记录 size cache
  滚动时不全量重算

滚动:
  scroll handler passive
  DOM 更新 requestAnimationFrame 合并
```

---

# 6. `@zeus-web/chat` 详细设计

## 6.1 参考对象

AI Chat 部分参考 ChatGPT 网页版的交互体验，而不是内部实现。ChatGPT 官方页面展示了它面向写作、头脑风暴、编辑、代码生成、数据分析、文件上传、Canvas、Agent 等使用场景。([OpenAI][3]) 这些能力对组件设计的启发是：Chat 不只是“消息列表 + 输入框”，还需要承载工具调用、代码块、附件、artifact/canvas、消息操作、流式状态。

## 6.2 定位

```txt id="wpszpn"
@zeus-web/chat
  ChatGPT-style headless chat component family
```

不做：

```txt id="fs5tm2"
不内置 OpenAI 请求
不保存 API Key
不绑定模型
不内置数据库
不直接 dangerouslySetInnerHTML 渲染不可信 markdown
```

只做：

```txt id="omdivo"
消息线程
输入 Composer
流式状态
中断 / 重试 / 重新生成
消息动作
代码块容器
附件容器
Tool Call / Artifact 展示协议
```

## 6.3 包结构

```txt id="kcof8l"
packages/advanced/chat/
  package.json
  src/
    index.ts
    types.ts

    core/
      chat-store.ts
      message-model.ts
      stream-buffer.ts
      composer-state.ts
      scroll-anchor.ts

    components/
      chat.tsx
      chat-thread.tsx
      chat-message.tsx
      chat-composer.tsx
      chat-code-block.tsx
      chat-attachment.tsx
      chat-tool-call.tsx
      chat-artifact.tsx
      chat-typing.tsx

  __tests__/
    chat-store.spec.ts
    stream-buffer.spec.ts
    chat-composer.spec.ts
    chat-thread.spec.ts
```

## 6.4 组件族

```txt id="l55o8t"
<zw-chat>
  根容器，管理布局 slot 和全局状态标记

<zw-chat-thread>
  消息滚动区，后续接 @zeus-web/virtual

<zw-chat-message>
  单条消息，支持 role/status/actions

<zw-chat-composer>
  输入框，支持 Enter 发送、Shift+Enter 换行、IME

<zw-chat-code-block>
  代码块容器，提供 copy/action 事件

<zw-chat-attachment>
  附件展示

<zw-chat-tool-call>
  工具调用状态，pending/running/success/error

<zw-chat-artifact>
  右侧 artifact/canvas 协议容器

<zw-chat-typing>
  assistant typing indicator
```

## 6.5 Message Model

```ts id="h7zeaq"
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

export type ChatMessagePart =
  | ChatMessagePartText
  | ChatMessagePartCode
  | ChatMessagePartToolCall
  | ChatMessagePartArtifact

export interface ChatMessageData {
  id: string
  role: ChatRole
  status?: ChatMessageStatus
  parts: ChatMessagePart[]
  createdAt?: number
  metadata?: Record<string, unknown>
}
```

这里不要只用 `content: string`，否则后面 tool call、artifact、code block 都会变成 hack。可以兼容简单写法：

```ts id="73rbn9"
content?: string
parts?: ChatMessagePart[]
```

内部统一 normalize 成 `parts`。

## 6.6 Events

```ts id="pllrjb"
export interface ChatSendDetail {
  value: string
  attachments?: ChatAttachmentData[]
  nativeEvent: Event | KeyboardEvent
}

export interface ChatAbortDetail {
  messageId?: string
  reason?: string
}

export interface ChatRegenerateDetail {
  messageId: string
}

export interface ChatMessageActionDetail {
  messageId: string
  action: 'copy' | 'like' | 'dislike' | 'retry' | 'delete'
}

export interface ChatArtifactOpenDetail {
  artifactId: string
  messageId: string
}
```

事件名：

```txt id="046pz7"
send
abort
regenerate
message-action
artifact-open
value-change
attachment-add
attachment-remove
```

## 6.7 Methods

```ts id="acnc72"
export interface ChatElement extends HTMLElement {
  appendMessage(message: ChatMessageData): void
  updateMessage(id: string, patch: Partial<ChatMessageData>): void
  appendMessagePart(id: string, part: ChatMessagePart): void
  clear(): void
  scrollToBottom(options?: ScrollIntoViewOptions): void
}

export interface ChatComposerElement extends HTMLElement {
  value?: string
  focus(): void
  clear(): void
}
```

## 6.8 Slots

```txt id="n08nes"
zw-chat:
  header
  sidebar
  thread
  composer
  artifact
  empty
  loading

zw-chat-message:
  avatar
  header
  default
  actions
  footer

zw-chat-composer:
  prefix
  submit
  suffix
  attachments
```

## 6.9 Headless HTML

```html id="dxa2c4"
<zw-chat>
  <zw-chat-thread slot="thread">
    <zw-chat-message role="assistant"> Hello from Zeus. </zw-chat-message>
  </zw-chat-thread>

  <zw-chat-composer
    slot="composer"
    placeholder="Ask anything..."
  ></zw-chat-composer>
</zw-chat>
```

## 6.10 Native 无框架使用

```ts id="m4d61r"
import '@zeus-web/chat/wc/auto'

const chat = document.querySelector('zw-chat')
const composer = document.querySelector('zw-chat-composer')

composer?.addEventListener('send', async event => {
  const { value } = event.detail

  chat?.appendMessage({
    id: crypto.randomUUID(),
    role: 'user',
    parts: [{ type: 'text', text: value }],
  })

  const assistantId = crypto.randomUUID()

  chat?.appendMessage({
    id: assistantId,
    role: 'assistant',
    status: 'streaming',
    parts: [{ type: 'text', text: '' }],
  })

  // 业务层自行接 SSE / fetch stream
})
```

## 6.11 React 使用

```tsx id="i46m1w"
import {
  Chat,
  ChatComposer,
  ChatMessage,
  ChatThread,
} from '@zeus-web/chat/react'

export function Demo() {
  return (
    <Chat>
      <ChatThread slot="thread">
        <ChatMessage role="assistant">Hello from Zeus.</ChatMessage>
      </ChatThread>

      <ChatComposer
        slot="composer"
        placeholder="Ask anything..."
        onSend={event => {
          console.log(event.detail.value)
        }}
      />
    </Chat>
  )
}
```

## 6.12 Chat 性能策略

```txt id="6puj4f"
消息很多:
  thread 接入 @zeus-web/virtual
  默认 200 条以下普通渲染，超过阈值启用 virtual

流式输出:
  stream-buffer 合并 token/chunk
  最多每帧 flush 一次 DOM
  不要每个 token 触发完整 render

Markdown:
  markdown parser lazy import
  代码高亮 lazy import
  streaming 中只解析新增 block
  complete 后再做最终 normalize

代码块:
  大代码块折叠
  copy 按需绑定
  高亮延迟到 idle

附件:
  缩略图懒加载
  大文件只显示 metadata，不把内容塞 props

自动滚动:
  scroll anchor 判断用户是否在底部
  用户手动上滑后不强制拉回底部
  显示 "new messages" affordance
```

---

# 7. `@zeus-web/data-grid` 详细设计

## 7.1 定位

```txt id="kak7cw"
@zeus-web/data-grid
  Headless high-performance data grid
```

不要叫 `table`。`table` 后续可以做普通小数据展示组件；`data-grid` 专门解决大数据、交互、虚拟滚动。

## 7.2 参考 AG Grid / RevoGrid

AG Grid 给出的核心模型是：只把 viewport 可见区域渲染到 DOM，垂直和水平方向分别做 row virtualization 和 column virtualization。([AG Grid][1]) 它还设了 max rendered rows 作为安全措施，避免错误布局导致一次渲染过多 DOM 使浏览器崩溃。([AG Grid][1])

RevoGrid 给出的能力边界更偏 Web Component / spreadsheet：高性能虚拟表格、键盘支持、Excel-like focus、copy/paste、sorting、filtering、export、custom sizes、pinned/sticky、cell template、plugin system 等。([GitHub][2])

Zeus DataGrid 不要第一版追完整 AG Grid / RevoGrid，而是按能力分层。

## 7.3 包结构

```txt id="l7xv0x"
packages/advanced/data-grid/
  package.json
  src/
    index.ts
    types.ts

    core/
      grid-engine.ts
      row-model.ts
      column-model.ts
      cell-model.ts
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

  __tests__/
    grid-engine.spec.ts
    viewport-model.spec.ts
    selection-model.spec.ts
    keyboard.spec.ts
```

## 7.4 Core API

```ts id="3rh106"
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

## 7.5 Events

```txt id="in6bdb"
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

## 7.6 Methods

```ts id="9z7ucy"
export interface DataGridElement extends HTMLElement {
  scrollToRow(index: number): void
  scrollToColumn(index: number): void
  getSelectedRowKeys(): DataGridRowKey[]
  setSelectedRowKeys(keys: DataGridRowKey[]): void
  clearSelection(): void
  refresh(): void
  autosizeColumn(key: string): void
}
```

## 7.7 渲染分层

```txt id="bn37ql"
Root Layer
  zw-data-grid

Header Layer
  column headers
  pinned-left headers
  pinned-right headers

Body Layer
  virtual rows
  virtual columns
  cells

Pinned Layer
  left pinned columns
  right pinned columns
  top pinned rows
  bottom pinned rows

Overlay Layer
  loading
  empty
  error
  context menu
```

## 7.8 第一版能力边界

P0 必须做：

```txt id="uc3mbh"
row virtualization
column virtualization
fixed header
column width
row selection
active cell
keyboard navigation
loading / empty overlay
cell text renderer
native / React / Vue 三端使用
```

P0 不做：

```txt id="l79xaa"
tree data
row grouping
pivot
merged cells
formulas
Excel export
full spreadsheet copy/paste
remote server-side grouping
complex cell editor
```

这些放 P2/P3。

## 7.9 DataGrid 性能策略

```txt id="1v880t"
DOM 数量:
  cells <= visibleRows * visibleColumns + overscan
  默认加 maxRenderedRows / maxRenderedCells 安全阈值

滚动:
  scroll event passive
  requestAnimationFrame 合并 viewport 更新
  transform translate3d 定位虚拟内容

列宽:
  column size cache
  resize 时只更新相关列布局
  不全量重建行

数据更新:
  rowKey 稳定
  transaction update
  按 rowKey diff
  高频更新 batch 到下一帧

单元格:
  纯文本 fast path
  custom renderer lazy path
  大量 cell 不挂载过多独立事件，优先事件委托

编辑:
  editor overlay 单实例复用
  不给每个 cell 常驻 input

可访问性:
  role="grid"
  aria-rowcount
  aria-colcount
  aria-rowindex
  aria-colindex
  roving tabindex
```

## 7.10 Native 无框架使用

```ts id="6ab9pj"
import '@zeus-web/data-grid/wc/auto'

const grid = document.querySelector('zw-data-grid')

grid.columns = [
  { key: 'name', title: 'Name', width: 180 },
  { key: 'status', title: 'Status', width: 120 },
]

grid.rows = [{ id: 1, name: 'Zeus', status: 'active' }]
```

## 7.11 React 使用

```tsx id="iqarrb"
import { DataGrid } from '@zeus-web/data-grid/react'

export function Demo() {
  return (
    <DataGrid
      rowKey="id"
      columns={[
        { key: 'name', title: 'Name', width: 180 },
        { key: 'status', title: 'Status', width: 120 },
      ]}
      rows={rows}
      selectable="multiple"
      onSelectionChange={event => {
        console.log(event.detail.selectedRowKeys)
      }}
    />
  )
}
```

---

# 8. `@zeus-web/revogrid` 适配器

这个不是主线表格，但建议做一个短期验证包。

```txt id="ocg81k"
packages/advanced/revogrid/
  @zeus-web/revogrid
```

目的不是替代 `@zeus-web/data-grid`，而是验证：

```txt id="j0kguf"
Zeus wrapper 是否能稳定传 array/object props
大型第三方 Web Component 是否能在 React/Vue/native 中一致工作
复杂事件桥接是否足够
表格 API 设计可以借鉴哪些点
```

是否进入 `@zeus-web/ui`：

```txt id="s9y64s"
不建议进入
```

原因：

```txt id="bfmjpu"
它是第三方 adapter
不是 Zeus 自研核心 UI
依赖和体积不可控
```

---

# 9. `@zeus-web/agent-console`

这是最终高级组合组件，适合你的 AIOps / RUM / SQL Agent / 可观测平台方向。

```txt id="eyv87s"
packages/advanced/agent-console/
  @zeus-web/agent-console
```

组件：

```txt id="v395o2"
<zw-agent-console>
<zw-agent-thread>
<zw-agent-tool-call>
<zw-agent-artifact-panel>
<zw-agent-data-preview>
<zw-agent-inspector>
```

依赖：

```txt id="ie080r"
@zeus-web/chat
@zeus-web/data-grid
@zeus-web/tabs
@zeus-web/dialog
@zeus-web/button
@zeus-web/input
```

能力：

```txt id="cc63f8"
左侧会话
中间 Chat Thread
右侧 Artifact / Canvas
工具调用 Timeline
表格结果预览
错误详情 Inspector
```

这个应该最后做，因为它依赖 Chat 和 DataGrid 稳定。

---

# 10. 跨框架 / 无框架协议

所有 advanced 包必须遵守同一套组件协议。

## 10.1 Web Component 优先

```ts id="tr980z"
import '@zeus-web/chat/wc/auto'
import '@zeus-web/data-grid/wc/auto'
```

HTML：

```html id="06bb7c"
<zw-chat></zw-chat> <zw-data-grid></zw-data-grid>
```

## 10.2 React/Vue wrapper 不接管状态

React/Vue wrapper 只做：

```txt id="e3s9jg"
props -> properties
events -> callbacks
slots -> children / named slots
ref -> HTMLElement
```

不做：

```txt id="qlg719"
不复制状态
不重写生命周期
不在 wrapper 里实现业务逻辑
不把 DataGrid/Chat 变成 React-only
```

## 10.3 对象 props 只走 property

这些不能 reflect：

```txt id="wx14yv"
messages
columns
rows
attachments
plugins
renderers
```

只允许简单字符串/布尔属性 reflect：

```txt id="5kzu77"
disabled
loading
size
variant
readonly
virtual
```

## 10.4 事件命名

DOM 事件：

```txt id="v0x6cv"
send
value-change
selection-change
active-cell-change
column-resize
```

React props：

```txt id="iupad3"
onSend
onValueChange
onSelectionChange
onActiveCellChange
onColumnResize
```

Vue emits：

```txt id="4w6v9g"
@send
@value-change
@selection-change
```

---

# 11. 样式协议

Headless 层必须提供：

```txt id="hml9wk"
data-slot
part
CSS variables
state data attributes
```

示例：

```html id="37wno3"
<zw-chat data-loading>
  <section data-slot="chat">
    <div data-slot="chat-thread"></div>
    <form data-slot="chat-composer"></form>
  </section>
</zw-chat>
```

Chat 样式入口：

```txt id="d33nsq"
data-slot="chat"
data-slot="chat-thread"
data-slot="chat-message"
data-slot="chat-composer"
data-role="user"
data-role="assistant"
data-status="streaming"
```

DataGrid 样式入口：

```txt id="ljfdrs"
data-slot="data-grid"
data-slot="data-grid-header"
data-slot="data-grid-row"
data-slot="data-grid-cell"
data-pinned="left"
data-selected
data-active
data-loading
```

---

# 12. Registry 设计

## 12.1 Chat registry

```txt id="fq1p3i"
packages/registry/templates/react/chat.tsx
packages/registry/templates/vue/chat.vue
```

registry item：

```json id="0jkwif"
{
  "name": "chat",
  "type": "component",
  "description": "ChatGPT-style chat components built on @zeus-web/chat.",
  "frameworks": ["react", "vue"],
  "dependencies": ["@zeus-web/chat"],
  "registryDependencies": ["cn", "globals", "button", "textarea"],
  "files": [
    {
      "framework": "react",
      "source": "templates/react/chat.tsx",
      "target": "components/ui/chat.tsx"
    },
    {
      "framework": "vue",
      "source": "templates/vue/chat.vue",
      "target": "components/ui/chat.vue"
    }
  ]
}
```

## 12.2 DataGrid registry

```json id="48algn"
{
  "name": "data-grid",
  "type": "component",
  "description": "High-performance virtualized data grid built on @zeus-web/data-grid.",
  "frameworks": ["react", "vue"],
  "dependencies": ["@zeus-web/data-grid"],
  "registryDependencies": ["cn", "globals"],
  "files": [
    {
      "framework": "react",
      "source": "templates/react/data-grid.tsx",
      "target": "components/ui/data-grid.tsx"
    },
    {
      "framework": "vue",
      "source": "templates/vue/data-grid.vue",
      "target": "components/ui/data-grid.vue"
    }
  ]
}
```

---

# 13. `@zeus-web/ui` 设计

## 13.1 Chat UI entry

```ts id="629x08"
// packages/ui/src/chat.ts
import '@zeus-web/chat/wc/auto'
import '@zeus-web/themes/default.css'
import './chat.css'
```

使用：

```ts id="pjq779"
import '@zeus-web/ui/chat'
```

## 13.2 DataGrid UI entry

```ts id="3qtjr5"
// packages/ui/src/data-grid.ts
import '@zeus-web/data-grid/wc/auto'
import '@zeus-web/themes/default.css'
import './data-grid.css'
```

使用：

```ts id="y65xrn"
import '@zeus-web/ui/data-grid'
```

## 13.3 package exports

```json id="9b8bo1"
{
  "exports": {
    "./chat": {
      "types": "./dist/chat.d.ts",
      "import": "./dist/chat.js"
    },
    "./chat.css": {
      "style": "./dist/chat.css"
    },
    "./data-grid": {
      "types": "./dist/data-grid.d.ts",
      "import": "./dist/data-grid.js"
    },
    "./data-grid.css": {
      "style": "./dist/data-grid.css"
    }
  }
}
```

---

# 14. Roadmap

## Phase 0：Product Contract 稳定

目标：

```txt id="8m3gvf"
让 packages/advanced 成为正式一等工作区
明确 advanced 包的构建、检查、发布、文档规则
```

任务：

```txt id="17ucvm"
1. 固化 packages/advanced/* workspace
2. build/check/release 全部识别 advanced
3. 新增 advanced package template
4. 新增 check:advanced-contract
5. docs 写明 primitives vs advanced 的边界
```

验收：

```txt id="9fc5ai"
pnpm check
pnpm check:exports
pnpm check:build-output
pnpm build
```

---

## Phase 1：Virtual Foundation

目标：

```txt id="6p066s"
完成 @zeus-web/virtual
```

任务：

```txt id="e3oi9d"
1. createVirtualizer core
2. fixed-size virtual list
3. dynamic-size size cache
4. range-change 事件
5. scrollToIndex / scrollToOffset
6. React/Vue/native showcase
```

验收：

```txt id="03xtae"
100,000 rows demo
DOM 节点数量稳定
滚动无明显空白
```

---

## Phase 2：Chat Headless

目标：

```txt id="vmmv28"
完成 @zeus-web/chat headless 组件族
```

任务：

```txt id="ypc8v7"
1. zw-chat
2. zw-chat-thread
3. zw-chat-message
4. zw-chat-composer
5. zw-chat-code-block
6. zw-chat-tool-call
7. zw-chat-artifact
8. stream-buffer
9. scroll-anchor
10. IME 发送保护
```

验收：

```txt id="0oj0jj"
native 使用可跑
React 使用可跑
Vue 使用可跑
streaming 不全量重渲染
composer 输入法不误发送
message actions 可用
```

---

## Phase 3：Chat Styled Product

目标：

```txt id="df6j8a"
让 Chat 完成产品闭环
```

任务：

```txt id="i41oxz"
1. registry react chat.tsx
2. registry vue chat.vue
3. @zeus-web/ui/chat
4. @zeus-web/ai metadata
5. docs chat 页面
6. examples chat showcase
```

验收：

```bash id="llzuxn"
zweb add chat
```

以及：

```ts id="a8b5og"
import '@zeus-web/ui/chat'
```

都可用。

---

## Phase 4：RevoGrid Adapter

目标：

```txt id="1u69ct"
用 RevoGrid 验证大型 Web Component / 表格互操作
```

任务：

```txt id="jxc25c"
1. @zeus-web/revogrid
2. columns/source property bridge
3. events bridge
4. React/Vue/native demo
5. 10w rows demo
6. 输出设计复盘文档
```

验收：

```txt id="gssy7l"
array/object props 可稳定传递
wrapper event bridge 可用
大数据 demo 正常
```

---

## Phase 5：DataGrid Lite

目标：

```txt id="3t23z6"
完成 Zeus 自研轻量高性能表格
```

任务：

```txt id="26tylj"
1. grid-engine
2. row model
3. column model
4. row virtualization
5. column virtualization
6. fixed header
7. selection model
8. active cell
9. keyboard navigation
10. loading/empty overlay
```

验收：

```txt id="g8q2ro"
100,000 rows
100 columns
只渲染 viewport + overscan
React/Vue/native 可用
```

---

## Phase 6：DataGrid Product

目标：

```txt id="qv1afe"
让 DataGrid 具备业务项目可用性
```

任务：

```txt id="f4izsi"
1. registry react data-grid.tsx
2. registry vue data-grid.vue
3. @zeus-web/ui/data-grid
4. sorting
5. basic filtering
6. column resize
7. pinned columns
8. copy selected cells
```

验收：

```txt id="ry86kq"
zweb add data-grid 可用
原生 @zeus-web/ui/data-grid 可用
大数据 demo 可用
```

---

## Phase 7：DataGrid Advanced

目标：

```txt id="jypjze"
逐步追 AG Grid / RevoGrid 的高级能力
```

任务：

```txt id="rh0ivv"
1. server row model
2. viewport row model
3. tree data
4. row grouping
5. column grouping
6. cell editor
7. batch update
8. export CSV
9. plugin system
```

不建议在这个阶段之前做：

```txt id="95flny"
pivot
formula
Excel xlsx export
merged cells
full spreadsheet behavior
```

---

## Phase 8：Agent Console

目标：

```txt id="qqzpt2"
做 Zeus 高级组件标杆
```

任务：

```txt id="cbt398"
1. zw-agent-console
2. Chat Thread
3. Tool Call Timeline
4. Artifact Panel
5. DataGrid Result Preview
6. Inspector
7. AI Ops / RUM / SQL Agent showcase
```

验收：

```txt id="ijcyeh"
能作为 AIOps / RUM / SQL Agent 的前端基础组件
```

---

# 15. 分支建议

```txt id="x4ziul"
feat/advanced-contract
feat/advanced-virtual
feat/advanced-chat
feat/advanced-chat-product
feat/advanced-revogrid-adapter
feat/advanced-data-grid-lite
feat/advanced-data-grid-product
feat/advanced-agent-console
```

不要一个 PR 做完所有高级组件。

---

# 16. 最终路线排序

最稳路线是：

```txt id="0ye7vr"
1. advanced contract
2. virtual
3. chat headless
4. chat registry + ui + ai metadata
5. revogrid adapter
6. data-grid lite
7. data-grid product
8. agent-console
```

一句话定版：

```txt id="89akro"
Zeus UI 高级组件走 packages/advanced/*；
全部 headless-first；
Virtual 先打底；
Chat 参考 ChatGPT 网页版做交互标杆；
DataGrid 参考 AG Grid / RevoGrid 做虚拟化和表格能力；
Web Component 是第一等产物，React/Vue 只是薄适配；
样式通过 registry 和 @zeus-web/ui 补齐。
```

[1]: https://www.ag-grid.com/javascript-data-grid/dom-virtualisation/ 'JavaScript Grid: DOM Virtualisation | AG Grid'
[2]: https://github.com/revolist/revogrid 'GitHub - revolist/revogrid: Powerful virtual data table smartsheet with advanced customization. Best features from excel plus incredible  performance  · GitHub'
[3]: https://openai.com/chatgpt/overview/ 'ChatGPT | AI Chatbot to Discover, Learn & Create'
