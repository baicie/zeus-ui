import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type {
  VirtualItem,
  Virtualizer,
  VirtualRange,
  VirtualScrollAlign,
} from '../types'

import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'
import {
  areVirtualRangesEqual,
  createEmptyVirtualRange,
  createRafScheduler,
  createVirtualizer,
} from '../core'

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

  const getSpacerStyle = (): Record<string, string> => {
    const totalSize = getTotalSize()

    if (props.horizontal) {
      return { width: `${totalSize}px`, height: '1px', pointerEvents: 'none' }
    }

    return { height: `${totalSize}px`, width: '1px', pointerEvents: 'none' }
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
            if (viewport && viewport !== element) {
              viewport.removeEventListener('scroll', scheduleUpdateRange)
            }

            viewport = element
            element.addEventListener('scroll', scheduleUpdateRange)
            scheduleUpdateRange()
            return
          }

          if (viewport) {
            viewport.removeEventListener('scroll', scheduleUpdateRange)
          }

          viewport = undefined
        }}
        part="viewport"
        data-slot="virtual-list-viewport"
        role="list"
        tabindex={() => 0}
        aria-label={() => props.ariaLabel}
        aria-orientation={() => (props.horizontal ? 'horizontal' : 'vertical')}
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
