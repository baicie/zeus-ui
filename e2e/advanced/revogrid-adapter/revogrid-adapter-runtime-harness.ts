/* eslint-disable no-restricted-globals */
import type {
  DataGridColumn,
  DataGridRowData,
  DataGridRowKey,
  DataGridSortDirection,
  RevoGridAdapterChangeDetail,
  RevoGridAdapterReadyDetail,
  RevoGridCompatibleColumn,
  RevoGridCompatibleSort,
  RevoGridCompatibleSourceRow,
  RevoGridElementLike,
} from '../../../packages/advanced/revogrid-adapter/src'

import { RevoGridAdapter } from '../../../packages/advanced/revogrid-adapter/src'

export const adapterRuntimeColumns: DataGridColumn[] = [
  {
    id: 'name',
    header: 'Name',
    field: 'userName',
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

export const adapterRuntimeRows: DataGridRowData[] = [
  {
    id: 'u1',
    userName: 'Ada Lovelace',
    age: 30,
    role: 'Engineer',
  },
  {
    id: 'u2',
    userName: 'Grace Hopper',
    age: 20,
    role: 'Compiler',
  },
  {
    id: 'u3',
    userName: 'Alan Turing',
    age: 40,
    role: 'Researcher',
  },
]

export interface FakeRevoGridElement extends RevoGridElementLike {
  refreshCount: number
  columns?: RevoGridCompatibleColumn[]
  source?: RevoGridCompatibleSourceRow[]
  sorting?: RevoGridCompatibleSort
  selectedRows?: number[]
  readonly?: boolean
  refresh: () => void
}

export interface MountedRevoGridAdapterOptions {
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
  selectedKeys?: DataGridRowKey[]
  selectionMode?: 'none' | 'single' | 'multiple'
  sortColumn?: string
  sortDirection?: DataGridSortDirection
  readonly?: boolean
  includeHiddenColumns?: boolean
  getRowKey?: (row: DataGridRowData, index: number) => DataGridRowKey
  ariaLabel?: string
}

export interface EventCollector<T> {
  events: CustomEvent<T>[]
  dispose: () => void
}

export function defineFakeRevoGridElement(): void {
  if (customElements.get('revo-grid')) return

  class FakeRevoGrid extends HTMLElement implements FakeRevoGridElement {
    refreshCount = 0
    columns?: RevoGridCompatibleColumn[]
    source?: RevoGridCompatibleSourceRow[]
    sorting?: RevoGridCompatibleSort
    selectedRows?: number[]
    readonly?: boolean

    refresh(): void {
      this.refreshCount += 1
    }
  }

  customElements.define('revo-grid', FakeRevoGrid)
}

export function defineRevoGridAdapterElement(): void {
  defineFakeRevoGridElement()

  if (!customElements.get('zw-revogrid-adapter')) {
    customElements.define('zw-revogrid-adapter', RevoGridAdapter)
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

export async function mountRevoGridAdapter(
  options: MountedRevoGridAdapterOptions = {},
) {
  defineRevoGridAdapterElement()

  const adapter = document.createElement(
    'zw-revogrid-adapter',
  ) as HTMLElement & {
    rows?: DataGridRowData[]
    columns?: DataGridColumn[]
    selectedKeys?: DataGridRowKey[]
    selectionMode?: 'none' | 'single' | 'multiple'
    sortColumn?: string
    sortDirection?: DataGridSortDirection
    readonly?: boolean
    includeHiddenColumns?: boolean
    getRowKey?: (row: DataGridRowData, index: number) => DataGridRowKey
    getRevoColumns: () => RevoGridCompatibleColumn[]
    getRevoSource: () => RevoGridCompatibleSourceRow[]
    getRevoSort: () => RevoGridCompatibleSort | undefined
    getRevoSelection: () => {
      mode: 'none' | 'single' | 'multiple'
      rowKeys: DataGridRowKey[]
      rowIndexes: number[]
    }
    getState: () => {
      columns: RevoGridCompatibleColumn[]
      source: RevoGridCompatibleSourceRow[]
      sort: RevoGridCompatibleSort | undefined
      selection: {
        mode: 'none' | 'single' | 'multiple'
        rowKeys: DataGridRowKey[]
        rowIndexes: number[]
      }
    }
    getGridElement: () => FakeRevoGridElement | undefined
    setRows: (rows: DataGridRowData[]) => void
    setColumns: (columns: DataGridColumn[]) => void
    setSelection: (keys: DataGridRowKey[]) => void
    setSort: (columnId: string, direction?: DataGridSortDirection) => void
    clearSort: () => void
    refresh: () => void
  }

  adapter.rows = options.rows ?? adapterRuntimeRows
  adapter.columns = options.columns ?? adapterRuntimeColumns
  adapter.selectedKeys = options.selectedKeys
  adapter.selectionMode = options.selectionMode ?? 'multiple'
  adapter.sortColumn = options.sortColumn
  adapter.sortDirection = options.sortDirection
  adapter.readonly = options.readonly
  adapter.includeHiddenColumns = options.includeHiddenColumns
  adapter.getRowKey = options.getRowKey

  if (options.ariaLabel) {
    adapter.setAttribute('aria-label', options.ariaLabel)
  }

  document.body.append(adapter)

  await customElements.whenDefined('zw-revogrid-adapter')
  await customElements.whenDefined('revo-grid')
  await nextFrame()

  return adapter
}

export function getFakeRevoGrid(adapter: HTMLElement): FakeRevoGridElement {
  const grid = adapter.querySelector<FakeRevoGridElement>('revo-grid')

  if (!grid) {
    throw new Error('Fake revo-grid element not found')
  }

  return grid
}

export function cleanupRevoGridAdapterFixtures(): void {
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

export type { RevoGridAdapterChangeDetail, RevoGridAdapterReadyDetail }
