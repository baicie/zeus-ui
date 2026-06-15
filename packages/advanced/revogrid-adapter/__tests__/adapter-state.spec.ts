import { describe, expect, it } from 'vitest'

import {
  createRevoGridAdapterState,
  ZEUS_REVO_COLUMN_ID,
  ZEUS_REVO_ROW_KEY,
} from '../src'

describe('revoGrid adapter state', () => {
  it('creates full adapter state', () => {
    const state = createRevoGridAdapterState({
      columns: [
        {
          id: 'name',
          field: 'userName',
          width: 180,
          sortable: true,
        },
        {
          id: 'age',
          sortable: true,
        },
      ],
      rows: [
        {
          id: 'u1',
          userName: 'Ada',
          age: 30,
        },
        {
          id: 'u2',
          userName: 'Grace',
          age: 20,
        },
      ],
      selectedKeys: ['u2'],
      selectionMode: 'multiple',
      sortColumn: 'age',
      sortDirection: 'desc',
      readonly: true,
    })

    expect(state.columns).toEqual([
      expect.objectContaining({
        prop: 'userName',
        size: 180,
        readonly: true,
        [ZEUS_REVO_COLUMN_ID]: 'name',
      }),
      expect.objectContaining({
        prop: 'age',
        readonly: true,
        [ZEUS_REVO_COLUMN_ID]: 'age',
      }),
    ])

    expect(state.source).toEqual([
      expect.objectContaining({
        id: 'u1',
        userName: 'Ada',
        [ZEUS_REVO_ROW_KEY]: 'u1',
      }),
      expect.objectContaining({
        id: 'u2',
        userName: 'Grace',
        [ZEUS_REVO_ROW_KEY]: 'u2',
      }),
    ])

    expect(state.sort).toEqual({
      prop: 'age',
      order: 'desc',
      [ZEUS_REVO_COLUMN_ID]: 'age',
    })

    expect(state.selection).toEqual({
      mode: 'multiple',
      rowKeys: ['u2'],
      rowIndexes: [1],
    })
  })

  it('supports empty adapter state', () => {
    expect(createRevoGridAdapterState()).toEqual({
      columns: [],
      source: [],
      sort: undefined,
      selection: {
        mode: 'none',
        rowKeys: [],
        rowIndexes: [],
      },
    })
  })
})
