import { describe, expect, it } from 'vitest'

import {
  getDataGridColumnById,
  getTotalColumnWidth,
  getVisibleDataGridColumns,
  normalizeDataGridColumn,
  normalizeDataGridColumns,
} from '../src/core'

describe('column model', () => {
  it('normalizes a column', () => {
    expect(
      normalizeDataGridColumn(
        {
          id: 'name',
          header: 'Name',
          width: 120,
          sortable: true,
        },
        0,
      ),
    ).toEqual({
      id: 'name',
      header: 'Name',
      field: 'name',
      width: 120,
      minWidth: 48,
      maxWidth: 1000,
      align: 'start',
      sortable: true,
      hidden: false,
    })
  })

  it('normalizes invalid widths', () => {
    expect(
      normalizeDataGridColumn(
        {
          id: 'age',
          width: -1,
          minWidth: 100,
          maxWidth: 80,
        },
        0,
      ),
    ).toMatchObject({
      width: 100,
      minWidth: 100,
      maxWidth: 100,
    })
  })

  it('normalizes columns', () => {
    expect(
      normalizeDataGridColumns([
        {
          id: 'name',
        },
        {
          id: 'age',
          field: 'profileAge',
        },
      ]).map(column => column.field),
    ).toEqual(['name', 'profileAge'])
  })

  it('filters visible columns', () => {
    const columns = normalizeDataGridColumns([
      {
        id: 'name',
      },
      {
        id: 'secret',
        hidden: true,
      },
    ])

    expect(getVisibleDataGridColumns(columns).map(column => column.id)).toEqual(
      ['name'],
    )
  })

  it('finds column by id', () => {
    const columns = normalizeDataGridColumns([{ id: 'name' }, { id: 'age' }])

    expect(getDataGridColumnById(columns, 'age')?.id).toBe('age')
    expect(getDataGridColumnById(columns, 'missing')).toBeUndefined()
  })

  it('calculates total visible width', () => {
    const columns = normalizeDataGridColumns([
      {
        id: 'name',
        width: 100,
      },
      {
        id: 'age',
        width: 80,
      },
      {
        id: 'secret',
        width: 999,
        hidden: true,
      },
    ])

    expect(getTotalColumnWidth(columns)).toBe(180)
  })
})
