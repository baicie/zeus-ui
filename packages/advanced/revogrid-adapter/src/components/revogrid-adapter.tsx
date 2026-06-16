import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'

import type {
  DataGridColumn,
  DataGridRowData,
  DataGridRowKey,
  DataGridSelectionMode,
  DataGridSortDirection,
  RevoGridAdapterChangeDetail,
  RevoGridAdapterProps,
  RevoGridAdapterReadyDetail,
  RevoGridAdapterState,
  RevoGridElementLike,
} from '../types'

import { defineElement, event, Host, prop } from '@zeus-js/zeus'

import { createRevoGridAdapterState } from '../core'

export interface RevoGridAdapterElement extends HTMLElement {
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
  selectedKeys?: DataGridRowKey[]
  getRowKey?: (row: DataGridRowData, index: number) => DataGridRowKey
  selectionMode?: DataGridSelectionMode
  sortColumn?: string
  sortDirection?: DataGridSortDirection
  readonly?: boolean
  includeHiddenColumns?: boolean
  getRevoColumns: () => RevoGridAdapterState['columns']
  getRevoSource: () => RevoGridAdapterState['source']
  getRevoSort: () => RevoGridAdapterState['sort']
  getRevoSelection: () => RevoGridAdapterState['selection']
  getState: () => RevoGridAdapterState
  getGridElement: () => RevoGridElementLike | undefined
  setRows: (rows: DataGridRowData[]) => void
  setColumns: (columns: DataGridColumn[]) => void
  setSelection: (keys: DataGridRowKey[]) => void
  setSort: (columnId: string, direction?: DataGridSortDirection) => void
  clearSort: () => void
  refresh: () => void
}

interface RevoGridAdapterEmits extends Record<
  string,
  EventDefinition<unknown>
> {
  adapterReady: EventDefinition<RevoGridAdapterReadyDetail>
  adapterChange: EventDefinition<RevoGridAdapterChangeDetail>
}

function resolveRows(value: DataGridRowData[] | undefined): DataGridRowData[] {
  return Array.isArray(value) ? value : []
}

function resolveColumns(value: DataGridColumn[] | undefined): DataGridColumn[] {
  return Array.isArray(value) ? value : []
}

function resolveSelectionMode(
  value: DataGridSelectionMode | undefined,
): DataGridSelectionMode {
  return value ?? 'none'
}

function createStateFromOptions(
  options: RevoGridAdapterProps,
): RevoGridAdapterState {
  return createRevoGridAdapterState({
    rows: resolveRows(options.rows),
    columns: resolveColumns(options.columns),
    selectedKeys: options.selectedKeys,
    selectionMode: resolveSelectionMode(options.selectionMode),
    sortColumn: options.sortColumn,
    sortDirection: options.sortDirection,
    readonly: options.readonly,
    includeHiddenColumns: options.includeHiddenColumns,
    getRowKey: options.getRowKey,
  })
}

function cloneState(state: RevoGridAdapterState): RevoGridAdapterState {
  return {
    columns: state.columns.map(column => ({
      ...column,
      cellProperties: column.cellProperties
        ? {
            ...column.cellProperties,
          }
        : undefined,
    })),
    source: state.source.map(row => ({ ...row })),
    sort: state.sort ? { ...state.sort } : undefined,
    selection: {
      ...state.selection,
      rowKeys: [...state.selection.rowKeys],
      rowIndexes: [...state.selection.rowIndexes],
    },
  }
}

function setup(
  props: RevoGridAdapterProps,
  ctx: DefineElementContext<RevoGridAdapterElement, RevoGridAdapterEmits>,
) {
  let gridElement: RevoGridElementLike | undefined
  let state = createStateFromOptions(props)
  let readyEmitted = false
  let pendingApply = false
  let lastSignature = ''

  const readOptions = (): RevoGridAdapterProps => ({
    rows: ctx.host.rows ?? props.rows,
    columns: ctx.host.columns ?? props.columns,
    selectedKeys: ctx.host.selectedKeys ?? props.selectedKeys,
    selectionMode: ctx.host.selectionMode ?? props.selectionMode,
    sortColumn: ctx.host.sortColumn ?? props.sortColumn,
    sortDirection: ctx.host.sortDirection ?? props.sortDirection,
    readonly: ctx.host.readonly ?? props.readonly,
    includeHiddenColumns:
      ctx.host.includeHiddenColumns ?? props.includeHiddenColumns,
    getRowKey: ctx.host.getRowKey ?? props.getRowKey,
  })

  const getSignature = (): string => {
    const options = readOptions()

    return [
      options.rows,
      options.columns,
      options.selectedKeys,
      options.selectionMode,
      options.sortColumn,
      options.sortDirection,
      options.readonly,
      options.includeHiddenColumns,
      options.getRowKey,
    ]
      .map(value => {
        if (typeof value === 'function')
          return `fn:${value.name || 'anonymous'}`
        if (Array.isArray(value)) return `array:${value.length}`
        return String(value)
      })
      .join('|')
  }

  const rebuildState = (): RevoGridAdapterState => {
    state = createStateFromOptions(readOptions())
    return state
  }

  const applyStateToGrid = (): void => {
    rebuildState()
    lastSignature = getSignature()

    if (gridElement) {
      gridElement.columns = state.columns
      gridElement.source = state.source
      gridElement.sorting = state.sort
      gridElement.selectedRows = state.selection.rowIndexes
      gridElement.readonly = Boolean(readOptions().readonly)
      gridElement.refresh?.()
    }

    if (!readyEmitted) {
      readyEmitted = true

      ctx.emit.adapterReady({
        grid: gridElement,
        state,
      })
    }

    ctx.emit.adapterChange({
      grid: gridElement,
      state,
    })
  }

  // Host props are read on every render, so any direct property assignment
  // (e.g. adapter.rows = nextRows) walks through the data-attribute getters
  // and lands here. Coalesce into one microtask to avoid redundant rebuilds
  // when several props change in the same tick.
  const scheduleApplyStateToGrid = (): void => {
    const nextSignature = getSignature()

    if (nextSignature === lastSignature) return
    if (pendingApply) return

    pendingApply = true

    queueMicrotask(() => {
      pendingApply = false
      applyStateToGrid()
    })
  }

  const syncHostProps = (): void => {
    const options = readOptions()

    ctx.host.rows = resolveRows(options.rows)
    ctx.host.columns = resolveColumns(options.columns)
    ctx.host.selectedKeys = options.selectedKeys
    ctx.host.getRowKey = options.getRowKey
    ctx.host.selectionMode = resolveSelectionMode(options.selectionMode)
    ctx.host.sortColumn = options.sortColumn
    ctx.host.sortDirection = options.sortDirection
    ctx.host.readonly = Boolean(options.readonly)
    ctx.host.includeHiddenColumns = Boolean(options.includeHiddenColumns)
  }

  ctx.expose({
    getRevoColumns() {
      rebuildState()
      return cloneState(state).columns
    },

    getRevoSource() {
      rebuildState()
      return cloneState(state).source
    },

    getRevoSort() {
      rebuildState()
      return cloneState(state).sort
    },

    getRevoSelection() {
      rebuildState()
      return cloneState(state).selection
    },

    getState() {
      rebuildState()
      return cloneState(state)
    },

    getGridElement() {
      return gridElement
    },

    setRows(rows: DataGridRowData[]) {
      props.rows = rows
      ctx.host.rows = rows
      syncHostProps()
      applyStateToGrid()
    },

    setColumns(columns: DataGridColumn[]) {
      props.columns = columns
      ctx.host.columns = columns
      syncHostProps()
      applyStateToGrid()
    },

    setSelection(keys: DataGridRowKey[]) {
      props.selectedKeys = keys
      ctx.host.selectedKeys = keys
      syncHostProps()
      applyStateToGrid()
    },

    setSort(columnId: string, direction: DataGridSortDirection = 'asc') {
      props.sortColumn = columnId
      props.sortDirection = direction
      ctx.host.sortColumn = columnId
      ctx.host.sortDirection = direction
      syncHostProps()
      applyStateToGrid()
    },

    clearSort() {
      props.sortColumn = undefined
      props.sortDirection = undefined
      ctx.host.sortColumn = undefined
      ctx.host.sortDirection = undefined
      syncHostProps()
      applyStateToGrid()
    },

    refresh() {
      applyStateToGrid()
    },
  })

  syncHostProps()
  lastSignature = getSignature()

  return (
    <Host
      part="root"
      data-slot="revogrid-adapter-root"
      data-adapter-signature={() => {
        scheduleApplyStateToGrid()
        return getSignature()
      }}
      data-readonly={() => (readOptions().readonly ? '' : undefined)}
      data-selection-mode={() =>
        resolveSelectionMode(readOptions().selectionMode)
      }
      data-row-count={() => String(resolveRows(readOptions().rows).length)}
      data-column-count={() =>
        String(resolveColumns(readOptions().columns).length)
      }
    >
      <revo-grid
        part="grid"
        data-slot="revogrid-adapter-grid"
        aria-label={() => props.ariaLabel}
        ref={(element: RevoGridElementLike | null) => {
          if (element) {
            gridElement = element
            applyStateToGrid()
            return
          }

          gridElement = undefined
        }}
      />
    </Host>
  )
}

export const RevoGridAdapter = defineElement<
  RevoGridAdapterProps,
  RevoGridAdapterElement,
  RevoGridAdapterEmits
>(
  'zw-revogrid-adapter',
  {
    shadow: false,
    props: {
      rows: Array,
      columns: Array,
      selectedKeys: Array,
      getRowKey: prop(Function),
      selectionMode: prop(['none', 'single', 'multiple'], {
        attr: 'selection-mode',
        default: 'none',
        reflect: true,
      }),
      sortColumn: prop(String, {
        attr: 'sort-column',
      }),
      sortDirection: prop(['asc', 'desc'], {
        attr: 'sort-direction',
      }),
      readonly: prop(Boolean, {
        reflect: true,
      }),
      includeHiddenColumns: prop(Boolean, {
        attr: 'include-hidden-columns',
      }),
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
    },
    emits: {
      adapterReady: event<RevoGridAdapterReadyDetail>(),
      adapterChange: event<RevoGridAdapterChangeDetail>(),
    },
    meta: {
      description:
        'RevoGrid-compatible adapter for Zeus Web DataGrid column, row, sorting and selection models.',
    },
  },
  setup,
)
