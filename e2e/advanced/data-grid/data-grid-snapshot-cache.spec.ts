import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cleanupDataGridFixtures,
  getViewport,
  mountDataGrid,
  nextFrame,
  setElementClientHeight,
  setElementClientWidth,
} from './data-grid-runtime-harness'

const snapshotDiagnostics = vi.hoisted(() => ({
  rowVirtualizerBuilds: 0,
  columnVirtualizerBuilds: 0,
  rowSnapshotCalls: 0,
  columnSnapshotCalls: 0,
}))

function resetSnapshotDiagnostics(): void {
  snapshotDiagnostics.rowVirtualizerBuilds = 0
  snapshotDiagnostics.columnVirtualizerBuilds = 0
  snapshotDiagnostics.rowSnapshotCalls = 0
  snapshotDiagnostics.columnSnapshotCalls = 0
}

function createRows(count = 100) {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${index}`,
  }))
}

function createColumns(count = 20) {
  return Array.from({ length: count }, (_, index) => ({
    id: `column-${index}`,
    header: `Column ${index}`,
    width: 100,
    sortable: true,
  }))
}

function mountVirtualDataGrid() {
  return mountDataGrid({
    rows: createRows(),
    columns: createColumns(),
    virtual: true,
    rowHeight: 40,
    overscan: 1,
    overscanColumns: 1,
  })
}

vi.mock(
  '../../../packages/advanced/data-grid/src/core',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('../../../packages/advanced/data-grid/src/core')
      >()

    return {
      ...actual,
      createDataGridRowVirtualizer(
        ...args: Parameters<typeof actual.createDataGridRowVirtualizer>
      ): ReturnType<typeof actual.createDataGridRowVirtualizer> {
        snapshotDiagnostics.rowVirtualizerBuilds += 1
        const virtualizer = actual.createDataGridRowVirtualizer(...args)

        return {
          ...virtualizer,
          getSnapshot(scrollOffset, viewportSize) {
            snapshotDiagnostics.rowSnapshotCalls += 1
            return virtualizer.getSnapshot(scrollOffset, viewportSize)
          },
        }
      },
      createDataGridColumnVirtualizer(
        ...args: Parameters<typeof actual.createDataGridColumnVirtualizer>
      ): ReturnType<typeof actual.createDataGridColumnVirtualizer> {
        snapshotDiagnostics.columnVirtualizerBuilds += 1
        const virtualizer = actual.createDataGridColumnVirtualizer(...args)

        return {
          ...virtualizer,
          getSnapshot(scrollOffset, viewportSize) {
            snapshotDiagnostics.columnSnapshotCalls += 1
            return virtualizer.getSnapshot(scrollOffset, viewportSize)
          },
        }
      },
    }
  },
)

describe('zw-data-grid viewport snapshot cache', () => {
  beforeEach(() => {
    resetSnapshotDiagnostics()
  })

  afterEach(() => {
    cleanupDataGridFixtures()
  })

  it('calculates each axis snapshot once for a viewport refresh', async () => {
    const grid = await mountVirtualDataGrid()
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 240)

    resetSnapshotDiagnostics()

    grid.refreshViewport()
    await nextFrame()

    expect(snapshotDiagnostics.rowSnapshotCalls).toBe(1)
    expect(snapshotDiagnostics.columnSnapshotCalls).toBe(1)
  })

  it('reuses viewport dimensions and calculates each axis once while scrolling', async () => {
    const grid = await mountVirtualDataGrid()
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 240)
    grid.refreshViewport()
    await nextFrame()

    let clientHeightReads = 0
    let clientWidthReads = 0

    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      get() {
        clientHeightReads += 1
        return 120
      },
    })
    Object.defineProperty(viewport, 'clientWidth', {
      configurable: true,
      get() {
        clientWidthReads += 1
        return 240
      },
    })
    resetSnapshotDiagnostics()

    viewport.scrollTop = 80
    viewport.scrollLeft = 200
    viewport.dispatchEvent(new Event('scroll'))
    await nextFrame()

    expect(snapshotDiagnostics.rowSnapshotCalls).toBe(1)
    expect(snapshotDiagnostics.columnSnapshotCalls).toBe(1)
    expect(clientHeightReads).toBe(0)
    expect(clientWidthReads).toBe(0)
    expect(grid.getRange().start).toBe(2)
    expect(grid.getColumnRange().start).toBe(2)
  })

  it('invalidates both snapshots when viewport dimensions change', async () => {
    const originalResizeObserver = Object.getOwnPropertyDescriptor(
      globalThis,
      'ResizeObserver',
    )
    let resizeCallback: ResizeObserverCallback | undefined

    class TestResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      disconnect(): void {}

      observe(): void {}

      unobserve(): void {}
    }

    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: TestResizeObserver,
    })

    try {
      const grid = await mountVirtualDataGrid()
      const viewport = getViewport(grid)

      setElementClientHeight(viewport, 120)
      setElementClientWidth(viewport, 240)
      grid.refreshViewport()
      await nextFrame()
      resetSnapshotDiagnostics()

      setElementClientHeight(viewport, 200)
      setElementClientWidth(viewport, 320)

      if (!resizeCallback) throw new Error('ResizeObserver was not connected')
      resizeCallback([], {} as ResizeObserver)
      await nextFrame()

      expect(snapshotDiagnostics.rowSnapshotCalls).toBe(1)
      expect(snapshotDiagnostics.columnSnapshotCalls).toBe(1)
      expect(grid.getRange().end).toBe(4)
      expect(grid.getColumnRange().end).toBe(3)
    } finally {
      if (originalResizeObserver) {
        Object.defineProperty(
          globalThis,
          'ResizeObserver',
          originalResizeObserver,
        )
      } else {
        Reflect.deleteProperty(globalThis, 'ResizeObserver')
      }
    }
  })

  it('invalidates only the row snapshot when rows change', async () => {
    const grid = await mountVirtualDataGrid()
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 240)
    grid.refreshViewport()
    await nextFrame()
    resetSnapshotDiagnostics()

    grid.setRows(createRows(120))
    await nextFrame()

    expect(snapshotDiagnostics.rowSnapshotCalls).toBe(1)
    expect(snapshotDiagnostics.columnSnapshotCalls).toBe(0)
  })

  it('invalidates only the column snapshot when columns change without sorting', async () => {
    const grid = await mountVirtualDataGrid()
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 240)
    grid.refreshViewport()
    await nextFrame()

    grid.measure(0, 80)
    expect(grid.getTotalSize()).toBe(4_040)

    resetSnapshotDiagnostics()
    grid.setColumns(createColumns(24))
    await nextFrame()

    expect(grid.getTotalSize()).toBe(4_040)
    expect(snapshotDiagnostics.rowVirtualizerBuilds).toBe(0)
    expect(snapshotDiagnostics.columnVirtualizerBuilds).toBe(1)
    expect(snapshotDiagnostics.rowSnapshotCalls).toBe(0)
    expect(snapshotDiagnostics.columnSnapshotCalls).toBe(1)
  })

  it('invalidates both snapshots when columns change under an active sort', async () => {
    const grid = await mountVirtualDataGrid()

    grid.setSort('column-0', 'asc')
    await nextFrame()
    resetSnapshotDiagnostics()

    grid.setColumns(createColumns(24))
    await nextFrame()

    expect(snapshotDiagnostics.rowVirtualizerBuilds).toBe(1)
    expect(snapshotDiagnostics.columnVirtualizerBuilds).toBe(1)
    expect(snapshotDiagnostics.rowSnapshotCalls).toBe(1)
    expect(snapshotDiagnostics.columnSnapshotCalls).toBe(1)
  })

  it('does not reuse a detached viewport snapshot after reconnecting', async () => {
    const grid = await mountVirtualDataGrid()
    let viewport = getViewport(grid)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 240)
    grid.refreshViewport()
    grid.scrollToOffset(80)
    await nextFrame()

    expect(grid.getRange().start).toBe(2)

    grid.remove()
    document.body.append(grid)
    await nextFrame()

    expect(grid.getRange().start).toBe(0)

    viewport = getViewport(grid)
    setElementClientHeight(viewport, 80)
    setElementClientWidth(viewport, 160)
    resetSnapshotDiagnostics()
    grid.refreshViewport()
    await nextFrame()

    expect(snapshotDiagnostics.rowSnapshotCalls).toBe(1)
    expect(snapshotDiagnostics.columnSnapshotCalls).toBe(1)
    expect(grid.getRange().end).toBe(1)
    expect(grid.getColumnRange().end).toBe(1)
  })

  it('uses current viewport dimensions for immediate aligned scrolling', async () => {
    const grid = await mountVirtualDataGrid()
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 240)
    grid.refreshViewport()

    setElementClientHeight(viewport, 40)
    setElementClientWidth(viewport, 100)
    grid.scrollToIndex(50, 'center')

    expect(viewport.scrollTop).toBe(2_000)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 240)
    grid.refreshViewport()

    setElementClientHeight(viewport, 40)
    setElementClientWidth(viewport, 100)
    grid.scrollToIndex(50, 'end')

    expect(viewport.scrollTop).toBe(2_000)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 240)
    grid.refreshViewport()

    setElementClientHeight(viewport, 40)
    setElementClientWidth(viewport, 100)
    grid.scrollToColumn(10, 'center')

    expect(viewport.scrollLeft).toBe(1_000)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 240)
    grid.refreshViewport()

    setElementClientHeight(viewport, 40)
    setElementClientWidth(viewport, 100)
    grid.scrollToColumn(10, 'end')

    expect(viewport.scrollLeft).toBe(1_000)
  })

  it('recomputes a zero-size fallback after rows and row height change', async () => {
    const grid = await mountDataGrid({
      rows: createRows(1),
      columns: createColumns(),
      virtual: true,
      rowHeight: 40,
      overscan: 0,
      overscanColumns: 0,
    })

    expect(grid.getRange().end).toBe(0)

    grid.rows = createRows(100)
    await nextFrame()

    expect(grid.getRange().end).toBe(9)

    grid.rowHeight = 20
    await nextFrame()

    expect(grid.getRange().end).toBe(9)
  })

  it('reuses snapshots when a viewport refresh keeps the same cache key', async () => {
    const grid = await mountVirtualDataGrid()
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 240)
    grid.refreshViewport()
    await nextFrame()
    resetSnapshotDiagnostics()

    grid.refreshViewport()
    await nextFrame()

    expect(snapshotDiagnostics.rowSnapshotCalls).toBe(0)
    expect(snapshotDiagnostics.columnSnapshotCalls).toBe(0)
  })

  it('invalidates only the row snapshot after row measurements change', async () => {
    const grid = await mountVirtualDataGrid()
    const viewport = getViewport(grid)

    setElementClientHeight(viewport, 120)
    setElementClientWidth(viewport, 240)
    grid.refreshViewport()
    await nextFrame()
    resetSnapshotDiagnostics()

    grid.measure(0, 80)

    expect(snapshotDiagnostics.rowSnapshotCalls).toBe(1)
    expect(snapshotDiagnostics.columnSnapshotCalls).toBe(0)
    expect(grid.getTotalSize()).toBe(4_040)

    resetSnapshotDiagnostics()
    grid.resetMeasurements()

    expect(snapshotDiagnostics.rowSnapshotCalls).toBe(1)
    expect(snapshotDiagnostics.columnSnapshotCalls).toBe(0)
    expect(grid.getTotalSize()).toBe(4_000)
  })

  it('preserves measured rows and both virtualizers when selection changes', async () => {
    const grid = await mountVirtualDataGrid()

    grid.measure(0, 80)
    expect(grid.getTotalSize()).toBe(4_040)
    resetSnapshotDiagnostics()

    grid.toggleRowSelection('row-0')
    await nextFrame()

    expect(grid.getSelection().keys).toEqual(['row-0'])
    expect(grid.getTotalSize()).toBe(4_040)
    expect(snapshotDiagnostics.rowVirtualizerBuilds).toBe(0)
    expect(snapshotDiagnostics.columnVirtualizerBuilds).toBe(0)
    expect(snapshotDiagnostics.rowSnapshotCalls).toBe(0)
    expect(snapshotDiagnostics.columnSnapshotCalls).toBe(0)
  })

  it('preserves measured rows when controlled selection is replaced', async () => {
    const grid = await mountVirtualDataGrid()

    grid.measure(0, 80)
    expect(grid.getTotalSize()).toBe(4_040)
    resetSnapshotDiagnostics()

    grid.selectedKeys = ['row-1']
    await nextFrame()

    expect(grid.getSelection().keys).toEqual(['row-1'])
    expect(grid.getTotalSize()).toBe(4_040)
    expect(snapshotDiagnostics.rowVirtualizerBuilds).toBe(0)
    expect(snapshotDiagnostics.columnVirtualizerBuilds).toBe(0)
    expect(snapshotDiagnostics.rowSnapshotCalls).toBe(0)
    expect(snapshotDiagnostics.columnSnapshotCalls).toBe(0)
  })

  it('rebuilds only the column virtualizer when a column is resized', async () => {
    const grid = await mountVirtualDataGrid()

    grid.measure(0, 80)
    expect(grid.getTotalSize()).toBe(4_040)
    resetSnapshotDiagnostics()

    grid.resizeColumn('column-0', 160)
    await nextFrame()

    expect(grid.getColumnWidths()['column-0']).toBe(160)
    expect(grid.getTotalSize()).toBe(4_040)
    expect(snapshotDiagnostics.rowVirtualizerBuilds).toBe(0)
    expect(snapshotDiagnostics.columnVirtualizerBuilds).toBe(1)
  })

  it('builds one row virtualizer for each sort change', async () => {
    const grid = await mountVirtualDataGrid()

    resetSnapshotDiagnostics()

    grid.setSort('column-0', 'asc')
    await nextFrame()

    expect(grid.getSort()).toEqual({
      columnId: 'column-0',
      direction: 'asc',
    })
    expect(snapshotDiagnostics.rowVirtualizerBuilds).toBe(1)
    expect(snapshotDiagnostics.columnVirtualizerBuilds).toBe(0)
  })
})
