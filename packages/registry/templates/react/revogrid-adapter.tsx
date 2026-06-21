import type {
  DataGridColumn,
  DataGridRowData,
} from '@zeus-web/revogrid-adapter'

import type { ComponentProps } from 'react'

import { RevoGridAdapter as RevoGridAdapterPrimitive } from '@zeus-web/revogrid-adapter/react'

import { cn } from '@/lib/cn'

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

export interface RevoGridAdapterProps extends ComponentProps<
  typeof RevoGridAdapterPrimitive
> {
  className?: string
}

export function RevoGridAdapter({
  className,
  rows = revoGridAdapterDemoRows,
  columns = revoGridAdapterDemoColumns,
  selectionMode = 'multiple',
  selectedKeys = ['u2'],
  sortColumn = 'age',
  sortDirection = 'desc',
  ...props
}: RevoGridAdapterProps) {
  return (
    <RevoGridAdapterPrimitive
      className={cn(
        'block overflow-hidden rounded-md border bg-background text-foreground',
        '[&_[data-slot=revogrid-adapter-grid]]:block',
        '[&_[data-slot=revogrid-adapter-grid]]:min-h-72',
        className,
      )}
      rows={rows}
      columns={columns}
      selectionMode={selectionMode}
      selectedKeys={selectedKeys}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      ariaLabel="RevoGrid adapter"
      {...props}
    />
  )
}

export function RevoGridAdapterDemo() {
  return <RevoGridAdapter />
}
