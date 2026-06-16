import type { RevoGridAdapterElement, RevoGridAdapterState } from '../types'

import { useEffect, useRef, useState } from 'react'

import { DemoCard } from '../components/DemoCard'
import { StatusNote } from '../components/StatusNote'
import { gridColumns, gridRows } from '../data/advanced-data'

function normalizeState(
  value: RevoGridAdapterState | undefined,
): RevoGridAdapterState {
  return {
    columns: value?.columns ?? [],
    source: value?.source ?? [],
    sort: value?.sort,
    selection: value?.selection ?? {},
  }
}

export function RevoGridAdapterPage() {
  const adapterRef = useRef<RevoGridAdapterElement | null>(null)
  const [state, setState] = useState<RevoGridAdapterState>(() =>
    normalizeState(undefined),
  )
  const [note, setNote] = useState(
    'This demo does not bundle RevoGrid. It displays adapter-mapped state.',
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

    const syncState = () => {
      const nextState = normalizeState(adapter.getState?.())
      setState(nextState)
      setNote(
        `Adapter mapped ${nextState.source.length} rows and ${nextState.columns.length} columns.`,
      )
    }

    const handleChange = (event: Event) => {
      const customEvent = event as CustomEvent<{
        state: RevoGridAdapterState
      }>

      const nextState = normalizeState(customEvent.detail.state)
      setState(nextState)
      setNote(
        `Adapter mapped ${nextState.source.length} rows and ${nextState.columns.length} columns.`,
      )
    }

    adapter.addEventListener('adapter-change', handleChange)

    requestAnimationFrame(() => {
      adapter.refresh?.()
      syncState()
    })

    return () => {
      adapter.removeEventListener('adapter-change', handleChange)
    }
  }, [])

  const columns = state.columns
  const rows = state.source

  return (
    <DemoCard
      title="RevoGrid adapter"
      description="Interop bridge that maps Zeus DataGrid rows, columns, sorting and selection into a RevoGrid-compatible element."
    >
      <zw-revogrid-adapter ref={adapterRef} />

      <div className="adapter-preview" aria-label="RevoGrid adapter preview">
        <div className="adapter-preview-header">
          <strong>Mapped RevoGrid-compatible state</strong>
          <span>No real RevoGrid implementation is bundled in this demo.</span>
        </div>

        <div className="adapter-table" role="table">
          <div className="adapter-table-row adapter-table-head" role="row">
            {columns.map(column => (
              <div
                key={String(column.prop ?? column.name)}
                className="adapter-table-cell"
                role="columnheader"
              >
                {String(column.name ?? column.prop ?? '')}
              </div>
            ))}
          </div>

          {rows.map((row, rowIndex) => (
            <div
              key={String(row.__zeusRowKey ?? row.id ?? rowIndex)}
              className="adapter-table-row"
              role="row"
            >
              {columns.map(column => (
                <div
                  key={String(column.prop ?? column.name)}
                  className="adapter-table-cell"
                  role="cell"
                >
                  {String(row[String(column.prop)] ?? '')}
                </div>
              ))}
            </div>
          ))}
        </div>

        <pre className="adapter-state-json">
          {JSON.stringify(
            {
              sort: state.sort,
              selection: state.selection,
            },
            null,
            2,
          )}
        </pre>
      </div>

      <StatusNote>{note}</StatusNote>
    </DemoCard>
  )
}
