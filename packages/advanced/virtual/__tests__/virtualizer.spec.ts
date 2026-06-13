import { describe, expect, it } from 'vitest'

import {
  createEmptyVirtualRange,
  createVirtualizer,
  isEmptyVirtualRange,
} from '../src/core'

describe('createVirtualizer', () => {
  it('returns an empty range for empty lists', () => {
    const virtualizer = createVirtualizer({
      count: 0,
      estimateSize: 20,
    })

    const range = virtualizer.getRange(0, 100)

    expect(range).toEqual(createEmptyVirtualRange())
    expect(isEmptyVirtualRange(range)).toBe(true)
    expect(virtualizer.getItems(range)).toEqual([])
  })

  it('calculates visible range with overscan', () => {
    const virtualizer = createVirtualizer({
      count: 100,
      estimateSize: 10,
      overscan: 2,
    })

    expect(virtualizer.getRange(0, 30)).toEqual({
      start: 0,
      end: 2,
      overscanStart: 0,
      overscanEnd: 4,
    })

    expect(virtualizer.getRange(50, 30)).toEqual({
      start: 5,
      end: 7,
      overscanStart: 3,
      overscanEnd: 9,
    })
  })

  it('clamps range near the end', () => {
    const virtualizer = createVirtualizer({
      count: 10,
      estimateSize: 10,
      overscan: 3,
    })

    expect(virtualizer.getRange(90, 30)).toEqual({
      start: 7,
      end: 9,
      overscanStart: 4,
      overscanEnd: 9,
    })
  })

  it('returns virtual items for the overscanned range', () => {
    const virtualizer = createVirtualizer({
      count: 100,
      estimateSize: 10,
      overscan: 1,
      getItemKey: index => `row:${index}`,
    })

    const range = virtualizer.getRange(20, 20)
    const items = virtualizer.getItems(range)

    expect(items).toEqual([
      {
        index: 1,
        key: 'row:1',
        start: 10,
        size: 10,
        end: 20,
      },
      {
        index: 2,
        key: 'row:2',
        start: 20,
        size: 10,
        end: 30,
      },
      {
        index: 3,
        key: 'row:3',
        start: 30,
        size: 10,
        end: 40,
      },
      {
        index: 4,
        key: 'row:4',
        start: 40,
        size: 10,
        end: 50,
      },
    ])
  })

  it('calculates total size', () => {
    const virtualizer = createVirtualizer({
      count: 4,
      estimateSize: 25,
    })

    expect(virtualizer.getTotalSize()).toBe(100)
  })

  it('calculates scroll offsets for alignments', () => {
    const virtualizer = createVirtualizer({
      count: 100,
      estimateSize: 10,
    })

    expect(
      virtualizer.getOffsetForIndex(10, {
        align: 'start',
        viewportSize: 50,
      }),
    ).toBe(100)

    expect(
      virtualizer.getOffsetForIndex(10, {
        align: 'center',
        viewportSize: 50,
      }),
    ).toBe(80)

    expect(
      virtualizer.getOffsetForIndex(10, {
        align: 'end',
        viewportSize: 50,
      }),
    ).toBe(60)
  })

  it('clamps scroll offsets for alignments', () => {
    const virtualizer = createVirtualizer({
      count: 10,
      estimateSize: 10,
    })

    expect(
      virtualizer.getOffsetForIndex(0, {
        align: 'center',
        viewportSize: 50,
      }),
    ).toBe(0)

    expect(
      virtualizer.getOffsetForIndex(99, {
        align: 'start',
        viewportSize: 50,
      }),
    ).toBe(50)
  })

  it('supports measured item sizes', () => {
    const virtualizer = createVirtualizer({
      count: 4,
      estimateSize: 10,
      overscan: 0,
    })

    virtualizer.measure(1, 30)

    expect(virtualizer.getTotalSize()).toBe(60)
    expect(virtualizer.getRange(10, 10)).toEqual({
      start: 1,
      end: 1,
      overscanStart: 1,
      overscanEnd: 1,
    })
  })

  it('resets measured item sizes', () => {
    const virtualizer = createVirtualizer({
      count: 4,
      estimateSize: 10,
    })

    virtualizer.measure(1, 30)
    expect(virtualizer.getTotalSize()).toBe(60)

    virtualizer.resetMeasurements()
    expect(virtualizer.getTotalSize()).toBe(40)
  })
})
