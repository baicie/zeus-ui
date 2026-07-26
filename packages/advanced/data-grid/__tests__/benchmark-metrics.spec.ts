import { describe, expect, it } from 'vitest'

import {
  DATA_GRID_BENCHMARK_RESULT_PREFIX,
  formatDataGridBenchmarkResult,
  getDataGridMemoryTrend,
  getRenderedRowsBudget,
} from '../benchmarks/benchmark-metrics'

describe('data-grid benchmark metrics', () => {
  it('computes rendered row budget from viewport and overscan', () => {
    expect(getRenderedRowsBudget(480, 40, 4)).toBe(21)
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

  it('formats a single-line machine-readable benchmark result', () => {
    const line = formatDataGridBenchmarkResult('render', {
      name: 'line\nbreak',
      rowCount: 10,
      columnCount: 2,
      firstRenderMs: 1.25,
      dom: {
        renderedRows: 4,
        renderedColumns: 2,
        renderedCells: 8,
        totalElements: 20,
        firstRenderedRowKey: 'row_0_1',
        lastRenderedRowIndex: 3,
      },
      totalSize: 400,
      memoryBefore: {
        heapUsed: 100,
        heapTotal: 200,
        rss: 300,
      },
      memoryAfter: {
        heapUsed: 110,
        heapTotal: 220,
        rss: 330,
      },
      memoryTrend: {
        heapUsedDelta: 10,
        heapTotalDelta: 20,
        rssDelta: 30,
      },
    })
    const serializedResult = line.slice(
      DATA_GRID_BENCHMARK_RESULT_PREFIX.length + 1,
    )

    expect(line.startsWith(`${DATA_GRID_BENCHMARK_RESULT_PREFIX} `)).toBe(true)
    expect(line.split(/\r?\n/)).toHaveLength(1)
    expect(JSON.parse(serializedResult)).toEqual({
      kind: 'render',
      result: {
        name: 'line\nbreak',
        rowCount: 10,
        columnCount: 2,
        firstRenderMs: 1.25,
        dom: {
          renderedRows: 4,
          renderedColumns: 2,
          renderedCells: 8,
          totalElements: 20,
          firstRenderedRowKey: 'row_0_1',
          lastRenderedRowIndex: 3,
        },
        totalSize: 400,
        memoryBefore: {
          heapUsed: 100,
          heapTotal: 200,
          rss: 300,
        },
        memoryAfter: {
          heapUsed: 110,
          heapTotal: 220,
          rss: 330,
        },
        memoryTrend: {
          heapUsedDelta: 10,
          heapTotalDelta: 20,
          rssDelta: 30,
        },
      },
    })
  })
})
