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

import { useLocalizedMessages } from '../composables/use-docs-locale'
import { dataGridPlaygroundMessages } from '../data/playground-i18n'

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
const cachedColumns = new Map<string, PlaygroundColumn[]>()

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
const messages = useLocalizedMessages(dataGridPlaygroundMessages)
const statusMessage = ref(messages.value.loadingComponent)

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
    return messages.value.measuringViewport
  }

  return messages.value.windowRange(
    formatNumber(rowRange.start + 1),
    formatNumber(rowRange.end + 1),
    formatNumber(appliedPreset.value.rowCount),
    formatNumber(columnRange.start + 1),
    formatNumber(columnRange.end + 1),
    formatNumber(appliedPreset.value.columnCount),
  )
})

function getPreset(key: DatasetPresetKey): DatasetPreset {
  const preset = presets.find(item => item.key === key)
  if (preset) return preset
  return presets[1]
}

function formatNumber(value: number): string {
  return value.toLocaleString(messages.value.numberLocale)
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
  const cacheKey = `${messages.value.numberLocale}:${columnCount}`
  const existingColumns = cachedColumns.get(cacheKey)
  if (existingColumns) return existingColumns

  const columns = Array.from({ length: columnCount }, (_, columnIndex) => {
    if (columnIndex === 0) {
      return {
        id: 'record',
        header: messages.value.recordHeader,
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
      header: messages.value.metricHeader(columnIndex + 1),
      field: `metric_${(columnIndex - 1) % DATA_FIELD_COUNT}`,
      width: 140,
      minWidth: 88,
      maxWidth: 320,
      sortable: columnIndex < 8,
      resizable: true,
    }
  })

  cachedColumns.set(cacheKey, columns)
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
  statusMessage.value = messages.value.preparingDataset

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
      grid.setAttribute('aria-label', messages.value.gridAriaLabel)

      appliedPresetKey.value = preset.key
      loadDuration.value = readTime() - startTime
      return grid.refreshViewport()
    })
    .then(() => waitForGridLayout(grid))
    .then(() => {
      ready.value = true
      loading.value = false
      statusMessage.value = messages.value.datasetReady(preset.label)
      scheduleMetrics()
    })
    .catch(error => {
      loading.value = false
      errorMessage.value = toErrorMessage(error)
      statusMessage.value = messages.value.datasetFailed
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
      statusMessage.value = messages.value.viewportPosition[position]
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
      statusMessage.value = messages.value.columnWidthsReset
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
    statusMessage.value = messages.value.selectionUpdated
  } else if (event.type === 'sort-change' && detail) {
    statusMessage.value = detail.sort
      ? messages.value.sortUpdated
      : messages.value.sortCleared
  } else if (event.type === 'column-resize-end') {
    statusMessage.value = messages.value.columnWidthUpdated
  } else if (event.type === 'active-cell-change' && detail) {
    statusMessage.value = detail.activeCell
      ? messages.value.activeCellUpdated
      : messages.value.activeCellCleared
  } else if (event.type === 'scroll-offset-change') {
    statusMessage.value = messages.value.viewportMoved
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
      if (!grid) throw new Error(messages.value.componentUnavailable)

      bindGridEvents(grid)
      return grid.componentOnReady()
    })
    .then(() => applySelectedDataset())
    .catch(error => {
      loading.value = false
      errorMessage.value = toErrorMessage(error)
      statusMessage.value = messages.value.componentFailed
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
    <div
      class="data-grid-playground__metrics"
      :aria-label="messages.datasetMetricsLabel"
    >
      <div>
        <span>{{ messages.rows }}</span>
        <strong>{{ formatNumber(appliedPreset.rowCount) }}</strong>
      </div>
      <div>
        <span>{{ messages.columns }}</span>
        <strong>{{ formatNumber(appliedPreset.columnCount) }}</strong>
      </div>
      <div>
        <span>{{ messages.domCells }}</span>
        <strong>{{ formatNumber(renderedCells) }}</strong>
      </div>
      <div>
        <span>{{ messages.dataPreparation }}</span>
        <strong>{{ loadDuration.toFixed(1) }} ms</strong>
      </div>
    </div>

    <div
      class="data-grid-playground__controls"
      :aria-label="messages.controlsLabel"
    >
      <fieldset
        class="data-grid-playground__control data-grid-playground__control--dataset"
      >
        <legend>{{ messages.dataset }}</legend>
        <div class="data-grid-playground__segments">
          <button
            v-for="preset in presets"
            :key="preset.key"
            type="button"
            :data-testid="`data-grid-dataset-${preset.key}`"
            :aria-pressed="selectedPresetKey === preset.key"
            :data-active="selectedPresetKey === preset.key ? '' : undefined"
            :aria-label="messages.selectDataset(preset.label)"
            @click="choosePreset(preset.key)"
          >
            {{ preset.label }}
          </button>
        </div>
      </fieldset>

      <button
        type="button"
        data-testid="data-grid-apply"
        class="data-grid-playground__apply"
        :disabled="loading || selectedPresetKey === appliedPresetKey"
        @click="applySelectedDataset"
      >
        {{ messages.applyData }}
      </button>

      <fieldset class="data-grid-playground__control">
        <legend>{{ messages.rowHeight }}</legend>
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
          >{{ messages.rowOverscan }} <output>{{ rowOverscan }}</output></span
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
          >{{ messages.columnOverscan }}
          <output>{{ columnOverscan }}</output></span
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
        <span>{{ messages.selection }}</span>
        <select v-model="selectionMode" @change="applyRuntimeSettings">
          <option value="none">{{ messages.selectionNone }}</option>
          <option value="single">{{ messages.selectionSingle }}</option>
          <option value="multiple">{{ messages.selectionMultiple }}</option>
        </select>
      </label>

      <label class="data-grid-playground__toggle">
        <input
          v-model="resizable"
          type="checkbox"
          @change="applyRuntimeSettings"
        />
        <span aria-hidden="true" />
        {{ messages.resizable }}
      </label>

      <label class="data-grid-playground__toggle">
        <input
          v-model="keyboardNavigation"
          type="checkbox"
          @change="applyRuntimeSettings"
        />
        <span aria-hidden="true" />
        {{ messages.keyboard }}
      </label>
    </div>

    <div
      class="data-grid-playground__commands"
      :aria-label="messages.viewportCommandsLabel"
    >
      <div class="data-grid-playground__jump-group">
        <button
          type="button"
          :title="messages.jumpFirst"
          :aria-label="messages.jumpFirst"
          :disabled="loading || !ready"
          @click="jumpToPosition('first')"
        >
          <ChevronUpIcon :size="16" aria-hidden="true" />
          {{ messages.first }}
        </button>
        <button
          type="button"
          :title="messages.jumpMiddle"
          :aria-label="messages.jumpMiddle"
          :disabled="loading || !ready"
          @click="jumpToPosition('middle')"
        >
          <span class="data-grid-playground__middle-icon" aria-hidden="true">
            <ChevronRightIcon :size="14" />
            <ChevronDownIcon :size="14" />
          </span>
          {{ messages.middle }}
        </button>
        <button
          type="button"
          data-testid="data-grid-jump-last"
          :title="messages.jumpLast"
          :aria-label="messages.jumpLast"
          :disabled="loading || !ready"
          @click="jumpToPosition('last')"
        >
          <ChevronDownIcon :size="16" aria-hidden="true" />
          {{ messages.last }}
        </button>
      </div>

      <button
        type="button"
        data-testid="data-grid-reset-widths"
        :title="messages.resetColumnWidths"
        :aria-label="messages.resetColumnWidths"
        class="data-grid-playground__reset-widths"
        :disabled="loading || !ready"
        @click="resetColumnWidths"
      >
        <span class="data-grid-playground__width-icon" aria-hidden="true">
          <ChevronLeftIcon :size="14" />
          <ChevronRightIcon :size="14" />
        </span>
        {{ messages.resetWidths }}
      </button>
    </div>

    <p v-if="errorMessage" class="data-grid-playground__error" role="alert">
      {{ errorMessage }}
    </p>

    <div class="data-grid-playground__grid-frame" :aria-busy="loading">
      <div v-if="loading" class="data-grid-playground__loading" role="status">
        {{ messages.preparing(selectedPreset.label) }}
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
        <span>{{ messages.window }}</span>
        {{ windowLabel }}
      </p>
      <p>
        <span>{{ messages.event }}</span>
        {{ statusMessage }}
      </p>
    </footer>
  </section>
</template>
