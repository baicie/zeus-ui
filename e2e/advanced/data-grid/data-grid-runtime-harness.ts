/* eslint-disable no-restricted-globals */
import type {
  DataGridActiveCellChangeDetail,
  DataGridColumn,
  DataGridColumnResizeDetail,
  DataGridElement,
  DataGridRangeChangeDetail,
  DataGridRowData,
  DataGridSelectionChangeDetail,
  DataGridSortChangeDetail,
} from '../../../packages/advanced/data-grid/src'
import { DataGrid } from '../../../packages/advanced/data-grid/src'

export const runtimeColumns: DataGridColumn[] = [
  {
    id: 'name',
    header: 'Name',
    field: 'name',
    width: 180,
    minWidth: 80,
    maxWidth: 260,
    sortable: true,
  },
  {
    id: 'age',
    header: 'Age',
    field: 'age',
    width: 120,
    minWidth: 64,
    maxWidth: 200,
    sortable: true,
  },
  {
    id: 'role',
    header: 'Role',
    field: 'role',
    width: 160,
    sortable: true,
  },
]

export const runtimeRows: DataGridRowData[] = [
  {
    id: 'u1',
    name: 'Ada Lovelace',
    age: 30,
    role: 'Engineer',
  },
  {
    id: 'u2',
    name: 'Grace Hopper',
    age: 20,
    role: 'Compiler',
  },
  {
    id: 'u3',
    name: 'Alan Turing',
    age: 40,
    role: 'Researcher',
  },
]

export interface MountedDataGridOptions {
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
  virtual?: boolean
  selectionMode?: 'none' | 'single' | 'multiple'
  rowHeight?: number
  overscan?: number
  resizable?: boolean
  keyboardNavigation?: boolean
  selectedKeys?: string[]
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
  activeRowKey?: string
  activeColumnId?: string
}

export interface EventCollector<T> {
  events: CustomEvent<T>[]
  dispose: () => void
}

export function defineDataGridElement(): void {
  if (!customElements.get('zw-data-grid')) {
    customElements.define('zw-data-grid', DataGrid)
  }
}

export async function nextFrame(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()

  await new Promise<void>(resolve => {
    setTimeout(resolve, 0)
  })

  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => resolve())
    })
  }
}

export async function mountDataGrid(
  options: MountedDataGridOptions = {},
): Promise<DataGridElement> {
  defineDataGridElement()

  const grid = document.createElement('zw-data-grid') as DataGridElement

  grid.rows = options.rows ?? runtimeRows
  grid.columns = options.columns ?? runtimeColumns
  grid.rowHeight = options.rowHeight ?? 40
  grid.overscan = options.overscan ?? 2
  grid.virtual = options.virtual ?? false
  grid.selectionMode = options.selectionMode ?? 'multiple'
  grid.resizable = options.resizable ?? true
  grid.keyboardNavigation = options.keyboardNavigation ?? true
  grid.selectedKeys = options.selectedKeys
  grid.sortColumn = options.sortColumn
  grid.sortDirection = options.sortDirection
  grid.activeRowKey = options.activeRowKey
  grid.activeColumnId = options.activeColumnId

  document.body.append(grid)

  await customElements.whenDefined('zw-data-grid')
  await nextFrame()

  return grid
}

export function cleanupDataGridFixtures(): void {
  document.body.innerHTML = ''
}

export function collectEvents<T>(
  target: EventTarget,
  type: string,
): EventCollector<T> {
  const events: CustomEvent<T>[] = []

  const listener = (event: Event) => {
    events.push(event as CustomEvent<T>)
  }

  target.addEventListener(type, listener)

  return {
    events,
    dispose() {
      target.removeEventListener(type, listener)
    },
  }
}

export function getHeaderCell(
  grid: DataGridElement,
  columnId: string,
): HTMLElement {
  const header = grid.querySelector<HTMLElement>(
    `[data-slot="data-grid-header-cell"][data-column-id="${columnId}"]`,
  )

  if (!header) {
    throw new Error(`Header cell not found: ${columnId}`)
  }

  return header
}

export function getCell(
  grid: DataGridElement,
  rowKey: string,
  columnId: string,
): HTMLElement {
  const cell = grid.querySelector<HTMLElement>(
    `[data-slot="data-grid-cell"][data-row-key="${rowKey}"][data-column-id="${columnId}"]`,
  )

  if (!cell) {
    throw new Error(`Cell not found: ${rowKey}/${columnId}`)
  }

  return cell
}

export function click(target: HTMLElement): void {
  target.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      composed: true,
    }),
  )
}

export function keydown(target: HTMLElement, key: string): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      composed: true,
      cancelable: true,
    }),
  )
}

export function setElementClientHeight(
  element: HTMLElement,
  clientHeight: number,
): void {
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: clientHeight,
  })
}

export function getViewport(grid: DataGridElement): HTMLElement {
  const viewport = grid.querySelector<HTMLElement>(
    '[data-slot="data-grid-viewport"]',
  )

  if (!viewport) {
    throw new Error('DataGrid viewport not found')
  }

  return viewport
}

export type {
  DataGridActiveCellChangeDetail,
  DataGridColumnResizeDetail,
  DataGridRangeChangeDetail,
  DataGridSelectionChangeDetail,
  DataGridSortChangeDetail,
}
