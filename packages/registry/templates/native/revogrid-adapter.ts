import type {
  DataGridColumn,
  DataGridRowData,
  RevoGridAdapterElement,
} from '@zeus-web/revogrid-adapter'

import '@zeus-web/revogrid-adapter/wc/auto'

export const revoGridAdapterDemoColumns: DataGridColumn[] = [
  {
    id: 'name',
    header: 'Name',
    field: 'userName',
    width: 180,
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

export const revoGridAdapterDemoRows: DataGridRowData[] = [
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

export interface MountRevoGridAdapterDemoOptions {
  target: HTMLElement
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
}

export function mountRevoGridAdapterDemo(
  options: MountRevoGridAdapterDemoOptions,
): RevoGridAdapterElement {
  const adapter = document.createElement(
    'zw-revogrid-adapter',
  ) as RevoGridAdapterElement

  adapter.rows = options.rows ?? revoGridAdapterDemoRows
  adapter.columns = options.columns ?? revoGridAdapterDemoColumns
  adapter.selectionMode = 'multiple'
  adapter.selectedKeys = ['u2']
  adapter.sortColumn = 'age'
  adapter.sortDirection = 'desc'
  adapter.setAttribute('aria-label', 'RevoGrid adapter demo')

  adapter.addEventListener('adapter-ready', () => {
    // The actual <revo-grid> implementation is expected to be registered by the app.
  })

  options.target.append(adapter)

  return adapter
}
