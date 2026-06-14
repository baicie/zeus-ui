import { describe, expect, it } from 'vitest'

import {
  areChatThreadVirtualItemsEqual,
  createChatThreadVirtualizer,
  shouldUpdateChatThreadVirtualSnapshot,
} from '../src/core'

describe('createChatThreadVirtualizer', () => {
  it('returns empty snapshot when count is zero', () => {
    const virtualizer = createChatThreadVirtualizer({
      count: 0,
      estimateSize: 64,
      overscan: 4,
    })

    expect(virtualizer.getTotalSize()).toBe(0)
    expect(virtualizer.getSnapshot(0, 400)).toEqual({
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

  it('calculates range and overscan for chat messages', () => {
    const virtualizer = createChatThreadVirtualizer({
      count: 100,
      estimateSize: 40,
      overscan: 2,
    })

    expect(virtualizer.getSnapshot(0, 120)).toEqual({
      range: {
        start: 0,
        end: 2,
        overscanStart: 0,
        overscanEnd: 4,
      },
      items: [
        { index: 0, key: '0', start: 0, size: 40, end: 40 },
        { index: 1, key: '1', start: 40, size: 40, end: 80 },
        { index: 2, key: '2', start: 80, size: 40, end: 120 },
        { index: 3, key: '3', start: 120, size: 40, end: 160 },
        { index: 4, key: '4', start: 160, size: 40, end: 200 },
      ],
      totalSize: 4000,
    })
  })

  it('calculates middle range with overscan', () => {
    const virtualizer = createChatThreadVirtualizer({
      count: 100,
      estimateSize: 50,
      overscan: 1,
    })

    const snapshot = virtualizer.getSnapshot(250, 150)

    expect(snapshot.range).toEqual({
      start: 5,
      end: 7,
      overscanStart: 4,
      overscanEnd: 8,
    })
    expect(snapshot.items.map(item => item.index)).toEqual([4, 5, 6, 7, 8])
  })

  it('clamps offset for index near the end', () => {
    const virtualizer = createChatThreadVirtualizer({
      count: 10,
      estimateSize: 100,
      overscan: 1,
    })

    expect(virtualizer.getOffsetForIndex(9, 'start', 300)).toBe(700)
    expect(virtualizer.getOffsetForIndex(9, 'end', 300)).toBe(700)
    expect(virtualizer.getOffsetForIndex(9, 'center', 300)).toBe(700)
  })

  it('supports measured message height', () => {
    const virtualizer = createChatThreadVirtualizer({
      count: 3,
      estimateSize: 40,
      overscan: 0,
    })

    expect(virtualizer.getTotalSize()).toBe(120)

    virtualizer.measure(1, 100)

    expect(virtualizer.getTotalSize()).toBe(180)
    expect(virtualizer.getSnapshot(40, 80).range).toEqual({
      start: 1,
      end: 1,
      overscanStart: 1,
      overscanEnd: 1,
    })
  })

  it('updates items when measurement changes but range stays the same', () => {
    const virtualizer = createChatThreadVirtualizer({
      count: 4,
      estimateSize: 40,
      overscan: 0,
    })

    const before = virtualizer.getSnapshot(40, 40)

    virtualizer.measure(1, 80)

    const after = virtualizer.getSnapshot(40, 40)

    expect(before.range).toEqual(after.range)
    expect(before.items).not.toEqual(after.items)
    expect(after.items).toEqual([
      {
        index: 1,
        key: '1',
        start: 40,
        size: 80,
        end: 120,
      },
    ])
  })

  it('resets measurements', () => {
    const virtualizer = createChatThreadVirtualizer({
      count: 3,
      estimateSize: 40,
      overscan: 0,
    })

    virtualizer.measure(1, 100)
    expect(virtualizer.getTotalSize()).toBe(180)

    virtualizer.resetMeasurements()
    expect(virtualizer.getTotalSize()).toBe(120)
  })

  it('normalizes invalid options', () => {
    const virtualizer = createChatThreadVirtualizer({
      count: Number.NaN,
      estimateSize: -1,
      overscan: -1,
    })

    expect(virtualizer.getTotalSize()).toBe(0)
    expect(virtualizer.getSnapshot(0, 100).items).toEqual([])
  })
})

describe('chat thread virtual snapshot comparison', () => {
  const base = {
    range: {
      start: 1,
      end: 1,
      overscanStart: 1,
      overscanEnd: 1,
    },
    items: [
      {
        index: 1,
        key: '1',
        start: 40,
        size: 40,
        end: 80,
      },
    ],
    totalSize: 120,
  }

  it('treats identical items as equal', () => {
    expect(areChatThreadVirtualItemsEqual(base.items, [...base.items])).toBe(
      true,
    )
  })

  it('detects item size changes', () => {
    expect(
      areChatThreadVirtualItemsEqual(base.items, [
        {
          index: 1,
          key: '1',
          start: 40,
          size: 100,
          end: 140,
        },
      ]),
    ).toBe(false)
  })

  it('updates snapshot when total size changes', () => {
    expect(
      shouldUpdateChatThreadVirtualSnapshot(base, {
        ...base,
        totalSize: 180,
      }),
    ).toBe(true)
  })

  it('updates snapshot when item shape changes even if range is stable', () => {
    expect(
      shouldUpdateChatThreadVirtualSnapshot(base, {
        ...base,
        items: [
          {
            index: 1,
            key: '1',
            start: 40,
            size: 100,
            end: 140,
          },
        ],
      }),
    ).toBe(true)
  })

  it('does not update identical snapshots', () => {
    expect(
      shouldUpdateChatThreadVirtualSnapshot(base, {
        range: { ...base.range },
        items: [...base.items],
        totalSize: base.totalSize,
      }),
    ).toBe(false)
  })
})
