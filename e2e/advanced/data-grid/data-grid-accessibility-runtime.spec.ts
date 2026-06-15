/* eslint-disable no-restricted-globals */
import type { DataGridActiveCellChangeDetail } from './data-grid-runtime-harness'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  cleanupDataGridFixtures,
  collectEvents,
  getCell,
  getHeaderCell,
  getViewport,
  mountDataGrid,
  nextFrame,
  runtimeColumns,
  runtimeRows,
  setElementClientHeight,
} from './data-grid-runtime-harness'

describe('zw-data-grid accessibility runtime', () => {
  afterEach(() => {
    cleanupDataGridFixtures()
    vi.restoreAllMocks()
  })

  it('renders grid aria metadata', async () => {
    const grid = await mountDataGrid({
      selectionMode: 'multiple',
      selectedKeys: ['u1'],
      activeRowKey: 'u1',
      activeColumnId: 'name',
    })
    const viewport = getViewport(grid)

    expect(viewport.getAttribute('role')).toBe('grid')
    expect(viewport.getAttribute('aria-rowcount')).toBe('4')
    expect(viewport.getAttribute('aria-colcount')).toBe('3')
    expect(viewport.getAttribute('aria-multiselectable')).toBe('true')
    expect(viewport.getAttribute('aria-activedescendant')).toBe(
      'zg-cell-u1-name',
    )
  })

  it('renders header aria-sort and aria-colindex', async () => {
    const grid = await mountDataGrid({
      sortColumn: 'age',
      sortDirection: 'desc',
    })

    expect(getHeaderCell(grid, 'name').getAttribute('aria-sort')).toBe('none')
    expect(getHeaderCell(grid, 'age').getAttribute('aria-sort')).toBe(
      'descending',
    )
    expect(getHeaderCell(grid, 'name').getAttribute('aria-colindex')).toBe('1')
    expect(getHeaderCell(grid, 'age').getAttribute('aria-colindex')).toBe('2')
  })

  it('renders row and cell aria indexes and selected state', async () => {
    const grid = await mountDataGrid({
      selectionMode: 'multiple',
      selectedKeys: ['u2'],
    })

    const row = grid.querySelector<HTMLElement>(
      '[data-slot="data-grid-row"][data-row-key="u2"]',
    )

    expect(row?.getAttribute('aria-rowindex')).toBe('3')
    expect(row?.getAttribute('aria-selected')).toBe('true')

    const cell = getCell(grid, 'u2', 'age')

    expect(cell.getAttribute('aria-colindex')).toBe('2')
    expect(cell.getAttribute('aria-selected')).toBe('true')
  })

  it('renders resize handle label and value metadata', async () => {
    const grid = await mountDataGrid({
      columns: runtimeColumns,
      resizable: true,
    })

    const handle = getHeaderCell(grid, 'name').querySelector<HTMLElement>(
      '[data-slot="data-grid-resize-handle"]',
    )

    expect(handle?.getAttribute('role')).toBe('separator')
    expect(handle?.getAttribute('aria-label')).toBe('Resize Name column')
    expect(handle?.getAttribute('aria-valuenow')).toBe('180')
    expect(handle?.getAttribute('aria-valuemin')).toBe('80')
    expect(handle?.getAttribute('aria-valuemax')).toBe('260')
  })

  it('focusCell updates active cell and moves DOM focus', async () => {
    const grid = await mountDataGrid({
      activeRowKey: 'u1',
      activeColumnId: 'name',
    })
    const collector = collectEvents<DataGridActiveCellChangeDetail>(
      grid,
      'active-cell-change',
    )

    grid.focusCell('u2', 'age')

    await nextFrame()

    const active = grid.getActiveCell()
    const cell = getCell(grid, 'u2', 'age')

    expect(active).toMatchObject({
      rowKey: 'u2',
      columnId: 'age',
    })
    expect(document.activeElement).toBe(cell)
    expect(
      collector.events[collector.events.length - 1]?.detail.activeCell,
    ).toMatchObject({
      rowKey: 'u2',
      columnId: 'age',
    })

    collector.dispose()
  })

  it('focusActiveCell moves DOM focus to the current active cell', async () => {
    const grid = await mountDataGrid({
      activeRowKey: 'u3',
      activeColumnId: 'role',
    })

    grid.focusActiveCell()

    await nextFrame()

    expect(document.activeElement).toBe(getCell(grid, 'u3', 'role'))
  })

  it('focusCell scrolls virtual rows into view before focusing the target cell', async () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({
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
    setElementClientHeight(viewport, 400)
    grid.refreshViewport()
    grid.focusCell('r20', 'age')

    await nextFrame()
    await nextFrame()

    const items = grid.getItems().map(item => item.key)
    expect(items).toContain('r20')

    expect(grid.getRange()).toMatchObject({
      start: 15,
      end: 25,
    })
  })

  it('uses fallback viewport size when clientHeight is zero', async () => {
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

    grid.refreshViewport()

    await nextFrame()

    expect(grid.getRange()).toEqual({
      start: 0,
      end: 9,
      overscanStart: 0,
      overscanEnd: 10,
    })
    expect(grid.getItems().map(item => item.index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
  })

  it('emits viewport-resize when viewport size changes', async () => {
    const grid = await mountDataGrid({
      rows: runtimeRows,
      columns: runtimeColumns,
      virtual: true,
      rowHeight: 40,
    })
    const viewport = getViewport(grid)
    const collector = collectEvents(grid, 'viewport-resize')

    setElementClientHeight(viewport, 200)
    grid.refreshViewport()

    await nextFrame()

    expect(collector.events[collector.events.length - 1]?.detail).toMatchObject(
      {
        viewportSize: 200,
        source: 'client',
      },
    )

    collector.dispose()
  })
})
