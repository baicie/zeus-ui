import type {
  DataGridRowData,
  DataGridRowKey,
  RevoGridAdapterRowMapOptions,
  RevoGridCompatibleSourceRow,
} from '../types'

import { ZEUS_REVO_ROW_INDEX, ZEUS_REVO_ROW_KEY } from '../types'

function defaultGetRowKey(row: DataGridRowData, index: number): DataGridRowKey {
  const value = row.id ?? row.key ?? index
  return String(value)
}

export function mapDataGridRowToRevoGridSourceRow(
  row: DataGridRowData,
  index: number,
  options: RevoGridAdapterRowMapOptions = {},
): RevoGridCompatibleSourceRow {
  const getRowKey = options.getRowKey ?? defaultGetRowKey

  return {
    ...row,
    [ZEUS_REVO_ROW_KEY]: getRowKey(row, index),
    [ZEUS_REVO_ROW_INDEX]: index,
  }
}

export function mapDataGridRowsToRevoGridSource(
  rows: DataGridRowData[] | undefined,
  options: RevoGridAdapterRowMapOptions = {},
): RevoGridCompatibleSourceRow[] {
  return (rows ?? []).map((row, index) =>
    mapDataGridRowToRevoGridSourceRow(row, index, options),
  )
}

export function getRevoGridRowKey(
  row: RevoGridCompatibleSourceRow,
): DataGridRowKey {
  return row[ZEUS_REVO_ROW_KEY]
}

export function getRevoGridRowIndex(row: RevoGridCompatibleSourceRow): number {
  return row[ZEUS_REVO_ROW_INDEX]
}
