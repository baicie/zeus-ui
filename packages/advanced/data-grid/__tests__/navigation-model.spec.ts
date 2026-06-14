import { describe, expect, it } from 'vitest'

import {
  areDataGridActiveCellsEqual,
  createDataGridActiveCell,
  createDataGridRows,
  createInitialDataGridActiveCell,
  getDataGridActiveCellId,
  moveDataGridActiveCell,
  normalizeDataGridColumns,
} from '../src/core'

describe('navigation model', () => {
  const rows = createDataGridRows([
    {
      id: 'a',
      name: 'Ada',
    },
    {
      id: 'b',
      name: 'Grace',
    },
    {
      id: 'c',
      name: 'Alan',
    },
  ])
  const columns = normalizeDataGridColumns([
    {
      id: 'name',
    },
    {
      id: 'role',
    },
    {
      id: 'status',
    },
  ])

  it('creates active cell', () => {
    expect(createDataGridActiveCell(rows, columns, 1, 2)).toEqual({
      rowIndex: 1,
      rowKey: 'b',
      columnId: 'status',
      columnIndex: 2,
    })
  })

  it('clamps active cell indexes', () => {
    expect(createDataGridActiveCell(rows, columns, 99, 99)).toEqual({
      rowIndex: 2,
      rowKey: 'c',
      columnId: 'status',
      columnIndex: 2,
    })
  })

  it('returns undefined when rows or columns are empty', () => {
    expect(createDataGridActiveCell([], columns, 0, 0)).toBeUndefined()
    expect(createDataGridActiveCell(rows, [], 0, 0)).toBeUndefined()
  })

  it('creates initial active cell from row key and column id', () => {
    expect(
      createInitialDataGridActiveCell({
        rows,
        columns,
        rowKey: 'b',
        columnId: 'role',
      }),
    ).toEqual({
      rowIndex: 1,
      rowKey: 'b',
      columnId: 'role',
      columnIndex: 1,
    })
  })

  it('moves active cell with arrow keys', () => {
    const current = createDataGridActiveCell(rows, columns, 1, 1)

    expect(
      moveDataGridActiveCell({
        rows,
        columns,
        current,
        key: 'ArrowUp',
      }),
    ).toMatchObject({
      rowKey: 'a',
      columnId: 'role',
    })

    expect(
      moveDataGridActiveCell({
        rows,
        columns,
        current,
        key: 'ArrowDown',
      }),
    ).toMatchObject({
      rowKey: 'c',
      columnId: 'role',
    })

    expect(
      moveDataGridActiveCell({
        rows,
        columns,
        current,
        key: 'ArrowLeft',
      }),
    ).toMatchObject({
      rowKey: 'b',
      columnId: 'name',
    })

    expect(
      moveDataGridActiveCell({
        rows,
        columns,
        current,
        key: 'ArrowRight',
      }),
    ).toMatchObject({
      rowKey: 'b',
      columnId: 'status',
    })
  })

  it('moves active cell with home/end/page keys', () => {
    const current = createDataGridActiveCell(rows, columns, 1, 1)

    expect(
      moveDataGridActiveCell({
        rows,
        columns,
        current,
        key: 'Home',
      }),
    ).toMatchObject({
      columnId: 'name',
    })

    expect(
      moveDataGridActiveCell({
        rows,
        columns,
        current,
        key: 'End',
      }),
    ).toMatchObject({
      columnId: 'status',
    })

    expect(
      moveDataGridActiveCell({
        rows,
        columns,
        current,
        key: 'PageUp',
        pageSize: 10,
      }),
    ).toMatchObject({
      rowKey: 'a',
    })

    expect(
      moveDataGridActiveCell({
        rows,
        columns,
        current,
        key: 'PageDown',
        pageSize: 10,
      }),
    ).toMatchObject({
      rowKey: 'c',
    })
  })

  it('compares active cells', () => {
    const a = createDataGridActiveCell(rows, columns, 0, 0)
    const b = createDataGridActiveCell(rows, columns, 0, 0)
    const c = createDataGridActiveCell(rows, columns, 0, 1)

    expect(areDataGridActiveCellsEqual(a, b)).toBe(true)
    expect(areDataGridActiveCellsEqual(a, c)).toBe(false)
  })

  it('creates active cell id', () => {
    expect(
      getDataGridActiveCellId({
        rowIndex: 1,
        rowKey: 'b',
        columnId: 'role',
        columnIndex: 1,
      }),
    ).toBe('zg-cell-b-role')
  })
})
