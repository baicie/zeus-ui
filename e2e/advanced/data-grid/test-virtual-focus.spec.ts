import { afterEach, describe, expect, it } from 'vitest'
import {
  cleanupDataGridFixtures,
  getViewport,
  mountDataGrid,
  nextFrame,
  runtimeColumns,
  setElementClientHeight,
} from './data-grid-runtime-harness'

describe('debug', () => {
  afterEach(() => cleanupDataGridFixtures())

  // Only getRange + getActiveCell, no getItems
  it('test with getActiveCell only', async () => {
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

    expect(grid.getActiveCell()).toMatchObject({
      rowKey: 'r20',
      columnId: 'age',
    })

    expect(grid.getRange()).toMatchObject({
      start: 15,
      end: 25,
    })
  })
})
