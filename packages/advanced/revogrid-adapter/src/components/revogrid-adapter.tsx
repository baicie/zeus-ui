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

function resolveRows(props: RevoGridAdapterProps): DataGridRowData[] {
  return Array.isArray(props.rows) ? props.rows : []
}

function resolveColumns(props: RevoGridAdapterProps): DataGridColumn[] {
  return Array.isArray(props.columns) ? props.columns : []
}

function resolveSelectionMode(
  value: DataGridSelectionMode | undefined,
): DataGridSelectionMode {
  return value ?? 'none'
}

function createState(props: RevoGridAdapterProps): RevoGridAdapterState {
  return createRevoGridAdapterState({
    rows: resolveRows(props),
    columns: resolveColumns(props),
    selectedKeys: props.selectedKeys,
    selectionMode: resolveSelectionMode(props.selectionMode),
    sortColumn: props.sortColumn,
    sortDirection: props.sortDirection,
    readonly: props.readonly,
    includeHiddenColumns: props.includeHiddenColumns,
    getRowKey: props.getRowKey,
  })
}

function setup(
  props: RevoGridAdapterProps,
  ctx: DefineElementContext<RevoGridAdapterElement, RevoGridAdapterEmits>,
) {
  let gridElement: RevoGridElementLike | undefined
  let state = createState(props)
  let readyEmitted = false

  const rebuildState = (): RevoGridAdapterState => {
    state = createState(props)
    return state
  }

  const applyStateToGrid = (): void => {
    rebuildState()

    if (gridElement) {
      gridElement.columns = state.columns
      gridElement.source = state.source
      gridElement.sorting = state.sort
      gridElement.selectedRows = state.selection.rowIndexes
      gridElement.readonly = Boolean(props.readonly)
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

  const syncHostProps = (): void => {
    ctx.host.rows = resolveRows(props)
    ctx.host.columns = resolveColumns(props)
    ctx.host.selectedKeys = props.selectedKeys
    ctx.host.selectionMode = resolveSelectionMode(props.selectionMode)
    ctx.host.sortColumn = props.sortColumn
    ctx.host.sortDirection = props.sortDirection
    ctx.host.readonly = Boolean(props.readonly)
    ctx.host.includeHiddenColumns = Boolean(props.includeHiddenColumns)
  }

  ctx.expose({
    getRevoColumns() {
      rebuildState()
      return state.columns.map(column => ({ ...column }))
    },

    getRevoSource() {
      rebuildState()
      return state.source.map(row => ({ ...row }))
    },

    getRevoSort() {
      rebuildState()
      return state.sort ? { ...state.sort } : undefined
    },

    getRevoSelection() {
      rebuildState()
      return {
        ...state.selection,
        rowKeys: [...state.selection.rowKeys],
        rowIndexes: [...state.selection.rowIndexes],
      }
    },

    getState() {
      rebuildState()

      return {
        columns: state.columns.map(column => ({ ...column })),
        source: state.source.map(row => ({ ...row })),
        sort: state.sort ? { ...state.sort } : undefined,
        selection: {
          ...state.selection,
          rowKeys: [...state.selection.rowKeys],
          rowIndexes: [...state.selection.rowIndexes],
        },
      }
    },

    getGridElement() {
      return gridElement
    },

    setRows(rows: DataGridRowData[]) {
      props.rows = rows
      syncHostProps()
      applyStateToGrid()
    },

    setColumns(columns: DataGridColumn[]) {
      props.columns = columns
      syncHostProps()
      applyStateToGrid()
    },

    setSelection(keys: DataGridRowKey[]) {
      props.selectedKeys = keys
      syncHostProps()
      applyStateToGrid()
    },

    setSort(columnId: string, direction: DataGridSortDirection = 'asc') {
      props.sortColumn = columnId
      props.sortDirection = direction
      syncHostProps()
      applyStateToGrid()
    },

    clearSort() {
      props.sortColumn = undefined
      props.sortDirection = undefined
      syncHostProps()
      applyStateToGrid()
    },

    refresh() {
      applyStateToGrid()
    },
  })

  syncHostProps()

  return (
    <Host
      part="root"
      data-slot="revogrid-adapter-root"
      data-readonly={() => (props.readonly ? '' : undefined)}
      data-selection-mode={() => resolveSelectionMode(props.selectionMode)}
      data-row-count={() => String(resolveRows(props).length)}
      data-column-count={() => String(resolveColumns(props).length)}
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
