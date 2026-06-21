import type {
  DataGridColumn,
  RevoGridAdapterColumnMapOptions,
  RevoGridCompatibleColumn,
} from '../types'

import { ZEUS_REVO_COLUMN_ID } from '../types'

function normalizeColumnWidth(value: number | undefined): number | undefined {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return undefined
  }

  return Math.floor(value)
}

export function getRevoGridColumnProp(column: DataGridColumn): string {
  return column.field || column.id
}

export function mapDataGridColumnToRevoGridColumn(
  column: DataGridColumn,
  options: RevoGridAdapterColumnMapOptions = {},
): RevoGridCompatibleColumn {
  const prop = getRevoGridColumnProp(column)

  return {
    prop,
    name: column.header ?? prop,
    size: normalizeColumnWidth(column.width),
    minSize: normalizeColumnWidth(column.minWidth),
    maxSize: normalizeColumnWidth(column.maxWidth),
    sortable: Boolean(column.sortable),
    readonly: options.readonly,
    cellProperties: {
      align: column.align ?? 'start',
      hidden: Boolean(column.hidden),
      resizable: column.resizable !== false,
    },
    [ZEUS_REVO_COLUMN_ID]: column.id,
  }
}

export function mapDataGridColumnsToRevoGridColumns(
  columns: DataGridColumn[] | undefined,
  options: RevoGridAdapterColumnMapOptions = {},
): RevoGridCompatibleColumn[] {
  return (columns ?? [])
    .filter(column => options.includeHidden || !column.hidden)
    .map(column => mapDataGridColumnToRevoGridColumn(column, options))
}

export function findRevoGridColumnByZeusColumnId(
  columns: RevoGridCompatibleColumn[],
  columnId: string,
): RevoGridCompatibleColumn | undefined {
  return columns.find(column => column[ZEUS_REVO_COLUMN_ID] === columnId)
}
