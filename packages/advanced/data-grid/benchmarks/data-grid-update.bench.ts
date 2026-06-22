// packages/advanced/data-grid/benchmarks/data-grid-update.bench.ts

import { describe, expect, it } from 'vitest'

import {
  createDataGridBenchmarkColumns,
  createDataGridBenchmarkDataset,
  createDataGridBenchmarkRows,
  DATA_GRID_BENCHMARK_SCENARIOS,
} from './benchmark-data'
import { measureDataGridUpdates } from './benchmark-metrics'

describe('data-grid update benchmark', () => {
  for (const scenario of DATA_GRID_BENCHMARK_SCENARIOS) {
    it(`captures rows/columns update baseline: ${scenario.name}`, () => {
      const dataset = createDataGridBenchmarkDataset(scenario)

      const nextRows = createDataGridBenchmarkRows(
        scenario.rowCount,
        scenario.columnCount,
      )
      const nextColumns = createDataGridBenchmarkColumns(scenario.columnCount)

      const result = measureDataGridUpdates({
        ...scenario,
        ...dataset,
        nextRows,
        nextColumns,
      })

      expect(result.initialRenderMs).toBeGreaterThanOrEqual(0)
      expect(result.rowsUpdateMs).toBeGreaterThanOrEqual(0)
      expect(result.columnsUpdateMs).toBeGreaterThanOrEqual(0)

      // 初始一次 + rows update 一次。
      expect(result.counters.createRows).toBe(2)

      // 初始一次 + rows update 重建 virtualizer 一次。
      expect(result.counters.createVirtualizer).toBe(2)

      // 初始一次 + columns update 一次。
      expect(result.counters.normalizeColumns).toBe(2)

      // initial / rows update / columns update 后各取过一次 snapshot。
      expect(result.counters.snapshots).toBe(3)
    })
  }
})
