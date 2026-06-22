// packages/advanced/data-grid/benchmarks/data-grid-render.bench.ts

import { describe, expect, it } from 'vitest'

import {
  createDataGridBenchmarkDataset,
  DATA_GRID_BENCHMARK_SCENARIOS,
} from './benchmark-data'
import {
  getRenderedRowsBudget,
  measureDataGridFirstRender,
} from './benchmark-metrics'

describe('data-grid render benchmark', () => {
  for (const scenario of DATA_GRID_BENCHMARK_SCENARIOS) {
    it(`captures first render baseline: ${scenario.name}`, () => {
      const dataset = createDataGridBenchmarkDataset(scenario)

      const result = measureDataGridFirstRender({
        ...scenario,
        ...dataset,
      })

      expect(result.rowCount).toBe(scenario.rowCount)
      expect(result.columnCount).toBe(scenario.columnCount)
      expect(result.totalSize).toBe(scenario.rowCount * scenario.rowHeight)
      expect(result.firstRenderMs).toBeGreaterThanOrEqual(0)

      expect(result.renderedRows).toBeLessThanOrEqual(
        getRenderedRowsBudget(
          scenario.viewportSize,
          scenario.rowHeight,
          scenario.overscan,
        ),
      )

      // 当前阶段横向未虚拟化，所以 renderedColumns 应等于 columnCount。
      expect(result.renderedColumns).toBe(scenario.columnCount)

      // 但纵向虚拟化必须确保 DOM cells 不随 rowCount 线性增长。
      expect(result.estimatedDomNodes.cellNodes).toBe(
        result.renderedRows * scenario.columnCount,
      )
      expect(result.estimatedDomNodes.cellNodes).toBeLessThan(
        scenario.rowCount * scenario.columnCount,
      )
    })
  }
})
