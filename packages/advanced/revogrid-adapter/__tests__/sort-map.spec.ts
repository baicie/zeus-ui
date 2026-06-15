import { describe, expect, it } from 'vitest'

import {
  mapDataGridColumnsToRevoGridColumns,
  mapDataGridSortPropsToRevoGridSort,
  mapDataGridSortToRevoGridSort,
  ZEUS_REVO_COLUMN_ID,
} from '../src'

describe('revoGrid sort map', () => {
  const columns = mapDataGridColumnsToRevoGridColumns([
    {
      id: 'name',
      field: 'userName',
      sortable: true,
    },
    {
      id: 'age',
      sortable: true,
    },
  ])

  it('maps DataGrid sort to RevoGrid sort', () => {
    expect(
      mapDataGridSortToRevoGridSort(
        {
          columnId: 'name',
          direction: 'asc',
        },
        columns,
      ),
    ).toEqual({
      prop: 'userName',
      order: 'asc',
      [ZEUS_REVO_COLUMN_ID]: 'name',
    })
  })

  it('maps sort props to RevoGrid sort', () => {
    expect(mapDataGridSortPropsToRevoGridSort('age', 'desc', columns)).toEqual({
      prop: 'age',
      order: 'desc',
      [ZEUS_REVO_COLUMN_ID]: 'age',
    })
  })

  it('returns undefined when sort column is missing', () => {
    expect(
      mapDataGridSortToRevoGridSort(
        {
          columnId: 'missing',
          direction: 'asc',
        },
        columns,
      ),
    ).toBeUndefined()
  })

  it('returns undefined when props are incomplete', () => {
    expect(
      mapDataGridSortPropsToRevoGridSort(undefined, 'asc', columns),
    ).toBeUndefined()
    expect(
      mapDataGridSortPropsToRevoGridSort('age', undefined, columns),
    ).toBeUndefined()
  })
})
