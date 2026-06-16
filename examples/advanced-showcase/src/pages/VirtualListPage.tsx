import { DemoCard } from '../components/DemoCard'

const ITEMS = Array.from({ length: 120 }, (_, i) => ({
  id: String(i),
  label: `Activity ${i + 1}`,
  desc:
    i % 3 === 0 ? 'Queued workload' : i % 3 === 1 ? 'Processing' : 'Completed',
  tag: i % 5 === 0 ? 'Priority' : i % 7 === 0 ? 'Escalated' : '',
}))

export function VirtualListPage() {
  return (
    <DemoCard
      title="Virtual list"
      description="Low-level viewport primitive for high-volume lists. 120 items rendered with virtual scrolling."
    >
      <zw-virtual-list
        count="120"
        estimate-size="52"
        overscan="3"
        aria-label="Advanced activity log"
      >
        <div className="virtual-items">
          {ITEMS.map(item => (
            <div key={item.id} className="virtual-row">
              <span className="virtual-row-label">{item.label}</span>
              <span className="virtual-row-desc">{item.desc}</span>
              {item.tag && <span className="virtual-row-tag">{item.tag}</span>}
            </div>
          ))}
        </div>
      </zw-virtual-list>
    </DemoCard>
  )
}
