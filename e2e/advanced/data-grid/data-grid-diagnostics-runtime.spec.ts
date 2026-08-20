import type {
  DataGridCommitTiming,
  DataGridModelBuildTiming,
} from '../../../packages/advanced/data-grid/src'
import { batch } from '@zeus-js/zeus'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  cleanupDataGridFixtures,
  defineDataGridElement,
  getViewport,
  mountDataGrid,
  nextFrame,
  setElementClientHeight,
  setElementClientWidth,
} from './data-grid-runtime-harness'

describe('zw-data-grid diagnostics', () => {
  afterEach(() => {
    cleanupDataGridFixtures()
  })

  it('reports one initial model build and ordered commit timings', async () => {
    const modelBuilds: Readonly<DataGridModelBuildTiming>[] = []
    const commits: Readonly<DataGridCommitTiming>[] = []
    const grid = await mountDataGrid({
      rows: Array.from({ length: 10_000 }, (_, index) => ({
        id: `row-${index}`,
      })),
      columns: Array.from({ length: 5 }, (_, index) => ({
        id: `column-${index}`,
        field: `column_${index}`,
        width: 100,
        hidden: index === 4,
      })),
      rowHeight: 20,
      virtual: true,
      diagnostics: {
        onModelBuild(sample) {
          modelBuilds.push(sample)
        },
        onCommit(sample) {
          commits.push(sample)
        },
      },
    })

    expect(modelBuilds).toHaveLength(1)
    expect(modelBuilds[0]).toMatchObject({
      sequence: 1,
      modelVersion: 0,
      rowCount: 10_000,
      columnCount: 5,
      visibleColumnCount: 4,
      sortActive: false,
      rowModelReused: true,
    })
    expect(modelBuilds[0].endTime).toBeGreaterThanOrEqual(
      modelBuilds[0].startTime,
    )

    const mountCommit = commits.find(sample => sample.source === 'mount')
    expect(mountCommit).toBeDefined()
    expectCommitTimingOrder(mountCommit as Readonly<DataGridCommitTiming>)
    expect(mountCommit?.createdNodeCount).toBeGreaterThan(0)
    expect(mountCommit?.removedNodeCount).toBe(0)

    const viewport = getViewport(grid)
    setElementClientHeight(viewport, 60)
    setElementClientWidth(viewport, 300)
    grid.scrollToOffset(400)
    commits.length = 0

    viewport.scrollTop = 4_000
    viewport.dispatchEvent(new Event('scroll'))
    await nextFrame()

    expect(commits).toHaveLength(1)
    expect(commits[0].source).toBe('scroll')
    expect(commits[0].firstRowIndex).toBeGreaterThan(0)
    expect(commits[0].lastRowIndex).toBeGreaterThanOrEqual(
      commits[0].firstRowIndex,
    )
    expect(commits[0].firstColumnIndex).toBe(0)
    expect(commits[0].lastColumnIndex).toBeGreaterThanOrEqual(0)
    expect(commits[0].createdNodeCount).toBe(0)
    expect(commits[0].removedNodeCount).toBe(0)
    expectCommitTimingOrder(commits[0])
  })

  it('builds the initial model once when rows and columns are omitted', async () => {
    defineDataGridElement()
    const modelBuilds: Readonly<DataGridModelBuildTiming>[] = []
    const grid = document.createElement('zw-data-grid') as HTMLElement & {
      diagnostics: {
        onModelBuild: (sample: Readonly<DataGridModelBuildTiming>) => void
      }
    }

    grid.diagnostics = {
      onModelBuild(sample) {
        modelBuilds.push(sample)
      },
    }
    document.body.append(grid)

    await nextFrame()

    expect(modelBuilds).toHaveLength(1)
    expect(modelBuilds[0]).toMatchObject({
      sequence: 1,
      modelVersion: 0,
      rowCount: 0,
      columnCount: 0,
      rowModelReused: true,
    })
  })

  it('does not read the diagnostics clock or observe render churn by default', async () => {
    const requestFrame = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(callback => {
        return setTimeout(callback, 0, 0) as unknown as number
      })
    const cancelFrame = vi
      .spyOn(globalThis, 'cancelAnimationFrame')
      .mockImplementation(handle => {
        clearTimeout(handle)
      })
    const performanceNow = vi.spyOn(globalThis.performance, 'now')
    const observe = vi.spyOn(MutationObserver.prototype, 'observe')

    try {
      await mountDataGrid()

      expect(performanceNow).not.toHaveBeenCalled()
      expect(
        observe.mock.calls.some(([target]) =>
          isDataGridDiagnosticsMutationTarget(target),
        ),
      ).toBe(false)
    } finally {
      performanceNow.mockRestore()
      observe.mockRestore()
      requestFrame.mockRestore()
      cancelFrame.mockRestore()
    }
  })

  it('reports active sort without claiming row model reuse', async () => {
    const modelBuilds: Readonly<DataGridModelBuildTiming>[] = []

    await mountDataGrid({
      rows: [
        { id: 'row-1', score: 2 },
        { id: 'row-2', score: 1 },
      ],
      columns: [
        {
          id: 'score',
          field: 'score',
          sortable: true,
        },
      ],
      sortColumn: 'score',
      sortDirection: 'asc',
      diagnostics: {
        onModelBuild(sample) {
          modelBuilds.push(sample)
        },
      },
    })

    expect(modelBuilds).toHaveLength(1)
    expect(modelBuilds[0]).toMatchObject({
      sortActive: true,
      rowModelReused: false,
    })
  })

  it('reports DOM churn after setRows flushes its outer batch', async () => {
    const commits: Readonly<DataGridCommitTiming>[] = []
    const grid = await mountDataGrid({
      rows: [
        { id: 'initial-a', value: 'Initial A' },
        { id: 'initial-b', value: 'Initial B' },
      ],
      columns: [{ id: 'value', field: 'value' }],
      diagnostics: {
        onCommit(sample) {
          commits.push(sample)
        },
      },
    })

    commits.length = 0
    grid.setRows([
      { id: 'next-a', value: 'Next A' },
      { id: 'next-b', value: 'Next B' },
    ])
    await Promise.resolve()

    expect(commits.filter(sample => sample.source === 'data')).toHaveLength(1)
    const dataCommit = commits.find(sample => sample.source === 'data')
    expect(dataCommit).toBeDefined()
    expect(dataCommit?.createdNodeCount).toBeGreaterThan(0)
    expect(dataCommit?.removedNodeCount).toBeGreaterThan(0)
    expect(grid.textContent).toContain('Next A')
    expect(grid.textContent).not.toContain('Initial A')
  })

  it('finalizes setRows diagnostics after a caller-owned batch flushes', async () => {
    const commits: Readonly<DataGridCommitTiming>[] = []
    const grid = await mountDataGrid({
      rows: [{ id: 'initial-row', value: 'Initial' }],
      columns: [{ id: 'value', field: 'value' }],
      diagnostics: {
        onCommit(sample) {
          commits.push(sample)
        },
      },
    })

    commits.length = 0
    batch(() => {
      grid.setRows([{ id: 'next-row', value: 'Next' }])
      expect(commits).toHaveLength(0)
    })
    await Promise.resolve()

    expect(commits).toHaveLength(1)
    expect(commits[0].source).toBe('data')
    expect(commits[0].createdNodeCount).toBeGreaterThan(0)
    expect(commits[0].removedNodeCount).toBeGreaterThan(0)
    expect(grid.textContent).toContain('Next')
  })

  it('finalizes setRows before an API commit after the caller batch closes', async () => {
    const commits: Readonly<DataGridCommitTiming>[] = []
    const grid = await mountDataGrid({
      rows: [{ id: 'initial-row', value: 'Initial' }],
      columns: [{ id: 'value', field: 'value' }],
      diagnostics: {
        onCommit(sample) {
          commits.push(sample)
        },
      },
    })

    commits.length = 0
    batch(() => {
      grid.setRows([{ id: 'next-row', value: 'Next' }])
    })
    grid.scrollToOffset(0)
    await Promise.resolve()

    expect(commits.map(sample => sample.source)).toEqual(['data', 'api'])
    expectCommitTimingOrder(commits[0])
    expectCommitTimingOrder(commits[1])
    expect(commits[0].commitEndTime).toBeLessThanOrEqual(
      commits[1].commitStartTime,
    )
    expect(commits[0].createdNodeCount).toBeGreaterThan(0)
    expect(commits[0].removedNodeCount).toBeGreaterThan(0)
    expect(commits[1].createdNodeCount).toBe(0)
    expect(commits[1].removedNodeCount).toBe(0)
    expect(grid.textContent).toContain('Next')
    expect(grid.textContent).not.toContain('Initial')
  })

  it('attributes synchronous data and API churn to separate timing windows', async () => {
    const commits: Readonly<DataGridCommitTiming>[] = []
    const grid = await mountDataGrid({
      rows: [{ id: 'initial-row', value: 'Initial' }],
      columns: [{ id: 'value', field: 'value' }],
      diagnostics: {
        onCommit(sample) {
          commits.push(sample)
        },
      },
    })

    commits.length = 0
    grid.setRows([{ id: 'next-row', value: 'Next' }])
    grid.scrollToOffset(0)
    await Promise.resolve()

    expect(commits.map(sample => sample.source)).toEqual(['data', 'api'])
    const [dataCommit, apiCommit] = commits
    expectCommitTimingOrder(dataCommit)
    expectCommitTimingOrder(apiCommit)
    expect(dataCommit.commitEndTime).toBeLessThanOrEqual(
      apiCommit.commitStartTime,
    )
    expect(dataCommit.createdNodeCount).toBeGreaterThan(0)
    expect(dataCommit.removedNodeCount).toBeGreaterThan(0)
    expect(apiCommit.createdNodeCount).toBe(0)
    expect(apiCommit.removedNodeCount).toBe(0)
  })

  it('preserves setRows DOM churn when an API commit shares the caller batch', async () => {
    const commits: Readonly<DataGridCommitTiming>[] = []
    const grid = await mountDataGrid({
      rows: [{ id: 'initial-row', value: 'Initial' }],
      columns: [{ id: 'value', field: 'value' }],
      diagnostics: {
        onCommit(sample) {
          commits.push(sample)
        },
      },
    })

    commits.length = 0
    batch(() => {
      grid.setRows([{ id: 'next-row', value: 'Next' }])
      grid.scrollToOffset(0)
    })
    await Promise.resolve()

    expect(commits).toHaveLength(1)
    expect(commits[0].source).toBe('data')
    expectCommitTimingOrder(commits[0], 2)
    expect(commits[0].createdNodeCount).toBeGreaterThan(0)
    expect(commits[0].removedNodeCount).toBeGreaterThan(0)
    expect(grid.textContent).toContain('Next')
    expect(grid.textContent).not.toContain('Initial')
  })

  it('finalizes consecutive deferred data commits without losing churn', async () => {
    const commits: Readonly<DataGridCommitTiming>[] = []
    const grid = await mountDataGrid({
      rows: [{ id: 'initial-row', value: 'Initial' }],
      columns: [{ id: 'value', field: 'value' }],
      diagnostics: {
        onCommit(sample) {
          commits.push(sample)
        },
      },
    })

    commits.length = 0
    grid.setRows([{ id: 'intermediate-row', value: 'Intermediate' }])
    grid.setRows([{ id: 'final-row', value: 'Final' }])
    await Promise.resolve()

    expect(commits.map(sample => sample.source)).toEqual(['data', 'data'])
    expectCommitTimingOrder(commits[0])
    expectCommitTimingOrder(commits[1])
    expect(commits[0].commitEndTime).toBeLessThanOrEqual(
      commits[1].commitStartTime,
    )
    for (const commit of commits) {
      expect(commit.createdNodeCount).toBeGreaterThan(0)
      expect(commit.removedNodeCount).toBeGreaterThan(0)
    }
    expect(grid.textContent).toContain('Final')
    expect(grid.textContent).not.toContain('Intermediate')
  })

  it('reports DOM churn after setColumns flushes its outer batch', async () => {
    const commits: Readonly<DataGridCommitTiming>[] = []
    const grid = await mountDataGrid({
      rows: [{ id: 'row-1', first: 'First', second: 'Second' }],
      columns: [{ id: 'first', field: 'first' }],
      diagnostics: {
        onCommit(sample) {
          commits.push(sample)
        },
      },
    })

    commits.length = 0
    grid.setColumns([{ id: 'second', field: 'second' }])
    await Promise.resolve()

    expect(commits.filter(sample => sample.source === 'data')).toHaveLength(1)
    const dataCommit = commits.find(sample => sample.source === 'data')
    expect(dataCommit).toBeDefined()
    expect(dataCommit?.createdNodeCount).toBeGreaterThan(0)
    expect(dataCommit?.removedNodeCount).toBeGreaterThan(0)
    expect(grid.textContent).toContain('Second')
    expect(grid.textContent).not.toContain('First')
  })

  it('finalizes setColumns diagnostics after a caller-owned batch flushes', async () => {
    const commits: Readonly<DataGridCommitTiming>[] = []
    const grid = await mountDataGrid({
      rows: [{ id: 'row-1', first: 'First', second: 'Second' }],
      columns: [{ id: 'first', field: 'first' }],
      diagnostics: {
        onCommit(sample) {
          commits.push(sample)
        },
      },
    })

    commits.length = 0
    batch(() => {
      grid.setColumns([{ id: 'second', field: 'second' }])
      expect(commits).toHaveLength(0)
    })
    await Promise.resolve()

    expect(commits).toHaveLength(1)
    expect(commits[0].source).toBe('data')
    expect(commits[0].createdNodeCount).toBeGreaterThan(0)
    expect(commits[0].removedNodeCount).toBeGreaterThan(0)
    expect(grid.textContent).toContain('Second')
  })

  it('finalizes setColumns before an API commit in the same task', async () => {
    const commits: Readonly<DataGridCommitTiming>[] = []
    const grid = await mountDataGrid({
      rows: [{ id: 'row-1', first: 'First', second: 'Second' }],
      columns: [{ id: 'first', field: 'first' }],
      diagnostics: {
        onCommit(sample) {
          commits.push(sample)
        },
      },
    })

    commits.length = 0
    grid.setColumns([{ id: 'second', field: 'second' }])
    grid.scrollToOffset(0)
    await Promise.resolve()

    expect(commits.map(sample => sample.source)).toEqual(['data', 'api'])
    expectCommitTimingOrder(commits[0])
    expectCommitTimingOrder(commits[1])
    expect(commits[0].commitEndTime).toBeLessThanOrEqual(
      commits[1].commitStartTime,
    )
    expect(commits[0].createdNodeCount).toBeGreaterThan(0)
    expect(commits[0].removedNodeCount).toBeGreaterThan(0)
    expect(commits[1].createdNodeCount).toBe(0)
    expect(commits[1].removedNodeCount).toBe(0)
    expect(grid.textContent).toContain('Second')
    expect(grid.textContent).not.toContain('First')
  })

  it('reports DOM churn after controlled rows property assignment', async () => {
    const commits: Readonly<DataGridCommitTiming>[] = []
    const grid = await mountDataGrid({
      rows: [{ id: 'initial-row', value: 'Initial' }],
      columns: [{ id: 'value', field: 'value' }],
      diagnostics: {
        onCommit(sample) {
          commits.push(sample)
        },
      },
    })

    commits.length = 0
    grid.rows = [{ id: 'assigned-row', value: 'Assigned' }]
    await nextFrame()

    expect(commits.filter(sample => sample.source === 'data')).toHaveLength(1)
    const dataCommit = commits.find(sample => sample.source === 'data')
    expect(dataCommit).toBeDefined()
    expect(dataCommit?.createdNodeCount).toBeGreaterThan(0)
    expect(dataCommit?.removedNodeCount).toBeGreaterThan(0)
    expect(grid.textContent).toContain('Assigned')
    expect(grid.textContent).not.toContain('Initial')
  })

  it('reports DOM churn after controlled columns property assignment', async () => {
    const commits: Readonly<DataGridCommitTiming>[] = []
    const grid = await mountDataGrid({
      rows: [{ id: 'row-1', first: 'First', second: 'Second' }],
      columns: [{ id: 'first', field: 'first' }],
      diagnostics: {
        onCommit(sample) {
          commits.push(sample)
        },
      },
    })

    commits.length = 0
    grid.columns = [{ id: 'second', field: 'second' }]
    await nextFrame()

    expect(commits.filter(sample => sample.source === 'data')).toHaveLength(1)
    const dataCommit = commits.find(sample => sample.source === 'data')
    expect(dataCommit).toBeDefined()
    expect(dataCommit?.createdNodeCount).toBeGreaterThan(0)
    expect(dataCommit?.removedNodeCount).toBeGreaterThan(0)
    expect(grid.textContent).toContain('Second')
    expect(grid.textContent).not.toContain('First')
  })

  it('measures viewport height once for each resize commit', async () => {
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
      const commits: Readonly<DataGridCommitTiming>[] = []
      const grid = await mountDataGrid({
        diagnostics: {
          onCommit(sample) {
            commits.push(sample)
          },
        },
      })
      const viewport = getViewport(grid)
      let clientHeightReads = 0

      Object.defineProperty(viewport, 'clientHeight', {
        configurable: true,
        get() {
          clientHeightReads += 1
          return 80
        },
      })
      commits.length = 0

      if (!resizeCallback) throw new Error('ResizeObserver was not connected')
      resizeCallback([], {} as ResizeObserver)
      await nextFrame()

      expect(clientHeightReads).toBe(1)
      expect(commits).toHaveLength(1)
      expect(commits[0].source).toBe('resize')
      expectCommitTimingOrder(commits[0])
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

  it('excludes external slot projection from component node churn', async () => {
    const commits: Readonly<DataGridCommitTiming>[] = []
    const grid = await mountDataGrid({
      diagnostics: {
        onCommit(sample) {
          commits.push(sample)
        },
      },
    })
    const external = document.createElement('span')
    external.slot = 'empty'
    external.textContent = 'External empty state'

    grid.append(external)
    await nextFrame()
    commits.length = 0

    grid.scrollToOffset(0)

    expect(commits).toHaveLength(1)
    expect(commits[0]).toMatchObject({
      source: 'api',
      createdNodeCount: 0,
      removedNodeCount: 0,
    })
  })

  it('resets component node churn at the start of each commit', async () => {
    const commits: Readonly<DataGridCommitTiming>[] = []
    const grid = await mountDataGrid({
      diagnostics: {
        onCommit(sample) {
          commits.push(sample)
        },
      },
    })
    const body = grid.querySelector<HTMLElement>('[data-slot="data-grid-body"]')

    if (!body) throw new Error('Data Grid body was not mounted')
    body.append(document.createElement('span'))
    commits.length = 0

    grid.scrollToOffset(0)

    expect(commits).toHaveLength(1)
    expect(commits[0]).toMatchObject({
      source: 'api',
      createdNodeCount: 0,
      removedNodeCount: 0,
    })
  })

  it('applies controlled props changed after connect before the first frame', async () => {
    defineDataGridElement()
    const modelBuilds: Readonly<DataGridModelBuildTiming>[] = []
    const grid = document.createElement('zw-data-grid') as HTMLElement & {
      rows: Array<Record<string, unknown>>
      columns: Array<Record<string, unknown>>
      diagnostics: {
        onModelBuild: (sample: Readonly<DataGridModelBuildTiming>) => void
      }
      getRows: () => Array<{ key: string }>
      getColumns: () => Array<{ id: string }>
    }

    grid.rows = [{ id: 'initial-row', value: 'initial' }]
    grid.columns = [{ id: 'initial-column', field: 'value' }]
    grid.diagnostics = {
      onModelBuild(sample) {
        modelBuilds.push(sample)
      },
    }
    document.body.append(grid)

    grid.rows = [{ id: 'latest-row', value: 'latest' }]
    grid.columns = [{ id: 'latest-column', field: 'value' }]

    await nextFrame()

    expect(modelBuilds[0].modelVersion).toBe(0)
    expect(modelBuilds[modelBuilds.length - 1]).toMatchObject({
      modelVersion: 2,
      rowCount: 1,
      columnCount: 1,
      rowModelReused: true,
    })
    expect(grid.getRows().map(row => row.key)).toEqual(['latest-row'])
    expect(grid.getColumns().map(column => column.id)).toEqual([
      'latest-column',
    ])
    expect(grid.textContent).toContain('latest')
    expect(grid.textContent).not.toContain('initial')
  })
})

function expectCommitTimingOrder(
  sample: Readonly<DataGridCommitTiming>,
  layoutReadCount = 1,
): void {
  expect(sample.transactionId).toBeGreaterThan(0)
  expect(sample.handlerStartTime).toBeGreaterThanOrEqual(sample.inputTime)
  expect(sample.handlerEndTime).toBeGreaterThanOrEqual(sample.handlerStartTime)
  expect(sample.rangeStartTime).toBeGreaterThanOrEqual(sample.handlerEndTime)
  expect(sample.rangeCalculatedTime).toBeGreaterThanOrEqual(
    sample.rangeStartTime,
  )
  expect(sample.commitStartTime).toBeGreaterThanOrEqual(
    sample.rangeCalculatedTime,
  )
  expect(sample.commitEndTime).toBeGreaterThanOrEqual(sample.commitStartTime)
  expect(sample.layoutReadIntervals).toHaveLength(layoutReadCount)

  for (const interval of sample.layoutReadIntervals) {
    expect(interval[0]).toBeGreaterThanOrEqual(sample.rangeStartTime)
    expect(interval[1]).toBeGreaterThanOrEqual(interval[0])
    expect(sample.rangeCalculatedTime).toBeGreaterThanOrEqual(interval[1])
  }
}

function isDataGridDiagnosticsMutationTarget(target: Node): boolean {
  if (!(target instanceof HTMLElement)) return false

  const slot = target.getAttribute('data-slot')
  return slot === 'data-grid-header' || slot === 'data-grid-body'
}
