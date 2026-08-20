import type { DataGridRowCollection } from '../src/core'

import { describe, expect, it } from 'vitest'

import {
  createDataGridRowModel,
  createNextDataGridSortState,
  normalizeDataGridColumns,
  sortDataGridRowCollection,
} from '../src/core'

function getRowKeys(rows: DataGridRowCollection): Array<string | undefined> {
  return Array.from({ length: rows.length }, (_, index) => rows.getKey(index))
}

describe('sort model', () => {
  it('cycles sort state', () => {
    expect(createNextDataGridSortState(undefined, 'age')).toEqual({
      columnId: 'age',
      direction: 'asc',
    })

    expect(
      createNextDataGridSortState(
        {
          columnId: 'age',
          direction: 'asc',
        },
        'age',
      ),
    ).toEqual({
      columnId: 'age',
      direction: 'desc',
    })

    expect(
      createNextDataGridSortState(
        {
          columnId: 'age',
          direction: 'desc',
        },
        'age',
      ),
    ).toBeUndefined()
  })

  it('supports explicit direction', () => {
    expect(createNextDataGridSortState(undefined, 'age', 'desc')).toEqual({
      columnId: 'age',
      direction: 'desc',
    })
  })

  it('sorts rows by sortable column', () => {
    const rows = createDataGridRowModel([
      {
        id: 'a',
        age: 30,
      },
      {
        id: 'b',
        age: 20,
      },
      {
        id: 'c',
        age: 40,
      },
    ])
    const columns = normalizeDataGridColumns([
      {
        id: 'age',
        sortable: true,
      },
    ])

    expect(
      getRowKeys(
        sortDataGridRowCollection(rows, columns, {
          columnId: 'age',
          direction: 'asc',
        }),
      ),
    ).toEqual(['b', 'a', 'c'])

    expect(
      getRowKeys(
        sortDataGridRowCollection(rows, columns, {
          columnId: 'age',
          direction: 'desc',
        }),
      ),
    ).toEqual(['c', 'a', 'b'])
  })

  it('sorts an indexed model without materializing row wrappers', () => {
    const rows = createDataGridRowModel([
      { id: 'a', age: 30 },
      { id: 'b', age: 20 },
      { id: 'c', age: 40 },
    ])
    const columns = normalizeDataGridColumns([
      {
        id: 'age',
        sortable: true,
      },
    ])

    const sorted = sortDataGridRowCollection(rows, columns, {
      columnId: 'age',
      direction: 'asc',
    })

    expect(
      Array.from({ length: sorted.length }, (_, index) => sorted.getKey(index)),
    ).toEqual(['b', 'a', 'c'])
    expect(sorted.getIndexByKey('c')).toBe(2)
    expect(sorted.getIndexByKey('b')).toBe(0)
    expect(sorted.getIndexByKey('a')).toBe(1)
    expect(rows.wrapperCount).toBe(0)
    expect(sorted.getRow(0)?.index).toBe(1)
    expect(rows.wrapperCount).toBe(1)
  })

  it('keeps original order for non-sortable column', () => {
    const rows = createDataGridRowModel([
      { id: 'a', age: 30 },
      { id: 'b', age: 20 },
    ])
    const columns = normalizeDataGridColumns([
      {
        id: 'age',
        sortable: false,
      },
    ])

    expect(
      sortDataGridRowCollection(rows, columns, {
        columnId: 'age',
        direction: 'asc',
      }),
    ).toBe(rows)
  })

  it('keeps stable order for equal values', () => {
    const rows = createDataGridRowModel([
      {
        id: 'a',
        age: 20,
      },
      {
        id: 'b',
        age: 20,
      },
    ])
    const columns = normalizeDataGridColumns([
      {
        id: 'age',
        sortable: true,
      },
    ])

    expect(
      getRowKeys(
        sortDataGridRowCollection(rows, columns, {
          columnId: 'age',
          direction: 'asc',
        }),
      ),
    ).toEqual(['a', 'b'])
  })
})
