import { describe, expect, it } from 'vitest'

import {
  areDataGridVirtualItemsEqual,
  createDataGridRowModel,
  createDataGridRowVirtualizer,
  shouldUpdateDataGridVirtualSnapshot,
} from '../src/core'

describe('data grid row virtualizer', () => {
  it('returns empty snapshot for empty rows', () => {
    const virtualizer = createDataGridRowVirtualizer({
      rows: createDataGridRowModel([]),
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
    const rows = createDataGridRowModel([
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

  it('keeps a fixed viewport row capacity across fractional offsets and clipped edges', () => {
    const rows = createDataGridRowModel(
      Array.from({ length: 1_000 }, (_, index) => ({ id: String(index) })),
    )
    const virtualizer = createDataGridRowVirtualizer({
      rows,
      rowHeight: 40,
      overscan: 1,
      fixed: true,
    })

    for (const offset of [0, 1, 39, 40, 399_880, 399_960]) {
      const snapshot = virtualizer.getSnapshot(offset, 120)

      expect(snapshot.items).toHaveLength(6)
      expect(snapshot.items[0].index).toBe(snapshot.range.overscanStart)
      expect(snapshot.items[snapshot.items.length - 1].index).toBe(
        snapshot.range.overscanEnd,
      )
      expect(snapshot.range.start).toBeLessThanOrEqual(snapshot.range.end)
      expect(snapshot.range.overscanStart).toBeLessThanOrEqual(
        snapshot.range.start,
      )
      expect(snapshot.range.overscanEnd).toBeGreaterThanOrEqual(
        snapshot.range.end,
      )
      expect(snapshot.items.map(item => item.data?.key)).toEqual(
        snapshot.items.map(item => item.index.toString()),
      )
    }

    expect(virtualizer.getRange(0, 0)).toEqual({
      start: 0,
      end: -1,
      overscanStart: 0,
      overscanEnd: -1,
    })
  })

  it('disables fixed capacity for measured rows and restores it on reset', () => {
    const rows = createDataGridRowModel(
      Array.from({ length: 20 }, (_, index) => ({ id: String(index) })),
    )
    const virtualizer = createDataGridRowVirtualizer({
      rows,
      rowHeight: 40,
      overscan: 1,
      fixed: true,
    })

    expect(virtualizer.getSnapshot(0, 120).items).toHaveLength(6)
    virtualizer.measure(0, 80)
    expect(virtualizer.getSnapshot(0, 120).items).toHaveLength(3)
    virtualizer.resetMeasurements()
    expect(virtualizer.getSnapshot(0, 120).items).toHaveLength(6)
  })

  it('reuses wrappers for rows shared by adjacent virtual ranges', () => {
    const rows = createDataGridRowModel([
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

    const first = virtualizer.getSnapshot(0, 80)
    const second = virtualizer.getSnapshot(40, 80)

    expect(second.items[0].data).toBe(first.items[1].data)
    expect(rows.wrapperCount).toBe(3)
  })

  it('calculates offset for row index', () => {
    const rows = createDataGridRowModel(
      Array.from({ length: 10 }, (_, index) => ({ id: String(index) })),
    )
    const virtualizer = createDataGridRowVirtualizer({
      rows,
      rowHeight: 40,
    })

    expect(virtualizer.getOffsetForIndex(5, 'start', 120)).toBe(200)
    expect(virtualizer.getOffsetForIndex(9, 'start', 120)).toBe(280)
  })

  it('reuses row wrappers when scrolling away and back to a recent range', () => {
    const rows = createDataGridRowModel(
      Array.from({ length: 10_000 }, (_, index) => ({ id: `row-${index}` })),
    )
    const virtualizer = createDataGridRowVirtualizer({
      rows,
      rowHeight: 40,
      overscan: 0,
    })
    const first = virtualizer.getSnapshot(0, 800)
    let revisited = first

    for (let index = 0; index < 100; index += 1) {
      virtualizer.getSnapshot(800, 800)
      revisited = virtualizer.getSnapshot(0, 800)
    }

    expect(rows.wrapperCount).toBe(40)
    expect(revisited.items[0].data).toBe(first.items[0].data)
  })

  it('preserves snapshot rows when distant ranges collide in the wrapper cache', () => {
    const rows = createDataGridRowModel(
      Array.from({ length: 10_000 }, (_, index) => ({ id: `row-${index}` })),
    )
    const virtualizer = createDataGridRowVirtualizer({
      rows,
      rowHeight: 40,
      overscan: 0,
    })
    const first = virtualizer.getSnapshot(0, 800)
    const distant = virtualizer.getSnapshot(128 * 40, 800)
    const revisited = virtualizer.getSnapshot(0, 800)

    expect(first.items.map(item => item.data && item.data.key)).toEqual(
      Array.from({ length: 20 }, (_, index) => `row-${index}`),
    )
    expect(distant.items.map(item => item.data && item.data.key)).toEqual(
      Array.from({ length: 20 }, (_, index) => `row-${128 + index}`),
    )
    expect(revisited.items.map(item => item.data && item.data.key)).toEqual(
      first.items.map(item => item.data && item.data.key),
    )
    expect(revisited.items[0].data).not.toBe(first.items[0].data)
    expect(rows.wrapperCount).toBe(60)
  })

  it('updates item shape after measurement', () => {
    const rows = createDataGridRowModel([
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
