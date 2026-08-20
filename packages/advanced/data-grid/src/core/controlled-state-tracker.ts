import type { DataGridControlledStateSources } from './controlled-state-model'

export enum DataGridControlledStateChange {
  Rows = 1,
  Columns = 2,
  SelectedKeys = 4,
  Sort = 8,
  ActiveCell = 16,
  RowHeight = 32,
  Overscan = 64,
  OverscanColumns = 128,
  Virtual = 256,
  SelectionMode = 512,
  Resizable = 1024,
  KeyboardNavigation = 2048,
}

export function createDataGridControlledStateTracker(
  initial: DataGridControlledStateSources,
) {
  let current = initial

  return {
    update(next: DataGridControlledStateSources): number {
      let changes = 0

      if (next.rows !== current.rows) {
        changes |= DataGridControlledStateChange.Rows
      }
      if (next.columns !== current.columns) {
        changes |= DataGridControlledStateChange.Columns
      }
      if (next.selectedKeys !== current.selectedKeys) {
        changes |= DataGridControlledStateChange.SelectedKeys
      }
      if (
        next.sortColumn !== current.sortColumn ||
        next.sortDirection !== current.sortDirection
      ) {
        changes |= DataGridControlledStateChange.Sort
      }
      if (
        next.activeRowKey !== current.activeRowKey ||
        next.activeColumnId !== current.activeColumnId
      ) {
        changes |= DataGridControlledStateChange.ActiveCell
      }
      if (next.rowHeight !== current.rowHeight) {
        changes |= DataGridControlledStateChange.RowHeight
      }
      if (next.overscan !== current.overscan) {
        changes |= DataGridControlledStateChange.Overscan
      }
      if (next.overscanColumns !== current.overscanColumns) {
        changes |= DataGridControlledStateChange.OverscanColumns
      }
      if (next.virtual !== current.virtual) {
        changes |= DataGridControlledStateChange.Virtual
      }
      if (next.selectionMode !== current.selectionMode) {
        changes |= DataGridControlledStateChange.SelectionMode
      }
      if (next.resizable !== current.resizable) {
        changes |= DataGridControlledStateChange.Resizable
      }
      if (next.keyboardNavigation !== current.keyboardNavigation) {
        changes |= DataGridControlledStateChange.KeyboardNavigation
      }

      if (changes) current = next

      return changes
    },

    commit(next: Partial<DataGridControlledStateSources>): void {
      current = { ...current, ...next }
    },
  }
}
