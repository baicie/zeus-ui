import { describe, expect, it } from 'vitest'

import {
  createDataGridRows,
  createNextDataGridSortState,
  normalizeDataGridColumns,
  sortDataGridRows,
} from '../src/core'

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
    const rows = createDataGridRows([
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
      sortDataGridRows(rows, columns, {
        columnId: 'age',
        direction: 'asc',
      }).map(row => row.key),
    ).toEqual(['b', 'a', 'c'])

    expect(
      sortDataGridRows(rows, columns, {
        columnId: 'age',
        direction: 'desc',
      }).map(row => row.key),
    ).toEqual(['c', 'a', 'b'])
  })

  it('keeps original order for non-sortable column', () => {
    const rows = createDataGridRows([
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
      sortDataGridRows(rows, columns, {
        columnId: 'age',
        direction: 'asc',
      }).map(row => row.key),
    ).toEqual(['a', 'b'])
  })

  it('keeps stable order for equal values', () => {
    const rows = createDataGridRows([
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
      sortDataGridRows(rows, columns, {
        columnId: 'age',
        direction: 'asc',
      }).map(row => row.key),
    ).toEqual(['a', 'b'])
  })
})
