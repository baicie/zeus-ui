import type { NormalizedDataGridColumn } from '../types'

export type DataGridColumnWidthState = Record<string, number>

export interface DataGridColumnResizeResult {
  columns: NormalizedDataGridColumn[]
  widths: DataGridColumnWidthState
  column: NormalizedDataGridColumn | undefined
  previousWidth: number | undefined
  width: number | undefined
}

export interface DataGridColumnResizeDeltaOptions {
  columns: NormalizedDataGridColumn[]
  widths?: DataGridColumnWidthState
  columnId: string
  delta: number
  baseWidth?: number
}

export function clampDataGridColumnWidth(
  column: Pick<NormalizedDataGridColumn, 'minWidth' | 'maxWidth'>,
  width: number,
): number {
  if (!Number.isFinite(width)) return column.minWidth

  return Math.min(column.maxWidth, Math.max(column.minWidth, Math.floor(width)))
}

export function createDataGridColumnWidthState(
  columns: NormalizedDataGridColumn[],
): DataGridColumnWidthState {
  return columns.reduce<DataGridColumnWidthState>((state, column) => {
    state[column.id] = column.width
    return state
  }, {})
}

export function applyDataGridColumnWidths(
  columns: NormalizedDataGridColumn[],
  widths: DataGridColumnWidthState | undefined,
): NormalizedDataGridColumn[] {
  if (!widths) return columns.map(column => ({ ...column }))

  return columns.map(column => {
    const nextWidth = widths[column.id]

    if (nextWidth === undefined) return { ...column }

    return {
      ...column,
      width: clampDataGridColumnWidth(column, nextWidth),
    }
  })
}

export function resizeDataGridColumn(
  columns: NormalizedDataGridColumn[],
  columnId: string,
  width: number,
  widths: DataGridColumnWidthState = createDataGridColumnWidthState(columns),
): DataGridColumnResizeResult {
  const column = columns.find(item => item.id === columnId)

  if (!column || !column.resizable) {
    return {
      columns: applyDataGridColumnWidths(columns, widths),
      widths: { ...widths },
      column: undefined,
      previousWidth: undefined,
      width: undefined,
    }
  }

  const previousWidth = widths[columnId] ?? column.width
  const nextWidth = clampDataGridColumnWidth(column, width)
  const nextWidths = {
    ...widths,
    [columnId]: nextWidth,
  }
  const nextColumns = applyDataGridColumnWidths(columns, nextWidths)
  const nextColumn = nextColumns.find(item => item.id === columnId)

  return {
    columns: nextColumns,
    widths: nextWidths,
    column: nextColumn,
    previousWidth,
    width: nextWidth,
  }
}

export function resizeDataGridColumnByDelta(
  options: DataGridColumnResizeDeltaOptions,
): DataGridColumnResizeResult {
  const column = options.columns.find(item => item.id === options.columnId)

  if (!column) {
    return {
      columns: applyDataGridColumnWidths(options.columns, options.widths),
      widths: { ...(options.widths ?? {}) },
      column: undefined,
      previousWidth: undefined,
      width: undefined,
    }
  }

  const widths =
    options.widths ?? createDataGridColumnWidthState(options.columns)
  const baseWidth =
    options.baseWidth ?? widths[options.columnId] ?? column.width

  return resizeDataGridColumn(
    options.columns,
    options.columnId,
    baseWidth + options.delta,
    widths,
  )
}

export function resetDataGridColumnWidths(
  columns: NormalizedDataGridColumn[],
): DataGridColumnResizeResult {
  const widths = createDataGridColumnWidthState(columns)

  return {
    columns: applyDataGridColumnWidths(columns, widths),
    widths,
    column: undefined,
    previousWidth: undefined,
    width: undefined,
  }
}
