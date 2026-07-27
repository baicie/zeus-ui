<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

interface DataGridRow {
  id: string
  metric: string
  owner: string
  status: string
  value: string
  [key: string]: string
}

interface DataGridColumn {
  id: string
  header: string
  field: string
  width: number
  sortable?: boolean
}

interface RevoGridAdapterState {
  columns: Array<Record<string, unknown>>
  source: Array<Record<string, unknown>>
  sort?: Record<string, unknown>
  selection: Record<string, unknown>
}

interface RevoGridAdapterElement extends HTMLElement {
  componentOnReady?: () => Promise<HTMLElement>
  rows?: DataGridRow[]
  columns?: DataGridColumn[]
  selectedKeys?: string[]
  selectionMode?: 'none' | 'single' | 'multiple'
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
  refresh?: () => void | Promise<void>
  getState?: () => RevoGridAdapterState | Promise<RevoGridAdapterState>
  setSelection?: (keys: string[]) => void | Promise<void>
  setSort?: (
    columnId: string,
    direction?: 'asc' | 'desc',
  ) => void | Promise<void>
  clearSort?: () => void | Promise<void>
}

interface AdapterChangeDetail {
  state?: unknown
}

const gridRows: DataGridRow[] = [
  {
    id: 'mrr',
    metric: 'Monthly recurring revenue',
    owner: 'Revenue',
    status: 'Healthy',
    value: '$128k',
  },
  {
    id: 'latency',
    metric: 'P95 latency',
    owner: 'Runtime',
    status: 'Watch',
    value: '182ms',
  },
  {
    id: 'tickets',
    metric: 'Open escalations',
    owner: 'Support',
    status: 'Action',
    value: '7',
  },
]

const gridColumns: DataGridColumn[] = [
  {
    id: 'metric',
    header: 'Metric',
    field: 'metric',
    width: 220,
    sortable: true,
  },
  {
    id: 'owner',
    header: 'Owner',
    field: 'owner',
    width: 140,
    sortable: true,
  },
  {
    id: 'status',
    header: 'Status',
    field: 'status',
    width: 120,
    sortable: true,
  },
  {
    id: 'value',
    header: 'Value',
    field: 'value',
    width: 110,
  },
]

const adapter = ref<RevoGridAdapterElement | null>(null)
const state = ref<RevoGridAdapterState>({
  columns: [],
  source: [],
  selection: {},
})
const note = ref(
  'The adapter maps Zeus rows and columns without bundling RevoGrid itself.',
)
const sortAscending = ref(true)

let activeElement: RevoGridAdapterElement | null = null
let refreshFrame: number | undefined

const stateSummary = computed(() =>
  JSON.stringify(
    {
      sort: state.value.sort,
      selection: state.value.selection,
    },
    null,
    2,
  ),
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function normalizeState(value: unknown): RevoGridAdapterState | undefined {
  if (!isRecord(value)) return undefined

  return {
    columns: normalizeRecordArray(value.columns),
    source: normalizeRecordArray(value.source),
    sort: isRecord(value.sort) ? value.sort : undefined,
    selection: isRecord(value.selection) ? value.selection : {},
  }
}

function commitState(value: unknown): void {
  const nextState = normalizeState(value)

  if (!nextState) return

  state.value = nextState
  note.value = `Mapped ${nextState.source.length} rows and ${nextState.columns.length} columns.`
}

function syncState(): void {
  const element = activeElement

  if (!element || typeof element.getState !== 'function') return

  Promise.resolve(element.getState()).then(
    value => commitState(value),
    () => {
      note.value = 'The adapter state could not be read.'
    },
  )
}

function refreshAdapter(): void {
  const element = activeElement

  if (!element) return

  if (typeof element.refresh === 'function') {
    Promise.resolve(element.refresh()).then(syncState, syncState)
  } else {
    syncState()
  }
}

function scheduleRefresh(): void {
  if (refreshFrame !== undefined) cancelAnimationFrame(refreshFrame)

  refreshFrame = requestAnimationFrame(() => {
    refreshFrame = undefined
    refreshAdapter()
  })
}

function configureAdapter(element: RevoGridAdapterElement): void {
  element.rows = gridRows.slice()
  element.columns = gridColumns.slice()
  element.selectionMode = 'multiple'
  element.selectedKeys = ['tickets']
  element.sortColumn = 'owner'
  element.sortDirection = 'asc'
  element.setAttribute('aria-label', 'RevoGrid adapter mapping demo')
  scheduleRefresh()
}

function handleAdapterChange(event: Event): void {
  const customEvent = event as CustomEvent<AdapterChangeDetail>
  const detail = customEvent.detail

  if (detail) commitState(detail.state)
}

function setOwnerSort(): void {
  const element = activeElement

  if (!element || typeof element.setSort !== 'function') return

  const direction = sortAscending.value ? 'desc' : 'asc'
  sortAscending.value = !sortAscending.value

  Promise.resolve(element.setSort('owner', direction)).then(() => {
    note.value = `Owner sort changed to ${direction}.`
    syncState()
  }, syncState)
}

function selectAttentionRows(): void {
  const element = activeElement

  if (!element || typeof element.setSelection !== 'function') return

  Promise.resolve(element.setSelection(['latency', 'tickets'])).then(() => {
    note.value = 'Selected the rows that need attention.'
    syncState()
  }, syncState)
}

function resetAdapter(): void {
  const element = activeElement

  if (!element) return

  const actions: Array<Promise<void>> = []

  if (typeof element.clearSort === 'function') {
    actions.push(Promise.resolve(element.clearSort()))
  }

  if (typeof element.setSelection === 'function') {
    actions.push(Promise.resolve(element.setSelection([])))
  }

  Promise.all(actions).then(() => {
    note.value = 'Sort and selection cleared.'
    syncState()
  }, syncState)
}

function columnKey(column: Record<string, unknown>, index: number): string {
  if (typeof column.prop === 'string') return column.prop
  if (typeof column.name === 'string') return column.name
  return String(index)
}

function columnLabel(column: Record<string, unknown>): string {
  if (typeof column.name === 'string') return column.name
  if (typeof column.prop === 'string') return column.prop
  return 'Column'
}

function cellValue(
  row: Record<string, unknown>,
  column: Record<string, unknown>,
): string {
  const field = typeof column.prop === 'string' ? column.prop : ''
  const value = field ? row[field] : undefined

  return value === undefined || value === null ? '' : String(value)
}

function rowKey(row: Record<string, unknown>, index: number): string {
  if (typeof row.__zeusRowKey === 'string') return row.__zeusRowKey
  if (typeof row.id === 'string') return row.id
  return String(index)
}

onMounted(() => {
  const element = adapter.value

  if (!element) return

  activeElement = element
  element.addEventListener('adapter-change', handleAdapterChange)

  if (typeof element.componentOnReady === 'function') {
    element.componentOnReady().then(
      () => configureAdapter(element),
      () => configureAdapter(element),
    )
  } else {
    configureAdapter(element)
  }
})

onUnmounted(() => {
  if (refreshFrame !== undefined) {
    cancelAnimationFrame(refreshFrame)
    refreshFrame = undefined
  }

  if (activeElement) {
    activeElement.removeEventListener('adapter-change', handleAdapterChange)
  }

  activeElement = null
})
</script>

<template>
  <div class="advanced-demo" data-playground-demo="revogrid-adapter">
    <div class="demo-toolbar">
      <button type="button" @click="setOwnerSort">Toggle owner sort</button>
      <button type="button" @click="selectAttentionRows">
        Select attention rows
      </button>
      <button type="button" @click="resetAdapter">Reset</button>
      <span aria-live="polite">{{ note }}</span>
    </div>

    <zw-revogrid-adapter ref="adapter" />

    <section class="adapter-preview" aria-label="Mapped RevoGrid state">
      <header>
        <strong>RevoGrid-compatible state</strong>
        <span>
          No third-party grid is bundled; this table renders the adapter output.
        </span>
      </header>

      <div class="adapter-table" role="table">
        <div class="adapter-row adapter-heading" role="row">
          <div
            v-for="(column, columnIndex) in state.columns"
            :key="columnKey(column, columnIndex)"
            role="columnheader"
          >
            {{ columnLabel(column) }}
          </div>
        </div>
        <div
          v-for="(row, rowIndex) in state.source"
          :key="rowKey(row, rowIndex)"
          class="adapter-row"
          role="row"
        >
          <div
            v-for="(column, columnIndex) in state.columns"
            :key="columnKey(column, columnIndex)"
            role="cell"
          >
            {{ cellValue(row, column) }}
          </div>
        </div>
      </div>

      <pre><code>{{ stateSummary }}</code></pre>
    </section>
  </div>
</template>

<style scoped>
.advanced-demo,
.adapter-preview {
  display: grid;
  gap: 0.875rem;
}

.demo-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.demo-toolbar span {
  flex: 1;
  min-width: 15rem;
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
  text-align: right;
}

button {
  padding: 0.4rem 0.7rem;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.45rem;
  cursor: pointer;
}

zw-revogrid-adapter {
  display: none;
}

.adapter-preview {
  padding: 0.875rem;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.75rem;
}

.adapter-preview header {
  display: grid;
  gap: 0.2rem;
}

.adapter-preview header span {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
}

.adapter-table {
  overflow-x: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.55rem;
}

.adapter-row {
  display: grid;
  grid-template-columns: minmax(13rem, 1.4fr) repeat(3, minmax(7rem, 0.8fr));
  min-width: 42rem;
}

.adapter-row + .adapter-row {
  border-top: 1px solid var(--vp-c-divider);
}

.adapter-row > div {
  min-height: 2.5rem;
  padding: 0.55rem 0.65rem;
  border-right: 1px solid var(--vp-c-divider);
  font-size: 0.85rem;
}

.adapter-row > div:last-child {
  border-right: 0;
}

.adapter-heading {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  font-weight: 700;
}

pre {
  margin: 0;
  padding: 0.75rem;
  overflow-x: auto;
  color: var(--vp-c-text-1);
  background: var(--vp-code-block-bg);
  border-radius: 0.55rem;
  font-size: 0.78rem;
}

@media (max-width: 720px) {
  .demo-toolbar span {
    flex-basis: 100%;
    text-align: left;
  }
}
</style>
