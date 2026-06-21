import type {
  DataGridRowKey,
  DataGridSelectionMode,
  RevoGridCompatibleSelection,
  RevoGridCompatibleSourceRow,
} from '../types'

import { ZEUS_REVO_ROW_INDEX, ZEUS_REVO_ROW_KEY } from '../types'

export function mapDataGridSelectionToRevoGridSelection(
  selectedKeys: DataGridRowKey[] | undefined,
  rows: RevoGridCompatibleSourceRow[],
  mode: DataGridSelectionMode = 'none',
): RevoGridCompatibleSelection {
  const keySet = new Set(selectedKeys ?? [])
  const rowIndexes =
    mode === 'none'
      ? []
      : rows
          .filter(row => keySet.has(row[ZEUS_REVO_ROW_KEY]))
          .map(row => Number(row[ZEUS_REVO_ROW_INDEX]))

  return {
    mode,
    rowKeys:
      mode === 'none'
        ? []
        : rows
            .filter(row => keySet.has(row[ZEUS_REVO_ROW_KEY]))
            .map(row => row[ZEUS_REVO_ROW_KEY]),
    rowIndexes,
  }
}
