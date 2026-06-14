import type {
  DataGridColumn,
  DataGridElement,
  DataGridRowData,
} from '@zeus-web/data-grid'

import '@zeus-web/data-grid/wc/auto'

export const dataGridDemoColumns: DataGridColumn[] = [
  {
    id: 'name',
    header: 'Name',
    field: 'name',
    width: 180,
    sortable: true,
  },
  {
    id: 'role',
    header: 'Role',
    field: 'role',
    width: 160,
    sortable: true,
  },
  {
    id: 'status',
    header: 'Status',
    field: 'status',
    width: 140,
    sortable: true,
  },
]

export const dataGridDemoRows: DataGridRowData[] = [
  {
    id: 'u1',
    name: 'Ada Lovelace',
    role: 'Engineer',
    status: 'Active',
  },
  {
    id: 'u2',
    name: 'Grace Hopper',
    role: 'Compiler',
    status: 'Active',
  },
  {
    id: 'u3',
    name: 'Alan Turing',
    role: 'Researcher',
    status: 'Archived',
  },
]

export function mountDataGridDemo(root: HTMLElement): void {
  root.innerHTML = ''

  const grid = document.createElement('zw-data-grid') as DataGridElement

  grid.columns = dataGridDemoColumns
  grid.rows = dataGridDemoRows
  grid.setAttribute('aria-label', 'Users')
  grid.setAttribute('selection-mode', 'multiple')
  grid.setAttribute('virtual', '')
  grid.setAttribute('row-height', '44')
  grid.setAttribute('overscan', '4')

  grid.addEventListener('selection-change', event => {
    const detail = (event as CustomEvent).detail
    console.info('selection-change', detail.selection)
  })

  grid.addEventListener('sort-change', event => {
    const detail = (event as CustomEvent).detail
    console.info('sort-change', detail.sort)
  })

  grid.addEventListener('row-action', event => {
    const detail = (event as CustomEvent).detail
    console.info('row-action', detail.row)
  })

  root.append(grid)
}
