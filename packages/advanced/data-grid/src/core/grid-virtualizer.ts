import type {
  DataGridRow,
  DataGridVirtualItem,
  DataGridVirtualRange,
  DataGridVirtualSnapshot,
  VirtualScrollAlign,
} from '../types'

import {
  areVirtualRangesEqual,
  createEmptyVirtualRange,
  createVirtualizer,
} from '@zeus-web/virtual'

export interface DataGridRowVirtualizerOptions {
  rows: DataGridRow[]
  rowHeight: number
  overscan?: number
}

export interface DataGridRowVirtualizer {
  getSnapshot: (
    scrollOffset: number,
    viewportSize: number,
  ) => DataGridVirtualSnapshot
  getRange: (scrollOffset: number, viewportSize: number) => DataGridVirtualRange
  getItems: (range: DataGridVirtualRange) => DataGridVirtualItem[]
  getTotalSize: () => number
  getOffsetForIndex: (
    index: number,
    align?: VirtualScrollAlign,
    viewportSize?: number,
  ) => number
  measure: (index: number, size: number) => void
  resetMeasurements: () => void
}

function normalizeRowHeight(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 40
  return value
}

function normalizeOverscan(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) return 4
  return Math.floor(value)
}

function toVirtualItems(
  rows: DataGridRow[],
  items: Array<Omit<DataGridVirtualItem, 'data'>>,
): DataGridVirtualItem[] {
  return items.map(item => ({
    ...item,
    data: rows[item.index],
  }))
}

export function areDataGridVirtualItemsEqual(
  left: DataGridVirtualItem[],
  right: DataGridVirtualItem[],
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
      a.data?.key !== b.data?.key
    ) {
      return false
    }
  }

  return true
}

export function shouldUpdateDataGridVirtualSnapshot(
  current: DataGridVirtualSnapshot,
  next: DataGridVirtualSnapshot,
): boolean {
  return (
    current.totalSize !== next.totalSize ||
    !areVirtualRangesEqual(current.range, next.range) ||
    !areDataGridVirtualItemsEqual(current.items, next.items)
  )
}

export function createDataGridRowVirtualizer(
  options: DataGridRowVirtualizerOptions,
): DataGridRowVirtualizer {
  const rows = options.rows
  const virtualizer = createVirtualizer({
    count: rows.length,
    estimateSize: normalizeRowHeight(options.rowHeight),
    overscan: normalizeOverscan(options.overscan),
    getItemKey: index => rows[index]?.key ?? String(index),
  })

  function getRange(
    scrollOffset: number,
    viewportSize: number,
  ): DataGridVirtualRange {
    return virtualizer.getRange(scrollOffset, viewportSize)
  }

  function getItems(range: DataGridVirtualRange): DataGridVirtualItem[] {
    return toVirtualItems(rows, virtualizer.getItems(range))
  }

  function getTotalSize(): number {
    return virtualizer.getTotalSize()
  }

  function getSnapshot(
    scrollOffset: number,
    viewportSize: number,
  ): DataGridVirtualSnapshot {
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

  return {
    getSnapshot,
    getRange,
    getItems,
    getTotalSize,

    getOffsetForIndex(
      index: number,
      align: VirtualScrollAlign = 'start',
      viewportSize = 0,
    ): number {
      return virtualizer.getOffsetForIndex(index, {
        align,
        viewportSize,
      })
    },

    measure(index: number, size: number): void {
      virtualizer.measure(index, size)
    },

    resetMeasurements(): void {
      virtualizer.resetMeasurements()
    },
  }
}
