import type {
  DataGridRow,
  DataGridSortDirection,
  DataGridSortState,
  NormalizedDataGridColumn,
} from '../types'

function comparePrimitive(left: unknown, right: unknown): number {
  if (left === right) return 0
  if (left === null || left === undefined) return -1
  if (right === null || right === undefined) return 1

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime()
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right)
  }

  return String(left).localeCompare(String(right))
}

export function createNextDataGridSortState(
  current: DataGridSortState | undefined,
  columnId: string,
  direction?: DataGridSortDirection,
): DataGridSortState | undefined {
  if (direction) {
    return {
      columnId,
      direction,
    }
  }

  if (!current || current.columnId !== columnId) {
    return {
      columnId,
      direction: 'asc',
    }
  }

  if (current.direction === 'asc') {
    return {
      columnId,
      direction: 'desc',
    }
  }

  return undefined
}

export function sortDataGridRows(
  rows: DataGridRow[],
  columns: NormalizedDataGridColumn[],
  sort: DataGridSortState | undefined,
): DataGridRow[] {
  if (!sort) return [...rows]

  const column = columns.find(item => item.id === sort.columnId)

  if (!column || !column.sortable) return [...rows]

  const sign = sort.direction === 'asc' ? 1 : -1

  return [...rows].sort((left, right) => {
    const result = comparePrimitive(
      left.data[column.field],
      right.data[column.field],
    )

    if (result === 0) return left.index - right.index

    return result * sign
  })
}
