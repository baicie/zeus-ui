// packages/advanced/data-grid/__tests__/benchmark-metrics.spec.ts

import { describe, expect, it } from 'vitest'

import {
  createDataGridBenchmarkColumns,
  createDataGridBenchmarkRows,
} from '../benchmarks/benchmark-data'
import {
  createDataGridBenchmarkRuntime,
  estimateDataGridDomBudget,
  getDataGridMemoryTrend,
  getRenderedRowsBudget,
  measureDataGridFirstRender,
  measureDataGridScroll,
} from '../benchmarks/benchmark-metrics'

describe('data-grid benchmark metrics', () => {
  it('estimates DOM budget for current non-horizontal-virtualized grid', () => {
    const budget = estimateDataGridDomBudget({
      renderedRowCount: 20,
      renderedColumnCount: 100,
    })

    expect(budget.shellNodes).toBe(6)
    expect(budget.headerNodes).toBe(300)
    expect(budget.rowNodes).toBe(20)
    expect(budget.cellNodes).toBe(2000)
    expect(budget.totalNodes).toBe(2326)
  })

  it('computes rendered row budget from viewport and overscan', () => {
    // 480 / 40 = 12 整除，max visible = 12 + 1 = 13, budget = 13 + 8 = 21
    expect(getRenderedRowsBudget(480, 40, 4)).toBe(21)
    // 400 / 40 = 10 整除, max visible = 11, budget = 19
    expect(getRenderedRowsBudget(400, 40, 4)).toBe(19)
  })

  it('computes memory trend deltas', () => {
    expect(
      getDataGridMemoryTrend(
        {
          heapUsed: 100,
          heapTotal: 200,
          rss: 300,
        },
        {
          heapUsed: 150,
          heapTotal: 260,
          rss: 390,
        },
      ),
    ).toEqual({
      heapUsedDelta: 50,
      heapTotalDelta: 60,
      rssDelta: 90,
    })
  })

  it('keeps 100k x 20 rendered rows within virtual budget', () => {
    const rows = createDataGridBenchmarkRows(100_000, 20)
    const columns = createDataGridBenchmarkColumns(20)

    const result = measureDataGridFirstRender({
      name: '100k rows x 20 columns',
      rows,
      columns,
      rowHeight: 40,
      viewportSize: 480,
      overscan: 4,
    })

    expect(result.renderedRows).toBeLessThanOrEqual(21)
    expect(result.renderedColumns).toBe(20)
    expect(result.estimatedDomNodes.cellNodes).toBeLessThanOrEqual(420)
    expect(result.estimatedDomNodes.cellNodes).toBeLessThan(100_000 * 20)
  })

  it('does not rebuild rows or columns during scroll snapshots', () => {
    const rows = createDataGridBenchmarkRows(100_000, 20)
    const columns = createDataGridBenchmarkColumns(20)

    const runtime = createDataGridBenchmarkRuntime({
      rows,
      columns,
      rowHeight: 40,
      overscan: 4,
    })

    const before = runtime.getCounters()

    runtime.scrollToOffset(0, 480)
    runtime.scrollToOffset(10_000, 480)
    runtime.scrollToOffset(200_000, 480)

    const after = runtime.getCounters()

    expect(after.normalizeColumns).toBe(before.normalizeColumns)
    expect(after.createRows).toBe(before.createRows)
    expect(after.createVirtualizer).toBe(before.createVirtualizer)
    expect(after.snapshots).toBe(before.snapshots + 3)
    expect(after.rangeChanges).toBeGreaterThanOrEqual(1)
  })

  it('captures scroll range changes without exceeding row budget', () => {
    const rows = createDataGridBenchmarkRows(100_000, 20)
    const columns = createDataGridBenchmarkColumns(20)

    const result = measureDataGridScroll({
      name: '100k rows x 20 columns',
      rows,
      columns,
      rowHeight: 40,
      viewportSize: 480,
      overscan: 4,
      frames: 60,
    })

    expect(result.renderedRowsMax).toBeLessThanOrEqual(
      result.renderedRowsBudget,
    )
    expect(result.rangeChanges).toBeGreaterThan(1)
    expect(result.rangeChanges).toBeLessThanOrEqual(60)
  })
})
