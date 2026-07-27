import { describe, expect, it } from 'vitest'

import {
  createDataGridBenchmarkDataset,
  DATA_GRID_BENCHMARK_SCENARIOS,
} from './benchmark-data'
import {
  formatDataGridBenchmarkResult,
  measureDataGridScroll,
} from './benchmark-metrics'

describe('data-grid scroll benchmark', () => {
  for (const scenario of DATA_GRID_BENCHMARK_SCENARIOS) {
    it(`captures real scroll update baseline: ${scenario.name}`, () => {
      const dataset = createDataGridBenchmarkDataset(scenario)

      return measureDataGridScroll({
        name: scenario.name,
        rows: dataset.rows,
        columns: dataset.columns,
        rowHeight: scenario.rowHeight,
        viewportSize: scenario.viewportSize,
        viewportWidth: scenario.viewportWidth,
        overscan: scenario.overscan,
        overscanColumns: scenario.overscanColumns,
        frames: 120,
      }).then(result => {
        console.info(formatDataGridBenchmarkResult('scroll', result))

        expect(result.frames).toBe(120)
        expect(result.frameDurationMs).toBeGreaterThanOrEqual(0)
        expect(result.averageFrameLatencyMs).toBeGreaterThanOrEqual(0)
        expect(result.framesPerSecond).toBeGreaterThan(0)
        expect(result.renderedRowsMax).toBeLessThanOrEqual(
          result.renderedRowsBudget,
        )
        expect(result.renderedColumnsMax).toBeLessThanOrEqual(
          result.renderedColumnsBudget,
        )
        expect(result.renderedCellsMax).toBeLessThanOrEqual(
          result.renderedRowsBudget * result.renderedColumnsBudget,
        )
        expect(result.renderedCellsMax).toBeLessThanOrEqual(600)
        expect(result.rowCountAfterScroll).toBe(scenario.rowCount)
        expect(result.columnCountAfterScroll).toBe(scenario.columnCount)
        expect(result.lastItemIndexAfterScroll).toBe(scenario.rowCount - 1)
        expect(result.lastColumnItemIndexAfterScroll).toBe(
          scenario.columnCount - 1,
        )
        expect(result.lastRenderedRowIndexAfterScroll).toBe(
          scenario.rowCount - 1,
        )
        expect(result.rangeChanges).toBeGreaterThan(1)
        expect(result.rangeChanges).toBeLessThanOrEqual(120)
      })
    })
  }
})
