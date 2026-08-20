import type { VirtualScrollAlign } from '@zeus-web/virtual'

import type {
  DataGridColumnVirtualItem,
  DataGridColumnVirtualRange,
  DataGridColumnVirtualSnapshot,
  NormalizedDataGridColumn,
} from '../types'

import {
  areVirtualRangesEqual,
  clamp,
  createEmptyVirtualRange,
} from '@zeus-web/virtual'

export interface DataGridColumnVirtualizerOptions {
  columns: NormalizedDataGridColumn[]
  overscan?: number
}

export interface DataGridColumnVirtualizer {
  getSnapshot: (
    scrollOffset: number,
    viewportSize: number,
  ) => DataGridColumnVirtualSnapshot
  getRange: (
    scrollOffset: number,
    viewportSize: number,
  ) => DataGridColumnVirtualRange
  getItems: (range: DataGridColumnVirtualRange) => DataGridColumnVirtualItem[]
  getTotalSize: () => number
  getOffsetForIndex: (
    index: number,
    align?: VirtualScrollAlign,
    viewportSize?: number,
  ) => number
}

function normalizeOverscan(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) return 2
  return Math.floor(value)
}

function findIndexAtOffset(offsets: number[], offset: number): number {
  let low = 0
  let high = offsets.length - 2

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const start = offsets[middle]
    const end = offsets[middle + 1]

    if (offset < start) {
      high = middle - 1
    } else if (offset >= end) {
      low = middle + 1
    } else {
      return middle
    }
  }

  return clamp(low, 0, Math.max(0, offsets.length - 2))
}

export function areDataGridColumnVirtualItemsEqual(
  left: DataGridColumnVirtualItem[],
  right: DataGridColumnVirtualItem[],
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
      a.end !== b.end ||
      a.data !== b.data
    ) {
      return false
    }
  }

  return true
}

export function shouldUpdateDataGridColumnVirtualSnapshot(
  current: DataGridColumnVirtualSnapshot,
  next: DataGridColumnVirtualSnapshot,
): boolean {
  return (
    current.totalSize !== next.totalSize ||
    !areVirtualRangesEqual(current.range, next.range) ||
    !areDataGridColumnVirtualItemsEqual(current.items, next.items)
  )
}

export function createDataGridColumnVirtualizer(
  options: DataGridColumnVirtualizerOptions,
): DataGridColumnVirtualizer {
  const columns = options.columns
  const overscan = normalizeOverscan(options.overscan)
  const offsets = [0]

  for (const column of columns) {
    offsets.push(offsets[offsets.length - 1] + column.width)
  }

  const totalSize = offsets[offsets.length - 1]

  function getRange(
    scrollOffset: number,
    viewportSize: number,
  ): DataGridColumnVirtualRange {
    if (columns.length === 0 || viewportSize <= 0) {
      return createEmptyVirtualRange()
    }

    const maxScrollOffset = Math.max(0, totalSize - viewportSize)
    const offset = clamp(scrollOffset, 0, maxScrollOffset)
    const start = findIndexAtOffset(offsets, offset)
    const end = findIndexAtOffset(
      offsets,
      Math.max(offset, offset + viewportSize - 1),
    )

    return {
      start,
      end,
      overscanStart: clamp(start - overscan, 0, columns.length - 1),
      overscanEnd: clamp(end + overscan, 0, columns.length - 1),
    }
  }

  function getItems(
    range: DataGridColumnVirtualRange,
  ): DataGridColumnVirtualItem[] {
    if (range.overscanEnd < range.overscanStart) return []

    const items: DataGridColumnVirtualItem[] = []

    for (
      let index = range.overscanStart;
      index <= range.overscanEnd;
      index += 1
    ) {
      const start = offsets[index]
      const end = offsets[index + 1]

      items.push({
        index,
        key: columns[index].id,
        start,
        size: end - start,
        end,
        data: columns[index],
      })
    }

    return items
  }

  return {
    getRange,
    getItems,

    getSnapshot(
      scrollOffset: number,
      viewportSize: number,
    ): DataGridColumnVirtualSnapshot {
      const range = getRange(scrollOffset, viewportSize)

      return {
        range,
        items: getItems(range),
        totalSize,
      }
    },

    getTotalSize(): number {
      return totalSize
    },

    getOffsetForIndex(
      index: number,
      align: VirtualScrollAlign = 'start',
      viewportSize = 0,
    ): number {
      if (columns.length === 0) return 0

      const normalizedIndex = clamp(Math.floor(index), 0, columns.length - 1)
      const start = offsets[normalizedIndex]
      const end = offsets[normalizedIndex + 1]
      let offset = start

      if (align === 'center') {
        offset = start - (viewportSize - (end - start)) / 2
      } else if (align === 'end') {
        offset = end - viewportSize
      }

      return clamp(offset, 0, Math.max(0, totalSize - viewportSize))
    },
  }
}
