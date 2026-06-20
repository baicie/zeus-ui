import { describe, expect, it } from 'vitest'

import {
  getVirtualItemsFromRangeDetail,
  isVirtualItem,
  normalizeVirtualItems,
} from '../utils/virtual-items'

describe('virtual item helpers', () => {
  const item = {
    index: 0,
    key: '0',
    start: 0,
    size: 52,
    end: 52,
  }

  it('recognizes valid virtual items', () => {
    expect(isVirtualItem(item)).toBe(true)
  })

  it('rejects malformed virtual items', () => {
    expect(isVirtualItem(undefined)).toBe(false)
    expect(isVirtualItem(null)).toBe(false)
    expect(isVirtualItem({})).toBe(false)
    expect(isVirtualItem({ index: 0 })).toBe(false)
    expect(isVirtualItem({ ...item, key: 0 })).toBe(false)
    expect(isVirtualItem({ ...item, start: Number.NaN })).toBe(false)
  })

  it('normalizes unknown values to arrays', () => {
    expect(normalizeVirtualItems(undefined)).toEqual([])
    expect(normalizeVirtualItems(null)).toEqual([])
    expect(normalizeVirtualItems({ items: [item] })).toEqual([])
    expect(normalizeVirtualItems([item, { broken: true }])).toEqual([item])
  })

  it('reads items from range-change detail safely', () => {
    expect(getVirtualItemsFromRangeDetail(undefined)).toEqual([])
    expect(getVirtualItemsFromRangeDetail({})).toEqual([])
    expect(getVirtualItemsFromRangeDetail({ items: undefined })).toEqual([])
    expect(getVirtualItemsFromRangeDetail({ items: [item] })).toEqual([item])
  })

  it('also supports direct item arrays for compatibility', () => {
    expect(getVirtualItemsFromRangeDetail([item])).toEqual([item])
  })
})
