// packages/advanced/data-grid/benchmarks/benchmark-metrics.ts

import type {
  DataGridColumn,
  DataGridRowData,
  DataGridVirtualSnapshot,
  NormalizedDataGridColumn,
} from '../src/types'

import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { createEmptyVirtualRange } from '@zeus-web/virtual'
import {
  applyDataGridColumnWidths,
  createDataGridColumnWidthState,
  createDataGridRows,
  createDataGridRowVirtualizer,
  getVisibleDataGridColumns,
  normalizeDataGridColumns,
  shouldUpdateDataGridVirtualSnapshot,
} from '../src/core'

export interface DataGridDomBudgetInput {
  renderedRowCount: number
  renderedColumnCount: number
}

export interface DataGridDomBudget {
  shellNodes: number
  headerNodes: number
  rowNodes: number
  cellNodes: number
  totalNodes: number
}

export interface DataGridBenchmarkRuntimeOptions {
  rows: DataGridRowData[]
  columns: DataGridColumn[]
  rowHeight: number
  overscan: number
}

export interface DataGridBenchmarkCounters {
  normalizeColumns: number
  createRows: number
  createVirtualizer: number
  snapshots: number
  rangeChanges: number
}

export interface DataGridBenchmarkRuntime {
  getColumns: () => NormalizedDataGridColumn[]
  getSnapshot: (
    scrollOffset: number,
    viewportSize: number,
  ) => DataGridVirtualSnapshot
  scrollToOffset: (
    scrollOffset: number,
    viewportSize: number,
  ) => DataGridVirtualSnapshot
  updateRows: (rows: DataGridRowData[]) => void
  updateColumns: (columns: DataGridColumn[]) => void
  getCounters: () => DataGridBenchmarkCounters
}

export interface DataGridRenderBenchmarkResult {
  name: string
  rowCount: number
  columnCount: number
  firstRenderMs: number
  renderedRows: number
  renderedColumns: number
  estimatedDomNodes: DataGridDomBudget
  totalSize: number
  memoryBefore?: DataGridMemorySample
  memoryAfter?: DataGridMemorySample
}

export interface DataGridScrollBenchmarkResult {
  name: string
  frames: number
  durationMs: number
  averageFrameCostMs: number
  estimatedFps: number
  rangeChanges: number
  renderedRowsMax: number
  renderedRowsBudget: number
  counters: DataGridBenchmarkCounters
  memoryBefore?: DataGridMemorySample
  memoryAfter?: DataGridMemorySample
}

export interface DataGridUpdateBenchmarkResult {
  name: string
  initialRenderMs: number
  rowsUpdateMs: number
  columnsUpdateMs: number
  counters: DataGridBenchmarkCounters
  memoryBefore?: DataGridMemorySample
  memoryAfter?: DataGridMemorySample
}

export interface DataGridMemorySample {
  heapUsed: number
  heapTotal?: number
  rss?: number
}

function cloneEmptyDataGridSnapshot(): DataGridVirtualSnapshot {
  return {
    range: createEmptyVirtualRange(),
    items: [],
    totalSize: 0,
  }
}

export function estimateDataGridDomBudget(
  input: DataGridDomBudgetInput,
): DataGridDomBudget {
  const renderedRowCount = Math.max(0, input.renderedRowCount)
  const renderedColumnCount = Math.max(0, input.renderedColumnCount)

  // 当前结构：
  // Host + viewport + header + spacer + body + empty。
  const shellNodes = 6

  // 每个 header cell 包含：
  // header-cell + header-label + resize-handle。
  const headerNodes = renderedColumnCount * 3

  // 每个 body row 是一个 row 节点。
  const rowNodes = renderedRowCount

  // 当前横向未虚拟化，所以 cell = rendered rows × visible columns。
  const cellNodes = renderedRowCount * renderedColumnCount

  return {
    shellNodes,
    headerNodes,
    rowNodes,
    cellNodes,
    totalNodes: shellNodes + headerNodes + rowNodes + cellNodes,
  }
}

export function getRenderedRowsBudget(
  viewportSize: number,
  rowHeight: number,
  overscan: number,
): number {
  // 纵向虚拟化在 scroll 边界 offset 时，会多露出半行
  // （顶部 / 底部各占一行的部分），所以 max visible rows 用
  // floor(viewport/rowHeight) + 1，而不是 ceil。
  const safeRowHeight = Math.max(1, rowHeight)
  const visibleRows = Math.floor(Math.max(0, viewportSize) / safeRowHeight) + 1

  return visibleRows + Math.max(0, overscan) * 2
}

export function createDataGridBenchmarkRuntime(
  options: DataGridBenchmarkRuntimeOptions,
): DataGridBenchmarkRuntime {
  let rowsSource = options.rows
  let columnsSource = options.columns

  const counters: DataGridBenchmarkCounters = {
    normalizeColumns: 0,
    createRows: 0,
    createVirtualizer: 0,
    snapshots: 0,
    rangeChanges: 0,
  }

  let currentSnapshot = cloneEmptyDataGridSnapshot()

  let columns = normalizeColumns(columnsSource)
  let rows = normalizeRows(rowsSource)
  let virtualizer = createVirtualizer(rows)

  function normalizeColumns(
    source: DataGridColumn[],
  ): NormalizedDataGridColumn[] {
    counters.normalizeColumns += 1

    const baseColumns = normalizeDataGridColumns(source)
    const widths = createDataGridColumnWidthState(baseColumns)

    return getVisibleDataGridColumns(
      applyDataGridColumnWidths(baseColumns, widths),
    )
  }

  function normalizeRows(source: DataGridRowData[]) {
    counters.createRows += 1
    return createDataGridRows(source)
  }

  function createVirtualizer(nextRows = rows) {
    counters.createVirtualizer += 1

    return createDataGridRowVirtualizer({
      rows: nextRows,
      rowHeight: options.rowHeight,
      overscan: options.overscan,
    })
  }

  function getSnapshot(
    scrollOffset: number,
    viewportSize: number,
  ): DataGridVirtualSnapshot {
    counters.snapshots += 1

    const nextSnapshot = virtualizer.getSnapshot(scrollOffset, viewportSize)

    if (shouldUpdateDataGridVirtualSnapshot(currentSnapshot, nextSnapshot)) {
      counters.rangeChanges += 1
      currentSnapshot = nextSnapshot
    }

    return nextSnapshot
  }

  return {
    getColumns() {
      return columns
    },

    getSnapshot,

    scrollToOffset(scrollOffset, viewportSize) {
      return getSnapshot(scrollOffset, viewportSize)
    },

    updateRows(nextRows) {
      rowsSource = nextRows
      rows = normalizeRows(rowsSource)
      virtualizer = createVirtualizer(rows)
      currentSnapshot = cloneEmptyDataGridSnapshot()
    },

    updateColumns(nextColumns) {
      columnsSource = nextColumns
      columns = normalizeColumns(columnsSource)
    },

    getCounters() {
      return { ...counters }
    },
  }
}

export function measureDataGridFirstRender(input: {
  name: string
  rows: DataGridRowData[]
  columns: DataGridColumn[]
  rowHeight: number
  overscan: number
  viewportSize: number
}): DataGridRenderBenchmarkResult {
  const memoryBefore = sampleDataGridMemory()
  const start = performance.now()

  const runtime = createDataGridBenchmarkRuntime({
    rows: input.rows,
    columns: input.columns,
    rowHeight: input.rowHeight,
    overscan: input.overscan,
  })

  const snapshot = runtime.getSnapshot(0, input.viewportSize)
  const columns = runtime.getColumns()

  const firstRenderMs = performance.now() - start
  const memoryAfter = sampleDataGridMemory()

  return {
    name: input.name,
    rowCount: input.rows.length,
    columnCount: input.columns.length,
    firstRenderMs,
    renderedRows: snapshot.items.length,
    renderedColumns: columns.length,
    estimatedDomNodes: estimateDataGridDomBudget({
      renderedRowCount: snapshot.items.length,
      renderedColumnCount: columns.length,
    }),
    totalSize: snapshot.totalSize,
    memoryBefore,
    memoryAfter,
  }
}

export function measureDataGridScroll(input: {
  name: string
  rows: DataGridRowData[]
  columns: DataGridColumn[]
  rowHeight: number
  overscan: number
  viewportSize: number
  frames: number
}): DataGridScrollBenchmarkResult {
  const runtime = createDataGridBenchmarkRuntime({
    rows: input.rows,
    columns: input.columns,
    rowHeight: input.rowHeight,
    overscan: input.overscan,
  })

  const maxScrollOffset = Math.max(
    0,
    input.rows.length * input.rowHeight - input.viewportSize,
  )

  const memoryBefore = sampleDataGridMemory()
  const start = performance.now()
  let renderedRowsMax = 0

  for (let frame = 0; frame < input.frames; frame += 1) {
    const ratio = input.frames <= 1 ? 1 : frame / (input.frames - 1)
    const offset = Math.round(maxScrollOffset * ratio)
    const snapshot = runtime.scrollToOffset(offset, input.viewportSize)

    renderedRowsMax = Math.max(renderedRowsMax, snapshot.items.length)
  }

  const durationMs = performance.now() - start
  const memoryAfter = sampleDataGridMemory()
  const counters = runtime.getCounters()

  const averageFrameCostMs = durationMs / Math.max(1, input.frames)
  const estimatedFps =
    averageFrameCostMs <= 0
      ? Number.POSITIVE_INFINITY
      : 1000 / averageFrameCostMs

  return {
    name: input.name,
    frames: input.frames,
    durationMs,
    averageFrameCostMs,
    estimatedFps,
    rangeChanges: counters.rangeChanges,
    renderedRowsMax,
    renderedRowsBudget: getRenderedRowsBudget(
      input.viewportSize,
      input.rowHeight,
      input.overscan,
    ),
    counters,
    memoryBefore,
    memoryAfter,
  }
}

export function measureDataGridUpdates(input: {
  name: string
  rows: DataGridRowData[]
  nextRows: DataGridRowData[]
  columns: DataGridColumn[]
  nextColumns: DataGridColumn[]
  rowHeight: number
  overscan: number
  viewportSize: number
}): DataGridUpdateBenchmarkResult {
  const memoryBefore = sampleDataGridMemory()

  const initialStart = performance.now()
  const runtime = createDataGridBenchmarkRuntime({
    rows: input.rows,
    columns: input.columns,
    rowHeight: input.rowHeight,
    overscan: input.overscan,
  })
  runtime.getSnapshot(0, input.viewportSize)
  const initialRenderMs = performance.now() - initialStart

  const rowsUpdateStart = performance.now()
  runtime.updateRows(input.nextRows)
  runtime.getSnapshot(0, input.viewportSize)
  const rowsUpdateMs = performance.now() - rowsUpdateStart

  const columnsUpdateStart = performance.now()
  runtime.updateColumns(input.nextColumns)
  runtime.getSnapshot(0, input.viewportSize)
  const columnsUpdateMs = performance.now() - columnsUpdateStart

  const memoryAfter = sampleDataGridMemory()

  return {
    name: input.name,
    initialRenderMs,
    rowsUpdateMs,
    columnsUpdateMs,
    counters: runtime.getCounters(),
    memoryBefore,
    memoryAfter,
  }
}

export function sampleDataGridMemory(): DataGridMemorySample | undefined {
  if (
    typeof process === 'undefined' ||
    typeof process.memoryUsage !== 'function'
  ) {
    return undefined
  }

  const memory = process.memoryUsage()

  return {
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    rss: memory.rss,
  }
}
