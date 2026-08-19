import type {
  DataGridCommitTiming,
  DataGridModelBuildTiming,
} from '../../../packages/advanced/data-grid/src'
import { afterEach, describe, expect, it } from 'vitest'

import {
  cleanupDataGridFixtures,
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
      rows: Array.from({ length: 100 }, (_, index) => ({
        id: `row-${index}`,
      })),
      columns: Array.from({ length: 5 }, (_, index) => ({
        id: `column-${index}`,
        field: `column_${index}`,
        width: 100,
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
      rowCount: 100,
      columnCount: 5,
      sorted: false,
    })
    expect(modelBuilds[0].endTime).toBeGreaterThanOrEqual(
      modelBuilds[0].startTime,
    )

    const mountCommit = commits.find(sample => sample.source === 'mount')
    expect(mountCommit).toBeDefined()
    expectCommitTimingOrder(mountCommit as Readonly<DataGridCommitTiming>)

    const viewport = getViewport(grid)
    setElementClientHeight(viewport, 60)
    setElementClientWidth(viewport, 300)
    grid.refreshViewport()
    commits.length = 0

    viewport.scrollTop = 400
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
    expectCommitTimingOrder(commits[0])
  })
})

function expectCommitTimingOrder(sample: Readonly<DataGridCommitTiming>): void {
  expect(sample.transactionId).toBeGreaterThan(0)
  expect(sample.handlerStartTime).toBeGreaterThanOrEqual(sample.inputTime)
  expect(sample.rangeStartTime).toBeGreaterThanOrEqual(sample.handlerStartTime)
  expect(sample.rangeCalculatedTime).toBeGreaterThanOrEqual(
    sample.rangeStartTime,
  )
  expect(sample.commitStartTime).toBeGreaterThanOrEqual(
    sample.rangeCalculatedTime,
  )
  expect(sample.commitEndTime).toBeGreaterThanOrEqual(sample.commitStartTime)
  expect(sample.handlerEndTime).toBeGreaterThanOrEqual(sample.commitEndTime)
}
