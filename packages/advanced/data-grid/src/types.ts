import type { VirtualItem, VirtualRange } from '@zeus-web/virtual'

export type DataGridRowKey = string

export type DataGridCellValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date

export type DataGridRowData = Record<string, unknown>

export type DataGridColumnAlign = 'start' | 'center' | 'end'

export type DataGridSortDirection = 'asc' | 'desc'

export type DataGridSelectionMode = 'none' | 'single' | 'multiple'

export type DataGridNavigationKey =
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown'

export interface DataGridColumn {
  id: string
  header?: string
  field?: string
  width?: number
  minWidth?: number
  maxWidth?: number
  align?: DataGridColumnAlign
  sortable?: boolean
  hidden?: boolean
  resizable?: boolean
}

export interface NormalizedDataGridColumn {
  id: string
  header: string
  field: string
  width: number
  minWidth: number
  maxWidth: number
  align: DataGridColumnAlign
  sortable: boolean
  hidden: boolean
  resizable: boolean
}

export interface DataGridRow {
  key: DataGridRowKey
  index: number
  data: DataGridRowData
}

export interface DataGridSortState {
  columnId: string
  direction: DataGridSortDirection
}

export interface DataGridSelectionState {
  mode: DataGridSelectionMode
  keys: DataGridRowKey[]
}

export type DataGridVirtualRange = VirtualRange

export type DataGridVirtualItem = VirtualItem<DataGridRow>

export interface DataGridVirtualSnapshot {
  range: DataGridVirtualRange
  items: DataGridVirtualItem[]
  totalSize: number
}

export interface DataGridActiveCell {
  rowIndex: number
  rowKey: DataGridRowKey
  columnId: string
  columnIndex: number
}

export interface DataGridCellContext {
  row: DataGridRow
  column: NormalizedDataGridColumn
  value: unknown
}

export interface DataGridRangeChangeDetail {
  range: DataGridVirtualRange
  items: DataGridVirtualItem[]
  scrollOffset: number
  viewportSize: number
  totalSize: number
}

export interface DataGridScrollOffsetChangeDetail {
  offset: number
  nativeEvent: Event
}

export interface DataGridSelectionChangeDetail {
  selection: DataGridSelectionState
  row?: DataGridRow
  nativeEvent?: Event
}

export interface DataGridSortChangeDetail {
  sort: DataGridSortState | undefined
  column?: NormalizedDataGridColumn
  nativeEvent?: Event
}

export interface DataGridColumnResizeStartDetail {
  column: NormalizedDataGridColumn
  width: number
  nativeEvent?: Event
}

export interface DataGridColumnResizeDetail {
  column: NormalizedDataGridColumn
  width: number
  previousWidth: number
  nativeEvent?: Event
}

export interface DataGridColumnResizeEndDetail {
  column: NormalizedDataGridColumn
  width: number
  nativeEvent?: Event
}

export interface DataGridActiveCellChangeDetail {
  activeCell: DataGridActiveCell | undefined
  previousActiveCell: DataGridActiveCell | undefined
  nativeEvent?: Event
}

export interface DataGridRowActionDetail {
  action: 'click' | 'dblclick' | 'keydown'
  row: DataGridRow
  nativeEvent: Event
}

export interface DataGridCellActionDetail {
  action: 'click' | 'dblclick' | 'keydown'
  cell: DataGridCellContext
  nativeEvent: Event
}

export type { DataGridProps, DataGridElement } from './components/data-grid'

export type { VirtualScrollAlign } from '@zeus-web/virtual'
