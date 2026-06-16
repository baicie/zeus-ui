import type { RevoGridAdapterElement } from '../types'

import { useEffect, useRef, useState } from 'react'
import { DemoCard } from '../components/DemoCard'
import { StatusNote } from '../components/StatusNote'
import { gridColumns, gridRows } from '../data/advanced-data'

export function RevoGridAdapterPage() {
  const adapterRef = useRef<RevoGridAdapterElement | null>(null)
  const [note, setNote] = useState(
    'This demo does not bundle RevoGrid. It verifies the adapter state mapping.',
  )

  useEffect(() => {
    const adapter = adapterRef.current
    if (!adapter) return

    adapter.rows = gridRows
    adapter.columns = gridColumns
    adapter.selectionMode = 'multiple'
    adapter.selectedKeys = ['tickets']
    adapter.sortColumn = 'owner'
    adapter.sortDirection = 'asc'
    adapter.setAttribute('aria-label', 'Advanced RevoGrid adapter demo')

    const handleChange = (event: Event) => {
      const customEvent = event as CustomEvent<{
        state: {
          source: unknown[]
          columns: unknown[]
        }
      }>

      setNote(
        `Adapter mapped ${customEvent.detail.state.source.length} rows and ${customEvent.detail.state.columns.length} columns.`,
      )
    }

    adapter.addEventListener('adapter-change', handleChange)
    adapter.refresh?.()

    return () => {
      adapter.removeEventListener('adapter-change', handleChange)
    }
  }, [])

  return (
    <DemoCard
      title="RevoGrid adapter"
      description="Interop bridge that maps Zeus DataGrid rows, columns, sorting and selection into a revo-grid compatible element."
    >
      <zw-revogrid-adapter ref={adapterRef} />
      <StatusNote>{note}</StatusNote>
    </DemoCard>
  )
}
