import type { DataGridColumn } from '../types'

export interface DataGridPerformanceDataset {
  rows: Array<Record<string, unknown>>
  columns: DataGridColumn[]
}

const DATA_GRID_ROW_COUNT = 100_000
const DATA_GRID_COLUMN_COUNT = 100
const DATA_FIELD_COUNT = 8

let cachedDataset: DataGridPerformanceDataset | undefined

function createPerformanceColumns(): DataGridColumn[] {
  return Array.from({ length: DATA_GRID_COLUMN_COUNT }, (_, index) => {
    if (index === 0) {
      return {
        id: 'record',
        header: 'Record',
        field: 'record',
        width: 120,
        sortable: true,
      }
    }

    return {
      id: `column-${index + 1}`,
      header: `Metric ${index + 1}`,
      field: `metric_${(index - 1) % DATA_FIELD_COUNT}`,
      width: 140,
      sortable: index < 8,
    }
  })
}

function createPerformanceRows(): Array<Record<string, unknown>> {
  return Array.from({ length: DATA_GRID_ROW_COUNT }, (_, index) => {
    const row: Record<string, unknown> = {
      id: `row-${index + 1}`,
      record: index + 1,
    }

    for (let fieldIndex = 0; fieldIndex < DATA_FIELD_COUNT; fieldIndex += 1) {
      row[`metric_${fieldIndex}`] =
        fieldIndex % 2 === 0
          ? (index + 1) * (fieldIndex + 1)
          : `R${index + 1} / M${fieldIndex + 1}`
    }

    return row
  })
}

export function getDataGridPerformanceDataset(): DataGridPerformanceDataset {
  if (!cachedDataset) {
    cachedDataset = {
      rows: createPerformanceRows(),
      columns: createPerformanceColumns(),
    }
  }

  return cachedDataset
}
