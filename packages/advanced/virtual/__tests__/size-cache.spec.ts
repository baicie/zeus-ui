import { describe, expect, it } from 'vitest'

import { SizeCache } from '../src/core'

describe('sizeCache', () => {
  it('uses fixed estimated size by default', () => {
    const cache = new SizeCache({
      count: 5,
      estimateSize: 20,
    })

    expect(cache.getCount()).toBe(5)
    expect(cache.getSize(0)).toBe(20)
    expect(cache.getOffset(3)).toBe(60)
    expect(cache.getTotalSize()).toBe(100)
  })

  it('supports measured item sizes', () => {
    const cache = new SizeCache({
      count: 5,
      estimateSize: 20,
    })

    cache.measure(1, 50)

    expect(cache.getSize(0)).toBe(20)
    expect(cache.getSize(1)).toBe(50)
    expect(cache.getOffset(2)).toBe(70)
    expect(cache.getTotalSize()).toBe(130)
  })

  it('drops out-of-range measurements when count shrinks', () => {
    const cache = new SizeCache({
      count: 5,
      estimateSize: 10,
    })

    cache.measure(4, 100)
    expect(cache.getTotalSize()).toBe(140)

    cache.setCount(4)
    expect(cache.getTotalSize()).toBe(40)
  })

  it('finds index at offset for fixed-size items', () => {
    const cache = new SizeCache({
      count: 10,
      estimateSize: 10,
    })

    expect(cache.findIndexAtOffset(0)).toBe(0)
    expect(cache.findIndexAtOffset(9)).toBe(0)
    expect(cache.findIndexAtOffset(10)).toBe(1)
    expect(cache.findIndexAtOffset(99)).toBe(9)
    expect(cache.findIndexAtOffset(1000)).toBe(9)
  })

  it('finds index at offset with measured items', () => {
    const cache = new SizeCache({
      count: 4,
      estimateSize: 10,
    })

    cache.measure(1, 30)

    expect(cache.findIndexAtOffset(0)).toBe(0)
    expect(cache.findIndexAtOffset(10)).toBe(1)
    expect(cache.findIndexAtOffset(39)).toBe(1)
    expect(cache.findIndexAtOffset(40)).toBe(2)
  })

  it('normalizes invalid sizes', () => {
    const cache = new SizeCache({
      count: 2,
      estimateSize: 0,
    })

    cache.measure(0, -100)

    expect(cache.getSize(0)).toBe(1)
    expect(cache.getTotalSize()).toBe(2)
  })
})
