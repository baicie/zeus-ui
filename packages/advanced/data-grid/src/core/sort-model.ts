import type {
  DataGridSortDirection,
  DataGridSortState,
  NormalizedDataGridColumn,
} from '../types'
import type { DataGridRowCollection, DataGridRowModel } from './row-model'

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

export function sortDataGridRowCollection(
  rows: DataGridRowModel,
  columns: NormalizedDataGridColumn[],
  sort: DataGridSortState | undefined,
): DataGridRowCollection {
  if (!sort) return rows

  const column = columns.find(item => item.id === sort.columnId)
  if (!column || !column.sortable) return rows

  const sign = sort.direction === 'asc' ? 1 : -1
  const order = rows.source.map((_, index) => index)

  order.sort((leftIndex, rightIndex) => {
    const left = rows.source[leftIndex]
    const right = rows.source[rightIndex]
    const result = comparePrimitive(left[column.field], right[column.field])

    if (result !== 0) return result * sign

    return leftIndex - rightIndex
  })

  const indexBySource: number[] = []
  order.forEach((sourceIndex, index) => {
    indexBySource[sourceIndex] = index
  })

  return {
    length: order.length,

    getRow(index) {
      return rows.getRow(order[index])
    },

    getKey(index) {
      return rows.getKey(order[index])
    },

    getIndexByKey(key) {
      return indexBySource[rows.getIndexByKey(key)!]
    },
  }
}
