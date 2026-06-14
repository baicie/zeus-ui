下面给出 **Phase 4：Chat Virtual Thread Integration** 的详细设计与完整代码，包含完整单元测试。

依据当前实现，`zw-chat-thread` 目前只有 `count / loading / empty / virtual / ariaLabel` 等 props，`virtual` 只是渲染成 `data-virtual`，组件实际只暴露 `scrollToBottom()`，没有 range、items、scrollToIndex 等虚拟线程能力。 而 `@zeus-web/virtual` 已经提供 `VirtualRange`、`VirtualItem`、`Virtualizer`、`getRange()`、`getItems()`、`getOffsetForIndex()`、`measure()` 等 core 能力，可以直接复用。

---

# 1. Phase 4 目标

```txt id="s958fb"
Phase 4: Chat Virtual Thread Integration

目标:
  1. @zeus-web/chat 依赖 @zeus-web/virtual
  2. zw-chat-thread 的 virtual 属性变成真实能力
  3. zw-chat-thread 支持 range-change / scroll-offset-change
  4. zw-chat-thread 暴露 getRange / getItems / getTotalSize / scrollToIndex / scrollToOffset / measure / resetMeasurements
  5. 保持 headless，不直接拥有 message renderer
  6. 单元测试覆盖 core virtual thread 与组件协议
```

---

# 2. 范围与非目标

## 本阶段做

```txt id="ndjnxh"
packages/advanced/chat/src/core/thread-virtualizer.ts
packages/advanced/chat/src/components/chat-thread.tsx
packages/advanced/chat/src/types.ts
packages/advanced/chat/src/core/index.ts
packages/advanced/chat/package.json
packages/advanced/chat/__tests__/thread-virtualizer.spec.ts
packages/advanced/chat/__tests__/chat-thread-virtual.spec.ts
docs/advanced/design/phase4.md
```

## 本阶段不做

```txt id="ce4jjl"
1. 不在 zw-chat-thread 内部直接渲染消息列表
2. 不做动态高度完整优化
3. 不做 reverse chat list
4. 不做 markdown/highlight
5. 不接模型服务
6. 不做 provider transport
7. 不改 registry styled templates
```

---

# 3. 设计原则

## 3.1 为什么不直接渲染 message

`zw-chat-thread` 继续保持 headless：

```txt id="39mjau"
它负责:
  - 滚动容器
  - 总高度 spacer
  - range 计算
  - items 计算
  - range-change 事件
  - scrollToIndex / scrollToOffset 方法

它不负责:
  - 根据 messages 自动生成 zw-chat-message
  - markdown 渲染
  - 代码高亮
  - 模型请求
```

上层可以通过：

```txt id="y4cmcn"
range-change
getItems()
getRange()
```

拿到可见区数据后自行渲染。

## 3.2 为什么消费 `@zeus-web/virtual`

因为 `@zeus-web/virtual` 已经有固定高度 range 计算、overscan、offset 对齐、测量和重置逻辑。`createVirtualizer()` 当前已经完成 `getRange()`、`getItems()`、`getTotalSize()`、`getOffsetForIndex()` 等能力。

---

# 4. 文件清单

```txt id="5d8u9d"
修改:
  packages/advanced/chat/package.json
  packages/advanced/chat/src/types.ts
  packages/advanced/chat/src/core/index.ts
  packages/advanced/chat/src/components/chat-thread.tsx

新增:
  packages/advanced/chat/src/core/thread-virtualizer.ts
  packages/advanced/chat/__tests__/thread-virtualizer.spec.ts
  packages/advanced/chat/__tests__/chat-thread-virtual.spec.ts
  docs/advanced/design/phase4.md
```

---

# 5. 完整代码

## 5.1 替换 `packages/advanced/chat/package.json`

```json id="tpdt6b"
{
  "name": "@zeus-web/chat",
  "type": "module",
  "version": "0.0.0",
  "description": "Headless ChatGPT-style chat advanced components for Zeus Web.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/baicie/zeus-ui.git",
    "directory": "packages/advanced/chat"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "sideEffects": ["./dist/wc/index.js", "./dist/wc/*.js", "./dist/**/*.css"],
  "exports": {
    ".": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./wc": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./wc/auto": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/auto.js"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "import": "./dist/react/index.js"
    },
    "./vue": {
      "types": "./dist/vue/index.d.ts",
      "import": "./dist/vue/index.js"
    },
    "./vue/global": {
      "types": "./dist/vue/global.d.ts"
    },
    "./custom-elements.json": {
      "default": "./dist/custom-elements.json"
    },
    "./zeus.components.json": {
      "default": "./dist/zeus.components.json"
    }
  },
  "files": ["dist"],
  "scripts": {
    "dev": "rolldown -c ../../../rolldown.config.ts --watch",
    "build": "rimraf dist && rolldown -c ../../../rolldown.config.ts",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../../.. --project unit packages/advanced/chat/__tests__/message-model.spec.ts packages/advanced/chat/__tests__/chat-store.spec.ts packages/advanced/chat/__tests__/composer-state.spec.ts packages/advanced/chat/__tests__/stream-buffer.spec.ts packages/advanced/chat/__tests__/thread-virtualizer.spec.ts packages/advanced/chat/__tests__/chat-components.spec.ts packages/advanced/chat/__tests__/chat-thread-virtual.spec.ts"
  },
  "peerDependencies": {
    "@zeus-js/zeus": ">=0.1.0-beta.5 <0.2.0",
    "react": ">=18 || >=19",
    "vue": ">=3"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    },
    "vue": {
      "optional": true
    }
  },
  "dependencies": {
    "@zeus-js/runtime-dom": "0.1.0-beta.5",
    "@zeus-js/web-c-runtime": "0.2.0",
    "@zeus-web/virtual": "workspace:*",
    "@zeus-web/zeus-compat": "workspace:*"
  }
}
```

---

## 5.2 替换 `packages/advanced/chat/src/types.ts`

```ts id="j7n8hu"
import type {
  VirtualItem,
  VirtualRange,
  VirtualScrollAlign,
} from '@zeus-web/virtual'

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export type ChatMessageStatus =
  | 'idle'
  | 'streaming'
  | 'complete'
  | 'error'
  | 'aborted'

export type ChatToolCallStatus = 'pending' | 'running' | 'success' | 'error'

export type ChatArtifactKind = 'text' | 'code' | 'table' | 'chart' | 'custom'

export interface ChatMessagePartText {
  type: 'text'
  text: string
}

export interface ChatMessagePartCode {
  type: 'code'
  code: string
  language?: string
  filename?: string
}

export interface ChatMessagePartToolCall {
  type: 'tool-call'
  id: string
  name: string
  status: ChatToolCallStatus
  input?: unknown
  output?: unknown
  error?: string
}

export interface ChatMessagePartArtifact {
  type: 'artifact'
  id: string
  kind: ChatArtifactKind
  title?: string
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
  content?: string
  parts?: ChatMessagePart[]
  createdAt?: number
  metadata?: Record<string, unknown>
}

export interface NormalizedChatMessageData {
  id: string
  role: ChatRole
  status: ChatMessageStatus
  parts: ChatMessagePart[]
  createdAt: number
  metadata?: Record<string, unknown>
}

export interface ChatAttachmentData {
  id: string
  name: string
  type?: string
  size?: number
  url?: string
  metadata?: Record<string, unknown>
}

export interface ChatSendDetail {
  value: string
  attachments: ChatAttachmentData[]
  nativeEvent: Event | KeyboardEvent
}

export interface ChatAbortDetail {
  messageId?: string
  reason?: string
}

export interface ChatRegenerateDetail {
  messageId: string
}

export type ChatMessageAction = 'copy' | 'like' | 'dislike' | 'retry' | 'delete'

export interface ChatMessageActionDetail {
  messageId: string
  action: ChatMessageAction
  nativeEvent?: Event
}

export interface ChatArtifactOpenDetail {
  artifactId: string
  messageId?: string
  nativeEvent?: Event
}

export interface ChatValueChangeDetail {
  value: string
  nativeEvent: Event
}

export interface ChatAttachmentChangeDetail {
  attachments: ChatAttachmentData[]
  nativeEvent?: Event
}

export type ChatCodeBlockAction = 'copy'

export interface ChatCodeBlockActionDetail {
  action: ChatCodeBlockAction
  language?: string
  filename?: string
  nativeEvent?: Event
}

export type ChatThreadScrollAlign = VirtualScrollAlign

export type ChatThreadVirtualRange = VirtualRange

export type ChatThreadVirtualItem = VirtualItem<NormalizedChatMessageData>

export interface ChatThreadVirtualSnapshot {
  range: ChatThreadVirtualRange
  items: ChatThreadVirtualItem[]
  totalSize: number
}

export interface ChatThreadRangeChangeDetail {
  range: ChatThreadVirtualRange
  items: ChatThreadVirtualItem[]
  scrollOffset: number
  viewportSize: number
  totalSize: number
}

export interface ChatThreadScrollOffsetChangeDetail {
  offset: number
  nativeEvent: Event
}

export interface ChatThreadVirtualizerOptions {
  count: number
  estimateSize: number
  overscan?: number
  getItemKey?: (index: number) => string
}

export interface ChatThreadVirtualizer {
  getSnapshot: (
    scrollOffset: number,
    viewportSize: number,
  ) => ChatThreadVirtualSnapshot
  getRange: (
    scrollOffset: number,
    viewportSize: number,
  ) => ChatThreadVirtualRange
  getItems: (range: ChatThreadVirtualRange) => ChatThreadVirtualItem[]
  getTotalSize: () => number
  getOffsetForIndex: (
    index: number,
    align?: ChatThreadScrollAlign,
    viewportSize?: number,
  ) => number
  measure: (index: number, size: number) => void
  resetMeasurements: () => void
}

export type { ChatProps, ChatElement } from './components/chat'

export type {
  ChatArtifactProps,
  ChatArtifactElement,
} from './components/chat-artifact'

export type {
  ChatCodeBlockProps,
  ChatCodeBlockElement,
} from './components/chat-code-block'

export type {
  ChatComposerProps,
  ChatComposerElement,
} from './components/chat-composer'

export type {
  ChatMessageProps,
  ChatMessageElement,
} from './components/chat-message'

export type {
  ChatThreadProps,
  ChatThreadElement,
} from './components/chat-thread'

export type {
  ChatToolCallProps,
  ChatToolCallElement,
} from './components/chat-tool-call'

export type {
  ChatTypingProps,
  ChatTypingElement,
} from './components/chat-typing'
```

---

## 5.3 新增 `packages/advanced/chat/src/core/thread-virtualizer.ts`

```ts id="kzc1pi"
import { createEmptyVirtualRange, createVirtualizer } from '@zeus-web/virtual'

import type {
  ChatThreadScrollAlign,
  ChatThreadVirtualItem,
  ChatThreadVirtualizer,
  ChatThreadVirtualizerOptions,
  ChatThreadVirtualRange,
  ChatThreadVirtualSnapshot,
} from '../types'

function normalizeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

function normalizeEstimateSize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 64
  return value
}

function normalizeOverscan(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value < 0) return 4
  return Math.floor(value)
}

function defaultItemKey(index: number): string {
  return String(index)
}

export function createChatThreadVirtualizer(
  options: ChatThreadVirtualizerOptions,
): ChatThreadVirtualizer {
  const virtualizer = createVirtualizer({
    count: normalizeCount(options.count),
    estimateSize: normalizeEstimateSize(options.estimateSize),
    overscan: normalizeOverscan(options.overscan),
    getItemKey: options.getItemKey ?? defaultItemKey,
  })

  function getRange(
    scrollOffset: number,
    viewportSize: number,
  ): ChatThreadVirtualRange {
    return virtualizer.getRange(scrollOffset, viewportSize)
  }

  function getItems(range: ChatThreadVirtualRange): ChatThreadVirtualItem[] {
    return virtualizer.getItems(range) as ChatThreadVirtualItem[]
  }

  function getTotalSize(): number {
    return virtualizer.getTotalSize()
  }

  function getSnapshot(
    scrollOffset: number,
    viewportSize: number,
  ): ChatThreadVirtualSnapshot {
    const range =
      viewportSize > 0
        ? getRange(scrollOffset, viewportSize)
        : createEmptyVirtualRange()
    const items = getItems(range)

    return {
      range,
      items,
      totalSize: getTotalSize(),
    }
  }

  function getOffsetForIndex(
    index: number,
    align: ChatThreadScrollAlign = 'start',
    viewportSize = 0,
  ): number {
    return virtualizer.getOffsetForIndex(index, {
      align,
      viewportSize,
    })
  }

  return {
    getSnapshot,
    getRange,
    getItems,
    getTotalSize,
    getOffsetForIndex,

    measure(index: number, size: number): void {
      virtualizer.measure(index, size)
    },

    resetMeasurements(): void {
      virtualizer.resetMeasurements()
    },
  }
}
```

---

## 5.4 替换 `packages/advanced/chat/src/core/index.ts`

```ts id="za0n9t"
export * from './chat-store'
export * from './composer-state'
export * from './message-model'
export * from './stream-buffer'
export * from './thread-virtualizer'
```

---

## 5.5 替换 `packages/advanced/chat/src/components/chat-thread.tsx`

```tsx id="jce1z2"
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'
import {
  areVirtualRangesEqual,
  createEmptyVirtualRange,
  createRafScheduler,
} from '@zeus-web/virtual'

import type {
  ChatThreadRangeChangeDetail,
  ChatThreadScrollAlign,
  ChatThreadScrollOffsetChangeDetail,
  ChatThreadVirtualItem,
  ChatThreadVirtualizer,
  ChatThreadVirtualRange,
} from '../types'
import { createChatThreadVirtualizer } from '../core'

export interface ChatThreadProps {
  count?: number
  loading?: boolean
  empty?: boolean
  virtual?: boolean
  estimateSize?: number
  overscan?: number
  ariaLabel?: string
}

export interface ChatThreadElement extends HTMLElement {
  scrollToBottom: (options?: ScrollIntoViewOptions) => void
  getRange: () => ChatThreadVirtualRange
  getItems: () => ChatThreadVirtualItem[]
  getTotalSize: () => number
  scrollToIndex: (index: number, align?: ChatThreadScrollAlign) => void
  scrollToOffset: (offset: number) => void
  measure: (index?: number, size?: number) => void
  resetMeasurements: () => void
}

interface ChatThreadEmits extends Record<string, EventDefinition<unknown>> {
  rangeChange: EventDefinition<ChatThreadRangeChangeDetail>
  scrollOffsetChange: EventDefinition<ChatThreadScrollOffsetChangeDetail>
}

function resolveCount(props: ChatThreadProps): number {
  if (!Number.isFinite(props.count ?? 0) || (props.count ?? 0) <= 0) return 0
  return Math.floor(props.count ?? 0)
}

function resolveEstimateSize(props: ChatThreadProps): number {
  const size = props.estimateSize ?? 64

  if (!Number.isFinite(size) || size <= 0) return 64

  return size
}

function resolveOverscan(props: ChatThreadProps): number {
  const overscan = props.overscan ?? 4

  if (!Number.isFinite(overscan) || overscan < 0) return 4

  return Math.floor(overscan)
}

function createThreadVirtualizer(
  props: ChatThreadProps,
): ChatThreadVirtualizer {
  return createChatThreadVirtualizer({
    count: resolveCount(props),
    estimateSize: resolveEstimateSize(props),
    overscan: resolveOverscan(props),
  })
}

function getScrollOffset(viewport: HTMLElement | undefined): number {
  return viewport?.scrollTop ?? 0
}

function getViewportSize(viewport: HTMLElement | undefined): number {
  return viewport?.clientHeight ?? 0
}

function setScrollOffset(
  viewport: HTMLElement | undefined,
  offset: number,
): void {
  if (!viewport) return

  viewport.scrollTop = Math.max(0, offset)
}

function getVirtualizerSignature(props: ChatThreadProps): string {
  return [
    resolveCount(props),
    resolveEstimateSize(props),
    resolveOverscan(props),
  ].join(':')
}

function setup(
  props: ChatThreadProps,
  ctx: DefineElementContext<ChatThreadElement, ChatThreadEmits>,
) {
  let viewport: HTMLElement | undefined
  let virtualizer = createThreadVirtualizer(props)
  let signature = getVirtualizerSignature(props)
  let currentRange: ChatThreadVirtualRange = createEmptyVirtualRange()
  let currentItems: ChatThreadVirtualItem[] = []
  const scheduler = createRafScheduler()

  const refreshVirtualizer = (): void => {
    const nextSignature = getVirtualizerSignature(props)

    if (nextSignature === signature) return

    signature = nextSignature
    virtualizer = createThreadVirtualizer(props)
    currentRange = createEmptyVirtualRange()
    currentItems = []
  }

  const updateRange = (nativeEvent?: Event): void => {
    refreshVirtualizer()

    if (!props.virtual) {
      currentRange = createEmptyVirtualRange()
      currentItems = []
      return
    }

    const scrollOffset = getScrollOffset(viewport)
    const viewportSize = getViewportSize(viewport)
    const snapshot = virtualizer.getSnapshot(scrollOffset, viewportSize)
    const nextRange = snapshot.range
    const nextItems = snapshot.items

    if (!areVirtualRangesEqual(currentRange, nextRange)) {
      currentRange = nextRange
      currentItems = nextItems

      ctx.emit.rangeChange({
        range: currentRange,
        items: currentItems,
        scrollOffset,
        viewportSize,
        totalSize: snapshot.totalSize,
      })
    }

    if (nativeEvent) {
      ctx.emit.scrollOffsetChange({
        offset: scrollOffset,
        nativeEvent,
      })
    }
  }

  const scheduleUpdateRange = (nativeEvent?: Event): void => {
    scheduler.schedule(() => updateRange(nativeEvent))
  }

  const scrollToBottom = (options?: ScrollIntoViewOptions): void => {
    viewport?.scrollTo({
      top: viewport.scrollHeight,
      behavior: options?.behavior,
    })
  }

  ctx.expose({
    scrollToBottom,

    getRange(): ChatThreadVirtualRange {
      return currentRange
    },

    getItems(): ChatThreadVirtualItem[] {
      return currentItems
    },

    getTotalSize(): number {
      refreshVirtualizer()
      return props.virtual ? virtualizer.getTotalSize() : 0
    },

    scrollToIndex(index: number, align: ChatThreadScrollAlign = 'start'): void {
      if (!props.virtual) return

      refreshVirtualizer()

      const offset = virtualizer.getOffsetForIndex(
        index,
        align,
        getViewportSize(viewport),
      )

      setScrollOffset(viewport, offset)
      updateRange()
    },

    scrollToOffset(offset: number): void {
      if (!props.virtual) return

      setScrollOffset(viewport, offset)
      updateRange()
    },

    measure(index?: number, size?: number): void {
      refreshVirtualizer()

      if (
        typeof index === 'number' &&
        typeof size === 'number' &&
        Number.isFinite(index) &&
        Number.isFinite(size)
      ) {
        virtualizer.measure(index, size)
      }

      updateRange()
    },

    resetMeasurements(): void {
      refreshVirtualizer()
      virtualizer.resetMeasurements()
      updateRange()
    },
  })

  const getTotalSize = (): number => {
    refreshVirtualizer()
    return props.virtual ? virtualizer.getTotalSize() : 0
  }

  const getSpacerStyle = (): string => {
    if (!props.virtual) return 'display:none;'

    return [
      `height:${getTotalSize()}px`,
      'width:1px',
      'pointer-events:none',
    ].join(';')
  }

  return (
    <Host
      part="root"
      data-slot="chat-thread-root"
      data-loading={() => (props.loading ? '' : undefined)}
      data-empty={() => (props.empty ? '' : undefined)}
      data-virtual={() => (props.virtual ? '' : undefined)}
      data-count={() => String(resolveCount(props))}
      data-estimate-size={() => String(resolveEstimateSize(props))}
      data-overscan={() => String(resolveOverscan(props))}
      data-total-size={() => String(getTotalSize())}
    >
      <div
        ref={(element: HTMLElement | null) => {
          if (element) {
            viewport = element
            scheduleUpdateRange()
          }
        }}
        part="viewport"
        data-slot="chat-thread"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={() => (props.loading ? 'true' : undefined)}
        aria-label={() => props.ariaLabel}
        onScroll={(nativeEvent: Event) => {
          scheduleUpdateRange(nativeEvent)
        }}
      >
        <div
          part="spacer"
          data-slot="chat-thread-spacer"
          aria-hidden="true"
          data-total-size={() => String(getTotalSize())}
          style={() => getSpacerStyle()}
        />

        <div
          part="items"
          data-slot="chat-thread-items"
          data-range-start={() => String(currentRange.start)}
          data-range-end={() => String(currentRange.end)}
          data-overscan-start={() => String(currentRange.overscanStart)}
          data-overscan-end={() => String(currentRange.overscanEnd)}
        >
          <Slot />
        </div>
      </div>
    </Host>
  )
}

export const ChatThread = defineElement<
  ChatThreadProps,
  ChatThreadElement,
  ChatThreadEmits
>(
  'zw-chat-thread',
  {
    shadow: false,
    props: {
      count: prop(Number, {
        default: 0,
      }),
      loading: prop(Boolean, {
        reflect: true,
      }),
      empty: prop(Boolean, {
        reflect: true,
      }),
      virtual: prop(Boolean, {
        reflect: true,
      }),
      estimateSize: prop(Number, {
        attr: 'estimate-size',
        default: 64,
      }),
      overscan: prop(Number, {
        default: 4,
      }),
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
    },
    emits: {
      rangeChange: event<ChatThreadRangeChangeDetail>(),
      scrollOffsetChange: event<ChatThreadScrollOffsetChangeDetail>(),
    },
    meta: {
      description:
        'Headless chat message thread advanced component with optional virtual range provider.',
    },
  },
  setup,
)
```

---

# 6. 完整单元测试

## 6.1 新增 `packages/advanced/chat/__tests__/thread-virtualizer.spec.ts`

```ts id="l2ohsy"
import { describe, expect, it } from 'vitest'

import { createChatThreadVirtualizer } from '../src/core'

describe('createChatThreadVirtualizer', () => {
  it('returns empty snapshot when count is zero', () => {
    const virtualizer = createChatThreadVirtualizer({
      count: 0,
      estimateSize: 64,
      overscan: 4,
    })

    expect(virtualizer.getTotalSize()).toBe(0)
    expect(virtualizer.getSnapshot(0, 400)).toEqual({
      range: {
        start: 0,
        end: -1,
        overscanStart: 0,
        overscanEnd: -1,
      },
      items: [],
      totalSize: 0,
    })
  })

  it('calculates range and overscan for chat messages', () => {
    const virtualizer = createChatThreadVirtualizer({
      count: 100,
      estimateSize: 40,
      overscan: 2,
    })

    expect(virtualizer.getSnapshot(0, 120)).toEqual({
      range: {
        start: 0,
        end: 2,
        overscanStart: 0,
        overscanEnd: 4,
      },
      items: [
        {
          index: 0,
          key: '0',
          start: 0,
          size: 40,
          end: 40,
        },
        {
          index: 1,
          key: '1',
          start: 40,
          size: 40,
          end: 80,
        },
        {
          index: 2,
          key: '2',
          start: 80,
          size: 40,
          end: 120,
        },
        {
          index: 3,
          key: '3',
          start: 120,
          size: 40,
          end: 160,
        },
        {
          index: 4,
          key: '4',
          start: 160,
          size: 40,
          end: 200,
        },
      ],
      totalSize: 4000,
    })
  })

  it('calculates middle range with overscan', () => {
    const virtualizer = createChatThreadVirtualizer({
      count: 100,
      estimateSize: 50,
      overscan: 1,
    })

    const snapshot = virtualizer.getSnapshot(250, 150)

    expect(snapshot.range).toEqual({
      start: 5,
      end: 7,
      overscanStart: 4,
      overscanEnd: 8,
    })

    expect(snapshot.items.map(item => item.index)).toEqual([4, 5, 6, 7, 8])
  })

  it('clamps offset for index near the end', () => {
    const virtualizer = createChatThreadVirtualizer({
      count: 10,
      estimateSize: 100,
      overscan: 1,
    })

    expect(virtualizer.getOffsetForIndex(9, 'start', 300)).toBe(700)
    expect(virtualizer.getOffsetForIndex(9, 'end', 300)).toBe(700)
    expect(virtualizer.getOffsetForIndex(9, 'center', 300)).toBe(700)
  })

  it('supports measured message height', () => {
    const virtualizer = createChatThreadVirtualizer({
      count: 3,
      estimateSize: 40,
      overscan: 0,
    })

    expect(virtualizer.getTotalSize()).toBe(120)

    virtualizer.measure(1, 100)

    expect(virtualizer.getTotalSize()).toBe(180)
    expect(virtualizer.getSnapshot(40, 80).range).toEqual({
      start: 1,
      end: 1,
      overscanStart: 1,
      overscanEnd: 1,
    })
  })

  it('resets measurements', () => {
    const virtualizer = createChatThreadVirtualizer({
      count: 3,
      estimateSize: 40,
      overscan: 0,
    })

    virtualizer.measure(1, 100)
    expect(virtualizer.getTotalSize()).toBe(180)

    virtualizer.resetMeasurements()
    expect(virtualizer.getTotalSize()).toBe(120)
  })

  it('normalizes invalid options', () => {
    const virtualizer = createChatThreadVirtualizer({
      count: Number.NaN,
      estimateSize: -1,
      overscan: -1,
    })

    expect(virtualizer.getTotalSize()).toBe(0)
    expect(virtualizer.getSnapshot(0, 100).items).toEqual([])
  })
})
```

---

## 6.2 新增 `packages/advanced/chat/__tests__/chat-thread-virtual.spec.ts`

```ts id="sdsd8r"
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const source = readFileSync(
  resolve(
    workspaceRoot,
    'packages/advanced/chat/src/components/chat-thread.tsx',
  ),
  'utf-8',
)

describe('chat-thread virtual protocol', () => {
  it('infers virtual props, events, methods, slots, and css parts', () => {
    const result = analyzeFile({
      file: 'packages/advanced/chat/src/components/chat-thread.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)
    expect(result.components[0]).toMatchObject({
      tag: 'zw-chat-thread',
      props: {
        count: {
          type: 'number',
          default: 0,
        },
        loading: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        empty: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        virtual: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        estimateSize: {
          type: 'number',
          default: 64,
        },
        overscan: {
          type: 'number',
          default: 4,
        },
      },
      events: {
        rangeChange: {
          name: 'range-change',
          reactName: 'onRangeChange',
        },
        scrollOffsetChange: {
          name: 'scroll-offset-change',
          reactName: 'onScrollOffsetChange',
        },
      },
      methods: {
        scrollToBottom: {
          name: 'scrollToBottom',
          returns: 'void',
        },
        getRange: {
          name: 'getRange',
          returns: 'ChatThreadVirtualRange',
        },
        getItems: {
          name: 'getItems',
          returns: 'ChatThreadVirtualItem[]',
        },
        getTotalSize: {
          name: 'getTotalSize',
          returns: 'number',
        },
        scrollToIndex: {
          name: 'scrollToIndex',
          returns: 'void',
        },
        scrollToOffset: {
          name: 'scrollToOffset',
          returns: 'void',
        },
        measure: {
          name: 'measure',
          returns: 'void',
        },
        resetMeasurements: {
          name: 'resetMeasurements',
          returns: 'void',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
      },
    })

    expect(result.components[0].cssParts).toEqual(
      expect.arrayContaining(['items', 'root', 'spacer', 'viewport']),
    )
  })

  it('uses @zeus-web/virtual instead of duplicating virtualizer logic', () => {
    expect(source).toContain("from '@zeus-web/virtual'")
    expect(source).toContain('createRafScheduler')
    expect(source).toContain('areVirtualRangesEqual')
  })

  it('does not render chat messages directly', () => {
    expect(source).not.toContain('document.createElement')
    expect(source).not.toContain('zw-chat-message')
    expect(source).toContain('<Slot />')
  })
})
```

---

# 7. 新增设计文档

## `docs/advanced/design/phase4.md`

````md id="2nky21"
# Phase 4：Chat Virtual Thread Integration

## 目标

Phase 4 将 `@zeus-web/chat` 与 `@zeus-web/virtual` 集成，使 `zw-chat-thread` 的 `virtual` 属性从 metadata 变成真实能力。

本阶段仍保持 headless-first，不在 `zw-chat-thread` 内直接渲染消息内容，而是提供 range、items、spacer、滚动方法与事件。

## 范围

本阶段新增：

1. `packages/advanced/chat/src/core/thread-virtualizer.ts`
2. `packages/advanced/chat/__tests__/thread-virtualizer.spec.ts`
3. `packages/advanced/chat/__tests__/chat-thread-virtual.spec.ts`

本阶段修改：

1. `packages/advanced/chat/package.json`
2. `packages/advanced/chat/src/types.ts`
3. `packages/advanced/chat/src/core/index.ts`
4. `packages/advanced/chat/src/components/chat-thread.tsx`

## 非目标

本阶段不做：

1. 不在 `zw-chat-thread` 中自动渲染 `zw-chat-message`。
2. 不做动态高度完整优化。
3. 不做 reverse chat list。
4. 不实现 markdown 渲染。
5. 不实现代码高亮。
6. 不接模型服务。
7. 不做 provider transport。
8. 不修改 registry styled templates。

## API

### Props

`zw-chat-thread` 新增：

```txt
virtual?: boolean
estimate-size?: number
overscan?: number
```
````

### Events

`zw-chat-thread` 新增：

```txt
range-change
scroll-offset-change
```

### Methods

`zw-chat-thread` 新增：

```txt
getRange()
getItems()
getTotalSize()
scrollToIndex()
scrollToOffset()
measure()
resetMeasurements()
```

保留：

```txt
scrollToBottom()
```

## Headless 渲染策略

`zw-chat-thread` 只负责：

1. viewport
2. spacer
3. range
4. items
5. scroll methods
6. range-change event

上层负责根据 `range-change` 或 `getItems()` 渲染可见消息。

## 验收

```bash
pnpm --filter @zeus-web/chat check
pnpm --filter @zeus-web/chat test
pnpm --filter @zeus-web/chat build
pnpm --filter @zeus-web/virtual test
pnpm check
pnpm test-unit
pnpm check:advanced-contract
pnpm check:build-output
```

````

---

# 8. 验收命令

```bash id="dva9pf"
pnpm --filter @zeus-web/virtual test

pnpm --filter @zeus-web/chat check
pnpm --filter @zeus-web/chat test
pnpm --filter @zeus-web/chat build

pnpm check
pnpm test-unit
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm check:product-contract
````

---

# 9. Phase 4 完成标准

```txt id="c4snf6"
必须满足:
  1. @zeus-web/chat package.json 依赖 @zeus-web/virtual
  2. zw-chat-thread virtual=true 时可计算 range/items/totalSize
  3. zw-chat-thread 支持 range-change 事件
  4. zw-chat-thread 支持 scrollToIndex / scrollToOffset
  5. zw-chat-thread 支持 measure / resetMeasurements
  6. chat 不复制 virtual core 逻辑，只消费 @zeus-web/virtual
  7. 单测覆盖 core virtual thread
  8. analyzer 测试覆盖组件 props/events/methods/parts
```

---

# 10. 下一阶段建议

Phase 5 建议进入：

```txt id="y7txuu"
Phase 5: Data Grid Lite

目标:
  1. @zeus-web/data-grid
  2. 基于 @zeus-web/virtual 做 row virtualization
  3. column model
  4. selection model
  5. keyboard navigation
  6. headless table protocol
```

不建议 Phase 5 继续扩 Chat 的样式层，因为目前 advanced workspace 更需要第二个复杂组件来验证 `virtual` 的复用价值。
