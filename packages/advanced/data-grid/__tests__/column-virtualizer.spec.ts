import { describe, expect, it } from 'vitest'

import {
  createDataGridColumnVirtualizer,
  shouldUpdateDataGridColumnVirtualSnapshot,
} from '../src/core'

const columns = [
  { id: 'a', field: 'a', header: 'A', width: 100 },
  { id: 'b', field: 'b', header: 'B', width: 120 },
  { id: 'c', field: 'c', header: 'C', width: 140 },
  { id: 'd', field: 'd', header: 'D', width: 160 },
].map(column => ({
  ...column,
  minWidth: column.width,
  maxWidth: column.width,
  align: 'start' as const,
  sortable: false,
  hidden: false,
  resizable: true,
}))

describe('data grid column virtualizer', () => {
  it('renders a horizontally virtualized range with overscan', () => {
    const virtualizer = createDataGridColumnVirtualizer({
      columns,
      overscan: 1,
    })

    const snapshot = virtualizer.getSnapshot(120, 180)

    expect(snapshot.range).toEqual({
      start: 1,
      end: 2,
      overscanStart: 0,
      overscanEnd: 3,
    })
    expect(snapshot.items.map(item => item.data?.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
    expect(snapshot.totalSize).toBe(520)
  })

  it('keeps the visible window bounded at the horizontal end', () => {
    const virtualizer = createDataGridColumnVirtualizer({
      columns,
      overscan: 1,
    })

    expect(virtualizer.getSnapshot(999, 180).range).toEqual({
      start: 2,
      end: 3,
      overscanStart: 1,
      overscanEnd: 3,
    })
  })

  it('calculates horizontal offsets for programmatic scrolling', () => {
    const virtualizer = createDataGridColumnVirtualizer({ columns })

    expect(virtualizer.getOffsetForIndex(2, 'start', 200)).toBe(220)
    expect(virtualizer.getOffsetForIndex(2, 'center', 200)).toBe(190)
    expect(virtualizer.getOffsetForIndex(3, 'end', 200)).toBe(320)
  })

  it('detects changes to a column snapshot', () => {
    const virtualizer = createDataGridColumnVirtualizer({ columns })
    const current = virtualizer.getSnapshot(0, 200)

    expect(
      shouldUpdateDataGridColumnVirtualSnapshot(
        current,
        virtualizer.getSnapshot(220, 200),
      ),
    ).toBe(true)
    expect(
      shouldUpdateDataGridColumnVirtualSnapshot(current, {
        ...current,
      }),
    ).toBe(false)
  })
})
