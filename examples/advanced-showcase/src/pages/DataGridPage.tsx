import type { DataGridElement } from '../types'

import { useEffect, useRef, useState } from 'react'
import { DemoCard } from '../components/DemoCard'
import { StatusNote } from '../components/StatusNote'
import { gridColumns, gridRows } from '../data/advanced-data'

export function DataGridPage() {
  const gridRef = useRef<DataGridElement | null>(null)
  const [note, setNote] = useState('Interact with the grid to see events.')

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    grid.rows = gridRows
    grid.columns = gridColumns
    grid.rowHeight = 40
    grid.overscan = 2
    grid.virtual = true
    grid.selectionMode = 'multiple'
    grid.selectedKeys = ['latency']
    grid.resizable = true
    grid.keyboardNavigation = true
    grid.activeRowKey = 'mrr'
    grid.activeColumnId = 'metric'
    grid.setAttribute('aria-label', 'Advanced metrics table')

    const handleSelection = () => {
      const sel = grid.getSelection?.()
      setNote(`Selection: ${JSON.stringify(sel)}`)
    }

    const handleSort = () => {
      const sort = grid.getSort?.()
      setNote(`Sort: ${JSON.stringify(sort)}`)
    }

    const handleActiveCell = () => {
      const cell = grid.getActiveCell?.()
      setNote(
        `Active cell: row=${(cell as { rowKey?: string } | null)?.rowKey}, col=${(cell as { columnId?: string } | null)?.columnId}`,
      )
    }

    grid.addEventListener('selection-change', handleSelection)
    grid.addEventListener('sort-change', handleSort)
    grid.addEventListener('active-cell-change', handleActiveCell)

    return () => {
      grid.removeEventListener('selection-change', handleSelection)
      grid.removeEventListener('sort-change', handleSort)
      grid.removeEventListener('active-cell-change', handleActiveCell)
    }
  }, [])

  return (
    <DemoCard
      title="Data grid"
      description="Virtualized table with selection, sortable columns and keyboard navigation."
    >
      <zw-data-grid ref={gridRef} />
      <StatusNote>{note}</StatusNote>
    </DemoCard>
  )
}
