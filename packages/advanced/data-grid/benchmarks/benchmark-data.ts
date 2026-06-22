// packages/advanced/data-grid/benchmarks/benchmark-data.ts

import type { DataGridColumn, DataGridRowData } from '../src/types'
import process from 'node:process'

export type DataGridBenchmarkDataMode = 'sparse' | 'dense'

export interface DataGridBenchmarkScenario {
  name: string
  rowCount: number
  columnCount: number
  rowHeight: number
  viewportSize: number
  overscan: number
}

export interface DataGridBenchmarkRowsOptions {
  dataMode?: DataGridBenchmarkDataMode
  seed?: number
}

export interface DataGridBenchmarkDatasetOptions extends DataGridBenchmarkRowsOptions {}

export const DATA_GRID_BENCHMARK_SCENARIOS = [
  {
    name: '10k rows x 20 columns',
    rowCount: 10_000,
    columnCount: 20,
    rowHeight: 40,
    viewportSize: 480,
    overscan: 4,
  },
  {
    name: '100k rows x 20 columns',
    rowCount: 100_000,
    columnCount: 20,
    rowHeight: 40,
    viewportSize: 480,
    overscan: 4,
  },
  {
    name: '100k rows x 100 columns',
    rowCount: 100_000,
    columnCount: 100,
    rowHeight: 40,
    viewportSize: 480,
    overscan: 4,
  },
] satisfies DataGridBenchmarkScenario[]

export function resolveDataGridBenchmarkDataMode(): DataGridBenchmarkDataMode {
  return process.env.ZEUS_DATA_GRID_BENCH_DENSE === '1' ? 'dense' : 'sparse'
}

export function createDataGridBenchmarkColumns(
  columnCount: number,
): DataGridColumn[] {
  assertPositiveInteger(columnCount, 'columnCount')

  return Array.from({ length: columnCount }, (_, index) => {
    const columnNumber = index + 1

    return {
      id: `col_${columnNumber}`,
      header: `Column ${columnNumber}`,
      field: `col_${columnNumber}`,
      width: index === 0 ? 120 : 140,
      minWidth: 80,
      maxWidth: 320,
      align: index % 3 === 0 ? 'end' : 'start',
      sortable: index < 8,
      resizable: true,
    } satisfies DataGridColumn
  })
}

export function createDataGridBenchmarkRows(
  rowCount: number,
  columnCount: number,
  options: DataGridBenchmarkRowsOptions = {},
): DataGridRowData[] {
  assertPositiveInteger(rowCount, 'rowCount')
  assertPositiveInteger(columnCount, 'columnCount')

  const dataMode = options.dataMode ?? resolveDataGridBenchmarkDataMode()
  const seed = options.seed ?? 0

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const row: DataGridRowData = {
      id: `row_${seed}_${rowIndex + 1}`,
      index: rowIndex,
    }

    if (dataMode === 'sparse') {
      // CI 默认只保留稳定 row identity 与少量字段。
      // 这仍然能验证 100k 行模型、虚拟 range、列数量与 DOM 预算，
      // 但不会把 benchmark 变成 1000 万字段对象的内存压力测试。
      row.col_1 = rowIndex
      row.col_2 = `R${rowIndex + 1}-C2`
      return row
    }

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const columnNumber = columnIndex + 1

      row[`col_${columnNumber}`] =
        columnIndex % 4 === 0
          ? (rowIndex + seed) * columnNumber
          : `R${rowIndex + 1}-C${columnNumber}`
    }

    return row
  })
}

export function createDataGridBenchmarkDataset(
  scenario: DataGridBenchmarkScenario,
  options: DataGridBenchmarkDatasetOptions = {},
): {
  rows: DataGridRowData[]
  columns: DataGridColumn[]
} {
  return {
    rows: createDataGridBenchmarkRows(
      scenario.rowCount,
      scenario.columnCount,
      options,
    ),
    columns: createDataGridBenchmarkColumns(scenario.columnCount),
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`[data-grid:bench] ${name} must be a positive integer.`)
  }
}
