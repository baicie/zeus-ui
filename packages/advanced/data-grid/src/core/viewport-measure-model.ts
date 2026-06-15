import type { DataGridViewportMeasurement } from '../types'

export interface ResolveDataGridViewportSizeOptions {
  clientHeight: number
  rowHeight: number
  rowCount: number
  fallbackRowCount?: number
}

export interface DataGridViewportMeasureController {
  getMeasurement: () => DataGridViewportMeasurement
  measure: (
    clientHeight: number,
    rowHeight: number,
    rowCount: number,
  ) => DataGridViewportMeasurement
}

function normalizePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.floor(value)
}

export function resolveDataGridViewportMeasurement(
  options: ResolveDataGridViewportSizeOptions,
): DataGridViewportMeasurement {
  const rowHeight = normalizePositiveInteger(options.rowHeight, 40)
  const rowCount = Math.max(0, Math.floor(options.rowCount))
  const fallbackRowCount = normalizePositiveInteger(
    options.fallbackRowCount ?? 10,
    10,
  )
  const clientHeight = Math.floor(options.clientHeight)

  if (Number.isFinite(clientHeight) && clientHeight > 0) {
    return {
      size: clientHeight,
      source: 'client',
    }
  }

  return {
    size: rowHeight * Math.max(1, Math.min(rowCount || 1, fallbackRowCount)),
    source: 'fallback',
  }
}

export function shouldEmitDataGridViewportResize(
  current: DataGridViewportMeasurement,
  next: DataGridViewportMeasurement,
): boolean {
  return current.size !== next.size || current.source !== next.source
}

export function createDataGridViewportMeasureController(
  initial: DataGridViewportMeasurement = {
    size: 40,
    source: 'fallback',
  },
): DataGridViewportMeasureController {
  let measurement = initial

  return {
    getMeasurement(): DataGridViewportMeasurement {
      return measurement
    },

    measure(
      clientHeight: number,
      rowHeight: number,
      rowCount: number,
    ): DataGridViewportMeasurement {
      measurement = resolveDataGridViewportMeasurement({
        clientHeight,
        rowHeight,
        rowCount,
      })

      return measurement
    },
  }
}
