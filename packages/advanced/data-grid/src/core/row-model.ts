import type { DataGridRow, DataGridRowData, DataGridRowKey } from '../types'

export type DataGridGetRowKey = (
  row: DataGridRowData,
  index: number,
) => DataGridRowKey

export interface DataGridRowCollection {
  readonly length: number
  getRow: (index: number) => DataGridRow | undefined
  getKey: (index: number) => DataGridRowKey | undefined
  getIndexByKey: (key: DataGridRowKey) => number | undefined
}

export interface DataGridRowModel extends DataGridRowCollection {
  readonly source: DataGridRowData[]
  readonly wrapperCount: number
}

function fallbackRowKey(row: DataGridRowData, index: number): DataGridRowKey {
  const candidate = row.id ?? row.key

  if (typeof candidate === 'string' || typeof candidate === 'number') {
    return String(candidate)
  }

  return String(index)
}

export function createDataGridRowModel(
  rows: DataGridRowData[] | undefined,
  getRowKey: DataGridGetRowKey = fallbackRowKey,
): DataGridRowModel {
  const source = rows || []
  const keys: DataGridRowKey[] = []
  const indexByKey = new Map<DataGridRowKey, number>()

  for (let index = 0; index < source.length; index += 1) {
    const row = source[index]
    const key = getRowKey(row, index)

    if (indexByKey.has(key)) {
      throw new Error(
        `[Data Grid] duplicate row key "${String(key)}" at index ${index}.`,
      )
    }

    keys.push(key)
    indexByKey.set(key, index)
  }

  const model = {
    source,
    length: source.length,
    wrapperCount: 0,

    getRow(index: number): DataGridRow | undefined {
      const key = keys[index]

      if (key === undefined) return undefined

      model.wrapperCount += 1

      return {
        key,
        index,
        data: source[index],
      }
    },

    getKey(index: number): DataGridRowKey | undefined {
      return keys[index]
    },

    getIndexByKey(key: DataGridRowKey): number | undefined {
      return indexByKey.get(key)
    },
  } satisfies DataGridRowModel

  return model
}

export function materializeDataGridRows(
  rows: DataGridRowCollection,
): DataGridRow[] {
  return Array.from({ length: rows.length }, (_, index) => rows.getRow(index)!)
}

export function getDataGridRowByKey(
  rows: DataGridRowCollection,
  key: DataGridRowKey,
): DataGridRow | undefined {
  return rows.getRow(rows.getIndexByKey(key)!)
}

export function getDataGridCellValue(row: DataGridRow, field: string): unknown {
  return row.data[field]
}
