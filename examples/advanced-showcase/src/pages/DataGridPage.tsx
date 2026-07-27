import type { DataGridElement } from '../types'

import { useEffect, useRef, useState } from 'react'

import { DemoCard } from '../components/DemoCard'
import { getDataGridPerformanceDataset } from '../data/data-grid-performance-data'

export function DataGridPage() {
  const gridRef = useRef<DataGridElement | null>(null)
  const [note, setNote] = useState('Preparing 100,000 rows and 100 columns.')

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const dataset = getDataGridPerformanceDataset()

    grid.rows = dataset.rows
    grid.columns = dataset.columns
    grid.rowHeight = 40
    grid.overscan = 4
    grid.overscanColumns = 2
    grid.virtual = true
    grid.selectionMode = 'multiple'
    grid.selectedKeys = ['row-2']
    grid.resizable = true
    grid.keyboardNavigation = true
    grid.activeRowKey = 'row-1'
    grid.activeColumnId = 'record'
    grid.setAttribute('aria-label', 'High performance metrics table')

    const refresh = () => {
      grid.refreshViewport()
    }

    const handleSelection = () => {
      const sel = grid.getSelection()
      setNote(`Selection event: ${JSON.stringify(sel)}`)
    }

    const handleSort = () => {
      const sort = grid.getSort()
      setNote(`Sort event: ${JSON.stringify(sort)}`)
    }

    const handleActiveCell = () => {
      const cell = grid.getActiveCell()

      setNote(
        cell
          ? `Active cell event: row=${cell.rowKey}, col=${cell.columnId}`
          : 'Active cell cleared.',
      )
    }

    grid.addEventListener('selection-change', handleSelection)
    grid.addEventListener('sort-change', handleSort)
    grid.addEventListener('active-cell-change', handleActiveCell)

    const frame = requestAnimationFrame(refresh)
    setNote(`${dataset.rows.length.toLocaleString()} rows loaded.`)

    return () => {
      cancelAnimationFrame(frame)
      grid.removeEventListener('selection-change', handleSelection)
      grid.removeEventListener('sort-change', handleSort)
      grid.removeEventListener('active-cell-change', handleActiveCell)
    }
  }, [])

  const jumpToMiddle = () => {
    const grid = gridRef.current
    if (!grid) return

    grid.scrollToIndex(50_000, 'center')
    grid.scrollToColumn(79, 'center')
    setNote('Viewport moved to row 50,001 and column 80.')
  }

  const resetViewport = () => {
    const grid = gridRef.current
    if (!grid) return

    grid.scrollToIndex(0)
    grid.scrollToColumn(0)
    setNote('Viewport reset to the first cell.')
  }

  return (
    <DemoCard
      title="High-performance data grid"
      description="100,000 rows and 100 columns with two-axis virtualization."
    >
      <div className="button-row">
        <button type="button" onClick={jumpToMiddle}>
          Jump to row 50,001 / column 80
        </button>
        <button type="button" onClick={resetViewport}>
          Reset viewport
        </button>
      </div>

      <zw-data-grid className="data-grid-performance" ref={gridRef} />

      <div className="debug-panel" role="status">
        <strong>Debug output</strong>
        <span>{note}</span>
      </div>
    </DemoCard>
  )
}
