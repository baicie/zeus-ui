import type {
  RevoGridAdapterChangeDetail,
  RevoGridAdapterReadyDetail,
} from './revogrid-adapter-runtime-harness'

import { afterEach, describe, expect, it } from 'vitest'

import {
  ZEUS_REVO_COLUMN_ID,
  ZEUS_REVO_ROW_INDEX,
  ZEUS_REVO_ROW_KEY,
} from '../../../packages/advanced/revogrid-adapter/src'

import {
  adapterRuntimeColumns,
  adapterRuntimeRows,
  cleanupRevoGridAdapterFixtures,
  getFakeRevoGrid,
  mountRevoGridAdapter,
  nextFrame,
} from './revogrid-adapter-runtime-harness'

describe('zw-revogrid-adapter runtime', () => {
  afterEach(() => {
    cleanupRevoGridAdapterFixtures()
  })

  it('mounts and writes adapter state into fake revo-grid', async () => {
    const adapter = await mountRevoGridAdapter({
      selectedKeys: ['u2'],
      sortColumn: 'age',
      sortDirection: 'desc',
      readonly: true,
    })
    const grid = getFakeRevoGrid(adapter)

    expect(grid.columns).toEqual([
      expect.objectContaining({
        prop: 'userName',
        name: 'Name',
        size: 180,
        readonly: true,
        [ZEUS_REVO_COLUMN_ID]: 'name',
      }),
      expect.objectContaining({
        prop: 'age',
        name: 'Age',
        readonly: true,
        [ZEUS_REVO_COLUMN_ID]: 'age',
      }),
      expect.objectContaining({
        prop: 'role',
        name: 'Role',
        readonly: true,
        [ZEUS_REVO_COLUMN_ID]: 'role',
      }),
    ])

    expect(grid.source).toEqual([
      expect.objectContaining({
        id: 'u1',
        userName: 'Ada Lovelace',
        [ZEUS_REVO_ROW_KEY]: 'u1',
        [ZEUS_REVO_ROW_INDEX]: 0,
      }),
      expect.objectContaining({
        id: 'u2',
        userName: 'Grace Hopper',
        [ZEUS_REVO_ROW_KEY]: 'u2',
        [ZEUS_REVO_ROW_INDEX]: 1,
      }),
      expect.objectContaining({
        id: 'u3',
        userName: 'Alan Turing',
        [ZEUS_REVO_ROW_KEY]: 'u3',
        [ZEUS_REVO_ROW_INDEX]: 2,
      }),
    ])

    expect(grid.sorting).toEqual({
      prop: 'age',
      order: 'desc',
      [ZEUS_REVO_COLUMN_ID]: 'age',
    })
    expect(grid.selectedRows).toEqual([1])
    expect(grid.readonly).toBe(true)
    expect(grid.refreshCount).toBeGreaterThanOrEqual(1)
  })

  it('emits adapter-ready once and adapter-change on refresh', async () => {
    const readyEvents: CustomEvent<RevoGridAdapterReadyDetail>[] = []
    const changeEvents: CustomEvent<RevoGridAdapterChangeDetail>[] = []

    const adapter = await mountRevoGridAdapter({
      beforeAppend(element) {
        element.addEventListener('adapter-ready', event => {
          readyEvents.push(event as CustomEvent<RevoGridAdapterReadyDetail>)
        })

        element.addEventListener('adapter-change', event => {
          changeEvents.push(event as CustomEvent<RevoGridAdapterChangeDetail>)
        })
      },
    })

    expect(readyEvents).toHaveLength(1)
    expect(readyEvents[0]?.detail.state.source).toHaveLength(3)

    adapter.refresh()
    adapter.refresh()

    await nextFrame()

    expect(readyEvents).toHaveLength(1)
    expect(changeEvents.length).toBeGreaterThanOrEqual(3)
    expect(
      changeEvents[changeEvents.length - 1]?.detail.state.source,
    ).toHaveLength(3)
  })

  it('syncs direct property updates into fake revo-grid without requiring exposed setters', async () => {
    const adapter = await mountRevoGridAdapter()
    const grid = getFakeRevoGrid(adapter)

    adapter.rows = [
      {
        id: 'direct',
        userName: 'Direct Update',
        age: 1,
        role: 'Runtime',
      },
    ]

    adapter.columns = [
      {
        id: 'name',
        field: 'userName',
        header: 'User',
        sortable: true,
      },
    ]

    await nextFrame()
    await nextFrame()

    expect(grid.source).toEqual([
      expect.objectContaining({
        id: 'direct',
        userName: 'Direct Update',
        [ZEUS_REVO_ROW_KEY]: 'direct',
        [ZEUS_REVO_ROW_INDEX]: 0,
      }),
    ])

    expect(grid.columns).toEqual([
      expect.objectContaining({
        prop: 'userName',
        name: 'User',
        [ZEUS_REVO_COLUMN_ID]: 'name',
      }),
    ])
  })

  it('exposes state getters', async () => {
    const adapter = await mountRevoGridAdapter({
      selectedKeys: ['u1', 'u3'],
      sortColumn: 'name',
      sortDirection: 'asc',
    })

    expect(adapter.getRevoColumns().map(column => column.prop)).toEqual([
      'userName',
      'age',
      'role',
    ])
    expect(adapter.getRevoSource().map(row => row[ZEUS_REVO_ROW_KEY])).toEqual([
      'u1',
      'u2',
      'u3',
    ])
    expect(adapter.getRevoSort()).toEqual({
      prop: 'userName',
      order: 'asc',
      [ZEUS_REVO_COLUMN_ID]: 'name',
    })
    expect(adapter.getRevoSelection()).toEqual({
      mode: 'multiple',
      rowKeys: ['u1', 'u3'],
      rowIndexes: [0, 2],
    })

    expect(adapter.getState()).toMatchObject({
      columns: expect.any(Array),
      source: expect.any(Array),
      sort: {
        prop: 'userName',
        order: 'asc',
      },
      selection: {
        rowKeys: ['u1', 'u3'],
        rowIndexes: [0, 2],
      },
    })
  })

  it('setRows updates fake revo-grid source', async () => {
    const adapter = await mountRevoGridAdapter()
    const grid = getFakeRevoGrid(adapter)

    adapter.setRows([
      {
        id: 'u4',
        userName: 'New User',
        age: 50,
        role: 'Runtime',
      },
    ])

    await nextFrame()

    expect(grid.source).toEqual([
      expect.objectContaining({
        id: 'u4',
        userName: 'New User',
        [ZEUS_REVO_ROW_KEY]: 'u4',
        [ZEUS_REVO_ROW_INDEX]: 0,
      }),
    ])
  })

  it('setColumns updates fake revo-grid columns', async () => {
    const adapter = await mountRevoGridAdapter()
    const grid = getFakeRevoGrid(adapter)

    adapter.setColumns([
      {
        id: 'name',
        field: 'userName',
        header: 'User',
        width: 220,
        sortable: true,
      },
    ])

    await nextFrame()

    expect(grid.columns).toEqual([
      expect.objectContaining({
        prop: 'userName',
        name: 'User',
        size: 220,
        [ZEUS_REVO_COLUMN_ID]: 'name',
      }),
    ])
  })

  it('setSelection updates fake revo-grid selectedRows', async () => {
    const adapter = await mountRevoGridAdapter({
      selectionMode: 'multiple',
    })
    const grid = getFakeRevoGrid(adapter)

    adapter.setSelection(['u1', 'u3'])

    await nextFrame()

    expect(grid.selectedRows).toEqual([0, 2])
    expect(adapter.selectedKeys).toEqual(['u1', 'u3'])
  })

  it('setSort and clearSort update fake revo-grid sorting', async () => {
    const adapter = await mountRevoGridAdapter()
    const grid = getFakeRevoGrid(adapter)

    adapter.setSort('age', 'asc')

    await nextFrame()

    expect(adapter.sortColumn).toBe('age')
    expect(adapter.sortDirection).toBe('asc')
    expect(grid.sorting).toEqual({
      prop: 'age',
      order: 'asc',
      [ZEUS_REVO_COLUMN_ID]: 'age',
    })

    adapter.clearSort()

    await nextFrame()

    expect(adapter.sortColumn).toBeUndefined()
    expect(adapter.sortDirection).toBeUndefined()
    expect(grid.sorting).toBeUndefined()
  })

  it('supports custom getRowKey at runtime', async () => {
    const adapter = await mountRevoGridAdapter({
      rows: [
        {
          uuid: 'x1',
          userName: 'Custom Key',
        },
      ],
      columns: adapterRuntimeColumns,
      getRowKey: row => String(row.uuid),
    })
    const grid = getFakeRevoGrid(adapter)

    expect(grid.source?.[0]?.[ZEUS_REVO_ROW_KEY]).toBe('x1')
  })

  it('filters hidden columns by default and can include them', async () => {
    const adapter = await mountRevoGridAdapter({
      columns: [
        ...adapterRuntimeColumns,
        {
          id: 'secret',
          field: 'secret',
          hidden: true,
        },
      ],
    })

    expect(adapter.getRevoColumns().map(column => column.prop)).toEqual([
      'userName',
      'age',
      'role',
    ])

    adapter.includeHiddenColumns = true
    adapter.refresh()

    await nextFrame()

    expect(adapter.getRevoColumns().map(column => column.prop)).toEqual([
      'userName',
      'age',
      'role',
      'secret',
    ])
  })

  it('does not require real @revolist/revogrid implementation', async () => {
    const adapter = await mountRevoGridAdapter({
      rows: adapterRuntimeRows,
      columns: adapterRuntimeColumns,
    })

    expect(getFakeRevoGrid(adapter).tagName.toLowerCase()).toBe('revo-grid')
    expect(adapter.getGridElement()).toBe(getFakeRevoGrid(adapter))
  })
})
