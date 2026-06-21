<script setup lang="ts">
import type {
  DataGridColumn,
  DataGridRowData,
} from '@zeus-web/revogrid-adapter'

import { RevoGridAdapter as RevoGridAdapterPrimitive } from '@zeus-web/revogrid-adapter/vue'

import { computed } from 'vue'

import { cn } from '@/lib/cn'

const props = withDefaults(
  defineProps<{
    class?: string
    rows?: DataGridRowData[]
    columns?: DataGridColumn[]
    selectionMode?: 'none' | 'single' | 'multiple'
    selectedKeys?: string[]
    sortColumn?: string
    sortDirection?: 'asc' | 'desc'
  }>(),
  {
    selectionMode: 'multiple',
    sortColumn: 'age',
    sortDirection: 'desc',
  },
)

const revoGridAdapterDemoColumns: DataGridColumn[] = [
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

const revoGridAdapterDemoRows: DataGridRowData[] = [
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

const adapterClasses = computed(() =>
  cn(
    'block overflow-hidden rounded-md border bg-background text-foreground',
    '[&_[data-slot=revogrid-adapter-grid]]:block',
    '[&_[data-slot=revogrid-adapter-grid]]:min-h-72',
    props.class,
  ),
)

const rows = computed(() => props.rows ?? revoGridAdapterDemoRows)
const columns = computed(() => props.columns ?? revoGridAdapterDemoColumns)
const selectedKeys = computed(() => props.selectedKeys ?? ['u2'])
</script>

<template>
  <RevoGridAdapterPrimitive
    :class="adapterClasses"
    :rows="rows"
    :columns="columns"
    :selection-mode="props.selectionMode"
    :selected-keys="selectedKeys"
    :sort-column="props.sortColumn"
    :sort-direction="props.sortDirection"
    aria-label="RevoGrid adapter"
  />
</template>
