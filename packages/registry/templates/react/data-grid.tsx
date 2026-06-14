import type { DataGridColumn, DataGridRowData } from '@zeus-web/data-grid'

import type { ComponentProps } from 'react'
import { DataGrid as DataGridPrimitive } from '@zeus-web/data-grid/react'

import { cn } from '@/lib/cn'

export interface DataGridProps extends ComponentProps<
  typeof DataGridPrimitive
> {
  className?: string
}

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

export function DataGrid({ className, ...props }: DataGridProps) {
  return (
    <DataGridPrimitive
      className={cn(
        'block overflow-hidden rounded-[var(--zeus-radius-md)] border border-[hsl(var(--zeus-border))] bg-[hsl(var(--zeus-background))] text-[hsl(var(--zeus-foreground))]',
        '[&_[data-slot=data-grid-viewport]]:max-h-[360px]',
        '[&_[data-slot=data-grid-viewport]]:overflow-auto',
        '[&_[data-slot=data-grid-header]]:sticky',
        '[&_[data-slot=data-grid-header]]:top-0',
        '[&_[data-slot=data-grid-header]]:z-10',
        '[&_[data-slot=data-grid-header]]:border-b',
        '[&_[data-slot=data-grid-header]]:bg-[hsl(var(--zeus-muted))]',
        '[&_[data-slot=data-grid-header-cell]]:px-3',
        '[&_[data-slot=data-grid-header-cell]]:py-2',
        '[&_[data-slot=data-grid-header-cell]]:text-left',
        '[&_[data-slot=data-grid-header-cell]]:text-sm',
        '[&_[data-slot=data-grid-header-cell]]:font-medium',
        '[&_[data-slot=data-grid-header-cell]]:disabled:cursor-default',
        '[&_[data-slot=data-grid-body]]:relative',
        '[&_[data-slot=data-grid-row]]:border-b',
        '[&_[data-slot=data-grid-row]]:text-sm',
        '[&_[data-slot=data-grid-row][data-selected]]:bg-[hsl(var(--zeus-accent))]',
        '[&_[data-slot=data-grid-cell]]:px-3',
        '[&_[data-slot=data-grid-cell]]:py-2',
        '[&_[data-slot=data-grid-cell]]:truncate',
        className,
      )}
      {...props}
    />
  )
}

export function DataGridDemo() {
  return (
    <DataGrid
      ariaLabel="Users"
      columns={dataGridDemoColumns}
      rows={dataGridDemoRows}
      rowHeight={44}
      overscan={4}
      virtual
      selectionMode="multiple"
    />
  )
}
