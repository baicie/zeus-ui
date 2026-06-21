import { describe, expect, it } from 'vitest'

import {
  areDataGridVirtualItemsEqual,
  createDataGridRows,
  createDataGridRowVirtualizer,
  shouldUpdateDataGridVirtualSnapshot,
} from '../src/core'

describe('data grid row virtualizer', () => {
  it('returns empty snapshot for empty rows', () => {
    const virtualizer = createDataGridRowVirtualizer({
      rows: [],
      rowHeight: 40,
      overscan: 2,
    })

    expect(virtualizer.getSnapshot(0, 100)).toEqual({
      range: {
        start: 0,
        end: -1,
        overscanStart: 0,
        overscanEnd: -1,
      },
      items: [],
      totalSize: 0,
    })
  })

  it('calculates row range and includes row data', () => {
    const rows = createDataGridRows([
      {
        id: 'a',
      },
      {
        id: 'b',
      },
      {
        id: 'c',
      },
      {
        id: 'd',
      },
    ])

    const virtualizer = createDataGridRowVirtualizer({
      rows,
      rowHeight: 40,
      overscan: 1,
    })

    const snapshot = virtualizer.getSnapshot(40, 80)

    expect(snapshot.range).toEqual({
      start: 1,
      end: 2,
      overscanStart: 0,
      overscanEnd: 3,
    })

    expect(snapshot.items.map(item => item.data?.key)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])

    expect(snapshot.totalSize).toBe(160)
  })

  it('calculates offset for row index', () => {
    const rows = createDataGridRows(
      Array.from({ length: 10 }, (_, index) => ({ id: String(index) })),
    )
    const virtualizer = createDataGridRowVirtualizer({
      rows,
      rowHeight: 40,
    })

    expect(virtualizer.getOffsetForIndex(5, 'start', 120)).toBe(200)
    expect(virtualizer.getOffsetForIndex(9, 'start', 120)).toBe(280)
  })

  it('updates item shape after measurement', () => {
    const rows = createDataGridRows([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
      { id: 'd' },
    ])
    const virtualizer = createDataGridRowVirtualizer({
      rows,
      rowHeight: 40,
      overscan: 0,
    })

    const before = virtualizer.getSnapshot(40, 40)

    virtualizer.measure(1, 80)

    const after = virtualizer.getSnapshot(40, 40)

    expect(before.range).toEqual(after.range)
    expect(before.items).not.toEqual(after.items)
    expect(after.items[0]).toMatchObject({
      index: 1,
      key: 'b',
      start: 40,
      size: 80,
      end: 120,
      data: {
        key: 'b',
      },
    })
  })

  it('compares virtual items', () => {
    const left = [
      {
        index: 0,
        key: 'a',
        start: 0,
        size: 40,
        end: 40,
        data: {
          key: 'a',
          index: 0,
          data: {
            id: 'a',
          },
        },
      },
    ]

    expect(areDataGridVirtualItemsEqual(left, [...left])).toBe(true)

    expect(
      areDataGridVirtualItemsEqual(left, [
        {
          ...left[0],
          size: 80,
          end: 80,
        },
      ]),
    ).toBe(false)
  })

  it('detects snapshot changes', () => {
    const current = {
      range: {
        start: 0,
        end: 0,
        overscanStart: 0,
        overscanEnd: 0,
      },
      items: [],
      totalSize: 40,
    }

    expect(
      shouldUpdateDataGridVirtualSnapshot(current, {
        ...current,
        totalSize: 80,
      }),
    ).toBe(true)

    expect(
      shouldUpdateDataGridVirtualSnapshot(current, {
        ...current,
        range: {
          start: 1,
          end: 1,
          overscanStart: 1,
          overscanEnd: 1,
        },
      }),
    ).toBe(true)

    expect(
      shouldUpdateDataGridVirtualSnapshot(current, {
        ...current,
      }),
    ).toBe(false)
  })

  it('detects row data reference changes even when row key is stable', () => {
    const leftRow = {
      key: 'a',
      index: 0,
      data: {
        id: 'a',
        name: 'old',
      },
    }

    const rightRow = {
      key: 'a',
      index: 0,
      data: {
        id: 'a',
        name: 'new',
      },
    }

    expect(
      areDataGridVirtualItemsEqual(
        [
          {
            index: 0,
            key: 'a',
            start: 0,
            size: 40,
            end: 40,
            data: leftRow,
          },
        ],
        [
          {
            index: 0,
            key: 'a',
            start: 0,
            size: 40,
            end: 40,
            data: rightRow,
          },
        ],
      ),
    ).toBe(false)
  })

  it('updates snapshot when row data reference changes with stable key', () => {
    const leftRow = {
      key: 'a',
      index: 0,
      data: {
        id: 'a',
        name: 'old',
      },
    }

    const rightRow = {
      key: 'a',
      index: 0,
      data: {
        id: 'a',
        name: 'new',
      },
    }

    expect(
      shouldUpdateDataGridVirtualSnapshot(
        {
          range: {
            start: 0,
            end: 0,
            overscanStart: 0,
            overscanEnd: 0,
          },
          items: [
            {
              index: 0,
              key: 'a',
              start: 0,
              size: 40,
              end: 40,
              data: leftRow,
            },
          ],
          totalSize: 40,
        },
        {
          range: {
            start: 0,
            end: 0,
            overscanStart: 0,
            overscanEnd: 0,
          },
          items: [
            {
              index: 0,
              key: 'a',
              start: 0,
              size: 40,
              end: 40,
              data: rightRow,
            },
          ],
          totalSize: 40,
        },
      ),
    ).toBe(true)
  })
})
