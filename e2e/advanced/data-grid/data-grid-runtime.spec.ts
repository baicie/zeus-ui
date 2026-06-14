import type {
  DataGridActiveCellChangeDetail,
  DataGridColumnResizeDetail,
  DataGridRangeChangeDetail,
  DataGridSelectionChangeDetail,
  DataGridSortChangeDetail,
} from './data-grid-runtime-harness'
import { afterEach, describe, expect, it } from 'vitest'

import {
  cleanupDataGridFixtures,
  click,
  collectEvents,
  getCell,
  getHeaderCell,
  getViewport,
  keydown,
  mountDataGrid,
  nextFrame,
  runtimeColumns,
  setElementClientHeight,
} from './data-grid-runtime-harness'

describe('zw-data-grid runtime', () => {
  afterEach(() => {
    cleanupDataGridFixtures()
  })

  it('mounts as a custom element and exposes runtime methods', async () => {
    const grid = await mountDataGrid()

    expect(grid.tagName.toLowerCase()).toBe('zw-data-grid')
    expect(typeof grid.setRows).toBe('function')
    expect(typeof grid.setColumns).toBe('function')
    expect(typeof grid.getRows).toBe('function')
    expect(typeof grid.getColumns).toBe('function')
    expect(typeof grid.getVisibleRows).toBe('function')
    expect(typeof grid.setSort).toBe('function')
    expect(typeof grid.toggleRowSelection).toBe('function')
    expect(typeof grid.resizeColumn).toBe('function')
    expect(typeof grid.setActiveCell).toBe('function')

    expect(grid.getRows().map(row => row.key)).toEqual(['u1', 'u2', 'u3'])
    expect(grid.getColumns().map(column => column.id)).toEqual([
      'name',
      'age',
      'role',
    ])

    expect(
      Array.from(grid.querySelectorAll('[data-slot="data-grid-row"]')).length,
    ).toBe(3)
  })

  it('updates rows and columns when controlled references change with the same length', async () => {
    const grid = await mountDataGrid()

    grid.rows = [
      {
        id: 'u1',
        name: 'Ada Updated',
        age: 31,
        role: 'Engineer',
      },
      {
        id: 'u2',
        name: 'Grace Hopper',
        age: 20,
        role: 'Compiler',
      },
      {
        id: 'u3',
        name: 'Alan Turing',
        age: 40,
        role: 'Researcher',
      },
    ]

    await nextFrame()

    expect(grid.getRows()[0].data.name).toBe('Ada Updated')

    grid.columns = [
      {
        id: 'name',
        header: 'Full name',
        field: 'name',
        width: 220,
        sortable: true,
      },
      {
        id: 'age',
        header: 'Age',
        field: 'age',
        width: 140,
        sortable: true,
      },
      {
        id: 'role',
        header: 'Role',
        field: 'role',
        width: 160,
        sortable: true,
      },
    ]

    await nextFrame()

    expect(grid.getColumns()[0]).toMatchObject({
      id: 'name',
      header: 'Full name',
      width: 220,
    })
  })

  it('syncs selectedKeys and clears selection when selectedKeys becomes undefined', async () => {
    const grid = await mountDataGrid({
      selectedKeys: ['u1'],
      selectionMode: 'multiple',
    })

    expect(grid.getSelection()).toEqual({
      mode: 'multiple',
      keys: ['u1'],
    })

    grid.selectedKeys = undefined

    await nextFrame()

    expect(grid.getSelection()).toEqual({
      mode: 'multiple',
      keys: [],
    })
  })

  it('emits selection-change and syncs selectedKeys when selection is changed by methods', async () => {
    const grid = await mountDataGrid({
      selectionMode: 'multiple',
    })
    const collector = collectEvents<DataGridSelectionChangeDetail>(
      grid,
      'selection-change',
    )

    grid.toggleRowSelection('u2')

    await nextFrame()

    expect(grid.selectedKeys).toEqual(['u2'])
    expect(grid.getSelection().keys).toEqual(['u2'])
    expect(collector.events).toHaveLength(1)
    expect(collector.events[0].detail.selection.keys).toEqual(['u2'])

    grid.clearSelection()

    await nextFrame()

    expect(grid.selectedKeys).toEqual([])
    expect(grid.getSelection().keys).toEqual([])
    expect(collector.events).toHaveLength(2)

    collector.dispose()
  })

  it('syncs controlled sort props and emits sort-change', async () => {
    const grid = await mountDataGrid()
    const collector = collectEvents<DataGridSortChangeDetail>(
      grid,
      'sort-change',
    )

    grid.setSort('age', 'asc')

    await nextFrame()

    expect(grid.sortColumn).toBe('age')
    expect(grid.sortDirection).toBe('asc')
    expect(grid.getSort()).toEqual({
      columnId: 'age',
      direction: 'asc',
    })
    expect(grid.getVisibleRows().map(row => row.key)).toEqual([
      'u2',
      'u1',
      'u3',
    ])
    expect(collector.events).toHaveLength(1)

    grid.sortDirection = 'desc'

    await nextFrame()

    expect(grid.getSort()).toEqual({
      columnId: 'age',
      direction: 'desc',
    })
    expect(grid.getVisibleRows().map(row => row.key)).toEqual([
      'u3',
      'u1',
      'u2',
    ])

    grid.clearSort()

    await nextFrame()

    expect(grid.sortColumn).toBeUndefined()
    expect(grid.sortDirection).toBeUndefined()
    expect(grid.getSort()).toBeUndefined()

    collector.dispose()
  })

  it('sorts when a sortable header cell is clicked', async () => {
    const grid = await mountDataGrid()
    const header = getHeaderCell(grid, 'age')

    click(header)

    await nextFrame()

    expect(grid.getSort()).toEqual({
      columnId: 'age',
      direction: 'asc',
    })
    expect(grid.getVisibleRows().map(row => row.key)).toEqual([
      'u2',
      'u1',
      'u3',
    ])

    click(header)

    await nextFrame()

    expect(grid.getSort()).toEqual({
      columnId: 'age',
      direction: 'desc',
    })
  })

  it('resizes columns through runtime methods and resets to default widths', async () => {
    const grid = await mountDataGrid({
      columns: runtimeColumns,
      resizable: true,
    })
    const collector = collectEvents<DataGridColumnResizeDetail>(
      grid,
      'column-resize',
    )

    expect(grid.getColumnWidths().name).toBe(180)

    grid.resizeColumn('name', 240)

    await nextFrame()

    expect(grid.getColumnWidths().name).toBe(240)
    expect(grid.getColumns().find(column => column.id === 'name')?.width).toBe(
      240,
    )
    expect(collector.events).toHaveLength(1)
    expect(collector.events[0].detail).toMatchObject({
      width: 240,
      previousWidth: 180,
    })

    grid.resetColumnWidths()

    await nextFrame()

    expect(grid.getColumnWidths().name).toBe(180)
    expect(grid.getColumns().find(column => column.id === 'name')?.width).toBe(
      180,
    )

    collector.dispose()
  })

  it('syncs controlled active cell props and emits active-cell-change', async () => {
    const grid = await mountDataGrid({
      activeRowKey: 'u1',
      activeColumnId: 'name',
    })
    const collector = collectEvents<DataGridActiveCellChangeDetail>(
      grid,
      'active-cell-change',
    )

    expect(grid.getActiveCell()).toMatchObject({
      rowKey: 'u1',
      columnId: 'name',
    })

    grid.activeRowKey = 'u2'
    grid.activeColumnId = 'age'

    await nextFrame()

    expect(grid.getActiveCell()).toMatchObject({
      rowKey: 'u2',
      columnId: 'age',
    })

    grid.setActiveCell('u3', 'role')

    await nextFrame()

    expect(grid.activeRowKey).toBe('u3')
    expect(grid.activeColumnId).toBe('role')
    expect(grid.getActiveCell()).toMatchObject({
      rowKey: 'u3',
      columnId: 'role',
    })
    expect(
      collector.events[collector.events.length - 1]?.detail.activeCell,
    ).toMatchObject({
      rowKey: 'u3',
      columnId: 'role',
    })

    collector.dispose()
  })

  it('moves active cell with keyboard navigation without emitting intermediate cell state', async () => {
    const grid = await mountDataGrid({
      activeRowKey: 'u1',
      activeColumnId: 'name',
      keyboardNavigation: true,
    })
    const collector = collectEvents<DataGridActiveCellChangeDetail>(
      grid,
      'active-cell-change',
    )
    const cell = getCell(grid, 'u1', 'name')

    keydown(cell, 'ArrowRight')

    await nextFrame()

    expect(grid.getActiveCell()).toMatchObject({
      rowKey: 'u1',
      columnId: 'age',
    })

    expect(collector.events).toHaveLength(1)
    expect(collector.events[0].detail.activeCell).toMatchObject({
      rowKey: 'u1',
      columnId: 'age',
    })

    keydown(getCell(grid, 'u1', 'age'), 'ArrowDown')

    await nextFrame()

    expect(grid.getActiveCell()).toMatchObject({
      rowKey: 'u2',
      columnId: 'age',
    })

    expect(collector.events).toHaveLength(2)

    collector.dispose()
  })

  it('calculates virtual range and emits range-change in runtime', async () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      id: `r${index}`,
      name: `Row ${index}`,
      age: index,
      role: 'Runtime',
    }))

    const grid = await mountDataGrid({
      rows,
      columns: runtimeColumns,
      virtual: true,
      rowHeight: 40,
      overscan: 1,
    })
    const viewport = getViewport(grid)
    const collector = collectEvents<DataGridRangeChangeDetail>(
      grid,
      'range-change',
    )

    setElementClientHeight(viewport, 120)

    grid.scrollToOffset(80)

    await nextFrame()

    expect(grid.getRange()).toEqual({
      start: 2,
      end: 4,
      overscanStart: 1,
      overscanEnd: 5,
    })

    expect(grid.getItems().map(item => item.index)).toEqual([1, 2, 3, 4, 5])
    expect(grid.getTotalSize()).toBe(800)
    expect(collector.events.length).toBeGreaterThanOrEqual(1)
    expect(
      collector.events[collector.events.length - 1]?.detail.totalSize,
    ).toBe(800)

    collector.dispose()
  })
})
