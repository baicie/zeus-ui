import type { EstimateSize } from '../types'

import {
  clamp,
  normalizeNonNegativeInteger,
  normalizePositiveNumber,
} from './range'

export interface SizeCacheOptions {
  count: number
  estimateSize: EstimateSize
}

export class SizeCache {
  private count: number
  private estimateSize: EstimateSize
  private readonly measuredSizes = new Map<number, number>()

  constructor(options: SizeCacheOptions) {
    this.count = normalizeNonNegativeInteger(options.count)
    this.estimateSize = options.estimateSize
  }

  getCount(): number {
    return this.count
  }

  setCount(count: number): void {
    this.count = normalizeNonNegativeInteger(count)

    for (const index of this.measuredSizes.keys()) {
      if (index >= this.count) {
        this.measuredSizes.delete(index)
      }
    }
  }

  setEstimateSize(estimateSize: EstimateSize): void {
    this.estimateSize = estimateSize
  }

  getSize(index: number): number {
    const normalizedIndex = normalizeNonNegativeInteger(index)

    if (this.measuredSizes.has(normalizedIndex)) {
      return this.measuredSizes.get(normalizedIndex)!
    }

    return this.getEstimatedSize(normalizedIndex)
  }

  getOffset(index: number): number {
    const normalizedIndex = clamp(
      normalizeNonNegativeInteger(index),
      0,
      this.count,
    )

    if (
      this.measuredSizes.size === 0 &&
      typeof this.estimateSize === 'number'
    ) {
      return normalizedIndex * this.getEstimatedSize(0)
    }

    let offset = 0

    for (let i = 0; i < normalizedIndex; i += 1) {
      offset += this.getSize(i)
    }

    return offset
  }

  getTotalSize(): number {
    if (this.count === 0) return 0

    if (
      this.measuredSizes.size === 0 &&
      typeof this.estimateSize === 'number'
    ) {
      return this.count * this.getEstimatedSize(0)
    }

    let total = 0

    for (let i = 0; i < this.count; i += 1) {
      total += this.getSize(i)
    }

    return total
  }

  measure(index: number, size: number): void {
    const normalizedIndex = normalizeNonNegativeInteger(index)

    if (normalizedIndex >= this.count) return

    this.measuredSizes.set(
      normalizedIndex,
      normalizePositiveNumber(size, this.getEstimatedSize(normalizedIndex)),
    )
  }

  reset(): void {
    this.measuredSizes.clear()
  }

  findIndexAtOffset(offset: number): number {
    if (this.count === 0) return -1

    const normalizedOffset = Math.max(0, offset)
    const totalSize = this.getTotalSize()

    if (totalSize <= 0) return 0

    if (
      this.measuredSizes.size === 0 &&
      typeof this.estimateSize === 'number'
    ) {
      const size = this.getEstimatedSize(0)
      return clamp(Math.floor(normalizedOffset / size), 0, this.count - 1)
    }

    let low = 0
    let high = this.count - 1
    let match = 0

    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      const start = this.getOffset(middle)
      const end = start + this.getSize(middle)

      if (normalizedOffset < start) {
        high = middle - 1
      } else if (normalizedOffset >= end) {
        low = middle + 1
      } else {
        return middle
      }

      match = middle
    }

    return clamp(match, 0, this.count - 1)
  }

  private getEstimatedSize(index: number): number {
    if (typeof this.estimateSize === 'function') {
      return normalizePositiveNumber(this.estimateSize(index), 1)
    }

    return normalizePositiveNumber(this.estimateSize, 1)
  }
}
