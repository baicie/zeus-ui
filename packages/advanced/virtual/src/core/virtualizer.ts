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

  const getItemKey = options.getItemKey ?? getDefaultItemKey
  const overscan = normalizeOverscan(options.overscan)

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
