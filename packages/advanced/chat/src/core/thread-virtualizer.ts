import type {
  ChatThreadScrollAlign,
  ChatThreadVirtualItem,
  ChatThreadVirtualizer,
  ChatThreadVirtualizerOptions,
  ChatThreadVirtualRange,
  ChatThreadVirtualSnapshot,
} from '../types'

import {
  areVirtualRangesEqual,
  createEmptyVirtualRange,
  createVirtualizer,
} from '@zeus-web/virtual'

function normalizeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0

  return Math.floor(value)
}

function normalizeEstimateSize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 64

  return value
}

function normalizeOverscan(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) return 4

  return Math.floor(value)
}

function defaultItemKey(index: number): string {
  return String(index)
}

export function areChatThreadVirtualItemsEqual(
  left: ChatThreadVirtualItem[],
  right: ChatThreadVirtualItem[],
): boolean {
  if (left.length !== right.length) return false

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]
    const b = right[index]

    if (
      a.index !== b.index ||
      a.key !== b.key ||
      a.start !== b.start ||
      a.size !== b.size ||
      a.end !== b.end
    ) {
      return false
    }
  }

  return true
}

export function shouldUpdateChatThreadVirtualSnapshot(
  current: ChatThreadVirtualSnapshot,
  next: ChatThreadVirtualSnapshot,
): boolean {
  return (
    current.totalSize !== next.totalSize ||
    !areVirtualRangesEqual(current.range, next.range) ||
    !areChatThreadVirtualItemsEqual(current.items, next.items)
  )
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
    return virtualizer.getItems(range)
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

    return {
      range,
      items: getItems(range),
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
