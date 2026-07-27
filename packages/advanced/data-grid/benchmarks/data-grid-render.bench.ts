import { describe, expect, it } from 'vitest'

import {
  createDataGridBenchmarkDataset,
  DATA_GRID_BENCHMARK_SCENARIOS,
} from './benchmark-data'
import {
  formatDataGridBenchmarkResult,
  getRenderedColumnsBudget,
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
        viewportWidth: scenario.viewportWidth,
        overscan: scenario.overscan,
        overscanColumns: scenario.overscanColumns,
      }).then(result => {
        const renderedRowsBudget = getRenderedRowsBudget(
          scenario.viewportSize,
          scenario.rowHeight,
          scenario.overscan,
        )
        const renderedColumnsBudget = getRenderedColumnsBudget(
          scenario.viewportWidth,
          dataset.columns,
          scenario.overscanColumns,
        )

        console.info(formatDataGridBenchmarkResult('render', result))

        expect(result.rowCount).toBe(scenario.rowCount)
        expect(result.columnCount).toBe(scenario.columnCount)
        expect(result.totalSize).toBe(scenario.rowCount * scenario.rowHeight)
        expect(result.firstRenderMs).toBeGreaterThanOrEqual(0)
        expect(result.dom.renderedRows).toBeLessThanOrEqual(renderedRowsBudget)
        expect(result.dom.renderedColumns).toBeLessThanOrEqual(
          renderedColumnsBudget,
        )
        expect(result.dom.renderedCells).toBe(
          result.dom.renderedRows * result.dom.renderedColumns,
        )
        expect(result.dom.renderedCells).toBeLessThanOrEqual(
          renderedRowsBudget * renderedColumnsBudget,
        )
        expect(result.dom.renderedCells).toBeLessThanOrEqual(600)
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
