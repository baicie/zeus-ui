// packages/advanced/data-grid/benchmarks/data-grid-scroll.bench.ts

import { describe, expect, it } from 'vitest'

import {
  createDataGridBenchmarkDataset,
  DATA_GRID_BENCHMARK_SCENARIOS,
} from './benchmark-data'
import { measureDataGridScroll } from './benchmark-metrics'

describe('data-grid scroll benchmark', () => {
  for (const scenario of DATA_GRID_BENCHMARK_SCENARIOS) {
    it(`captures scroll update baseline: ${scenario.name}`, () => {
      const dataset = createDataGridBenchmarkDataset(scenario)

      const result = measureDataGridScroll({
        ...scenario,
        ...dataset,
        frames: 120,
      })

      expect(result.frames).toBe(120)
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
      expect(result.averageFrameCostMs).toBeGreaterThanOrEqual(0)
      expect(result.estimatedFps).toBeGreaterThan(0)

      expect(result.renderedRowsMax).toBeLessThanOrEqual(
        result.renderedRowsBudget,
      )

      // 核心：滚动时只取 virtual snapshot，不应重新 normalize columns/rows。
      expect(result.counters.normalizeColumns).toBe(1)
      expect(result.counters.createRows).toBe(1)
      expect(result.counters.createVirtualizer).toBe(1)

      expect(result.counters.snapshots).toBe(120)
      expect(result.rangeChanges).toBeGreaterThan(1)
      expect(result.rangeChanges).toBeLessThanOrEqual(120)
    })
  }
})
