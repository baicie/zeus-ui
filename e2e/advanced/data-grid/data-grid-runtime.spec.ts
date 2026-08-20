import type {
  DataGridActiveCellChangeDetail,
  DataGridColumnResizeDetail,
  DataGridRangeChangeDetail,
  DataGridSelectionChangeDetail,
  DataGridSortChangeDetail,
} from './data-grid-runtime-harness'
import { batch } from '@zeus-js/zeus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  setElementClientWidth,
} from './data-grid-runtime-harness'

const initialModelDiagnostics = vi.hoisted(() => ({
  createRowModelCallSizes: [] as number[],
  rowModels: [] as Array<{
    readonly wrapperCount: number
  }>,
  rowVirtualizerRows: [] as unknown[],
  sortRowsHasActiveSort: [] as boolean[],
}))

vi.mock(
  '../../../packages/advanced/data-grid/src/core',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('../../../packages/advanced/data-grid/src/core')
      >()

    return {
      ...actual,
      createDataGridRowModel(
        ...args: Parameters<typeof actual.createDataGridRowModel>
      ): ReturnType<typeof actual.createDataGridRowModel> {
        initialModelDiagnostics.createRowModelCallSizes.push(
          args[0]?.length ?? 0,
        )
        const model = actual.createDataGridRowModel(...args)
        initialModelDiagnostics.rowModels.push(model)
        return model
      },
      createDataGridRowVirtualizer(
        ...args: Parameters<typeof actual.createDataGridRowVirtualizer>
      ): ReturnType<typeof actual.createDataGridRowVirtualizer> {
        initialModelDiagnostics.rowVirtualizerRows.push(args[0].rows)
        return actual.createDataGridRowVirtualizer(...args)
      },
      sortDataGridRowCollection(
        ...args: Parameters<typeof actual.sortDataGridRowCollection>
      ): ReturnType<typeof actual.sortDataGridRowCollection> {
        initialModelDiagnostics.sortRowsHasActiveSort.push(
          args[2] !== undefined,
        )
        return actual.sortDataGridRowCollection(...args)
      },
    }
  },
)

function createWideColumns(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `column-${index + 1}`,
    header: `Column ${index + 1}`,
    field: `column_${index + 1}`,
    width: 100,
  }))
}

function createWideRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${index + 1}`,
  }))
}

function pointer(
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientX: number,
): void {
  const event = new Event(type, {
    bubbles: true,
    composed: true,
  })

  Object.defineProperties(event, {
    clientX: {
      value: clientX,
    },
    pointerId: {
      value: 1,
    },
  })

  target.dispatchEvent(event)
}

describe('zw-data-grid runtime', () => {
  beforeEach(() => {
    initialModelDiagnostics.createRowModelCallSizes.length = 0
    initialModelDiagnostics.rowModels.length = 0
    initialModelDiagnostics.rowVirtualizerRows.length = 0
    initialModelDiagnostics.sortRowsHasActiveSort.length = 0
  })

  afterEach(() => {
    cleanupDataGridFixtures()
  })

  it('indexes 10k rows once and only materializes viewport rows', async () => {
    const rows = createWideRows(10_000)

    await mountDataGrid({
      rows,
      columns: createWideColumns(3),
      virtual: true,
    })

    expect(initialModelDiagnostics.createRowModelCallSizes).toEqual([
      rows.length,
    ])
    expect(initialModelDiagnostics.rowModels[0].wrapperCount).toBeGreaterThan(0)
    expect(initialModelDiagnostics.rowModels[0].wrapperCount).toBeLessThan(100)
  })

  it('reuses modeled rows when first mount has no active sort', async () => {
    await mountDataGrid({
      rows: createWideRows(10),
      columns: createWideColumns(3),
      virtual: true,
    })

    expect(initialModelDiagnostics.sortRowsHasActiveSort).toEqual([])
    expect(initialModelDiagnostics.rowVirtualizerRows[0]).toBe(
      initialModelDiagnostics.rowModels[0],
    )
  })

  it('preserves the fallback active row across the next rows rebuild', async () => {
    const grid = await mountDataGrid({
      rows: [{ id: 'row-a' }, { id: 'row-b' }],
      columns: createWideColumns(1),
      virtual: true,
    })

    expect(grid.getActiveCell()).toMatchObject({
      rowKey: 'row-a',
      columnId: 'column-1',
    })

    grid.setRows([{ id: 'row-new' }, { id: 'row-a' }, { id: 'row-b' }])

    await nextFrame()

    expect(grid.getActiveCell()).toMatchObject({
      rowKey: 'row-a',
      columnId: 'column-1',
    })
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
    expect(typeof grid.getColumnRange).toBe('function')
    expect(typeof grid.getColumnItems).toBe('function')
    expect(typeof grid.scrollToColumn).toBe('function')

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

  it('treats rows and columns as replace-on-write shallow props', async () => {
    const rows = [
      { id: 'row-1', name: 'Initial' },
      { id: 'row-2', name: 'Second' },
    ]
    const columns = [{ id: 'name', header: 'Name', field: 'name', width: 120 }]
    const grid = await mountDataGrid({ rows, columns })

    expect(grid.rows).toBe(rows)
    expect(grid.columns).toBe(columns)
    expect(grid.getRows()[0].data).toBe(rows[0])
    expect(grid.getColumns()[0]).not.toBe(columns[0])

    grid.rows![0].name = 'Nested mutation'
    grid.columns![0].header = 'Nested header'
    await nextFrame()

    expect(getCell(grid, 'row-1', 'name').textContent).toBe('Initial')
    expect(getHeaderCell(grid, 'name').textContent).toContain('Name')
    expect(getHeaderCell(grid, 'name').textContent).not.toContain(
      'Nested header',
    )

    const nextRows = [
      { id: 'row-1', name: 'Replacement' },
      { id: 'row-2', name: 'Second' },
    ]
    const nextColumns = [
      { id: 'name', header: 'Replacement header', field: 'name', width: 140 },
    ]
    grid.rows = nextRows
    grid.columns = nextColumns
    await nextFrame()

    expect(grid.rows).toBe(nextRows)
    expect(grid.columns).toBe(nextColumns)
    expect(grid.getRows()[0].data).toBe(nextRows[0])
    expect(getCell(grid, 'row-1', 'name').textContent).toBe('Replacement')
    expect(getHeaderCell(grid, 'name').textContent).toContain(
      'Replacement header',
    )
  })

  it('updates rows and columns when controlled references change with the same length', async () => {
    const grid = await mountDataGrid()
    const initialCell = getCell(grid, 'u1', 'name')

    initialCell.focus()
    expect(document.activeElement).toBe(initialCell)

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
    expect(getCell(grid, 'u1', 'name').textContent).toBe('Ada Updated')
    expect(document.activeElement).toBe(getCell(grid, 'u1', 'name'))

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
    expect(getHeaderCell(grid, 'name').textContent).toContain('Full name')
    expect(document.activeElement).toBe(getCell(grid, 'u1', 'name'))
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

  it('treats selectedKeys as a replace-on-write shallow prop', async () => {
    const selectedKeys = ['u1']
    const grid = await mountDataGrid({
      selectedKeys,
      selectionMode: 'multiple',
    })

    expect(grid.selectedKeys).toBe(selectedKeys)

    grid.selectedKeys!.push('u2')
    await nextFrame()

    expect(grid.getSelection().keys).toEqual(['u1'])

    grid.selectedKeys = [...grid.selectedKeys!]
    await nextFrame()

    expect(grid.getSelection().keys).toEqual(['u1', 'u2'])
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

  it('rebuilds sorted rows and virtual items when columns change', () => {
    return mountDataGrid({
      rows: [
        { id: 'r1', primary: 2, secondary: 2 },
        { id: 'r2', primary: 1, secondary: 3 },
        { id: 'r3', primary: 3, secondary: 1 },
      ],
      columns: [
        {
          id: 'rank',
          header: 'Primary rank',
          field: 'primary',
          sortable: true,
        },
      ],
      virtual: true,
      rowHeight: 40,
      overscan: 0,
    }).then(grid => {
      const viewport = getViewport(grid)
      setElementClientHeight(viewport, 120)
      grid.setSort('rank', 'asc')
      grid.refreshViewport()

      return nextFrame()
        .then(() => {
          expect(grid.getVisibleRows().map(row => row.key)).toEqual([
            'r2',
            'r1',
            'r3',
          ])
          expect(grid.getItems().map(item => item.key)).toEqual([
            'r2',
            'r1',
            'r3',
          ])

          grid.setColumns([
            {
              id: 'rank',
              header: 'Secondary rank',
              field: 'secondary',
              sortable: true,
            },
          ])

          return nextFrame()
        })
        .then(() => {
          expect(grid.getVisibleRows().map(row => row.key)).toEqual([
            'r3',
            'r1',
            'r2',
          ])
          expect(grid.getItems().map(item => item.key)).toEqual([
            'r3',
            'r1',
            'r2',
          ])
          expect(getCell(grid, 'r3', 'rank').textContent).toBe('1')
        })
    })
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

  it('preserves active row identity and updates its visible index after sort', async () => {
    const grid = await mountDataGrid({
      activeRowKey: 'u3',
      activeColumnId: 'age',
      keyboardNavigation: true,
    })

    expect(grid.getActiveCell()).toMatchObject({
      rowKey: 'u3',
      rowIndex: 2,
    })

    grid.setSort('age', 'desc')
    await nextFrame()

    expect(grid.getActiveCell()).toMatchObject({
      rowKey: 'u3',
      rowIndex: 0,
    })
    expect(grid.getVisibleRows().map(row => row.index)).toEqual([2, 0, 1])

    grid.moveActiveCell('ArrowDown')
    await nextFrame()

    expect(grid.getActiveCell()).toMatchObject({
      rowKey: 'u1',
      rowIndex: 1,
    })
  })

  it('updates active indexes after row and column replacement', async () => {
    const grid = await mountDataGrid({
      activeRowKey: 'u2',
      activeColumnId: 'role',
    })

    grid.setRows([
      { id: 'u2', name: 'Grace', age: 37, role: 'Engineer' },
      { id: 'u1', name: 'Ada', age: 36, role: 'Engineer' },
      { id: 'u3', name: 'Linus', age: 55, role: 'Maintainer' },
    ])
    grid.setColumns([runtimeColumns[2], runtimeColumns[0], runtimeColumns[1]])
    await nextFrame()

    expect(grid.getActiveCell()).toMatchObject({
      rowKey: 'u2',
      rowIndex: 0,
      columnId: 'role',
      columnIndex: 0,
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

  it('refreshes the virtual column window and DOM layout after resizing', async () => {
    const grid = await mountDataGrid({
      rows: createWideRows(2),
      columns: createWideColumns(10),
      virtual: true,
      overscanColumns: 0,
      resizable: true,
    })
    const viewport = getViewport(grid)
    setElementClientWidth(viewport, 200)
    grid.refreshViewport()

    await nextFrame()

    expect(grid.getColumnItems().map(item => item.size)).toEqual([100, 100])

    grid.resizeColumn('column-1', 200)

    await nextFrame()

    const header = grid.querySelector<HTMLElement>(
      '[data-slot="data-grid-header"]',
    )
    const spacer = grid.querySelector<HTMLElement>(
      '[data-slot="data-grid-spacer"]',
    )
    const handle = getHeaderCell(grid, 'column-1').querySelector<HTMLElement>(
      '[data-slot="data-grid-resize-handle"]',
    )

    expect(grid.getTotalColumnSize()).toBe(1100)
    expect(grid.getColumnItems().map(item => item.size)).toEqual([200])
    expect(
      grid.querySelectorAll('[data-slot="data-grid-header-cell"]'),
    ).toHaveLength(1)
    expect(header?.style.gridTemplateColumns).toBe('200px')
    expect(spacer?.style.width).toBe('1100px')
    expect(handle?.getAttribute('aria-valuenow')).toBe('200')
  })

  it('refreshes column layout during pointer resizing', async () => {
    const grid = await mountDataGrid({
      columns: runtimeColumns,
      resizable: true,
    })
    const header = grid.querySelector<HTMLElement>(
      '[data-slot="data-grid-header"]',
    )
    const handle = getHeaderCell(grid, 'name').querySelector<HTMLElement>(
      '[data-slot="data-grid-resize-handle"]',
    )

    if (!handle) {
      throw new Error('Resize handle not found: name')
    }

    pointer(handle, 'pointerdown', 100)
    pointer(handle, 'pointermove', 140)

    await nextFrame()

    expect(grid.getColumnWidths().name).toBe(220)
    expect(header?.style.gridTemplateColumns).toBe('220px 120px 160px')
    expect(handle?.getAttribute('aria-valuenow')).toBe('220')

    pointer(handle, 'pointerup', 140)
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

  it('updates the virtual spacer when rows are assigned after columns', () => {
    return mountDataGrid({
      rows: [],
      columns: [],
      virtual: true,
      rowHeight: 40,
    }).then(grid => {
      grid.columns = createWideColumns(10)

      return nextFrame()
        .then(() => {
          grid.rows = createWideRows(100)
          return nextFrame()
        })
        .then(() => {
          const spacer = grid.querySelector<HTMLElement>(
            '[data-slot="data-grid-spacer"]',
          )

          if (!spacer) throw new Error('Data Grid spacer not found.')

          expect(grid.getTotalSize()).toBe(4_000)
          expect(spacer.style.height).toBe('4000px')
        })
    })
  })

  it('updates the virtual spacer when setRows replaces the initial rows', async () => {
    const grid = await mountDataGrid({
      rows: createWideRows(2),
      columns: createWideColumns(1),
      virtual: true,
      rowHeight: 40,
    })
    const spacer = grid.querySelector<HTMLElement>(
      '[data-slot="data-grid-spacer"]',
    )

    if (!spacer) throw new Error('Data Grid spacer not found.')

    expect(grid.getTotalSize()).toBe(80)
    expect(spacer.style.height).toBe('80px')

    grid.setRows(createWideRows(10))
    await nextFrame()

    expect(grid.getTotalSize()).toBe(400)
    expect(spacer.style.height).toBe('400px')
  })

  it('preserves an outer-batched rows assignment when selection is committed', async () => {
    const grid = await mountDataGrid({
      rows: [{ id: 'initial-row', value: 'Initial' }],
      columns: [{ id: 'value', field: 'value' }],
      selectionMode: 'multiple',
    })
    const nextRows = [{ id: 'next-row', value: 'Next' }]

    batch(() => {
      grid.rows = nextRows
      grid.setSelection(['next-row'])
    })
    await nextFrame()

    expect.soft(grid.getRows().map(row => row.key)).toEqual(['next-row'])
    expect.soft(grid.textContent).toContain('Next')
    expect(grid.textContent).not.toContain('Initial')
  })

  it('updates the virtual spacer when row layout measurements change', () => {
    return mountDataGrid({
      rows: createWideRows(100),
      columns: createWideColumns(10),
      virtual: true,
      rowHeight: 40,
    }).then(grid => {
      const spacer = grid.querySelector<HTMLElement>(
        '[data-slot="data-grid-spacer"]',
      )

      if (!spacer) throw new Error('Data Grid spacer not found.')

      grid.rowHeight = 48

      return nextFrame()
        .then(() => {
          expect(grid.getTotalSize()).toBe(4_800)
          expect(spacer.style.height).toBe('4800px')

          grid.measure(0, 80)
          return nextFrame()
        })
        .then(() => {
          expect(grid.getTotalSize()).toBe(4_832)
          expect(spacer.style.height).toBe('4832px')

          grid.resetMeasurements()
          return nextFrame()
        })
        .then(() => {
          expect(grid.getTotalSize()).toBe(4_800)
          expect(spacer.style.height).toBe('4800px')
        })
    })
  })

  it('virtualizes columns using the horizontal viewport and keeps true aria indexes', () => {
    const columns = createWideColumns(100)
    const rows = createWideRows(20)

    return mountDataGrid({
      rows,
      columns,
      virtual: true,
      rowHeight: 40,
      overscan: 1,
      overscanColumns: 1,
    }).then(grid => {
      const viewport = getViewport(grid)

      expect(
        grid.querySelectorAll('[data-slot="data-grid-header-cell"]'),
      ).toHaveLength(8)

      setElementClientHeight(viewport, 120)
      setElementClientWidth(viewport, 200)
      grid.refreshViewport()

      return nextFrame()
        .then(() => {
          expect(grid.getColumnRange()).toEqual({
            start: 0,
            end: 1,
            overscanStart: 0,
            overscanEnd: 2,
          })
          expect(
            grid.querySelectorAll('[data-slot="data-grid-header-cell"]'),
          ).toHaveLength(3)
          expect(
            grid.querySelectorAll('[data-slot="data-grid-cell"]'),
          ).toHaveLength(12)

          grid.scrollToColumn(50)

          return nextFrame()
        })
        .then(() => {
          expect(viewport.scrollLeft).toBe(5000)
          expect(grid.getColumnRange()).toEqual({
            start: 50,
            end: 51,
            overscanStart: 49,
            overscanEnd: 52,
          })
          expect(grid.getColumnItems().map(item => item.index)).toEqual(
            Array.from({ length: 4 }, (_, index) => index + 49),
          )
          expect(
            grid.querySelectorAll('[data-slot="data-grid-header-cell"]'),
          ).toHaveLength(4)
          expect(
            grid.querySelectorAll('[data-slot="data-grid-cell"]'),
          ).toHaveLength(16)
          expect(
            getHeaderCell(grid, 'column-50').getAttribute('aria-colindex'),
          ).toBe('50')
          expect(
            getCell(grid, 'row-1', 'column-50').getAttribute('aria-colindex'),
          ).toBe('50')
        })
    })
  })

  it('scrolls to columns when virtualization is disabled', async () => {
    const grid = await mountDataGrid({
      rows: createWideRows(2),
      columns: createWideColumns(10),
      virtual: false,
    })
    const viewport = getViewport(grid)
    setElementClientWidth(viewport, 200)
    grid.refreshViewport()

    grid.scrollToColumn(5)

    await nextFrame()

    expect(viewport.scrollLeft).toBe(500)
  })

  it('scrolls and focuses cells outside the horizontal window', () => {
    const columns = createWideColumns(100)
    const rows = createWideRows(20)

    return mountDataGrid({
      rows,
      columns,
      virtual: true,
      rowHeight: 40,
      overscan: 0,
      overscanColumns: 0,
    }).then(grid => {
      const viewport = getViewport(grid)
      setElementClientHeight(viewport, 120)
      setElementClientWidth(viewport, 200)
      grid.refreshViewport()
      grid.focusCell('row-11', 'column-81')

      return nextFrame()
        .then(() => nextFrame())
        .then(() => {
          expect(viewport.scrollLeft).toBe(7950)
          expect(grid.getColumnItems().map(item => item.data.id)).toContain(
            'column-81',
          )
          expect(grid.getActiveCell()).toMatchObject({
            rowKey: 'row-11',
            columnId: 'column-81',
          })
          expect(document.activeElement).toBe(
            getCell(grid, 'row-11', 'column-81'),
          )

          keydown(getCell(grid, 'row-11', 'column-81'), 'ArrowRight')

          return nextFrame()
        })
        .then(() => {
          expect(viewport.scrollLeft).toBe(8050)
          expect(grid.getActiveCell()).toMatchObject({
            rowKey: 'row-11',
            columnId: 'column-82',
          })
          expect(document.activeElement).toBe(
            getCell(grid, 'row-11', 'column-82'),
          )
        })
    })
  })

  it('clears an offscreen active descendant and restores it with focusActiveCell', () => {
    const columns = createWideColumns(100)
    const rows = createWideRows(20)

    return mountDataGrid({
      rows,
      columns,
      virtual: true,
      rowHeight: 40,
      overscan: 0,
      overscanColumns: 0,
      activeRowKey: 'row-1',
      activeColumnId: 'column-1',
    }).then(grid => {
      const viewport = getViewport(grid)
      setElementClientHeight(viewport, 120)
      setElementClientWidth(viewport, 200)
      grid.refreshViewport()
      grid.scrollToColumn(50)

      return nextFrame()
        .then(() => {
          expect(
            grid.querySelector(
              '[data-slot="data-grid-cell"][id="zg-cell-row-1-column-1"]',
            ),
          ).toBeNull()
          expect(viewport.getAttribute('aria-activedescendant')).toBeNull()

          grid.focusActiveCell()

          return nextFrame()
        })
        .then(() => nextFrame())
        .then(() => {
          const cell = getCell(grid, 'row-1', 'column-1')

          expect(viewport.scrollLeft).toBe(0)
          expect(viewport.getAttribute('aria-activedescendant')).toBe(
            'zg-cell-row-1-column-1',
          )
          expect(document.activeElement).toBe(cell)
        })
    })
  })
})
