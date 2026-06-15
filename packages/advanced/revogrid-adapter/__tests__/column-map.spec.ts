import { describe, expect, it } from 'vitest'

import {
  findRevoGridColumnByZeusColumnId,
  getRevoGridColumnProp,
  mapDataGridColumnsToRevoGridColumns,
  mapDataGridColumnToRevoGridColumn,
  ZEUS_REVO_COLUMN_ID,
} from '../src'

describe('revoGrid column map', () => {
  it('uses field as RevoGrid prop when available', () => {
    expect(
      getRevoGridColumnProp({
        id: 'name',
        field: 'user.name',
      }),
    ).toBe('user.name')
  })

  it('maps DataGrid column to RevoGrid-compatible column', () => {
    expect(
      mapDataGridColumnToRevoGridColumn(
        {
          id: 'name',
          header: 'Name',
          field: 'userName',
          width: 180,
          minWidth: 80,
          maxWidth: 260,
          sortable: true,
          align: 'center',
        },
        {
          readonly: true,
        },
      ),
    ).toEqual({
      prop: 'userName',
      name: 'Name',
      size: 180,
      minSize: 80,
      maxSize: 260,
      sortable: true,
      readonly: true,
      cellProperties: {
        align: 'center',
        hidden: false,
        resizable: true,
      },
      [ZEUS_REVO_COLUMN_ID]: 'name',
    })
  })

  it('filters hidden columns by default', () => {
    expect(
      mapDataGridColumnsToRevoGridColumns([
        {
          id: 'name',
        },
        {
          id: 'secret',
          hidden: true,
        },
      ]).map(column => column.prop),
    ).toEqual(['name'])
  })

  it('can include hidden columns explicitly', () => {
    expect(
      mapDataGridColumnsToRevoGridColumns(
        [
          {
            id: 'name',
          },
          {
            id: 'secret',
            hidden: true,
          },
        ],
        {
          includeHidden: true,
        },
      ).map(column => column.prop),
    ).toEqual(['name', 'secret'])
  })

  it('finds RevoGrid column by Zeus column id', () => {
    const columns = mapDataGridColumnsToRevoGridColumns([
      {
        id: 'name',
        field: 'userName',
      },
    ])

    expect(findRevoGridColumnByZeusColumnId(columns, 'name')).toMatchObject({
      prop: 'userName',
      [ZEUS_REVO_COLUMN_ID]: 'name',
    })
  })
})
