import type {
  RevoGridAdapterState,
  RevoGridAdapterStateOptions,
} from '../types'

import { mapDataGridColumnsToRevoGridColumns } from './column-map'
import { mapDataGridRowsToRevoGridSource } from './row-map'
import { mapDataGridSelectionToRevoGridSelection } from './selection-map'
import { mapDataGridSortPropsToRevoGridSort } from './sort-map'

export function createRevoGridAdapterState(
  options: RevoGridAdapterStateOptions = {},
): RevoGridAdapterState {
  const columns = mapDataGridColumnsToRevoGridColumns(options.columns, {
    readonly: options.readonly,
    includeHidden: options.includeHiddenColumns,
  })
  const source = mapDataGridRowsToRevoGridSource(options.rows, {
    getRowKey: options.getRowKey,
  })
  const sort = mapDataGridSortPropsToRevoGridSort(
    options.sortColumn,
    options.sortDirection,
    columns,
  )
  const selection = mapDataGridSelectionToRevoGridSelection(
    options.selectedKeys,
    source,
    options.selectionMode,
  )

  return {
    columns,
    source,
    sort,
    selection,
  }
}
