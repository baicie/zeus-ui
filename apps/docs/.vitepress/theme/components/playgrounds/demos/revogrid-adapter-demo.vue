<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { useLocalizedMessages } from '../../../composables/use-docs-locale'

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

const ui = useLocalizedMessages({
  en: {
    mrr: 'Monthly recurring revenue',
    revenue: 'Revenue',
    healthy: 'Healthy',
    latency: 'P95 latency',
    runtime: 'Runtime',
    watch: 'Watch',
    escalations: 'Open escalations',
    support: 'Support',
    action: 'Action',
    metric: 'Metric',
    owner: 'Owner',
    status: 'Status',
    value: 'Value',
    initialNote:
      'The adapter maps Zeus rows and columns without bundling RevoGrid itself.',
    mapped: (rows: number, columns: number) =>
      `Mapped ${rows} rows and ${columns} columns.`,
    readFailed: 'The adapter state could not be read.',
    adapterLabel: 'RevoGrid adapter mapping demo',
    sortChanged: (direction: string) => `Owner sort changed to ${direction}.`,
    attentionSelected: 'Selected the rows that need attention.',
    cleared: 'Sort and selection cleared.',
    column: 'Column',
    toggleSort: 'Toggle owner sort',
    selectAttention: 'Select attention rows',
    reset: 'Reset',
    previewLabel: 'Mapped RevoGrid state',
    previewTitle: 'RevoGrid-compatible state',
    previewDescription:
      'No third-party grid is bundled; this table renders the adapter output.',
  },
  zh: {
    mrr: '月度经常性收入',
    revenue: '营收',
    healthy: '正常',
    latency: 'P95 延迟',
    runtime: '运行时',
    watch: '关注',
    escalations: '待处理升级',
    support: '支持',
    action: '需处理',
    metric: '指标',
    owner: '负责人',
    status: '状态',
    value: '数值',
    initialNote: '适配器映射 Zeus 行列数据，但不会打包 RevoGrid 本身。',
    mapped: (rows: number, columns: number) =>
      `已映射 ${rows} 行、${columns} 列。`,
    readFailed: '无法读取适配器状态。',
    adapterLabel: 'RevoGrid 适配器映射演示',
    sortChanged: (direction: string) => `负责人排序已切换为 ${direction}。`,
    attentionSelected: '已选中需要关注的行。',
    cleared: '排序和选择已清除。',
    column: '列',
    toggleSort: '切换负责人排序',
    selectAttention: '选择需关注行',
    reset: '重置',
    previewLabel: '映射后的 RevoGrid 状态',
    previewTitle: 'RevoGrid 兼容状态',
    previewDescription: '未打包第三方网格；下表直接渲染适配器输出。',
  },
})

const gridRows: DataGridRow[] = [
  {
    id: 'mrr',
    metric: ui.value.mrr,
    owner: ui.value.revenue,
    status: ui.value.healthy,
    value: '$128k',
  },
  {
    id: 'latency',
    metric: ui.value.latency,
    owner: ui.value.runtime,
    status: ui.value.watch,
    value: '182ms',
  },
  {
    id: 'tickets',
    metric: ui.value.escalations,
    owner: ui.value.support,
    status: ui.value.action,
    value: '7',
  },
]

const gridColumns: DataGridColumn[] = [
  {
    id: 'metric',
    header: ui.value.metric,
    field: 'metric',
    width: 220,
    sortable: true,
  },
  {
    id: 'owner',
    header: ui.value.owner,
    field: 'owner',
    width: 140,
    sortable: true,
  },
  {
    id: 'status',
    header: ui.value.status,
    field: 'status',
    width: 120,
    sortable: true,
  },
  {
    id: 'value',
    header: ui.value.value,
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
const note = ref(ui.value.initialNote)
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
  note.value = ui.value.mapped(
    nextState.source.length,
    nextState.columns.length,
  )
}

function syncState(): void {
  const element = activeElement

  if (!element || typeof element.getState !== 'function') return

  Promise.resolve(element.getState()).then(
    value => commitState(value),
    () => {
      note.value = ui.value.readFailed
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
  element.setAttribute('aria-label', ui.value.adapterLabel)
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
    note.value = ui.value.sortChanged(direction)
    syncState()
  }, syncState)
}

function selectAttentionRows(): void {
  const element = activeElement

  if (!element || typeof element.setSelection !== 'function') return

  Promise.resolve(element.setSelection(['latency', 'tickets'])).then(() => {
    note.value = ui.value.attentionSelected
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
    note.value = ui.value.cleared
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
  return ui.value.column
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
      <button type="button" @click="setOwnerSort">{{ ui.toggleSort }}</button>
      <button type="button" @click="selectAttentionRows">
        {{ ui.selectAttention }}
      </button>
      <button type="button" @click="resetAdapter">{{ ui.reset }}</button>
      <span aria-live="polite">{{ note }}</span>
    </div>

    <zw-revogrid-adapter ref="adapter" />

    <section class="adapter-preview" :aria-label="ui.previewLabel">
      <header>
        <strong>{{ ui.previewTitle }}</strong>
        <span>
          {{ ui.previewDescription }}
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
