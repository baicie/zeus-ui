import type { DataGridCellActionDetail } from '../../../packages/advanced/data-grid/src'

import { afterEach, describe, expect, it } from 'vitest'

import {
  cleanupDataGridFixtures,
  click,
  collectEvents,
  getCell,
  getHeaderCell,
  getViewport,
  mountDataGrid,
  nextFrame,
  setElementClientHeight,
  setElementClientWidth,
} from './data-grid-runtime-harness'

function createRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${index}`,
    name: `Row ${index}`,
    value: index,
  }))
}

const columns = [
  { id: 'name', header: 'Name', field: 'name', width: 120 },
  { id: 'value', header: 'Value', field: 'value', width: 100 },
]

function getRenderedRows(grid: Element): HTMLElement[] {
  return Array.from(
    grid.querySelectorAll<HTMLElement>('[data-slot="data-grid-row"]'),
  )
}

function getRenderedCells(row: Element): HTMLElement[] {
  return Array.from(
    row.querySelectorAll<HTMLElement>('[data-slot="data-grid-cell"]'),
  )
}

function createWideRow(columnCount: number) {
  const row: Record<string, unknown> = { id: 'row-0' }

  for (let index = 0; index < columnCount; index += 1) {
    row[`column_${index}`] = `Value ${index}`
  }

  return row
}

function createColumns(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `column-${index}`,
    header: `Column ${index}`,
    field: `column_${index}`,
    width: 100,
  }))
}

describe('zw-data-grid fixed-row DOM pooling', () => {
  afterEach(() => {
    cleanupDataGridFixtures()
  })

  it('reuses viewport row and cell slots across a long-distance scroll', async () => {
    const grid = await mountDataGrid({
      rows: createRows(1_000),
      columns,
      virtual: true,
      rowHeight: 40,
      overscan: 1,
      overscanColumns: 0,
      selectionMode: 'none',
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 220)
    grid.refreshViewport()
    grid.scrollToOffset(4_000)

    const rowsBefore = getRenderedRows(grid)
    const cellsBefore = rowsBefore.map(getRenderedCells)
    const actions = collectEvents<DataGridCellActionDetail>(grid, 'cell-action')

    grid.scrollToOffset(20_000)

    const rowsAfter = getRenderedRows(grid)
    const cellsAfter = rowsAfter.map(getRenderedCells)

    expect(rowsAfter).toHaveLength(rowsBefore.length)
    expect(rowsAfter.every((row, index) => row === rowsBefore[index])).toBe(
      true,
    )
    expect(
      cellsAfter.every((cells, rowIndex) =>
        cells.every((cell, columnIndex) =>
          Object.is(cell, cellsBefore[rowIndex][columnIndex]),
        ),
      ),
    ).toBe(true)

    const firstRow = rowsAfter[0]
    const firstCells = cellsAfter[0]
    const rowKey = firstRow.getAttribute('data-row-key')

    expect(rowKey).toBe('row-499')
    expect(firstCells[0].textContent).toBe('Row 499')
    expect(firstCells[1].textContent).toBe('499')
    expect(firstCells[0].getAttribute('data-row-key')).toBe(rowKey)

    click(firstCells[1])

    const lastAction = actions.events[actions.events.length - 1]

    expect(lastAction?.detail.cell.row.key).toBe(rowKey)
    expect(lastAction?.detail.cell.value).toBe(499)

    actions.dispose()
  })

  it('reuses header and cell slots across a long-distance horizontal scroll', async () => {
    const wideColumns = createColumns(30)
    const grid = await mountDataGrid({
      rows: [createWideRow(wideColumns.length)],
      columns: wideColumns,
      virtual: true,
      rowHeight: 40,
      overscan: 0,
      overscanColumns: 1,
      selectionMode: 'none',
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 40)
    setElementClientWidth(viewport, 200)
    grid.refreshViewport()
    grid.scrollToColumn(5)

    const headersBefore = Array.from(
      grid.querySelectorAll<HTMLElement>('[data-slot="data-grid-header-cell"]'),
    )
    const cellsBefore = getRenderedCells(getRenderedRows(grid)[0])
    const actions = collectEvents<DataGridCellActionDetail>(grid, 'cell-action')

    grid.scrollToColumn(20)

    const headersAfter = Array.from(
      grid.querySelectorAll<HTMLElement>('[data-slot="data-grid-header-cell"]'),
    )
    const cellsAfter = getRenderedCells(getRenderedRows(grid)[0])
    const firstColumn = grid.getColumnItems()[0]

    expect(headersAfter).toHaveLength(headersBefore.length)
    expect(cellsAfter).toHaveLength(cellsBefore.length)
    expect(
      headersAfter.every((header, index) => header === headersBefore[index]),
    ).toBe(true)
    expect(cellsAfter.every((cell, index) => cell === cellsBefore[index])).toBe(
      true,
    )
    expect(headersAfter[0].getAttribute('data-column-id')).toBe(firstColumn.key)
    expect(headersAfter[0].textContent).toContain(firstColumn.data.header)
    expect(cellsAfter[0].getAttribute('data-column-id')).toBe(firstColumn.key)
    expect(cellsAfter[0].textContent).toBe(`Value ${firstColumn.index}`)

    click(cellsAfter[0])

    const lastAction = actions.events[actions.events.length - 1]

    expect(lastAction?.detail.cell.column.id).toBe(firstColumn.key)
    expect(lastAction?.detail.cell.value).toBe(`Value ${firstColumn.index}`)

    actions.dispose()
  })

  it('does not rebind a focused header cell to another column while scrolling horizontally', async () => {
    const wideColumns = createColumns(30)
    const grid = await mountDataGrid({
      rows: [createWideRow(wideColumns.length)],
      columns: wideColumns,
      virtual: true,
      rowHeight: 40,
      overscan: 0,
      overscanColumns: 1,
      selectionMode: 'none',
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 40)
    setElementClientWidth(viewport, 200)
    grid.refreshViewport()
    grid.scrollToColumn(5)

    const focusedColumnId = 'column-5'
    const focusedHeader = getHeaderCell(grid, focusedColumnId)

    focusedHeader.focus()

    expect(document.activeElement).toBe(focusedHeader)

    grid.scrollToColumn(20)
    await nextFrame()

    expect(grid.getColumnItems().map(item => item.key)).not.toContain(
      focusedColumnId,
    )
    expect(document.activeElement).not.toBe(focusedHeader)
    expect(
      document.activeElement?.closest('[data-slot="data-grid-header-cell"]'),
    ).toBeNull()
    expect(focusedHeader.getAttribute('data-column-id')).toBe(focusedColumnId)
  })

  it('restores a focused header cell when its column remains rendered', async () => {
    const wideColumns = createColumns(30)
    const grid = await mountDataGrid({
      rows: [createWideRow(wideColumns.length)],
      columns: wideColumns,
      virtual: true,
      rowHeight: 40,
      overscan: 0,
      overscanColumns: 1,
      selectionMode: 'none',
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 40)
    setElementClientWidth(viewport, 200)
    grid.refreshViewport()
    grid.scrollToColumn(5)

    const focusedColumnId = 'column-5'
    const focusedHeader = getHeaderCell(grid, focusedColumnId)

    focusedHeader.focus()
    grid.scrollToColumn(6)
    await nextFrame()

    expect(grid.getColumnItems().map(item => item.key)).toContain(
      focusedColumnId,
    )

    const restoredHeader = getHeaderCell(grid, focusedColumnId)

    expect(document.activeElement).toBe(restoredHeader)
    expect(restoredHeader.getAttribute('data-column-id')).toBe(focusedColumnId)
  })

  it('does not steal focus back from an outside target after scheduling header focus restoration', async () => {
    const wideColumns = createColumns(30)
    const grid = await mountDataGrid({
      rows: [createWideRow(wideColumns.length)],
      columns: wideColumns,
      virtual: true,
      rowHeight: 40,
      overscan: 0,
      overscanColumns: 1,
      selectionMode: 'none',
    })
    const viewport = getViewport(grid)
    const outsideButton = document.createElement('button')

    outsideButton.type = 'button'
    document.body.append(outsideButton)

    setElementClientHeight(viewport, 40)
    setElementClientWidth(viewport, 200)
    grid.refreshViewport()
    grid.scrollToColumn(5)

    getHeaderCell(grid, 'column-5').focus()
    grid.scrollToColumn(6)
    outsideButton.focus()

    expect(document.activeElement).toBe(outsideButton)

    await nextFrame()

    expect(document.activeElement).toBe(outsideButton)
  })

  it('does not run stale header focus restoration after a subsequent synchronous horizontal scroll', async () => {
    const wideColumns = createColumns(30)
    const grid = await mountDataGrid({
      rows: [createWideRow(wideColumns.length)],
      columns: wideColumns,
      virtual: true,
      rowHeight: 40,
      overscan: 0,
      overscanColumns: 1,
      selectionMode: 'none',
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 40)
    setElementClientWidth(viewport, 200)
    grid.refreshViewport()
    grid.scrollToColumn(5)

    const focusedColumnId = 'column-5'

    getHeaderCell(grid, focusedColumnId).focus()
    grid.scrollToColumn(6)
    grid.scrollToColumn(5)

    expect(grid.getColumnItems().map(item => item.key)).toContain(
      focusedColumnId,
    )

    await nextFrame()

    expect(
      document.activeElement?.closest('[data-slot="data-grid-header-cell"]'),
    ).toBeNull()
  })

  it('keeps body column slots pooled while a header cell is focused', async () => {
    const wideColumns = createColumns(30)
    const grid = await mountDataGrid({
      rows: [createWideRow(wideColumns.length)],
      columns: wideColumns,
      virtual: true,
      rowHeight: 40,
      overscan: 0,
      overscanColumns: 1,
      selectionMode: 'none',
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 40)
    setElementClientWidth(viewport, 200)
    grid.refreshViewport()
    grid.scrollToColumn(5)

    const cellsBefore = getRenderedCells(getRenderedRows(grid)[0])

    getHeaderCell(grid, 'column-5').focus()
    grid.scrollToColumn(6)
    await nextFrame()

    const cellsAfter = getRenderedCells(getRenderedRows(grid)[0])

    expect(cellsAfter).toHaveLength(cellsBefore.length)
    expect(cellsAfter.every((cell, index) => cell === cellsBefore[index])).toBe(
      true,
    )
  })

  it('keeps header slots pooled while a body cell is focused', async () => {
    const wideColumns = createColumns(30)
    const grid = await mountDataGrid({
      rows: [createWideRow(wideColumns.length)],
      columns: wideColumns,
      virtual: true,
      rowHeight: 40,
      overscan: 0,
      overscanColumns: 1,
      selectionMode: 'none',
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 40)
    setElementClientWidth(viewport, 200)
    grid.refreshViewport()
    grid.scrollToColumn(5)

    const headersBefore = Array.from(
      grid.querySelectorAll<HTMLElement>('[data-slot="data-grid-header-cell"]'),
    )

    getCell(grid, 'row-0', 'column-5').focus()
    grid.scrollToColumn(6)
    await nextFrame()

    const headersAfter = Array.from(
      grid.querySelectorAll<HTMLElement>('[data-slot="data-grid-header-cell"]'),
    )

    expect(headersAfter).toHaveLength(headersBefore.length)
    expect(
      headersAfter.every((header, index) => header === headersBefore[index]),
    ).toBe(true)
  })

  it('does not rebind a focused resize handle to another column while scrolling horizontally', async () => {
    const wideColumns = createColumns(30)
    const grid = await mountDataGrid({
      rows: [createWideRow(wideColumns.length)],
      columns: wideColumns,
      virtual: true,
      rowHeight: 40,
      overscan: 0,
      overscanColumns: 1,
      selectionMode: 'none',
      resizable: true,
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 40)
    setElementClientWidth(viewport, 200)
    grid.refreshViewport()
    grid.scrollToColumn(5)

    const focusedColumnId = 'column-5'
    const focusedHeader = getHeaderCell(grid, focusedColumnId)
    const focusedResizeHandle = focusedHeader.querySelector<HTMLElement>(
      '[data-slot="data-grid-resize-handle"]',
    )

    if (!focusedResizeHandle) {
      throw new Error('expected a resize handle focus target')
    }

    focusedResizeHandle.focus()

    expect(document.activeElement).toBe(focusedResizeHandle)

    grid.scrollToColumn(20)
    await nextFrame()

    expect(grid.getColumnItems().map(item => item.key)).not.toContain(
      focusedColumnId,
    )
    expect(document.activeElement).not.toBe(focusedResizeHandle)
    expect(
      document.activeElement?.closest('[data-slot="data-grid-header-cell"]'),
    ).toBeNull()
    expect(focusedHeader.getAttribute('data-column-id')).toBe(focusedColumnId)
  })

  it('restores a focused resize handle when its column remains rendered', async () => {
    const wideColumns = createColumns(30)
    const grid = await mountDataGrid({
      rows: [createWideRow(wideColumns.length)],
      columns: wideColumns,
      virtual: true,
      rowHeight: 40,
      overscan: 0,
      overscanColumns: 1,
      selectionMode: 'none',
      resizable: true,
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 40)
    setElementClientWidth(viewport, 200)
    grid.refreshViewport()
    grid.scrollToColumn(5)

    const focusedColumnId = 'column-5'
    const focusedResizeHandle = getHeaderCell(
      grid,
      focusedColumnId,
    ).querySelector<HTMLElement>('[data-slot="data-grid-resize-handle"]')

    if (!focusedResizeHandle) {
      throw new Error('expected a resize handle focus target')
    }

    focusedResizeHandle.focus()
    grid.scrollToColumn(6)
    await nextFrame()

    const restoredResizeHandle = getHeaderCell(
      grid,
      focusedColumnId,
    ).querySelector<HTMLElement>('[data-slot="data-grid-resize-handle"]')

    expect(document.activeElement).toBe(restoredResizeHandle)
  })

  it('disables pooling for measured rows and restores it after reset', async () => {
    const grid = await mountDataGrid({
      rows: createRows(1_000),
      columns,
      virtual: true,
      rowHeight: 40,
      overscan: 1,
      overscanColumns: 0,
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 220)
    grid.refreshViewport()
    grid.scrollToOffset(4_000)

    const pooledRows = getRenderedRows(grid)
    const measuredIndex = grid.getItems()[2].index

    grid.measure(measuredIndex, 80)
    grid.scrollToOffset(8_000)

    const measuredRows = getRenderedRows(grid)

    expect(measuredRows.some(row => pooledRows.includes(row))).toBe(false)

    grid.resetMeasurements()
    grid.scrollToOffset(12_000)

    const resetRows = getRenderedRows(grid)

    grid.scrollToOffset(16_000)

    const reusedRows = getRenderedRows(grid)

    expect(reusedRows).toHaveLength(resetRows.length)
    expect(reusedRows.every((row, index) => row === resetRows[index])).toBe(
      true,
    )
  })

  it('preserves focused cells during horizontal scroll after row measurement', async () => {
    const wideColumns = createColumns(30)
    const grid = await mountDataGrid({
      rows: [createWideRow(wideColumns.length)],
      columns: wideColumns,
      virtual: true,
      rowHeight: 40,
      overscan: 0,
      overscanColumns: 1,
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 40)
    setElementClientWidth(viewport, 200)
    grid.refreshViewport()
    grid.measure(0, 80)
    await nextFrame()
    grid.scrollToColumn(5)

    getCell(grid, 'row-0', 'column-5').focus()
    expect(document.activeElement).toBe(getCell(grid, 'row-0', 'column-5'))
    await nextFrame()

    grid.scrollToColumn(6)
    await nextFrame()

    expect(document.activeElement).toBe(getCell(grid, 'row-0', 'column-5'))
  })

  it('keeps the focused row identity synchronously when controlled rows change', async () => {
    const grid = await mountDataGrid({
      rows: createRows(100),
      columns,
      virtual: true,
      rowHeight: 40,
      overscan: 1,
      overscanColumns: 0,
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 220)
    grid.refreshViewport()
    grid.scrollToOffset(200)

    getCell(grid, 'row-5', 'name').focus()
    await nextFrame()

    grid.rows = [
      { id: 'prepended-row', name: 'Prepended', value: -1 },
      ...createRows(100),
    ]

    expect(
      (document.activeElement as HTMLElement).getAttribute('data-row-key'),
    ).toBe('row-5')

    await nextFrame()

    expect(document.activeElement).toBe(getCell(grid, 'row-5', 'name'))
  })

  it('keeps the focused header identity synchronously when controlled columns change', async () => {
    const wideColumns = createColumns(30)
    const grid = await mountDataGrid({
      rows: [createWideRow(wideColumns.length)],
      columns: wideColumns,
      virtual: true,
      rowHeight: 40,
      overscan: 0,
      overscanColumns: 1,
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 40)
    setElementClientWidth(viewport, 200)
    grid.refreshViewport()
    grid.scrollToColumn(5)

    getHeaderCell(grid, 'column-5').focus()
    await nextFrame()

    grid.columns = [
      {
        id: 'prepended-column',
        header: 'Prepended',
        field: 'prepended',
        width: 100,
      },
      ...wideColumns,
    ]

    expect(
      (document.activeElement as HTMLElement).getAttribute('data-column-id'),
    ).toBe('column-5')

    await nextFrame()

    expect(document.activeElement).toBe(getHeaderCell(grid, 'column-5'))
  })

  it('does not recycle a focused cell and preserves focus while it stays rendered', async () => {
    const grid = await mountDataGrid({
      rows: createRows(100),
      columns,
      virtual: true,
      rowHeight: 40,
      overscan: 1,
      overscanColumns: 0,
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 220)
    grid.refreshViewport()
    grid.scrollToOffset(400)

    const focusedRowKey = grid.getItems()[2].key

    grid.focusCell(focusedRowKey, 'name')
    await nextFrame()

    const pooledCell = grid.querySelector<HTMLElement>(
      `[data-slot="data-grid-cell"][data-row-key="${focusedRowKey}"][data-column-id="name"]`,
    )

    if (!pooledCell) throw new Error('expected a pooled focus target')

    expect(document.activeElement).toBe(pooledCell)

    grid.scrollToOffset(440)
    await nextFrame()

    const focusedCell = grid.querySelector<HTMLElement>(
      `[data-slot="data-grid-cell"][data-row-key="${focusedRowKey}"][data-column-id="name"]`,
    )

    expect(focusedCell).not.toBeNull()
    expect(document.activeElement).toBe(focusedCell)
    expect(pooledCell.getAttribute('data-row-key')).toBe(focusedRowKey)

    grid.scrollToOffset(480)
    await nextFrame()

    expect(
      grid.querySelector(
        `[data-slot="data-grid-cell"][data-row-key="${focusedRowKey}"][data-column-id="name"]`,
      ),
    ).toBe(focusedCell)
    expect(document.activeElement).toBe(focusedCell)
  })

  it('keeps the focused business cell stable through the native click sequence', async () => {
    const grid = await mountDataGrid({
      rows: createRows(1_000),
      columns,
      virtual: true,
      rowHeight: 40,
      overscan: 1,
      overscanColumns: 0,
      selectionMode: 'multiple',
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 220)
    grid.refreshViewport()
    grid.scrollToOffset(20_000)

    const row = getRenderedRows(grid)[1]
    const cell = getRenderedCells(row)[0]
    const rowKey = row.getAttribute('data-row-key')
    const actions = collectEvents<DataGridCellActionDetail>(grid, 'cell-action')

    if (!rowKey) throw new Error('expected a rendered business row key')

    cell.focus()
    click(cell)

    const focusedCell = grid.querySelector<HTMLElement>(
      `[data-slot="data-grid-cell"][data-row-key="${rowKey}"][data-column-id="name"]`,
    )
    const focusedRow = focusedCell?.closest<HTMLElement>(
      '[data-slot="data-grid-row"]',
    )

    expect(focusedCell).not.toBeNull()
    expect(document.activeElement).toBe(focusedCell)
    expect(focusedRow?.getAttribute('aria-selected')).toBe('true')
    expect(focusedCell?.getAttribute('aria-selected')).toBe('true')
    expect(focusedCell?.hasAttribute('data-active')).toBe(true)
    expect(viewport.getAttribute('aria-activedescendant')).toBe(focusedCell?.id)
    const lastAction = actions.events[actions.events.length - 1]

    expect(lastAction?.detail.cell.row.key).toBe(rowKey)

    grid.scrollToOffset(20_040)
    await nextFrame()

    const retainedCell = grid.querySelector<HTMLElement>(
      `[data-slot="data-grid-cell"][data-row-key="${rowKey}"][data-column-id="name"]`,
    )

    expect(retainedCell).not.toBeNull()
    expect(document.activeElement).toBe(retainedCell)
    expect(retainedCell?.hasAttribute('data-active')).toBe(true)
    expect(viewport.getAttribute('aria-activedescendant')).toBe(
      retainedCell?.id,
    )

    actions.dispose()
  })

  it('keeps selection, active-cell ARIA, and same-key data current in reused slots', async () => {
    const initialRows = createRows(1_000)
    const grid = await mountDataGrid({
      rows: initialRows,
      columns,
      virtual: true,
      rowHeight: 40,
      overscan: 1,
      overscanColumns: 0,
      selectionMode: 'multiple',
    })
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 220)
    grid.refreshViewport()
    grid.scrollToOffset(20_000)

    const row = getRenderedRows(grid)[1]
    const cell = getRenderedCells(row)[0]
    const rowKey = row.getAttribute('data-row-key')

    if (!rowKey) throw new Error('expected a rendered business row key')

    click(cell)

    expect(row.getAttribute('aria-selected')).toBe('true')
    expect(cell.getAttribute('aria-selected')).toBe('true')
    expect(cell.hasAttribute('data-active')).toBe(true)
    expect(viewport.getAttribute('aria-activedescendant')).toBe(cell.id)

    const replacementRows = initialRows.map(item =>
      item.id === rowKey ? { ...item, name: 'Replacement row' } : item,
    )

    grid.setRows(replacementRows)

    const replacementCell = grid.querySelector<HTMLElement>(
      `[data-slot="data-grid-cell"][data-row-key="${rowKey}"][data-column-id="name"]`,
    )

    expect(replacementCell).toBe(cell)
    expect(replacementCell?.textContent).toBe('Replacement row')
    expect(replacementCell?.getAttribute('aria-selected')).toBe('true')
    expect(replacementCell?.hasAttribute('data-active')).toBe(true)
    expect(viewport.getAttribute('aria-activedescendant')).toBe(
      replacementCell?.id,
    )
  })
})
