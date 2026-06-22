// packages/advanced/data-grid/__tests__/benchmark-data.spec.ts

import { describe, expect, it } from 'vitest'

import {
  createDataGridBenchmarkColumns,
  createDataGridBenchmarkRows,
  DATA_GRID_BENCHMARK_SCENARIOS,
} from '../benchmarks/benchmark-data'

describe('data-grid benchmark data', () => {
  it('declares required benchmark scenarios', () => {
    expect(DATA_GRID_BENCHMARK_SCENARIOS).toEqual([
      expect.objectContaining({
        name: '10k rows x 20 columns',
        rowCount: 10_000,
        columnCount: 20,
      }),
      expect.objectContaining({
        name: '100k rows x 20 columns',
        rowCount: 100_000,
        columnCount: 20,
      }),
      expect.objectContaining({
        name: '100k rows x 100 columns',
        rowCount: 100_000,
        columnCount: 100,
      }),
    ])
  })

  it('creates deterministic columns', () => {
    const columns = createDataGridBenchmarkColumns(3)

    expect(columns).toEqual([
      expect.objectContaining({
        id: 'col_1',
        field: 'col_1',
        width: 120,
        sortable: true,
        resizable: true,
      }),
      expect.objectContaining({
        id: 'col_2',
        field: 'col_2',
        width: 140,
        sortable: true,
        resizable: true,
      }),
      expect.objectContaining({
        id: 'col_3',
        field: 'col_3',
        width: 140,
        sortable: true,
        resizable: true,
      }),
    ])
  })

  it('creates sparse rows by default for CI-safe benchmarks', () => {
    const rows = createDataGridBenchmarkRows(2, 100, {
      dataMode: 'sparse',
    })

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'row_0_1',
        index: 0,
        col_1: 0,
        col_2: 'R1-C2',
      }),
      expect.objectContaining({
        id: 'row_0_2',
        index: 1,
        col_1: 1,
        col_2: 'R2-C2',
      }),
    ])

    expect(Object.keys(rows[0] ?? {})).toEqual([
      'id',
      'index',
      'col_1',
      'col_2',
    ])
  })

  it('can create dense rows for opt-in memory benchmarks', () => {
    const rows = createDataGridBenchmarkRows(2, 3, {
      dataMode: 'dense',
    })

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'row_0_1',
        index: 0,
        col_1: 0,
        col_2: 'R1-C2',
        col_3: 'R1-C3',
      }),
      expect.objectContaining({
        id: 'row_0_2',
        index: 1,
        col_1: 1,
        col_2: 'R2-C2',
        col_3: 'R2-C3',
      }),
    ])
  })

  it('uses seed to create a distinct update dataset', () => {
    const rows = createDataGridBenchmarkRows(1, 2, {
      dataMode: 'sparse',
      seed: 1,
    })

    expect(rows[0]).toEqual(
      expect.objectContaining({
        id: 'row_1_1',
      }),
    )
  })

  it('rejects invalid benchmark sizes', () => {
    expect(() => createDataGridBenchmarkRows(0, 1)).toThrow(
      '[data-grid:bench] rowCount must be a positive integer.',
    )
    expect(() => createDataGridBenchmarkRows(1, 0)).toThrow(
      '[data-grid:bench] columnCount must be a positive integer.',
    )
    expect(() => createDataGridBenchmarkColumns(0)).toThrow(
      '[data-grid:bench] columnCount must be a positive integer.',
    )
  })
})
