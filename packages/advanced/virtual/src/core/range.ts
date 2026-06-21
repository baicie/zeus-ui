import type { VirtualRange } from '../types'

export const emptyVirtualRange: VirtualRange = {
  start: 0,
  end: -1,
  overscanStart: 0,
  overscanEnd: -1,
}

export function createEmptyVirtualRange(): VirtualRange {
  return { ...emptyVirtualRange }
}

export function isEmptyVirtualRange(range: VirtualRange): boolean {
  return range.end < range.start || range.overscanEnd < range.overscanStart
}

export function areVirtualRangesEqual(
  left: VirtualRange,
  right: VirtualRange,
): boolean {
  return (
    left.start === right.start &&
    left.end === right.end &&
    left.overscanStart === right.overscanStart &&
    left.overscanEnd === right.overscanEnd
  )
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

export function normalizeNonNegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

export function normalizePositiveNumber(
  value: unknown,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return value
}
