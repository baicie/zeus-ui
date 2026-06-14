<script setup lang="ts">
import type { DataGridColumn, DataGridRowData } from '@zeus-web/data-grid'
import { DataGrid as DataGridPrimitive } from '@zeus-web/data-grid/vue'
import { computed } from 'vue'

import { cn } from '@/lib/cn'

const props = withDefaults(
  defineProps<{
    class?: string
    columns?: DataGridColumn[]
    rows?: DataGridRowData[]
    rowHeight?: number
    overscan?: number
    virtual?: boolean
    selectionMode?: 'none' | 'single' | 'multiple'
    ariaLabel?: string
  }>(),
  {
    class: '',
  },
)

const dataGridDemoColumns: DataGridColumn[] = [
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

const dataGridDemoRows: DataGridRowData[] = [
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

const gridClasses = computed(() =>
  cn(
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
    '[&_[data-slot=data-grid-body]]:relative',
    '[&_[data-slot=data-grid-row]]:border-b',
    '[&_[data-slot=data-grid-row]]:text-sm',
    '[&_[data-slot=data-grid-row][data-selected]]:bg-[hsl(var(--zeus-accent))]',
    '[&_[data-slot=data-grid-cell]]:px-3',
    '[&_[data-slot=data-grid-cell]]:py-2',
    '[&_[data-slot=data-grid-cell]]:truncate',
    props.class,
  ),
)
</script>

<template>
  <DataGridPrimitive
    :class="gridClasses"
    :aria-label="props.ariaLabel"
    :columns="props.columns ?? dataGridDemoColumns"
    :rows="props.rows ?? dataGridDemoRows"
    :row-height="props.rowHeight ?? 44"
    :overscan="props.overscan ?? 4"
    :virtual="props.virtual ?? true"
    :selection-mode="props.selectionMode ?? 'multiple'"
  />
</template>
