import type {
  VirtualItem,
  VirtualListElement,
  VirtualListRangeChangeDetail,
} from '../types'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DemoCard } from '../components/DemoCard'
import { StatusNote } from '../components/StatusNote'

const ITEMS = Array.from({ length: 120 }, (_, i) => ({
  id: String(i),
  label: `Activity ${i + 1}`,
  desc:
    i % 3 === 0 ? 'Queued workload' : i % 3 === 1 ? 'Processing' : 'Completed',
  tag: i % 5 === 0 ? 'Priority' : i % 7 === 0 ? 'Escalated' : '',
}))

function isVirtualItem(value: unknown): value is VirtualItem {
  if (!value || typeof value !== 'object') return false

  const item = value as Partial<VirtualItem>

  return (
    typeof item.index === 'number' &&
    typeof item.key === 'string' &&
    typeof item.start === 'number' &&
    typeof item.size === 'number' &&
    typeof item.end === 'number'
  )
}

function normalizeVirtualItems(value: unknown): VirtualItem[] {
  if (!Array.isArray(value)) return []

  return value.filter(isVirtualItem)
}

function getDetailItems(value: unknown): VirtualItem[] {
  if (Array.isArray(value)) {
    return normalizeVirtualItems(value)
  }

  if (!value || typeof value !== 'object') {
    return []
  }

  const detail = value as Partial<VirtualListRangeChangeDetail>

  return normalizeVirtualItems(detail.items)
}

function getVisibleItems(element: VirtualListElement | null): VirtualItem[] {
  if (!element || typeof element.getItems !== 'function') return []

  return normalizeVirtualItems(element.getItems())
}

function formatRangeNote(items: VirtualItem[]): string {
  const first = items[0]
  const last = items[items.length - 1]

  return first && last
    ? `Visible range: ${first.index + 1} - ${last.index + 1} / ${ITEMS.length}; DOM rows: ${items.length}`
    : `Visible range: empty / ${ITEMS.length}; DOM rows: 0`
}

export function VirtualListPage() {
  const virtualRef = useRef<VirtualListElement | null>(null)
  const [visibleItems, setVisibleItems] = useState<VirtualItem[]>([])
  const [note, setNote] = useState('Waiting for virtual range.')

  const commitVisibleItems = useCallback((nextValue: unknown) => {
    const nextItems = normalizeVirtualItems(nextValue)

    setVisibleItems([...nextItems])
    setNote(formatRangeNote(nextItems))
  }, [])

  useEffect(() => {
    const virtual = virtualRef.current
    if (!virtual) return

    virtual.count = ITEMS.length
    virtual.estimateSize = 52
    virtual.overscan = 3
    virtual.setAttribute('aria-label', 'Advanced activity log')

    const syncVisibleItems = () => {
      commitVisibleItems(getVisibleItems(virtual))
    }

    const handleRangeChange = (event: Event) => {
      const customEvent = event as CustomEvent<unknown>
      commitVisibleItems(getDetailItems(customEvent.detail))
    }

    virtual.addEventListener('range-change', handleRangeChange)

    requestAnimationFrame(() => {
      virtual.measure?.()
      syncVisibleItems()
    })

    return () => {
      virtual.removeEventListener('range-change', handleRangeChange)
    }
  }, [commitVisibleItems])

  const safeVisibleItems = useMemo(
    () => normalizeVirtualItems(visibleItems),
    [visibleItems],
  )

  return (
    <DemoCard
      title="Virtual list"
      description="Low-level viewport primitive for high-volume lists. 120 logical items, only visible rows are mounted."
    >
      <zw-virtual-list ref={virtualRef}>
        <div className="virtual-items">
          {safeVisibleItems.map(item => {
            const data = ITEMS[item.index]

            if (!data) return null

            return (
              <div
                key={item.key}
                className="virtual-row"
                style={{
                  height: `${item.size}px`,
                  transform: `translateY(${item.start}px)`,
                }}
              >
                <span className="virtual-row-label">{data.label}</span>
                <span className="virtual-row-desc">{data.desc}</span>
                {data.tag ? (
                  <span className="virtual-row-tag">{data.tag}</span>
                ) : null}
              </div>
            )
          })}
        </div>
      </zw-virtual-list>

      <StatusNote>{note}</StatusNote>
    </DemoCard>
  )
}
