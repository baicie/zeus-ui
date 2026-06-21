下面给的是 **Phase 1：`@zeus-web/virtual`** 的详细设计与完整代码。它基于 `feat/advanced-workspace` / `b952c34` 当前工程形态来写：现有 primitive 包使用共享 `../../../rolldown.config.ts` 构建，并导出 `./wc`、`./wc/auto`、`./react`、`./vue` 等产物。 现有组件写法使用 `defineElement / Host / prop / Slot / event / ctx.expose`，测试主要通过 `@zeus-js/component-analyzer` 分析源码协议。

> 前提：建议先把上一轮 review 里指出的 Phase 0 问题修掉，尤其是 `./wc/auto` 漏检、`check-build-output` 过弱、`build.ts` 缓存判断路径错误。否则 `@zeus-web/virtual` 能写进去，但契约检查还不够严格。

---

# Phase 1 目标

Phase 1 只做 **Virtual Foundation MVP**：

```txt
packages/advanced/virtual
  @zeus-web/virtual
```

本阶段做：

```txt
1. 固定高度虚拟列表 core engine
2. overscan range 计算
3. scrollToIndex / scrollToOffset
4. size cache 基础能力
5. raf scheduler
6. <zw-virtual-list> Web Component
7. React/Vue wrapper 通过 Zeus output 自动生成
8. 完整单元测试
```

本阶段不做：

```txt
1. 动态高度完整优化
2. 二维 virtual-grid
3. DataGrid 集成
4. Chat 集成
5. registry / @zeus-web/ui styled entry
```

---

# 目录结构

```txt
packages/advanced/virtual/
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts
    core/
      index.ts
      range.ts
      scheduler.ts
      size-cache.ts
      virtualizer.ts
    components/
      virtual-list.tsx
  __tests__/
    scheduler.spec.ts
    size-cache.spec.ts
    virtualizer.spec.ts
    virtual-list.spec.ts
```

另外建议修改：

```txt
vitest.config.ts
```

把 coverage include 加上 `packages/advanced/*/src/**`。当前 vitest coverage 只覆盖 `packages/*/src/**` 和 `packages/primitives/*/src/**`，不覆盖 advanced 嵌套包。

---

# 1. `packages/advanced/virtual/package.json`

```json
{
  "name": "@zeus-web/virtual",
  "type": "module",
  "version": "0.0.0",
  "description": "Headless virtual scrolling foundation for Zeus Web advanced components.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/baicie/zeus-ui.git",
    "directory": "packages/advanced/virtual"
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
    "test": "vitest --root ../../.. --project unit packages/advanced/virtual/__tests__/scheduler.spec.ts packages/advanced/virtual/__tests__/size-cache.spec.ts packages/advanced/virtual/__tests__/virtualizer.spec.ts packages/advanced/virtual/__tests__/virtual-list.spec.ts"
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
    "@zeus-web/zeus-compat": "workspace:*"
  }
}
```

---

# 2. `packages/advanced/virtual/tsconfig.json`

```json
{
  "extends": "../../../scripts/config/tsconfig.zeus-jsx.json",
  "compilerOptions": {
    "composite": false,
    "rootDir": "../../",
    "outDir": "dist",
    "isolatedDeclarations": false
  },
  "include": ["src"]
}
```

---

# 3. `packages/advanced/virtual/src/types.ts`

```ts
export type VirtualScrollAlign = 'start' | 'center' | 'end'

export type EstimateSize = number | ((index: number) => number)

export interface VirtualRange {
  start: number
  end: number
  overscanStart: number
  overscanEnd: number
}

export interface VirtualItem<TData = unknown> {
  index: number
  key: string
  start: number
  size: number
  end: number
  data?: TData
}

export interface VirtualizerOptions {
  count: number
  estimateSize: EstimateSize
  overscan?: number
  getItemKey?: (index: number) => string
}

export interface ScrollToIndexOptions {
  align?: VirtualScrollAlign
  viewportSize?: number
}

export interface Virtualizer {
  getCount: () => number
  getTotalSize: () => number
  getRange: (scrollOffset: number, viewportSize: number) => VirtualRange
  getItems: (range: VirtualRange) => VirtualItem[]
  getOffsetForIndex: (index: number, options?: ScrollToIndexOptions) => number
  measure: (index: number, size: number) => void
  resetMeasurements: () => void
}

export interface VirtualListProps {
  count?: number
  estimateSize?: number
  overscan?: number
  horizontal?: boolean
  ariaLabel?: string
}

export interface VirtualListRangeChangeDetail {
  range: VirtualRange
  items: VirtualItem[]
  scrollOffset: number
  viewportSize: number
}

export interface VirtualListScrollOffsetChangeDetail {
  offset: number
  nativeEvent: Event
}

export interface VirtualListElement extends HTMLElement {
  getRange: () => VirtualRange
  getItems: () => VirtualItem[]
  getTotalSize: () => number
  scrollToIndex: (index: number, align?: VirtualScrollAlign) => void
  scrollToOffset: (offset: number) => void
  measure: () => void
}
```

---

# 4. `packages/advanced/virtual/src/core/range.ts`

```ts
import type { VirtualRange } from '../types'

export const emptyVirtualRange: VirtualRange = {
  start: 0,
  end: -1,
  overscanStart: 0,
  overscanEnd: -1,
}

export function createEmptyVirtualRange(): VirtualRange {
  return { ...emptyVirtualRange }
}

export function isEmptyVirtualRange(range: VirtualRange): boolean {
  return range.end < range.start || range.overscanEnd < range.overscanStart
}

export function areVirtualRangesEqual(
  left: VirtualRange,
  right: VirtualRange,
): boolean {
  return (
    left.start === right.start &&
    left.end === right.end &&
    left.overscanStart === right.overscanStart &&
    left.overscanEnd === right.overscanEnd
  )
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

export function normalizeNonNegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

export function normalizePositiveNumber(
  value: unknown,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return value
}
```

---

# 5. `packages/advanced/virtual/src/core/size-cache.ts`

```ts
import type { EstimateSize } from '../types'

import {
  clamp,
  normalizeNonNegativeInteger,
  normalizePositiveNumber,
} from './range'

export interface SizeCacheOptions {
  count: number
  estimateSize: EstimateSize
}

export class SizeCache {
  private count: number
  private estimateSize: EstimateSize
  private readonly measuredSizes = new Map<number, number>()

  constructor(options: SizeCacheOptions) {
    this.count = normalizeNonNegativeInteger(options.count)
    this.estimateSize = options.estimateSize
  }

  getCount(): number {
    return this.count
  }

  setCount(count: number): void {
    this.count = normalizeNonNegativeInteger(count)

    for (const index of this.measuredSizes.keys()) {
      if (index >= this.count) {
        this.measuredSizes.delete(index)
      }
    }
  }

  setEstimateSize(estimateSize: EstimateSize): void {
    this.estimateSize = estimateSize
  }

  getSize(index: number): number {
    const normalizedIndex = normalizeNonNegativeInteger(index)

    if (this.measuredSizes.has(normalizedIndex)) {
      return this.measuredSizes.get(normalizedIndex)!
    }

    return this.getEstimatedSize(normalizedIndex)
  }

  getOffset(index: number): number {
    const normalizedIndex = clamp(
      normalizeNonNegativeInteger(index),
      0,
      this.count,
    )

    if (
      this.measuredSizes.size === 0 &&
      typeof this.estimateSize === 'number'
    ) {
      return normalizedIndex * this.getEstimatedSize(0)
    }

    let offset = 0

    for (let i = 0; i < normalizedIndex; i += 1) {
      offset += this.getSize(i)
    }

    return offset
  }

  getTotalSize(): number {
    if (this.count === 0) return 0

    if (
      this.measuredSizes.size === 0 &&
      typeof this.estimateSize === 'number'
    ) {
      return this.count * this.getEstimatedSize(0)
    }

    let total = 0

    for (let i = 0; i < this.count; i += 1) {
      total += this.getSize(i)
    }

    return total
  }

  measure(index: number, size: number): void {
    const normalizedIndex = normalizeNonNegativeInteger(index)

    if (normalizedIndex >= this.count) return

    this.measuredSizes.set(
      normalizedIndex,
      normalizePositiveNumber(size, this.getEstimatedSize(normalizedIndex)),
    )
  }

  reset(): void {
    this.measuredSizes.clear()
  }

  findIndexAtOffset(offset: number): number {
    if (this.count === 0) return -1

    const normalizedOffset = Math.max(0, offset)
    const totalSize = this.getTotalSize()

    if (totalSize <= 0) return 0

    if (
      this.measuredSizes.size === 0 &&
      typeof this.estimateSize === 'number'
    ) {
      const size = this.getEstimatedSize(0)
      return clamp(Math.floor(normalizedOffset / size), 0, this.count - 1)
    }

    let low = 0
    let high = this.count - 1
    let match = 0

    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      const start = this.getOffset(middle)
      const end = start + this.getSize(middle)

      if (normalizedOffset < start) {
        high = middle - 1
      } else if (normalizedOffset >= end) {
        low = middle + 1
      } else {
        return middle
      }

      match = middle
    }

    return clamp(match, 0, this.count - 1)
  }

  private getEstimatedSize(index: number): number {
    if (typeof this.estimateSize === 'function') {
      return normalizePositiveNumber(this.estimateSize(index), 1)
    }

    return normalizePositiveNumber(this.estimateSize, 1)
  }
}
```

---

# 6. `packages/advanced/virtual/src/core/scheduler.ts`

```ts
type FrameCallback = () => void

export interface FrameSchedulerOptions {
  requestFrame?: (callback: FrameRequestCallback) => number
  cancelFrame?: (handle: number) => void
}

export interface RafScheduler {
  schedule: (callback: FrameCallback) => void
  flush: () => void
  cancel: () => void
  isScheduled: () => boolean
}

function defaultRequestFrame(callback: FrameRequestCallback): number {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback)
  }

  return setTimeout(() => callback(Date.now()), 16) as unknown as number
}

function defaultCancelFrame(handle: number): void {
  if (typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(handle)
    return
  }

  clearTimeout(handle)
}

export function createRafScheduler(
  options: FrameSchedulerOptions = {},
): RafScheduler {
  const requestFrame = options.requestFrame ?? defaultRequestFrame
  const cancelFrame = options.cancelFrame ?? defaultCancelFrame

  let frameHandle: number | undefined
  let queuedCallback: FrameCallback | undefined

  const run = () => {
    frameHandle = undefined

    const callback = queuedCallback
    queuedCallback = undefined

    callback?.()
  }

  return {
    schedule(callback): void {
      queuedCallback = callback

      if (frameHandle !== undefined) return

      frameHandle = requestFrame(run)
    },

    flush(): void {
      if (frameHandle !== undefined) {
        cancelFrame(frameHandle)
        frameHandle = undefined
      }

      const callback = queuedCallback
      queuedCallback = undefined

      callback?.()
    },

    cancel(): void {
      if (frameHandle !== undefined) {
        cancelFrame(frameHandle)
      }

      frameHandle = undefined
      queuedCallback = undefined
    },

    isScheduled(): boolean {
      return frameHandle !== undefined
    },
  }
}
```

---

# 7. `packages/advanced/virtual/src/core/virtualizer.ts`

```ts
import type {
  ScrollToIndexOptions,
  VirtualItem,
  Virtualizer,
  VirtualizerOptions,
  VirtualRange,
} from '../types'

import {
  clamp,
  createEmptyVirtualRange,
  normalizeNonNegativeInteger,
  normalizePositiveNumber,
} from './range'
import { SizeCache } from './size-cache'

function normalizeOverscan(value: unknown): number {
  return normalizeNonNegativeInteger(value)
}

function getDefaultItemKey(index: number): string {
  return String(index)
}

export function createVirtualizer(options: VirtualizerOptions): Virtualizer {
  const sizeCache = new SizeCache({
    count: options.count,
    estimateSize: options.estimateSize,
  })

  let getItemKey = options.getItemKey ?? getDefaultItemKey
  let overscan = normalizeOverscan(options.overscan)

  function getCount(): number {
    return sizeCache.getCount()
  }

  function getTotalSize(): number {
    return sizeCache.getTotalSize()
  }

  function getRange(scrollOffset: number, viewportSize: number): VirtualRange {
    const count = getCount()

    if (count === 0) {
      return createEmptyVirtualRange()
    }

    const normalizedViewportSize = normalizePositiveNumber(viewportSize, 0)

    if (normalizedViewportSize <= 0) {
      return createEmptyVirtualRange()
    }

    const maxScrollOffset = Math.max(0, getTotalSize() - normalizedViewportSize)
    const normalizedScrollOffset = clamp(scrollOffset, 0, maxScrollOffset)

    const start = sizeCache.findIndexAtOffset(normalizedScrollOffset)
    const visibleEndOffset = normalizedScrollOffset + normalizedViewportSize
    const end = sizeCache.findIndexAtOffset(Math.max(0, visibleEndOffset - 1))

    const safeStart = clamp(start, 0, count - 1)
    const safeEnd = clamp(Math.max(end, safeStart), 0, count - 1)

    return {
      start: safeStart,
      end: safeEnd,
      overscanStart: clamp(safeStart - overscan, 0, count - 1),
      overscanEnd: clamp(safeEnd + overscan, 0, count - 1),
    }
  }

  function getItems(range: VirtualRange): VirtualItem[] {
    if (range.overscanEnd < range.overscanStart) return []

    const items: VirtualItem[] = []

    for (
      let index = range.overscanStart;
      index <= range.overscanEnd;
      index += 1
    ) {
      const start = sizeCache.getOffset(index)
      const size = sizeCache.getSize(index)

      items.push({
        index,
        key: getItemKey(index),
        start,
        size,
        end: start + size,
      })
    }

    return items
  }

  function getOffsetForIndex(
    index: number,
    options: ScrollToIndexOptions = {},
  ): number {
    const count = getCount()

    if (count === 0) return 0

    const normalizedIndex = clamp(
      normalizeNonNegativeInteger(index),
      0,
      count - 1,
    )

    const viewportSize = normalizePositiveNumber(options.viewportSize, 0)
    const align = options.align ?? 'start'
    const itemStart = sizeCache.getOffset(normalizedIndex)
    const itemSize = sizeCache.getSize(normalizedIndex)

    let offset = itemStart

    if (align === 'center') {
      offset = itemStart - (viewportSize - itemSize) / 2
    } else if (align === 'end') {
      offset = itemStart - viewportSize + itemSize
    }

    return clamp(offset, 0, Math.max(0, getTotalSize() - viewportSize))
  }

  return {
    getCount,
    getTotalSize,
    getRange,
    getItems,
    getOffsetForIndex,

    measure(index, size): void {
      sizeCache.measure(index, size)
    },

    resetMeasurements(): void {
      sizeCache.reset()
    },
  }
}

export function createVirtualizerFromOptions(
  options: VirtualizerOptions,
): Virtualizer {
  return createVirtualizer(options)
}
```

---

# 8. `packages/advanced/virtual/src/core/index.ts`

```ts
export * from './range'
export * from './scheduler'
export * from './size-cache'
export * from './virtualizer'
```

---

# 9. `packages/advanced/virtual/src/components/virtual-list.tsx`

```tsx
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

import type {
  VirtualItem,
  VirtualListElement,
  VirtualListProps,
  VirtualListRangeChangeDetail,
  VirtualListScrollOffsetChangeDetail,
  VirtualRange,
  VirtualScrollAlign,
  Virtualizer,
} from '../types'
import {
  areVirtualRangesEqual,
  createEmptyVirtualRange,
  createRafScheduler,
  createVirtualizer,
} from '../core'

interface VirtualListEmits extends Record<string, EventDefinition<unknown>> {
  rangeChange: EventDefinition<VirtualListRangeChangeDetail>
  scrollOffsetChange: EventDefinition<VirtualListScrollOffsetChangeDetail>
}

function resolveCount(props: VirtualListProps): number {
  return Math.max(0, Math.floor(props.count ?? 0))
}

function resolveEstimateSize(props: VirtualListProps): number {
  const size = props.estimateSize ?? 32

  if (!Number.isFinite(size) || size <= 0) return 32

  return size
}

function resolveOverscan(props: VirtualListProps): number {
  return Math.max(0, Math.floor(props.overscan ?? 2))
}

function getScrollOffset(
  viewport: HTMLElement | undefined,
  horizontal: boolean | undefined,
): number {
  if (!viewport) return 0

  return horizontal ? viewport.scrollLeft : viewport.scrollTop
}

function getViewportSize(
  viewport: HTMLElement | undefined,
  horizontal: boolean | undefined,
): number {
  if (!viewport) return 0

  return horizontal ? viewport.clientWidth : viewport.clientHeight
}

function setScrollOffset(
  viewport: HTMLElement | undefined,
  horizontal: boolean | undefined,
  offset: number,
): void {
  if (!viewport) return

  if (horizontal) {
    viewport.scrollLeft = offset
  } else {
    viewport.scrollTop = offset
  }
}

function createListVirtualizer(props: VirtualListProps): Virtualizer {
  return createVirtualizer({
    count: resolveCount(props),
    estimateSize: resolveEstimateSize(props),
    overscan: resolveOverscan(props),
  })
}

function setup(
  props: VirtualListProps,
  ctx: DefineElementContext<VirtualListElement, VirtualListEmits>,
) {
  let viewport: HTMLElement | undefined
  let virtualizer = createListVirtualizer(props)
  let currentRange: VirtualRange = createEmptyVirtualRange()
  let currentItems: VirtualItem[] = []
  let lastSignature = ''

  const scheduler = createRafScheduler()

  const getSignature = () =>
    [
      resolveCount(props),
      resolveEstimateSize(props),
      resolveOverscan(props),
      props.horizontal ? 'horizontal' : 'vertical',
    ].join(':')

  const refreshVirtualizer = () => {
    const nextSignature = getSignature()

    if (nextSignature === lastSignature) return

    lastSignature = nextSignature
    virtualizer = createListVirtualizer(props)
  }

  const updateRange = (nativeEvent?: Event) => {
    refreshVirtualizer()

    const scrollOffset = getScrollOffset(viewport, props.horizontal)
    const viewportSize = getViewportSize(viewport, props.horizontal)
    const nextRange = virtualizer.getRange(scrollOffset, viewportSize)

    if (!areVirtualRangesEqual(currentRange, nextRange)) {
      currentRange = nextRange
      currentItems = virtualizer.getItems(nextRange)

      ctx.emit.rangeChange({
        range: currentRange,
        items: currentItems,
        scrollOffset,
        viewportSize,
      })
    }

    if (nativeEvent) {
      ctx.emit.scrollOffsetChange({
        offset: scrollOffset,
        nativeEvent,
      })
    }
  }

  const scheduleUpdateRange = (nativeEvent?: Event) => {
    scheduler.schedule(() => updateRange(nativeEvent))
  }

  ctx.expose({
    getRange(): VirtualRange {
      return currentRange
    },

    getItems(): VirtualItem[] {
      return currentItems
    },

    getTotalSize(): number {
      refreshVirtualizer()
      return virtualizer.getTotalSize()
    },

    scrollToIndex(index: number, align: VirtualScrollAlign = 'start'): void {
      refreshVirtualizer()

      const offset = virtualizer.getOffsetForIndex(index, {
        align,
        viewportSize: getViewportSize(viewport, props.horizontal),
      })

      setScrollOffset(viewport, props.horizontal, offset)
      updateRange()
    },

    scrollToOffset(offset: number): void {
      setScrollOffset(viewport, props.horizontal, Math.max(0, offset))
      updateRange()
    },

    measure(): void {
      updateRange()
    },
  })

  const getTotalSize = () => {
    refreshVirtualizer()
    return virtualizer.getTotalSize()
  }

  const getSpacerStyle = () => {
    const totalSize = getTotalSize()

    return props.horizontal
      ? `width:${totalSize}px;height:1px;pointer-events:none;`
      : `height:${totalSize}px;width:1px;pointer-events:none;`
  }

  return (
    <Host
      part="root"
      data-slot="virtual-list-root"
      data-orientation={() => (props.horizontal ? 'horizontal' : 'vertical')}
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
        data-slot="virtual-list-viewport"
        role="list"
        tabindex="0"
        aria-label={() => props.ariaLabel}
        aria-orientation={() => (props.horizontal ? 'horizontal' : 'vertical')}
        onScroll={(nativeEvent: Event) => {
          scheduleUpdateRange(nativeEvent)
        }}
      >
        <div
          part="spacer"
          data-slot="virtual-list-spacer"
          data-total-size={() => String(getTotalSize())}
          aria-hidden="true"
          style={() => getSpacerStyle()}
        />

        <div
          part="items"
          data-slot="virtual-list-items"
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

export const VirtualList = defineElement<
  VirtualListProps,
  VirtualListElement,
  VirtualListEmits
>(
  'zw-virtual-list',
  {
    shadow: false,
    props: {
      count: prop(Number, {
        default: 0,
        reflect: true,
      }),
      estimateSize: prop(Number, {
        attr: 'estimate-size',
        default: 32,
        reflect: true,
      }),
      overscan: prop(Number, {
        default: 2,
        reflect: true,
      }),
      horizontal: prop(Boolean, {
        reflect: true,
      }),
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
    },
    emits: {
      rangeChange: event<VirtualListRangeChangeDetail>(),
      scrollOffsetChange: event<VirtualListScrollOffsetChangeDetail>(),
    },
    meta: {
      description: 'Headless virtual list advanced component.',
    },
  },
  setup,
)
```

---

# 10. `packages/advanced/virtual/src/index.ts`

```ts
export * from './types'
export * from './core'
export {
  VirtualList,
  type VirtualListElement,
  type VirtualListProps,
} from './components/virtual-list'
```

---

# 11. `packages/advanced/virtual/__tests__/scheduler.spec.ts`

```ts
import { describe, expect, it, vi } from 'vitest'

import { createRafScheduler } from '../src/core'

describe('createRafScheduler', () => {
  it('coalesces multiple scheduled callbacks into one frame', () => {
    const queued: FrameRequestCallback[] = []
    const cancelFrame = vi.fn()

    const scheduler = createRafScheduler({
      requestFrame(callback) {
        queued.push(callback)
        return queued.length
      },
      cancelFrame,
    })

    const first = vi.fn()
    const second = vi.fn()

    scheduler.schedule(first)
    scheduler.schedule(second)

    expect(scheduler.isScheduled()).toBe(true)
    expect(queued).toHaveLength(1)

    queued[0](0)

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    expect(scheduler.isScheduled()).toBe(false)
  })

  it('flushes the queued callback synchronously', () => {
    const callback = vi.fn()
    const cancelFrame = vi.fn()

    const scheduler = createRafScheduler({
      requestFrame() {
        return 1
      },
      cancelFrame,
    })

    scheduler.schedule(callback)
    scheduler.flush()

    expect(cancelFrame).toHaveBeenCalledWith(1)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(scheduler.isScheduled()).toBe(false)
  })

  it('cancels the queued callback', () => {
    const callback = vi.fn()
    const cancelFrame = vi.fn()

    const scheduler = createRafScheduler({
      requestFrame() {
        return 1
      },
      cancelFrame,
    })

    scheduler.schedule(callback)
    scheduler.cancel()
    scheduler.flush()

    expect(cancelFrame).toHaveBeenCalledWith(1)
    expect(callback).not.toHaveBeenCalled()
    expect(scheduler.isScheduled()).toBe(false)
  })
})
```

---

# 12. `packages/advanced/virtual/__tests__/size-cache.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import { SizeCache } from '../src/core'

describe('SizeCache', () => {
  it('uses fixed estimated size by default', () => {
    const cache = new SizeCache({
      count: 5,
      estimateSize: 20,
    })

    expect(cache.getCount()).toBe(5)
    expect(cache.getSize(0)).toBe(20)
    expect(cache.getOffset(3)).toBe(60)
    expect(cache.getTotalSize()).toBe(100)
  })

  it('supports measured item sizes', () => {
    const cache = new SizeCache({
      count: 5,
      estimateSize: 20,
    })

    cache.measure(1, 50)

    expect(cache.getSize(0)).toBe(20)
    expect(cache.getSize(1)).toBe(50)
    expect(cache.getOffset(2)).toBe(70)
    expect(cache.getTotalSize()).toBe(130)
  })

  it('drops out-of-range measurements when count shrinks', () => {
    const cache = new SizeCache({
      count: 5,
      estimateSize: 10,
    })

    cache.measure(4, 100)
    expect(cache.getTotalSize()).toBe(140)

    cache.setCount(4)
    expect(cache.getTotalSize()).toBe(40)
  })

  it('finds index at offset for fixed-size items', () => {
    const cache = new SizeCache({
      count: 10,
      estimateSize: 10,
    })

    expect(cache.findIndexAtOffset(0)).toBe(0)
    expect(cache.findIndexAtOffset(9)).toBe(0)
    expect(cache.findIndexAtOffset(10)).toBe(1)
    expect(cache.findIndexAtOffset(99)).toBe(9)
    expect(cache.findIndexAtOffset(1000)).toBe(9)
  })

  it('finds index at offset with measured items', () => {
    const cache = new SizeCache({
      count: 4,
      estimateSize: 10,
    })

    cache.measure(1, 30)

    expect(cache.findIndexAtOffset(0)).toBe(0)
    expect(cache.findIndexAtOffset(10)).toBe(1)
    expect(cache.findIndexAtOffset(39)).toBe(1)
    expect(cache.findIndexAtOffset(40)).toBe(2)
  })

  it('normalizes invalid sizes', () => {
    const cache = new SizeCache({
      count: 2,
      estimateSize: 0,
    })

    cache.measure(0, -100)

    expect(cache.getSize(0)).toBe(1)
    expect(cache.getTotalSize()).toBe(2)
  })
})
```

---

# 13. `packages/advanced/virtual/__tests__/virtualizer.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import {
  createEmptyVirtualRange,
  createVirtualizer,
  isEmptyVirtualRange,
} from '../src/core'

describe('createVirtualizer', () => {
  it('returns an empty range for empty lists', () => {
    const virtualizer = createVirtualizer({
      count: 0,
      estimateSize: 20,
    })

    const range = virtualizer.getRange(0, 100)

    expect(range).toEqual(createEmptyVirtualRange())
    expect(isEmptyVirtualRange(range)).toBe(true)
    expect(virtualizer.getItems(range)).toEqual([])
  })

  it('calculates visible range with overscan', () => {
    const virtualizer = createVirtualizer({
      count: 100,
      estimateSize: 10,
      overscan: 2,
    })

    expect(virtualizer.getRange(0, 30)).toEqual({
      start: 0,
      end: 2,
      overscanStart: 0,
      overscanEnd: 4,
    })

    expect(virtualizer.getRange(50, 30)).toEqual({
      start: 5,
      end: 7,
      overscanStart: 3,
      overscanEnd: 9,
    })
  })

  it('clamps range near the end', () => {
    const virtualizer = createVirtualizer({
      count: 10,
      estimateSize: 10,
      overscan: 3,
    })

    expect(virtualizer.getRange(90, 30)).toEqual({
      start: 7,
      end: 9,
      overscanStart: 4,
      overscanEnd: 9,
    })
  })

  it('returns virtual items for the overscanned range', () => {
    const virtualizer = createVirtualizer({
      count: 100,
      estimateSize: 10,
      overscan: 1,
      getItemKey: index => `row:${index}`,
    })

    const range = virtualizer.getRange(20, 20)
    const items = virtualizer.getItems(range)

    expect(items).toEqual([
      {
        index: 1,
        key: 'row:1',
        start: 10,
        size: 10,
        end: 20,
      },
      {
        index: 2,
        key: 'row:2',
        start: 20,
        size: 10,
        end: 30,
      },
      {
        index: 3,
        key: 'row:3',
        start: 30,
        size: 10,
        end: 40,
      },
      {
        index: 4,
        key: 'row:4',
        start: 40,
        size: 10,
        end: 50,
      },
    ])
  })

  it('calculates total size', () => {
    const virtualizer = createVirtualizer({
      count: 4,
      estimateSize: 25,
    })

    expect(virtualizer.getTotalSize()).toBe(100)
  })

  it('calculates scroll offsets for alignments', () => {
    const virtualizer = createVirtualizer({
      count: 100,
      estimateSize: 10,
    })

    expect(
      virtualizer.getOffsetForIndex(10, {
        align: 'start',
        viewportSize: 50,
      }),
    ).toBe(100)

    expect(
      virtualizer.getOffsetForIndex(10, {
        align: 'center',
        viewportSize: 50,
      }),
    ).toBe(80)

    expect(
      virtualizer.getOffsetForIndex(10, {
        align: 'end',
        viewportSize: 50,
      }),
    ).toBe(60)
  })

  it('clamps scroll offsets for alignments', () => {
    const virtualizer = createVirtualizer({
      count: 10,
      estimateSize: 10,
    })

    expect(
      virtualizer.getOffsetForIndex(0, {
        align: 'center',
        viewportSize: 50,
      }),
    ).toBe(0)

    expect(
      virtualizer.getOffsetForIndex(99, {
        align: 'start',
        viewportSize: 50,
      }),
    ).toBe(50)
  })

  it('supports measured item sizes', () => {
    const virtualizer = createVirtualizer({
      count: 4,
      estimateSize: 10,
      overscan: 0,
    })

    virtualizer.measure(1, 30)

    expect(virtualizer.getTotalSize()).toBe(60)
    expect(virtualizer.getRange(10, 10)).toEqual({
      start: 1,
      end: 1,
      overscanStart: 1,
      overscanEnd: 1,
    })
  })

  it('resets measured item sizes', () => {
    const virtualizer = createVirtualizer({
      count: 4,
      estimateSize: 10,
    })

    virtualizer.measure(1, 30)
    expect(virtualizer.getTotalSize()).toBe(60)

    virtualizer.resetMeasurements()
    expect(virtualizer.getTotalSize()).toBe(40)
  })
})
```

---

# 14. `packages/advanced/virtual/__tests__/virtual-list.spec.ts`

```ts
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
    'packages/advanced/virtual/src/components/virtual-list.tsx',
  ),
  'utf-8',
)

describe('virtual-list advanced component protocol', () => {
  it('infers props, events, methods, slots, and css parts from source', () => {
    const result = analyzeFile({
      file: 'packages/advanced/virtual/src/components/virtual-list.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)
    expect(result.components[0]).toMatchObject({
      tag: 'zw-virtual-list',
      props: {
        count: {
          type: 'number',
          default: 0,
          reflect: true,
        },
        estimateSize: {
          type: 'number',
          default: 32,
          reflect: true,
        },
        overscan: {
          type: 'number',
          default: 2,
          reflect: true,
        },
        horizontal: {
          type: 'boolean',
          default: false,
          reflect: true,
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
        getRange: {
          name: 'getRange',
          returns: 'VirtualRange',
        },
        getItems: {
          name: 'getItems',
          returns: 'VirtualItem[]',
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
      },
      slots: {
        default: {
          name: 'default',
        },
      },
      cssParts: ['items', 'root', 'spacer', 'viewport'],
    })
  })
})
```

---

# 15. 修改 `vitest.config.ts`

把 coverage include 改成：

```diff
coverage: {
  provider: 'v8',
  reporter: ['text', 'html'],
- include: ['packages/*/src/**', 'packages/primitives/*/src/**'],
+ include: [
+   'packages/*/src/**',
+   'packages/primitives/*/src/**',
+   'packages/advanced/*/src/**',
+ ],
  exclude: [],
},
```

完整片段：

```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'html'],
  include: [
    'packages/*/src/**',
    'packages/primitives/*/src/**',
    'packages/advanced/*/src/**',
  ],
  exclude: [],
},
```

---

# Phase 1 验收命令

```bash
pnpm --filter @zeus-web/virtual check
pnpm --filter @zeus-web/virtual test

pnpm check
pnpm test-unit

pnpm --filter @zeus-web/virtual build
pnpm check:exports
pnpm check:advanced-contract
pnpm check:build-output
pnpm release:plan
```

---

# 设计补充

## 为什么 Phase 1 只做固定高度虚拟列表

`@zeus-web/virtual` 是后续 Chat / DataGrid 的基础层。第一版必须先把最小稳定协议打通：

```txt
core engine
Web Component
React wrapper
Vue wrapper
unit tests
package rules
release discovery
```

动态高度、二维虚拟表格、sticky、reverse list 都可以在 Phase 1.1 / Phase 1.2 继续加。

## 为什么不进 registry / ui

`virtual` 是基础能力包，不是直接给业务项目展示的 UI 组件，所以本阶段不需要：

```txt
packages/registry/templates/react/virtual-list.tsx
packages/ui/src/virtual.ts
```

后续 `chat` 和 `data-grid` 会消费它。

## 为什么 core 和 component 分层

`src/core` 纯 TS，可以被 Chat/DataGrid 复用，也方便单元测试；`src/components` 只负责把 core 包成 Web Component。这个符合 advanced workspace 的约束：高级组件必须有 `src/core` 和 `src/components` 分层。
