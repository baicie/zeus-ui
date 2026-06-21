import type {
  VirtualItem,
  VirtualListElement,
  VirtualListRangeChangeDetail,
} from '../types'

export function isVirtualItem(value: unknown): value is VirtualItem {
  if (!value || typeof value !== 'object') return false

  const item = value as Partial<VirtualItem>

  return (
    typeof item.index === 'number' &&
    Number.isFinite(item.index) &&
    typeof item.key === 'string' &&
    typeof item.start === 'number' &&
    Number.isFinite(item.start) &&
    typeof item.size === 'number' &&
    Number.isFinite(item.size) &&
    typeof item.end === 'number' &&
    Number.isFinite(item.end)
  )
}

export function normalizeVirtualItems(value: unknown): VirtualItem[] {
  if (!Array.isArray(value)) return []

  return value.filter(isVirtualItem)
}

export function getVirtualItemsFromRangeDetail(value: unknown): VirtualItem[] {
  if (Array.isArray(value)) {
    return normalizeVirtualItems(value)
  }

  if (!value || typeof value !== 'object') {
    return []
  }

  const detail = value as Partial<VirtualListRangeChangeDetail>

  return normalizeVirtualItems(detail.items)
}

export function getVisibleItemsFromElement(
  element: VirtualListElement | null,
): VirtualItem[] {
  if (!element || typeof element.getItems !== 'function') {
    return []
  }

  return normalizeVirtualItems(element.getItems())
}
