import type {
  DataGridColumn,
  DataGridRowData,
  DataGridRowKey,
  DataGridSelectionMode,
  DataGridSortDirection,
  DataGridSortState,
} from '../types'

export interface DataGridControlledStateSources {
  rows: DataGridRowData[]
  columns: DataGridColumn[]
  selectedKeys?: DataGridRowKey[]
  sortColumn?: string
  sortDirection?: DataGridSortDirection
  activeRowKey?: DataGridRowKey
  activeColumnId?: string
  rowHeight: number
  overscan: number
  virtual: boolean
  selectionMode: DataGridSelectionMode
  resizable: boolean
  keyboardNavigation: boolean
}

export type DataGridControlledStateChangeReason =
  | 'rows'
  | 'columns'
  | 'selectedKeys'
  | 'sort'
  | 'activeCell'
  | 'rowHeight'
  | 'overscan'
  | 'virtual'
  | 'selectionMode'
  | 'resizable'
  | 'keyboardNavigation'

export interface DataGridControlledStateChanges {
  changed: boolean
  reasons: DataGridControlledStateChangeReason[]
  rowsChanged: boolean
  columnsChanged: boolean
  selectedKeysChanged: boolean
  sortChanged: boolean
  activeCellChanged: boolean
  layoutChanged: boolean
  selectionModeChanged: boolean
  interactionChanged: boolean
}

export interface DataGridControlledStateController {
  read: () => DataGridControlledStateSources
  update: (
    next: DataGridControlledStateSources,
  ) => DataGridControlledStateChanges
  commit: (next: DataGridControlledStateSources) => void
}

function normalizeSources(
  sources: DataGridControlledStateSources,
): DataGridControlledStateSources {
  return {
    rows: sources.rows,
    columns: sources.columns,
    selectedKeys: sources.selectedKeys,
    sortColumn: sources.sortColumn,
    sortDirection: sources.sortDirection,
    activeRowKey: sources.activeRowKey,
    activeColumnId: sources.activeColumnId,
    rowHeight: sources.rowHeight,
    overscan: sources.overscan,
    virtual: Boolean(sources.virtual),
    selectionMode: sources.selectionMode,
    resizable: Boolean(sources.resizable),
    keyboardNavigation: Boolean(sources.keyboardNavigation),
  }
}

function pushReason(
  reasons: DataGridControlledStateChangeReason[],
  reason: DataGridControlledStateChangeReason,
  changed: boolean,
): void {
  if (changed) reasons.push(reason)
}

export function createDataGridControlledSortState(
  sortColumn: string | undefined,
  sortDirection: DataGridSortDirection | undefined,
): DataGridSortState | undefined {
  if (!sortColumn || !sortDirection) return undefined

  return {
    columnId: sortColumn,
    direction: sortDirection,
  }
}

export function createDataGridControlledStateController(
  initial: DataGridControlledStateSources,
): DataGridControlledStateController {
  let current = normalizeSources(initial)

  function getChanges(
    nextSources: DataGridControlledStateSources,
  ): DataGridControlledStateChanges {
    const next = normalizeSources(nextSources)
    const rowsChanged = next.rows !== current.rows
    const columnsChanged = next.columns !== current.columns
    const selectedKeysChanged = next.selectedKeys !== current.selectedKeys
    const sortChanged =
      next.sortColumn !== current.sortColumn ||
      next.sortDirection !== current.sortDirection
    const activeCellChanged =
      next.activeRowKey !== current.activeRowKey ||
      next.activeColumnId !== current.activeColumnId
    const rowHeightChanged = next.rowHeight !== current.rowHeight
    const overscanChanged = next.overscan !== current.overscan
    const virtualChanged = next.virtual !== current.virtual
    const selectionModeChanged = next.selectionMode !== current.selectionMode
    const resizableChanged = next.resizable !== current.resizable
    const keyboardNavigationChanged =
      next.keyboardNavigation !== current.keyboardNavigation

    const reasons: DataGridControlledStateChangeReason[] = []

    pushReason(reasons, 'rows', rowsChanged)
    pushReason(reasons, 'columns', columnsChanged)
    pushReason(reasons, 'selectedKeys', selectedKeysChanged)
    pushReason(reasons, 'sort', sortChanged)
    pushReason(reasons, 'activeCell', activeCellChanged)
    pushReason(reasons, 'rowHeight', rowHeightChanged)
    pushReason(reasons, 'overscan', overscanChanged)
    pushReason(reasons, 'virtual', virtualChanged)
    pushReason(reasons, 'selectionMode', selectionModeChanged)
    pushReason(reasons, 'resizable', resizableChanged)
    pushReason(reasons, 'keyboardNavigation', keyboardNavigationChanged)

    return {
      changed: reasons.length > 0,
      reasons,
      rowsChanged,
      columnsChanged,
      selectedKeysChanged,
      sortChanged,
      activeCellChanged,
      layoutChanged: rowHeightChanged || overscanChanged || virtualChanged,
      selectionModeChanged,
      interactionChanged: resizableChanged || keyboardNavigationChanged,
    }
  }

  return {
    read(): DataGridControlledStateSources {
      return current
    },

    update(
      nextSources: DataGridControlledStateSources,
    ): DataGridControlledStateChanges {
      const changes = getChanges(nextSources)

      if (changes.changed) {
        current = normalizeSources(nextSources)
      }

      return changes
    },

    commit(nextSources: DataGridControlledStateSources): void {
      current = normalizeSources(nextSources)
    },
  }
}
