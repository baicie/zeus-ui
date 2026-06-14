import type {
  ChatThreadScrollAlign,
  ChatThreadVirtualItem,
  ChatThreadVirtualizer,
  ChatThreadVirtualizerOptions,
  ChatThreadVirtualRange,
  ChatThreadVirtualSnapshot,
} from '../types'

import { createEmptyVirtualRange, createVirtualizer } from '@zeus-web/virtual'

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
