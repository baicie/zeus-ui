import type {
  DataGridColumn,
  DataGridRowData,
  DataGridRowKey,
  DataGridSelectionMode,
  DataGridSortDirection,
  DataGridSortState,
} from '@zeus-web/data-grid'

export type {
  DataGridColumn,
  DataGridRowData,
  DataGridRowKey,
  DataGridSelectionMode,
  DataGridSortDirection,
  DataGridSortState,
}

export const ZEUS_REVO_ROW_KEY = '__zeusRowKey'
export const ZEUS_REVO_ROW_INDEX = '__zeusRowIndex'
export const ZEUS_REVO_COLUMN_ID = '__zeusColumnId'

export interface RevoGridCompatibleColumn {
  prop: string
  name: string
  size?: number
  minSize?: number
  maxSize?: number
  sortable?: boolean
  readonly?: boolean
  pin?: 'colPinStart' | 'colPinEnd'
  cellProperties?: Record<string, unknown>
  [ZEUS_REVO_COLUMN_ID]?: string
}

export interface RevoGridCompatibleSourceRow extends Record<string, unknown> {
  [ZEUS_REVO_ROW_KEY]: DataGridRowKey
  [ZEUS_REVO_ROW_INDEX]: number
}

export interface RevoGridCompatibleSort {
  prop: string
  order: DataGridSortDirection
  [ZEUS_REVO_COLUMN_ID]?: string
}

export interface RevoGridCompatibleSelection {
  mode: DataGridSelectionMode
  rowKeys: DataGridRowKey[]
  rowIndexes: number[]
}

export interface RevoGridAdapterColumnMapOptions {
  readonly?: boolean
  includeHidden?: boolean
}

export interface RevoGridAdapterRowMapOptions {
  getRowKey?: (row: DataGridRowData, index: number) => DataGridRowKey
}

export interface RevoGridAdapterStateOptions {
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
  selectedKeys?: DataGridRowKey[]
  selectionMode?: DataGridSelectionMode
  sortColumn?: string
  sortDirection?: DataGridSortDirection
  readonly?: boolean
  includeHiddenColumns?: boolean
  getRowKey?: (row: DataGridRowData, index: number) => DataGridRowKey
}

export interface RevoGridAdapterState {
  columns: RevoGridCompatibleColumn[]
  source: RevoGridCompatibleSourceRow[]
  sort: RevoGridCompatibleSort | undefined
  selection: RevoGridCompatibleSelection
}

export interface RevoGridElementLike extends HTMLElement {
  columns?: RevoGridCompatibleColumn[]
  source?: RevoGridCompatibleSourceRow[]
  sorting?: RevoGridCompatibleSort | undefined
  selectedRows?: number[]
  readonly?: boolean
  refresh?: () => void
}

export interface RevoGridAdapterReadyDetail {
  grid: RevoGridElementLike | undefined
  state: RevoGridAdapterState
}

export interface RevoGridAdapterChangeDetail {
  grid: RevoGridElementLike | undefined
  state: RevoGridAdapterState
}

export type RevoGridAdapterProps = RevoGridAdapterStateOptions & {
  ariaLabel?: string
}
