import type {
  DataGridSortDirection,
  DataGridSortState,
  RevoGridCompatibleColumn,
  RevoGridCompatibleSort,
} from '../types'

import { ZEUS_REVO_COLUMN_ID } from '../types'

import { findRevoGridColumnByZeusColumnId } from './column-map'

export function mapDataGridSortToRevoGridSort(
  sort: DataGridSortState | undefined,
  columns: RevoGridCompatibleColumn[],
): RevoGridCompatibleSort | undefined {
  if (!sort) return undefined

  const column = findRevoGridColumnByZeusColumnId(columns, sort.columnId)
  if (!column) return undefined

  return {
    prop: column.prop,
    order: sort.direction,
    [ZEUS_REVO_COLUMN_ID]: sort.columnId,
  }
}

export function mapDataGridSortPropsToRevoGridSort(
  sortColumn: string | undefined,
  sortDirection: DataGridSortDirection | undefined,
  columns: RevoGridCompatibleColumn[],
): RevoGridCompatibleSort | undefined {
  if (!sortColumn || !sortDirection) return undefined

  return mapDataGridSortToRevoGridSort(
    {
      columnId: sortColumn,
      direction: sortDirection,
    },
    columns,
  )
}
