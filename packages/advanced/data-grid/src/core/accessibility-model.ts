import type {
  DataGridActiveCell,
  DataGridAriaSort,
  DataGridSelectionMode,
  DataGridSortState,
  NormalizedDataGridColumn,
} from '../types'

export function getDataGridAriaSort(
  column: NormalizedDataGridColumn,
  sort: DataGridSortState | undefined,
): DataGridAriaSort | undefined {
  if (!column.sortable) return undefined
  if (!sort || sort.columnId !== column.id) return 'none'

  return sort.direction === 'asc' ? 'ascending' : 'descending'
}

export function getDataGridHeaderRowAriaIndex(): number {
  return 1
}

export function getDataGridDataRowAriaIndex(rowIndex: number): number {
  return rowIndex + 2
}

export function getDataGridColumnAriaIndex(columnIndex: number): number {
  return columnIndex + 1
}

export function getDataGridAriaMultiSelectable(
  selectionMode: DataGridSelectionMode,
): 'true' | undefined {
  return selectionMode === 'multiple' ? 'true' : undefined
}

export function getDataGridAriaSelected(
  selectionMode: DataGridSelectionMode,
  selected: boolean,
): 'true' | 'false' | undefined {
  if (selectionMode === 'none') return undefined
  return selected ? 'true' : 'false'
}

export function getDataGridCellTabIndex(
  keyboardNavigation: boolean,
  active: boolean,
): 0 | -1 | undefined {
  if (!keyboardNavigation) return undefined
  return active ? 0 : -1
}

export function getDataGridResizeHandleAriaLabel(
  column: NormalizedDataGridColumn,
): string {
  return `Resize ${column.header || column.id} column`
}

export function getDataGridActiveDescendant(
  activeCell: DataGridActiveCell | undefined,
  getId: (activeCell: DataGridActiveCell) => string | undefined,
): string | undefined {
  if (!activeCell) return undefined
  return getId(activeCell)
}
