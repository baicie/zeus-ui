<script setup lang="ts">
import type { DataGridElement } from '@zeus-web/data-grid/wc'

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from '@zeus-web/icons/vue'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
} from 'vue'

type DatasetPresetKey = '10k-20' | '100k-100' | '100k-1000'
type PlaygroundSelectionMode = 'none' | 'single' | 'multiple'

interface DatasetPreset {
  key: DatasetPresetKey
  label: string
  rowCount: number
  columnCount: number
}

interface PlaygroundRow {
  [key: string]: unknown
  id: string
  record: number
}

interface PlaygroundColumn {
  id: string
  header: string
  field: string
  width: number
  minWidth: number
  maxWidth: number
  sortable: boolean
  resizable: boolean
}

interface IndexRange {
  start: number
  end: number
}

interface EventDetailRecord {
  activeCell?: unknown
  selection?: unknown
  sort?: unknown
}

const DATA_FIELD_COUNT = 8
const presets: DatasetPreset[] = [
  {
    key: '10k-20',
    label: '10k x 20',
    rowCount: 10_000,
    columnCount: 20,
  },
  {
    key: '100k-100',
    label: '100k x 100',
    rowCount: 100_000,
    columnCount: 100,
  },
  {
    key: '100k-1000',
    label: '100k x 1000',
    rowCount: 100_000,
    columnCount: 1_000,
  },
]
const rowHeightOptions = [32, 40, 48]
const gridEventNames = [
  'range-change',
  'scroll-offset-change',
  'selection-change',
  'sort-change',
  'column-resize-end',
  'active-cell-change',
]

let cachedRows: PlaygroundRow[] = []
const cachedColumns = new Map<number, PlaygroundColumn[]>()

const gridRef = shallowRef<DataGridElement | null>(null)
const selectedPresetKey = ref<DatasetPresetKey>('10k-20')
const appliedPresetKey = ref<DatasetPresetKey>('10k-20')
const rowHeight = ref(40)
const rowOverscan = ref(4)
const columnOverscan = ref(2)
const selectionMode = ref<PlaygroundSelectionMode>('multiple')
const resizable = ref(true)
const keyboardNavigation = ref(true)
const ready = ref(false)
const loading = ref(true)
const errorMessage = ref('')
const loadDuration = ref(0)
const renderedCells = ref(0)
const visibleRows = ref<IndexRange>({ start: 0, end: -1 })
const visibleColumns = ref<IndexRange>({ start: 0, end: -1 })
const statusMessage = ref('Loading component')

let metricsFrame: number | undefined
let settingsFrame: number | undefined
let metricsRequestId = 0

const selectedPreset = computed(() => {
  return getPreset(selectedPresetKey.value)
})

const appliedPreset = computed(() => {
  return getPreset(appliedPresetKey.value)
})

const gridStyle = computed(() => {
  const style: Record<string, string> = {}
  style['--data-grid-playground-row-height'] = `${rowHeight.value}px`
  return style
})

const windowLabel = computed(() => {
  const rowRange = visibleRows.value
  const columnRange = visibleColumns.value

  if (rowRange.end < rowRange.start || columnRange.end < columnRange.start) {
    return 'Measuring viewport'
  }

  return `Rows ${formatNumber(rowRange.start + 1)}-${formatNumber(
    rowRange.end + 1,
  )} of ${formatNumber(appliedPreset.value.rowCount)} | Columns ${formatNumber(
    columnRange.start + 1,
  )}-${formatNumber(columnRange.end + 1)} of ${formatNumber(
    appliedPreset.value.columnCount,
  )}`
})

function getPreset(key: DatasetPresetKey): DatasetPreset {
  const preset = presets.find(item => item.key === key)
  if (preset) return preset
  return presets[1]
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

function readTime(): number {
  if (globalThis.performance) {
    return globalThis.performance.now()
  }

  return Date.now()
}

function createRows(rowCount: number): PlaygroundRow[] {
  if (cachedRows.length < rowCount) {
    const nextRows = cachedRows.slice()

    for (let rowIndex = cachedRows.length; rowIndex < rowCount; rowIndex += 1) {
      const row: PlaygroundRow = {
        id: `row-${rowIndex + 1}`,
        record: rowIndex + 1,
      }

      for (let fieldIndex = 0; fieldIndex < DATA_FIELD_COUNT; fieldIndex += 1) {
        row[`metric_${fieldIndex}`] =
          fieldIndex % 2 === 0
            ? (rowIndex + 1) * (fieldIndex + 1)
            : `R${rowIndex + 1} / M${fieldIndex + 1}`
      }

      nextRows.push(row)
    }

    cachedRows = nextRows
  }

  if (cachedRows.length === rowCount) return cachedRows
  return cachedRows.slice(0, rowCount)
}

function createColumns(columnCount: number): PlaygroundColumn[] {
  const existingColumns = cachedColumns.get(columnCount)
  if (existingColumns) return existingColumns

  const columns = Array.from({ length: columnCount }, (_, columnIndex) => {
    if (columnIndex === 0) {
      return {
        id: 'record',
        header: 'Record',
        field: 'record',
        width: 120,
        minWidth: 88,
        maxWidth: 280,
        sortable: true,
        resizable: true,
      }
    }

    return {
      id: `column-${columnIndex + 1}`,
      header: `Metric ${columnIndex + 1}`,
      field: `metric_${(columnIndex - 1) % DATA_FIELD_COUNT}`,
      width: 140,
      minWidth: 88,
      maxWidth: 320,
      sortable: columnIndex < 8,
      resizable: true,
    }
  })

  cachedColumns.set(columnCount, columns)
  return columns
}

function nextAnimationFrame(): Promise<void> {
  return new Promise(resolve => {
    globalThis.requestAnimationFrame(() => resolve())
  })
}

function waitForViewportLayout(
  grid: DataGridElement,
  totalHeight: number,
  totalWidth: number,
  remainingFrames: number,
): Promise<void> {
  const viewport = grid.querySelector<HTMLElement>(
    '[data-slot="data-grid-viewport"]',
  )
  const heightReady = Boolean(
    viewport && viewport.scrollHeight >= Math.floor(totalHeight),
  )
  const widthReady = Boolean(
    viewport && viewport.scrollWidth >= Math.floor(totalWidth),
  )

  if (heightReady && widthReady) return Promise.resolve()

  if (remainingFrames <= 0) {
    return Promise.reject(
      new Error('Data Grid viewport layout did not settle.'),
    )
  }

  return nextAnimationFrame()
    .then(() => grid.refreshViewport())
    .then(() => nextAnimationFrame())
    .then(() =>
      waitForViewportLayout(grid, totalHeight, totalWidth, remainingFrames - 1),
    )
}

function waitForGridLayout(grid: DataGridElement): Promise<void> {
  return Promise.all([grid.getTotalSize(), grid.getTotalColumnSize()]).then(
    sizes => waitForViewportLayout(grid, sizes[0], sizes[1], 12),
  )
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function readItemIndex(item: unknown): number | undefined {
  if (!item || typeof item !== 'object') return undefined

  const index = (item as { index?: unknown }).index
  return typeof index === 'number' ? index : undefined
}

function readIndexRange(items: unknown[]): IndexRange {
  let start = Number.POSITIVE_INFINITY
  let end = Number.NEGATIVE_INFINITY

  for (const item of items) {
    const index = readItemIndex(item)
    if (index === undefined) continue
    start = Math.min(start, index)
    end = Math.max(end, index)
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { start: 0, end: -1 }
  }

  return { start, end }
}

function readMetrics(): void {
  const grid = gridRef.value
  if (!grid || !ready.value) return

  const requestId = ++metricsRequestId

  Promise.all([grid.getItems(), grid.getColumnItems()])
    .then(results => {
      if (requestId !== metricsRequestId) return

      visibleRows.value = readIndexRange(results[0])
      visibleColumns.value = readIndexRange(results[1])
      renderedCells.value = grid.querySelectorAll(
        '[data-slot="data-grid-cell"]',
      ).length
    })
    .catch(error => {
      errorMessage.value = toErrorMessage(error)
    })
}

function scheduleMetrics(): void {
  if (metricsFrame !== undefined) return

  metricsFrame = globalThis.requestAnimationFrame(() => {
    metricsFrame = undefined
    readMetrics()
  })
}

function applyRuntimeSettings(): void {
  if (settingsFrame !== undefined) return

  settingsFrame = globalThis.requestAnimationFrame(() => {
    settingsFrame = undefined

    const grid = gridRef.value
    if (!grid || !ready.value) return

    grid.rowHeight = rowHeight.value
    grid.overscan = rowOverscan.value
    grid.overscanColumns = columnOverscan.value
    grid.selectionMode = selectionMode.value
    grid.resizable = resizable.value
    grid.keyboardNavigation = keyboardNavigation.value

    Promise.resolve(grid.refreshViewport())
      .then(() => nextAnimationFrame())
      .then(() => scheduleMetrics())
      .catch(error => {
        errorMessage.value = toErrorMessage(error)
      })
  })
}

function chooseRowHeight(value: number): void {
  rowHeight.value = value
  applyRuntimeSettings()
}

function choosePreset(key: DatasetPresetKey): void {
  selectedPresetKey.value = key
}

function applySelectedDataset(): Promise<void> {
  const grid = gridRef.value
  if (!grid) return Promise.resolve()

  const preset = selectedPreset.value
  loading.value = true
  errorMessage.value = ''
  statusMessage.value = 'Preparing dataset'

  return nextAnimationFrame()
    .then(() => {
      const startTime = readTime()
      const rows = createRows(preset.rowCount)
      const columns = createColumns(preset.columnCount)

      grid.virtual = true
      grid.rowHeight = rowHeight.value
      grid.overscan = rowOverscan.value
      grid.overscanColumns = columnOverscan.value
      grid.selectionMode = selectionMode.value
      grid.resizable = resizable.value
      grid.keyboardNavigation = keyboardNavigation.value
      grid.rows = rows
      grid.columns = columns
      grid.selectedKeys = ['row-2']
      grid.activeRowKey = 'row-1'
      grid.activeColumnId = 'record'
      grid.setAttribute('aria-label', 'High performance data grid playground')

      appliedPresetKey.value = preset.key
      loadDuration.value = readTime() - startTime
      return grid.refreshViewport()
    })
    .then(() => waitForGridLayout(grid))
    .then(() => {
      ready.value = true
      loading.value = false
      statusMessage.value = `${preset.label} ready`
      scheduleMetrics()
    })
    .catch(error => {
      loading.value = false
      errorMessage.value = toErrorMessage(error)
      statusMessage.value = 'Dataset failed to load'
    })
}

function jumpToPosition(position: 'first' | 'middle' | 'last'): void {
  const grid = gridRef.value
  if (!grid || !ready.value) return

  const preset = appliedPreset.value
  let rowIndex = 0
  let columnIndex = 0
  let align: 'start' | 'center' | 'end' = 'start'

  if (position === 'middle') {
    rowIndex = Math.floor(preset.rowCount / 2)
    columnIndex = Math.floor(preset.columnCount / 2)
    align = 'center'
  }

  if (position === 'last') {
    rowIndex = preset.rowCount - 1
    columnIndex = preset.columnCount - 1
    align = 'end'
  }

  Promise.resolve(grid.scrollToColumn(columnIndex, align))
    .then(() => nextAnimationFrame())
    .then(() => grid.scrollToIndex(rowIndex, align))
    .then(() => nextAnimationFrame())
    .then(() => {
      statusMessage.value = `${position} viewport`
      readMetrics()
    })
    .catch(error => {
      errorMessage.value = toErrorMessage(error)
    })
}

function resetColumnWidths(): void {
  const grid = gridRef.value
  if (!grid || !ready.value) return

  Promise.resolve(grid.resetColumnWidths())
    .then(() => nextAnimationFrame())
    .then(() => {
      statusMessage.value = 'Column widths reset'
      scheduleMetrics()
    })
    .catch(error => {
      errorMessage.value = toErrorMessage(error)
    })
}

function readEventDetail(event: Event): EventDetailRecord | undefined {
  if (!(event instanceof CustomEvent)) return undefined
  if (!event.detail || typeof event.detail !== 'object') return undefined
  return event.detail as EventDetailRecord
}

function handleGridEvent(event: Event): void {
  const detail = readEventDetail(event)

  if (event.type === 'selection-change' && detail && detail.selection) {
    statusMessage.value = 'Selection updated'
  } else if (event.type === 'sort-change' && detail) {
    statusMessage.value = detail.sort ? 'Sort updated' : 'Sort cleared'
  } else if (event.type === 'column-resize-end') {
    statusMessage.value = 'Column width updated'
  } else if (event.type === 'active-cell-change' && detail) {
    statusMessage.value = detail.activeCell
      ? 'Active cell updated'
      : 'Active cell cleared'
  } else if (event.type === 'scroll-offset-change') {
    statusMessage.value = 'Viewport moved'
  }

  scheduleMetrics()
}

function bindGridEvents(grid: DataGridElement): void {
  for (const eventName of gridEventNames) {
    grid.addEventListener(eventName, handleGridEvent)
  }
}

function unbindGridEvents(grid: DataGridElement): void {
  for (const eventName of gridEventNames) {
    grid.removeEventListener(eventName, handleGridEvent)
  }
}

onMounted(() => {
  import('@zeus-web/data-grid/wc/auto')
    .then(() => nextTick())
    .then(() => {
      const grid = gridRef.value
      if (!grid) throw new Error('Data Grid element is unavailable.')

      bindGridEvents(grid)
      return grid.componentOnReady()
    })
    .then(() => applySelectedDataset())
    .catch(error => {
      loading.value = false
      errorMessage.value = toErrorMessage(error)
      statusMessage.value = 'Component failed to load'
    })
})

onBeforeUnmount(() => {
  if (metricsFrame !== undefined) {
    globalThis.cancelAnimationFrame(metricsFrame)
  }

  if (settingsFrame !== undefined) {
    globalThis.cancelAnimationFrame(settingsFrame)
  }

  const grid = gridRef.value
  if (grid) unbindGridEvents(grid)
})
</script>

<template>
  <section class="data-grid-playground" :style="gridStyle">
    <div class="data-grid-playground__metrics" aria-label="Dataset metrics">
      <div>
        <span>Rows</span>
        <strong>{{ formatNumber(appliedPreset.rowCount) }}</strong>
      </div>
      <div>
        <span>Columns</span>
        <strong>{{ formatNumber(appliedPreset.columnCount) }}</strong>
      </div>
      <div>
        <span>DOM cells</span>
        <strong>{{ formatNumber(renderedCells) }}</strong>
      </div>
      <div>
        <span>Data prep</span>
        <strong>{{ loadDuration.toFixed(1) }} ms</strong>
      </div>
    </div>

    <div class="data-grid-playground__controls" aria-label="Grid controls">
      <fieldset
        class="data-grid-playground__control data-grid-playground__control--dataset"
      >
        <legend>Dataset</legend>
        <div class="data-grid-playground__segments">
          <button
            v-for="preset in presets"
            :key="preset.key"
            type="button"
            :aria-pressed="selectedPresetKey === preset.key"
            :data-active="selectedPresetKey === preset.key ? '' : undefined"
            :aria-label="`Select ${preset.label}`"
            @click="choosePreset(preset.key)"
          >
            {{ preset.label }}
          </button>
        </div>
      </fieldset>

      <button
        type="button"
        class="data-grid-playground__apply"
        :disabled="loading || selectedPresetKey === appliedPresetKey"
        @click="applySelectedDataset"
      >
        Apply data
      </button>

      <fieldset class="data-grid-playground__control">
        <legend>Row height</legend>
        <div class="data-grid-playground__segments">
          <button
            v-for="height in rowHeightOptions"
            :key="height"
            type="button"
            :aria-pressed="rowHeight === height"
            :data-active="rowHeight === height ? '' : undefined"
            @click="chooseRowHeight(height)"
          >
            {{ height }}
          </button>
        </div>
      </fieldset>

      <label
        class="data-grid-playground__control data-grid-playground__control--slider"
      >
        <span
          >Row overscan <output>{{ rowOverscan }}</output></span
        >
        <input
          v-model.number="rowOverscan"
          type="range"
          min="0"
          max="8"
          step="1"
          @input="applyRuntimeSettings"
        />
      </label>

      <label
        class="data-grid-playground__control data-grid-playground__control--slider"
      >
        <span
          >Column overscan <output>{{ columnOverscan }}</output></span
        >
        <input
          v-model.number="columnOverscan"
          type="range"
          min="0"
          max="4"
          step="1"
          @input="applyRuntimeSettings"
        />
      </label>

      <label
        class="data-grid-playground__control data-grid-playground__control--select"
      >
        <span>Selection</span>
        <select v-model="selectionMode" @change="applyRuntimeSettings">
          <option value="none">None</option>
          <option value="single">Single</option>
          <option value="multiple">Multiple</option>
        </select>
      </label>

      <label class="data-grid-playground__toggle">
        <input
          v-model="resizable"
          type="checkbox"
          @change="applyRuntimeSettings"
        />
        <span aria-hidden="true" />
        Resizable
      </label>

      <label class="data-grid-playground__toggle">
        <input
          v-model="keyboardNavigation"
          type="checkbox"
          @change="applyRuntimeSettings"
        />
        <span aria-hidden="true" />
        Keyboard
      </label>
    </div>

    <div class="data-grid-playground__commands" aria-label="Viewport commands">
      <div class="data-grid-playground__jump-group">
        <button
          type="button"
          title="Jump to first row and column"
          aria-label="Jump to first row and column"
          :disabled="loading || !ready"
          @click="jumpToPosition('first')"
        >
          <ChevronUpIcon :size="16" aria-hidden="true" />
          First
        </button>
        <button
          type="button"
          title="Jump to middle row and column"
          aria-label="Jump to middle row and column"
          :disabled="loading || !ready"
          @click="jumpToPosition('middle')"
        >
          <span class="data-grid-playground__middle-icon" aria-hidden="true">
            <ChevronRightIcon :size="14" />
            <ChevronDownIcon :size="14" />
          </span>
          Middle
        </button>
        <button
          type="button"
          title="Jump to last row and column"
          aria-label="Jump to last row and column"
          :disabled="loading || !ready"
          @click="jumpToPosition('last')"
        >
          <ChevronDownIcon :size="16" aria-hidden="true" />
          Last
        </button>
      </div>

      <button
        type="button"
        title="Reset column widths"
        class="data-grid-playground__reset-widths"
        :disabled="loading || !ready"
        @click="resetColumnWidths"
      >
        <span class="data-grid-playground__width-icon" aria-hidden="true">
          <ChevronLeftIcon :size="14" />
          <ChevronRightIcon :size="14" />
        </span>
        Reset widths
      </button>
    </div>

    <p v-if="errorMessage" class="data-grid-playground__error" role="alert">
      {{ errorMessage }}
    </p>

    <div class="data-grid-playground__grid-frame" :aria-busy="loading">
      <div v-if="loading" class="data-grid-playground__loading" role="status">
        Preparing {{ selectedPreset.label }}
      </div>
      <zw-data-grid
        ref="gridRef"
        data-testid="data-grid-playground-grid"
        :data-row-count="appliedPreset.rowCount"
        :data-column-count="appliedPreset.columnCount"
        class="data-grid-playground__grid"
      />
    </div>

    <footer class="data-grid-playground__status">
      <p data-testid="data-grid-playground-window">
        <span>Window</span>
        {{ windowLabel }}
      </p>
      <p>
        <span>Event</span>
        {{ statusMessage }}
      </p>
    </footer>
  </section>
</template>
