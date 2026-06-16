import type {
  VirtualItem,
  VirtualListElement,
  VirtualListRangeChangeDetail,
} from '../types'

import { useEffect, useRef, useState } from 'react'

import { DemoCard } from '../components/DemoCard'
import { StatusNote } from '../components/StatusNote'

const ITEMS = Array.from({ length: 120 }, (_, i) => ({
  id: String(i),
  label: `Activity ${i + 1}`,
  desc:
    i % 3 === 0 ? 'Queued workload' : i % 3 === 1 ? 'Processing' : 'Completed',
  tag: i % 5 === 0 ? 'Priority' : i % 7 === 0 ? 'Escalated' : '',
}))

function getVisibleItems(element: VirtualListElement | null): VirtualItem[] {
  if (!element) return []

  return element.getItems?.() ?? []
}

export function VirtualListPage() {
  const virtualRef = useRef<VirtualListElement | null>(null)
  const [visibleItems, setVisibleItems] = useState<VirtualItem[]>([])
  const [note, setNote] = useState('Waiting for virtual range.')

  useEffect(() => {
    const virtual = virtualRef.current
    if (!virtual) return

    virtual.count = ITEMS.length
    virtual.estimateSize = 52
    virtual.overscan = 3
    virtual.setAttribute('aria-label', 'Advanced activity log')

    const syncVisibleItems = () => {
      const items = getVisibleItems(virtual)
      setVisibleItems(items)

      const first = items[0]
      const last = items[items.length - 1]

      setNote(
        first && last
          ? `Visible range: ${first.index + 1} - ${last.index + 1} / ${ITEMS.length}; DOM rows: ${items.length}`
          : `Visible range: empty / ${ITEMS.length}; DOM rows: 0`,
      )
    }

    const handleRangeChange = (event: Event) => {
      const customEvent = event as CustomEvent<VirtualListRangeChangeDetail>
      setVisibleItems(customEvent.detail.items)

      const first = customEvent.detail.items[0]
      const last = customEvent.detail.items[customEvent.detail.items.length - 1]

      setNote(
        first && last
          ? `Visible range: ${first.index + 1} - ${last.index + 1} / ${ITEMS.length}; DOM rows: ${customEvent.detail.items.length}`
          : `Visible range: empty / ${ITEMS.length}; DOM rows: 0`,
      )
    }

    virtual.addEventListener('range-change', handleRangeChange)

    requestAnimationFrame(() => {
      virtual.measure?.()
      syncVisibleItems()
    })

    return () => {
      virtual.removeEventListener('range-change', handleRangeChange)
    }
  }, [])

  return (
    <DemoCard
      title="Virtual list"
      description="Low-level viewport primitive for high-volume lists. 120 logical items, only visible rows are mounted."
    >
      <zw-virtual-list ref={virtualRef}>
        <div className="virtual-items">
          {visibleItems.map(item => {
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
