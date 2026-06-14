import type {
  DataGridActiveCell,
  DataGridNavigationKey,
  DataGridRow,
  DataGridRowKey,
  NormalizedDataGridColumn,
} from '../types'

export interface DataGridNavigationStateOptions {
  rows: DataGridRow[]
  columns: NormalizedDataGridColumn[]
  rowKey?: DataGridRowKey
  columnId?: string
}

export interface DataGridMoveActiveCellOptions {
  rows: DataGridRow[]
  columns: NormalizedDataGridColumn[]
  current: DataGridActiveCell | undefined
  key: DataGridNavigationKey
  pageSize?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getColumnIndex(
  columns: NormalizedDataGridColumn[],
  columnId: string | undefined,
): number {
  if (!columnId) return 0

  const index = columns.findIndex(column => column.id === columnId)

  return index >= 0 ? index : 0
}

function getRowIndex(
  rows: DataGridRow[],
  rowKey: DataGridRowKey | undefined,
): number {
  if (!rowKey) return 0

  const index = rows.findIndex(row => row.key === rowKey)

  return index >= 0 ? index : 0
}

export function createDataGridActiveCell(
  rows: DataGridRow[],
  columns: NormalizedDataGridColumn[],
  rowIndex: number,
  columnIndex: number,
): DataGridActiveCell | undefined {
  if (rows.length === 0 || columns.length === 0) return undefined

  const normalizedRowIndex = clamp(rowIndex, 0, rows.length - 1)
  const normalizedColumnIndex = clamp(columnIndex, 0, columns.length - 1)
  const row = rows[normalizedRowIndex]
  const column = columns[normalizedColumnIndex]

  if (!row || !column) return undefined

  return {
    rowIndex: normalizedRowIndex,
    rowKey: row.key,
    columnId: column.id,
    columnIndex: normalizedColumnIndex,
  }
}

export function createInitialDataGridActiveCell(
  options: DataGridNavigationStateOptions,
): DataGridActiveCell | undefined {
  return createDataGridActiveCell(
    options.rows,
    options.columns,
    getRowIndex(options.rows, options.rowKey),
    getColumnIndex(options.columns, options.columnId),
  )
}

export function moveDataGridActiveCell(
  options: DataGridMoveActiveCellOptions,
): DataGridActiveCell | undefined {
  const current =
    options.current ??
    createInitialDataGridActiveCell({
      rows: options.rows,
      columns: options.columns,
    })

  if (!current) return undefined

  const pageSize = Math.max(1, Math.floor(options.pageSize ?? 10))
  let nextRowIndex = current.rowIndex
  let nextColumnIndex = current.columnIndex

  switch (options.key) {
    case 'ArrowUp': {
      nextRowIndex -= 1
      break
    }

    case 'ArrowDown': {
      nextRowIndex += 1
      break
    }

    case 'ArrowLeft': {
      nextColumnIndex -= 1
      break
    }

    case 'ArrowRight': {
      nextColumnIndex += 1
      break
    }

    case 'Home': {
      nextColumnIndex = 0
      break
    }

    case 'End': {
      nextColumnIndex = options.columns.length - 1
      break
    }

    case 'PageUp': {
      nextRowIndex -= pageSize
      break
    }

    case 'PageDown': {
      nextRowIndex += pageSize
      break
    }
  }

  return createDataGridActiveCell(
    options.rows,
    options.columns,
    nextRowIndex,
    nextColumnIndex,
  )
}

export function areDataGridActiveCellsEqual(
  left: DataGridActiveCell | undefined,
  right: DataGridActiveCell | undefined,
): boolean {
  if (!left && !right) return true
  if (!left || !right) return false

  return (
    left.rowKey === right.rowKey &&
    left.columnId === right.columnId &&
    left.rowIndex === right.rowIndex &&
    left.columnIndex === right.columnIndex
  )
}

export function getDataGridActiveCellId(
  activeCell: DataGridActiveCell | undefined,
): string | undefined {
  if (!activeCell) return undefined

  return `zg-cell-${activeCell.rowKey}-${activeCell.columnId}`
}
