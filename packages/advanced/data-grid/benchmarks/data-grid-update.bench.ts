import { describe, expect, it } from 'vitest'

import {
  createDataGridBenchmarkColumns,
  createDataGridBenchmarkDataset,
  createDataGridBenchmarkRows,
  DATA_GRID_BENCHMARK_SCENARIOS,
} from './benchmark-data'
import {
  formatDataGridBenchmarkResult,
  measureDataGridUpdates,
} from './benchmark-metrics'

describe('data-grid update benchmark', () => {
  for (const scenario of DATA_GRID_BENCHMARK_SCENARIOS) {
    it(`captures real rows/columns update baseline: ${scenario.name}`, () => {
      const dataset = createDataGridBenchmarkDataset(scenario)
      const nextRows = createDataGridBenchmarkRows(
        scenario.rowCount,
        scenario.columnCount,
        {
          seed: 1,
        },
      )
      const nextColumns = createDataGridBenchmarkColumns(scenario.columnCount)

      nextColumns[0].header = 'Updated Column 1'
      nextColumns[0].field = 'col_2'

      return measureDataGridUpdates({
        name: scenario.name,
        rows: dataset.rows,
        columns: dataset.columns,
        rowHeight: scenario.rowHeight,
        viewportSize: scenario.viewportSize,
        viewportWidth: scenario.viewportWidth,
        overscan: scenario.overscan,
        overscanColumns: scenario.overscanColumns,
        nextRows,
        nextColumns,
      }).then(result => {
        console.info(formatDataGridBenchmarkResult('update', result))

        expect(result.initialRenderMs).toBeGreaterThanOrEqual(0)
        expect(result.rowsUpdateMs).toBeGreaterThanOrEqual(0)
        expect(result.columnsUpdateMs).toBeGreaterThanOrEqual(0)
        expect(result.rowCountAfterUpdate).toBe(scenario.rowCount)
        expect(result.columnCountAfterUpdate).toBe(scenario.columnCount)
        expect(result.totalSizeAfterRowsUpdate).toBe(
          scenario.rowCount * scenario.rowHeight,
        )
        expect(result.domAfterRowsUpdate.renderedCells).toBeGreaterThan(0)
        expect(result.domAfterRowsUpdate.firstRenderedRowKey).toBe('row_1_1')
        expect(result.domAfterColumnsUpdate.renderedColumns).toBeLessThan(
          scenario.columnCount,
        )
        expect(result.firstCellTextAfterColumnsUpdate).toBe('R1-C2')
        expect(result.memoryTrend).toBeDefined()
      })
    })
  }
})
