import { describe, expect, it } from 'vitest'

import {
  createDataGridBenchmarkDataset,
  DATA_GRID_BENCHMARK_SCENARIOS,
} from './benchmark-data'
import {
  formatDataGridBenchmarkResult,
  getRenderedRowsBudget,
  measureDataGridFirstRender,
} from './benchmark-metrics'

describe('data-grid render benchmark', () => {
  for (const scenario of DATA_GRID_BENCHMARK_SCENARIOS) {
    it(`captures real first render baseline: ${scenario.name}`, () => {
      const dataset = createDataGridBenchmarkDataset(scenario)

      return measureDataGridFirstRender({
        name: scenario.name,
        rows: dataset.rows,
        columns: dataset.columns,
        rowHeight: scenario.rowHeight,
        viewportSize: scenario.viewportSize,
        overscan: scenario.overscan,
      }).then(result => {
        const renderedRowsBudget = getRenderedRowsBudget(
          scenario.viewportSize,
          scenario.rowHeight,
          scenario.overscan,
        )

        console.info(formatDataGridBenchmarkResult('render', result))

        expect(result.rowCount).toBe(scenario.rowCount)
        expect(result.columnCount).toBe(scenario.columnCount)
        expect(result.totalSize).toBe(scenario.rowCount * scenario.rowHeight)
        expect(result.firstRenderMs).toBeGreaterThanOrEqual(0)
        expect(result.dom.renderedRows).toBeLessThanOrEqual(renderedRowsBudget)
        expect(result.dom.renderedColumns).toBe(scenario.columnCount)
        expect(result.dom.renderedCells).toBe(
          result.dom.renderedRows * scenario.columnCount,
        )
        expect(result.dom.renderedCells).toBeLessThan(
          scenario.rowCount * scenario.columnCount,
        )
        expect(result.dom.totalElements).toBeGreaterThan(
          result.dom.renderedCells,
        )
      })
    })
  }
})
