import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type {
  ChatThreadRangeChangeDetail,
  ChatThreadScrollAlign,
  ChatThreadScrollOffsetChangeDetail,
  ChatThreadVirtualItem,
  ChatThreadVirtualizer,
  ChatThreadVirtualRange,
} from '../types'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

import {
  areVirtualRangesEqual,
  createEmptyVirtualRange,
  createRafScheduler,
} from '@zeus-web/virtual'
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
  const value = props.count ?? 0

  if (!Number.isFinite(value) || value <= 0) return 0

  return Math.floor(value)
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

  ctx.expose({
    scrollToBottom(options?: ScrollIntoViewOptions): void {
      viewport?.scrollTo({
        top: viewport.scrollHeight,
        behavior: options?.behavior,
      })
    },

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

  const getSpacerStyle = (): Record<string, string> => {
    if (!props.virtual) {
      return { display: 'none' }
    }

    return {
      height: `${getTotalSize()}px`,
      width: '1px',
      pointerEvents: 'none',
    }
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
