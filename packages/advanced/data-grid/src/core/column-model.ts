import type {
  DataGridColumn,
  DataGridColumnAlign,
  NormalizedDataGridColumn,
} from '../types'

const DEFAULT_COLUMN_WIDTH = 160
const DEFAULT_MIN_WIDTH = 48
const DEFAULT_MAX_WIDTH = 1000

function normalizeWidth(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return fallback
  }

  return Math.floor(value)
}

function normalizeAlign(
  value: DataGridColumnAlign | undefined,
): DataGridColumnAlign {
  return value ?? 'start'
}

export function normalizeDataGridColumn(
  column: DataGridColumn,
  index: number,
): NormalizedDataGridColumn {
  const id = column.id || `column-${index}`
  const field = column.field || id
  const minWidth = normalizeWidth(column.minWidth, DEFAULT_MIN_WIDTH)
  const maxWidth = Math.max(
    minWidth,
    normalizeWidth(column.maxWidth, DEFAULT_MAX_WIDTH),
  )
  const width = Math.min(
    maxWidth,
    Math.max(minWidth, normalizeWidth(column.width, DEFAULT_COLUMN_WIDTH)),
  )

  return {
    id,
    header: column.header ?? field,
    field,
    width,
    minWidth,
    maxWidth,
    align: normalizeAlign(column.align),
    sortable: Boolean(column.sortable),
    hidden: Boolean(column.hidden),
  }
}

export function normalizeDataGridColumns(
  columns: DataGridColumn[] | undefined,
): NormalizedDataGridColumn[] {
  return (columns ?? []).map((column, index) =>
    normalizeDataGridColumn(column, index),
  )
}

export function getVisibleDataGridColumns(
  columns: NormalizedDataGridColumn[],
): NormalizedDataGridColumn[] {
  return columns.filter(column => !column.hidden)
}

export function getDataGridColumnById(
  columns: NormalizedDataGridColumn[],
  id: string,
): NormalizedDataGridColumn | undefined {
  return columns.find(column => column.id === id)
}

export function getTotalColumnWidth(
  columns: NormalizedDataGridColumn[],
): number {
  return getVisibleDataGridColumns(columns).reduce(
    (total, column) => total + column.width,
    0,
  )
}
