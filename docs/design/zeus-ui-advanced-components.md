# Zeus-UI Advanced Components

## Status

Final design contract for `packages/advanced/*`.

This document defines the design, package boundaries and roadmap for Zeus Web advanced components: virtual scrolling, AI chat, high-performance data grid, RevoGrid adapter and agent console.

## Goals

Advanced components should make Zeus Web usable for product-level UI, not just small primitives.

They must support:

- High performance with large data or high-frequency updates.
- Native Web Component usage without React or Vue.
- Thin React and Vue wrappers.
- Headless-first behavior and accessibility contracts.
- Styled product output through registry templates and `@zeus-web/ui` entries.
- AI-friendly metadata and examples.

## Non-goals

Advanced components must not:

- Depend on React or Vue for their core behavior.
- Store API keys or bind to a specific AI provider.
- Make the default implementation framework-only.
- Reflect large object or array props as attributes.
- Render unbounded DOM for large lists, tables or chat threads.
- Put final product styles inside the headless package.

## Workspace layout

```txt
packages/advanced/
  virtual/        @zeus-web/virtual
  chat/           @zeus-web/chat
  revogrid/       @zeus-web/revogrid
  data-grid/      @zeus-web/data-grid
  agent-console/  @zeus-web/agent-console
```

`packages/advanced/*` is a first-class workspace next to `packages/primitives/*`.

```txt
packages/primitives/*
  Small headless primitives: button, input, dialog, tabs, switch.

packages/advanced/*
  Product-level components: virtual, chat, data-grid, agent-console.
```

## Layering model

Every advanced component has four layers.

```txt
Headless advanced package
  -> @zeus-web/chat
  -> owns state, behavior, events, slots, methods and a11y

Registry source template
  -> zweb add chat
  -> React / Vue editable styled source

Native styled UI entry
  -> @zeus-web/ui/chat
  -> styled Web Components for no-framework usage

AI metadata
  -> @zeus-web/ai
  -> usage rules, examples, props, events and anti-patterns
```

The same rule applies to data grid and future agent console packages.

## Package output contract

Each advanced package should eventually expose:

```txt
@zeus-web/<name>
@zeus-web/<name>/wc
@zeus-web/<name>/wc/auto
@zeus-web/<name>/react
@zeus-web/<name>/vue
@zeus-web/<name>/custom-elements.json
@zeus-web/<name>/zeus.components.json
```

Advanced packages should not be added to aggregate packages by default. Large or optional packages such as `data-grid`, `revogrid` and `agent-console` should remain explicit imports.

## Internal package structure

```txt
packages/advanced/<name>/
  package.json
  src/
    index.ts
    types.ts
    core/
      Framework-agnostic engines.
    components/
      Zeus defineElement Web Components.
  __tests__/
```

The `core` layer should avoid React, Vue and final product style ownership. The `components` layer adapts the core engine to Web Component props, properties, events, slots and exposed methods.

## Cross-framework contract

Web Components are the primary runtime target.

React and Vue wrappers should only adapt:

- props to properties,
- custom events to framework callbacks,
- slots to children or named slots,
- refs to the underlying HTMLElement.

Wrappers must not own the advanced component state machine.

Large inputs must be set as properties:

```txt
messages
columns
rows
attachments
plugins
renderers
```

Only small scalar state should reflect to attributes:

```txt
disabled
loading
readonly
virtual
size
variant
```

## Shared performance rules

Advanced components must follow these rules:

1. Render only visible viewport content plus overscan for large surfaces.
2. Batch high-frequency state and DOM updates with `requestAnimationFrame` or an equivalent scheduler.
3. Use stable keys for rows, messages and cells.
4. Keep DOM nodes stable when possible.
5. Avoid per-cell or per-message heavy event listeners; prefer event delegation.
6. Lazy-load heavy optional features such as markdown, syntax highlighting, export and custom renderers.
7. Avoid full re-render during streaming, scrolling or batch row updates.
8. Provide native, React and Vue showcases for every stable advanced component.

## Styling contract

Headless advanced packages expose styling hooks, not final visual design.

Required styling hooks:

- `data-slot`
- `data-state`
- role-specific attributes such as `data-role`
- state attributes such as `data-selected`, `data-active`, `data-loading`
- `part` names
- CSS variables where a layout or measurement value needs styling control

Final styles live in:

```txt
packages/registry/templates/<framework>/<component>
packages/ui/src/<component>.css
```

## @zeus-web/virtual

### Purpose

`@zeus-web/virtual` is the shared virtual scrolling foundation for advanced components.

It should support:

- Chat message thread virtualization.
- Data grid row and column virtualization.
- Large select / command / log viewer lists.
- Dynamic item measurement.

### Package structure

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

### Components

```txt
<zw-virtual-list>
<zw-virtual-grid>
```

### Roadmap

```txt
Phase V0
  Fixed-size list virtualization.
  range-change event.
  scrollToIndex and scrollToOffset methods.

Phase V1
  Dynamic-size list virtualization.
  ResizeObserver measurement.
  Size cache.

Phase V2
  Reverse mode for chat threads.
  Sticky header / footer.

Phase V3
  Two-dimensional virtual grid.
```

## @zeus-web/chat

### Purpose

`@zeus-web/chat` is a ChatGPT-style headless chat component family.

It should provide a high-quality AI chat experience without binding to an AI provider.

The component may reference ChatGPT-style interaction patterns:

- Conversation thread.
- Composer with Enter / Shift+Enter behavior.
- Streaming assistant messages.
- Message actions such as copy, retry, like and dislike.
- Code blocks.
- Attachments.
- Tool call status.
- Artifact / canvas panel.

It must not copy provider internals or include API key / model request logic.

### Components

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

### Message model

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

### Events

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

### Methods

```txt
appendMessage(message)
updateMessage(id, patch)
appendMessagePart(id, part)
clear()
scrollToBottom(options)
```

### Performance requirements

- Streaming chunks must be buffered and flushed at most once per frame.
- Markdown and syntax highlighting should be lazy-loaded.
- Long threads should use `@zeus-web/virtual`.
- Auto-scroll should respect whether the user is already anchored at the bottom.
- Code blocks should support collapsed rendering for large content.

### Product output

```txt
@zeus-web/chat
zweb add chat
@zeus-web/ui/chat
@zeus-web/ai metadata
```

## @zeus-web/data-grid

### Purpose

`@zeus-web/data-grid` is a high-performance headless data grid.

It should take inspiration from AG Grid and RevoGrid:

- AG Grid-style DOM virtualization, row buffer and viewport-only rendering.
- RevoGrid-style Web Component usage, virtual scroll, keyboard support, copy / paste, sticky columns and plugin-minded extension points.

The first implementation must not try to match every AG Grid or RevoGrid feature.

### Package structure

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

### Core types

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

### Events

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

### Methods

```txt
scrollToRow(index)
scrollToColumn(index)
getSelectedRowKeys()
setSelectedRowKeys(keys)
clearSelection()
refresh()
autosizeColumn(key)
```

### P0 capabilities

P0 must include:

- Row virtualization.
- Column virtualization.
- Fixed header.
- Column width.
- Row selection.
- Active cell.
- Keyboard navigation.
- Loading and empty overlays.
- Text cell renderer fast path.
- Native, React and Vue usage.

P0 must not include:

- Tree data.
- Row grouping.
- Pivot.
- Merged cells.
- Formula engine.
- Excel export.
- Full spreadsheet copy / paste.
- Complex cell editor framework.

### Performance requirements

- Render only visible rows and visible columns plus overscan.
- Keep max rendered rows / cells safety limits.
- Use stable `rowKey` for diffing.
- Batch transactions and viewport updates.
- Prefer event delegation for cell events.
- Reuse a single editor overlay instead of mounting one editor per cell.
- Use `role="grid"` and roving tabindex for accessibility.

### Product output

```txt
@zeus-web/data-grid
zweb add data-grid
@zeus-web/ui/data-grid
@zeus-web/ai metadata
```

## @zeus-web/revogrid

### Purpose

`@zeus-web/revogrid` is an adapter package, not the final Zeus data grid.

It should be used to validate:

- Large third-party Web Component interop.
- Object and array property forwarding.
- Custom event bridging.
- React / Vue wrapper behavior with complex components.
- Data grid API learnings before implementing `@zeus-web/data-grid`.

It should not be included in `@zeus-web/ui` by default because it is third-party-backed and has separate dependency / bundle concerns.

## @zeus-web/agent-console

### Purpose

`@zeus-web/agent-console` is the final composition layer for AI Ops, RUM, SQL Agent and observability workflows.

It should compose:

- `@zeus-web/chat`
- `@zeus-web/data-grid`
- tabs
- dialog
- button
- input

### Components

```txt
<zw-agent-console>
<zw-agent-thread>
<zw-agent-tool-call>
<zw-agent-artifact-panel>
<zw-agent-data-preview>
<zw-agent-inspector>
```

It should be built only after Chat and DataGrid are stable.

## Full roadmap

| Phase | Name | Output |
| --- | --- | --- |
| 0 | Advanced workspace contract | `packages/advanced/*` is discovered by workspace, build, checks and release scripts. |
| 1 | Virtual foundation | `@zeus-web/virtual` fixed and dynamic list virtualization. |
| 2 | Chat headless | `@zeus-web/chat` Web Component / React / Vue headless component family. |
| 3 | Chat product | `zweb add chat`, `@zeus-web/ui/chat`, docs, AI metadata and showcases. |
| 4 | RevoGrid adapter | `@zeus-web/revogrid` for large Web Component interop validation. |
| 5 | DataGrid Lite | `@zeus-web/data-grid` row / column virtualization, selection, keyboard navigation. |
| 6 | DataGrid product | `zweb add data-grid`, `@zeus-web/ui/data-grid`, sorting, filtering, resize, pinned columns. |
| 7 | DataGrid advanced | Server row model, tree data, grouping, plugin system and export. |
| 8 | Agent Console | `@zeus-web/agent-console` for AI Ops / RUM / SQL Agent product workflows. |

## Recommended branch plan

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

## Validation checklist

Every stable advanced component should pass:

```txt
pnpm check
pnpm check:exports
pnpm check:build-output
pnpm check:product-contract
pnpm showcase:ci
pnpm docs:check
```

Each component must include at least:

- Unit tests for core engine behavior.
- Web Component behavior tests.
- Native showcase coverage.
- React showcase coverage.
- Vue showcase coverage.
- AI metadata rules.
- Registry template checks when productized.
