import type {
  DataGridColumn,
  DataGridElement,
  DataGridRangeChangeDetail,
  DataGridRowData,
} from '../src'

import { performance } from 'node:perf_hooks'
import process from 'node:process'

type DataGridRuntimeHarness =
  typeof import('../../../../e2e/advanced/data-grid/data-grid-runtime-harness')

export interface DataGridBenchmarkInput {
  name: string
  rows: DataGridRowData[]
  columns: DataGridColumn[]
  rowHeight: number
  overscan: number
  overscanColumns: number
  viewportSize: number
  viewportWidth: number
}

export interface DataGridScrollBenchmarkInput extends DataGridBenchmarkInput {
  frames: number
}

export interface DataGridUpdateBenchmarkInput extends DataGridBenchmarkInput {
  nextRows: DataGridRowData[]
  nextColumns: DataGridColumn[]
}

export interface DataGridDomSnapshot {
  renderedRows: number
  renderedColumns: number
  renderedCells: number
  totalElements: number
  firstRenderedRowKey: string
  lastRenderedRowIndex: number
}

export interface DataGridMemorySample {
  heapUsed: number
  heapTotal: number
  rss: number
}

export interface DataGridMemoryTrend {
  heapUsedDelta: number
  heapTotalDelta: number
  rssDelta: number
}

export interface DataGridRenderBenchmarkResult {
  name: string
  rowCount: number
  columnCount: number
  firstRenderMs: number
  dom: DataGridDomSnapshot
  totalSize: number
  memoryBefore: DataGridMemorySample
  memoryAfter: DataGridMemorySample
  memoryTrend: DataGridMemoryTrend
}

export interface DataGridScrollBenchmarkResult {
  name: string
  frames: number
  frameDurationMs: number
  averageFrameLatencyMs: number
  framesPerSecond: number
  rangeChanges: number
  renderedRowsMax: number
  renderedColumnsMax: number
  renderedCellsMax: number
  renderedRowsBudget: number
  renderedColumnsBudget: number
  rowCountAfterScroll: number
  columnCountAfterScroll: number
  lastItemIndexAfterScroll: number
  lastColumnItemIndexAfterScroll: number
  lastRenderedRowIndexAfterScroll: number
  memoryBefore: DataGridMemorySample
  memoryAfter: DataGridMemorySample
  memoryTrend: DataGridMemoryTrend
}

export interface DataGridUpdateBenchmarkResult {
  name: string
  initialRenderMs: number
  rowsUpdateMs: number
  columnsUpdateMs: number
  rowCountAfterUpdate: number
  columnCountAfterUpdate: number
  totalSizeAfterRowsUpdate: number
  domAfterRowsUpdate: DataGridDomSnapshot
  domAfterColumnsUpdate: DataGridDomSnapshot
  firstCellTextAfterColumnsUpdate: string
  memoryBefore: DataGridMemorySample
  memoryAfter: DataGridMemorySample
  memoryTrend: DataGridMemoryTrend
}

interface MountedBenchmarkRun<T> {
  run: (grid: DataGridElement, harness: DataGridRuntimeHarness) => Promise<T>
}

interface MountedBenchmarkRunFactory<T> {
  (): MountedBenchmarkRun<T>
}

export type DataGridBenchmarkKind = 'render' | 'scroll' | 'update'

export const DATA_GRID_BENCHMARK_RESULT_PREFIX = '[data-grid:benchmark]'

export function formatDataGridBenchmarkResult(
  kind: DataGridBenchmarkKind,
  result:
    | DataGridRenderBenchmarkResult
    | DataGridScrollBenchmarkResult
    | DataGridUpdateBenchmarkResult,
): string {
  return `${DATA_GRID_BENCHMARK_RESULT_PREFIX} ${JSON.stringify({ kind, result })}`
}

export function captureDataGridDomSnapshot(
  grid: DataGridElement,
): DataGridDomSnapshot {
  const rows = grid.querySelectorAll<HTMLElement>('[data-slot="data-grid-row"]')
  const firstRow = rows.length > 0 ? rows[0] : undefined
  const lastRow = rows.length > 0 ? rows[rows.length - 1] : undefined
  const lastRowIndex = lastRow ? lastRow.getAttribute('data-row-index') : null

  return {
    renderedRows: rows.length,
    renderedColumns: grid.querySelectorAll(
      '[data-slot="data-grid-header-cell"]',
    ).length,
    renderedCells: grid.querySelectorAll('[data-slot="data-grid-cell"]').length,
    totalElements: grid.querySelectorAll('*').length + 1,
    firstRenderedRowKey: firstRow
      ? firstRow.getAttribute('data-row-key') || ''
      : '',
    lastRenderedRowIndex: lastRowIndex === null ? -1 : Number(lastRowIndex),
  }
}

export function getRenderedRowsBudget(
  viewportSize: number,
  rowHeight: number,
  overscan: number,
): number {
  const safeRowHeight = Math.max(1, rowHeight)
  const visibleRows = Math.floor(Math.max(0, viewportSize) / safeRowHeight) + 1

  return visibleRows + Math.max(0, overscan) * 2
}

export function getRenderedColumnsBudget(
  viewportWidth: number,
  columns: DataGridColumn[],
  overscanColumns: number,
): number {
  const visibleColumns = columns.filter(column => !column.hidden)
  if (visibleColumns.length === 0) return 0

  let minimumColumnWidth = Number.POSITIVE_INFINITY

  for (const column of visibleColumns) {
    const width =
      column.width !== undefined &&
      Number.isFinite(column.width) &&
      column.width > 0
        ? column.width
        : 160

    minimumColumnWidth = Math.min(minimumColumnWidth, width)
  }

  const intersectingColumns =
    Math.floor(Math.max(0, viewportWidth) / minimumColumnWidth) + 2

  return Math.min(
    visibleColumns.length,
    intersectingColumns + Math.max(0, overscanColumns) * 2,
  )
}

export function getDataGridMemoryTrend(
  before: DataGridMemorySample,
  after: DataGridMemorySample,
): DataGridMemoryTrend {
  return {
    heapUsedDelta: after.heapUsed - before.heapUsed,
    heapTotalDelta: after.heapTotal - before.heapTotal,
    rssDelta: after.rss - before.rss,
  }
}

export function sampleDataGridMemory(): DataGridMemorySample {
  const memory = process.memoryUsage()

  return {
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    rss: memory.rss,
  }
}

function mountBenchmarkGrid(
  input: DataGridBenchmarkInput,
  harness: DataGridRuntimeHarness,
): Promise<DataGridElement> {
  return harness
    .mountDataGrid({
      rows: input.rows,
      columns: input.columns,
      rowHeight: input.rowHeight,
      overscan: input.overscan,
      overscanColumns: input.overscanColumns,
      virtual: true,
    })
    .then(grid => {
      const viewport = harness.getViewport(grid)
      harness.setElementClientHeight(viewport, input.viewportSize)
      harness.setElementClientWidth(viewport, input.viewportWidth)
      grid.refreshViewport()

      return harness.nextFrame().then(() => grid)
    })
}

function runMountedBenchmark<T>(
  input: DataGridBenchmarkInput,
  createBenchmarkRun: MountedBenchmarkRunFactory<T>,
): Promise<T> {
  return import('../../../../e2e/advanced/data-grid/data-grid-runtime-harness').then(
    harness => {
      harness.cleanupDataGridFixtures()
      const benchmark = createBenchmarkRun()

      return mountBenchmarkGrid(input, harness)
        .then(grid => benchmark.run(grid, harness))
        .then(
          result => {
            harness.cleanupDataGridFixtures()
            return result
          },
          error => {
            harness.cleanupDataGridFixtures()
            throw error
          },
        )
    },
  )
}

export function measureDataGridFirstRender(
  input: DataGridBenchmarkInput,
): Promise<DataGridRenderBenchmarkResult> {
  return runMountedBenchmark(input, () => {
    const memoryBefore = sampleDataGridMemory()
    const start = performance.now()

    return {
      run(grid) {
        const firstRenderMs = performance.now() - start
        const memoryAfter = sampleDataGridMemory()

        return Promise.resolve({
          name: input.name,
          rowCount: input.rows.length,
          columnCount: input.columns.length,
          firstRenderMs,
          dom: captureDataGridDomSnapshot(grid),
          totalSize: grid.getTotalSize(),
          memoryBefore,
          memoryAfter,
          memoryTrend: getDataGridMemoryTrend(memoryBefore, memoryAfter),
        })
      },
    }
  })
}

export function measureDataGridScroll(
  input: DataGridScrollBenchmarkInput,
): Promise<DataGridScrollBenchmarkResult> {
  return runMountedBenchmark(input, () => ({
    run(grid, harness) {
      const collector = harness.collectEvents<DataGridRangeChangeDetail>(
        grid,
        'range-change',
      )
      const memoryBefore = sampleDataGridMemory()
      const frames = Math.max(1, Math.floor(input.frames))
      const maxScrollOffset = Math.max(
        0,
        input.rows.length * input.rowHeight - input.viewportSize,
      )
      const maxColumnScrollOffset = Math.max(
        0,
        grid.getTotalColumnSize() - input.viewportWidth,
      )
      const viewport = harness.getViewport(grid)
      let frameDurationMs = 0
      let renderedRowsMax = 0
      let renderedColumnsMax = 0
      let renderedCellsMax = 0
      let lastRenderedRowIndexAfterScroll = -1
      let sequence = Promise.resolve()

      for (let frame = 0; frame < frames; frame += 1) {
        const ratio = frames <= 1 ? 1 : frame / (frames - 1)
        const offset = Math.round(maxScrollOffset * ratio)
        const columnOffset = Math.round(maxColumnScrollOffset * ratio)

        sequence = sequence.then(() => {
          const frameStart = performance.now()

          viewport.scrollLeft = columnOffset
          grid.scrollToOffset(offset)

          return harness.nextFrame().then(() => {
            frameDurationMs += performance.now() - frameStart
            const dom = captureDataGridDomSnapshot(grid)
            renderedRowsMax = Math.max(renderedRowsMax, dom.renderedRows)
            renderedColumnsMax = Math.max(
              renderedColumnsMax,
              dom.renderedColumns,
            )
            renderedCellsMax = Math.max(renderedCellsMax, dom.renderedCells)
            lastRenderedRowIndexAfterScroll = dom.lastRenderedRowIndex
          })
        })
      }

      return sequence.then(
        () => {
          const averageFrameLatencyMs = frameDurationMs / frames
          const memoryAfter = sampleDataGridMemory()
          const itemsAfterScroll = grid.getItems()
          const columnItemsAfterScroll = grid.getColumnItems()
          const result: DataGridScrollBenchmarkResult = {
            name: input.name,
            frames,
            frameDurationMs,
            averageFrameLatencyMs,
            framesPerSecond:
              averageFrameLatencyMs <= 0
                ? Number.POSITIVE_INFINITY
                : 1000 / averageFrameLatencyMs,
            rangeChanges: collector.events.length,
            renderedRowsMax,
            renderedColumnsMax,
            renderedCellsMax,
            renderedRowsBudget: getRenderedRowsBudget(
              input.viewportSize,
              input.rowHeight,
              input.overscan,
            ),
            renderedColumnsBudget: getRenderedColumnsBudget(
              input.viewportWidth,
              input.columns,
              input.overscanColumns,
            ),
            rowCountAfterScroll: grid.getRows().length,
            columnCountAfterScroll: grid.getColumns().length,
            lastItemIndexAfterScroll:
              itemsAfterScroll.length > 0
                ? itemsAfterScroll[itemsAfterScroll.length - 1].index
                : -1,
            lastColumnItemIndexAfterScroll:
              columnItemsAfterScroll.length > 0
                ? columnItemsAfterScroll[columnItemsAfterScroll.length - 1]
                    .index
                : -1,
            lastRenderedRowIndexAfterScroll,
            memoryBefore,
            memoryAfter,
            memoryTrend: getDataGridMemoryTrend(memoryBefore, memoryAfter),
          }

          collector.dispose()
          return result
        },
        error => {
          collector.dispose()
          throw error
        },
      )
    },
  }))
}

export function measureDataGridUpdates(
  input: DataGridUpdateBenchmarkInput,
): Promise<DataGridUpdateBenchmarkResult> {
  return runMountedBenchmark(input, () => {
    const memoryBefore = sampleDataGridMemory()
    const initialStart = performance.now()

    return {
      run(grid, harness) {
        const initialRenderMs = performance.now() - initialStart
        const rowsUpdateStart = performance.now()

        grid.setRows(input.nextRows)

        return harness.nextFrame().then(() => {
          const rowsUpdateMs = performance.now() - rowsUpdateStart
          const totalSizeAfterRowsUpdate = grid.getTotalSize()
          const domAfterRowsUpdate = captureDataGridDomSnapshot(grid)
          const columnsUpdateStart = performance.now()

          grid.setColumns(input.nextColumns)

          return harness.nextFrame().then(() => {
            const columnsUpdateMs = performance.now() - columnsUpdateStart
            const domAfterColumnsUpdate = captureDataGridDomSnapshot(grid)
            const firstCell = grid.querySelector<HTMLElement>(
              '[data-slot="data-grid-cell"]',
            )
            const memoryAfter = sampleDataGridMemory()

            return {
              name: input.name,
              initialRenderMs,
              rowsUpdateMs,
              columnsUpdateMs,
              rowCountAfterUpdate: grid.getRows().length,
              columnCountAfterUpdate: grid.getColumns().length,
              totalSizeAfterRowsUpdate,
              domAfterRowsUpdate,
              domAfterColumnsUpdate,
              firstCellTextAfterColumnsUpdate:
                firstCell && firstCell.textContent ? firstCell.textContent : '',
              memoryBefore,
              memoryAfter,
              memoryTrend: getDataGridMemoryTrend(memoryBefore, memoryAfter),
            }
          })
        })
      },
    }
  })
}
