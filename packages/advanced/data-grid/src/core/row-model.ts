import type { DataGridRow, DataGridRowData, DataGridRowKey } from '../types'

export type DataGridGetRowKey = (
  row: DataGridRowData,
  index: number,
) => DataGridRowKey

function fallbackRowKey(row: DataGridRowData, index: number): DataGridRowKey {
  const candidate = row.id ?? row.key

  if (typeof candidate === 'string' || typeof candidate === 'number') {
    return String(candidate)
  }

  return String(index)
}

export function createDataGridRows(
  rows: DataGridRowData[] | undefined,
  getRowKey: DataGridGetRowKey = fallbackRowKey,
): DataGridRow[] {
  return (rows ?? []).map((row, index) => ({
    key: getRowKey(row, index),
    index,
    data: row,
  }))
}

export function getDataGridRowByKey(
  rows: DataGridRow[],
  key: DataGridRowKey,
): DataGridRow | undefined {
  return rows.find(row => row.key === key)
}

export function getDataGridCellValue(row: DataGridRow, field: string): unknown {
  return row.data[field]
}
