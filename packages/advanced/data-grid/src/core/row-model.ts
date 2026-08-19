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
  const source = rows ?? []
  const result: DataGridRow[] = []
  const keys = new Set<DataGridRowKey>()

  for (let index = 0; index < source.length; index += 1) {
    const row = source[index]
    const key = getRowKey(row, index)

    if (keys.has(key)) {
      throw new Error(
        `[Data Grid] duplicate row key "${String(key)}" at index ${index}.`,
      )
    }

    keys.add(key)
    result.push({
      key,
      index,
      data: row,
    })
  }

  return result
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
