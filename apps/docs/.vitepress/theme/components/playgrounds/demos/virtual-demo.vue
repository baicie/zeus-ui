<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import { useLocalizedMessages } from '../../../composables/use-docs-locale'

interface VirtualItem {
  index: number
  key: string
  start: number
  size: number
}

interface VirtualListRangeChangeDetail {
  items?: unknown
}

interface VirtualListElement extends HTMLElement {
  componentOnReady?: () => Promise<HTMLElement>
  count?: number
  estimateSize?: number
  overscan?: number
  measure?: () => void | Promise<void>
  scrollToIndex?: (
    index: number,
    align?: 'start' | 'center' | 'end',
  ) => void | Promise<void>
}

interface Activity {
  label: string
  description: string
  priority: string
}

const ui = useLocalizedMessages({
  en: {
    activity: (index: number) => `Activity ${index}`,
    queued: 'Queued workload',
    processing: 'Processing',
    completed: 'Completed',
    priority: 'Priority',
    waiting: 'Waiting for the first visible range.',
    visibleRange: (first: number, last: number, total: number, count: number) =>
      `Visible ${first}–${last} of ${total}; ${count} DOM rows`,
    emptyRange: (total: number) => `No rows visible; 0 of ${total} DOM rows`,
    listLabel: 'Virtualized activity feed',
    controlsLabel: 'Virtual list controls',
    first: 'First',
    middle: 'Middle',
    last: 'Last',
  },
  zh: {
    activity: (index: number) => `活动 ${index}`,
    queued: '任务已排队',
    processing: '处理中',
    completed: '已完成',
    priority: '优先',
    waiting: '正在等待首个可见范围。',
    visibleRange: (first: number, last: number, total: number, count: number) =>
      `显示第 ${first}–${last} 项，共 ${total} 项；DOM 中有 ${count} 行`,
    emptyRange: (total: number) => `没有可见行；DOM 中为 0/${total} 行`,
    listLabel: '虚拟化活动列表',
    controlsLabel: '虚拟列表控制',
    first: '开头',
    middle: '中间',
    last: '末尾',
  },
})

const activities: Activity[] = Array.from({ length: 500 }, (_, index) => ({
  label: ui.value.activity(index + 1),
  description:
    index % 3 === 0
      ? ui.value.queued
      : index % 3 === 1
        ? ui.value.processing
        : ui.value.completed,
  priority: index % 11 === 0 ? ui.value.priority : '',
}))

const virtualList = ref<VirtualListElement | null>(null)
const visibleItems = ref<VirtualItem[]>([])
const rangeLabel = ref(ui.value.waiting)

let activeElement: VirtualListElement | null = null
let measureFrame: number | undefined

function isVirtualItem(value: unknown): value is VirtualItem {
  if (!value || typeof value !== 'object') return false

  const item = value as Partial<VirtualItem>

  return (
    typeof item.index === 'number' &&
    typeof item.key === 'string' &&
    typeof item.start === 'number' &&
    typeof item.size === 'number'
  )
}

function commitVisibleItems(value: unknown): void {
  const nextItems = Array.isArray(value) ? value.filter(isVirtualItem) : []

  visibleItems.value = nextItems.slice()

  const first = nextItems[0]
  const last = nextItems[nextItems.length - 1]

  rangeLabel.value =
    first && last
      ? ui.value.visibleRange(
          first.index + 1,
          last.index + 1,
          activities.length,
          nextItems.length,
        )
      : ui.value.emptyRange(activities.length)
}

function handleRangeChange(event: Event): void {
  const customEvent = event as CustomEvent<VirtualListRangeChangeDetail>
  const detail = customEvent.detail

  commitVisibleItems(detail ? detail.items : undefined)
}

function scheduleMeasure(): void {
  if (measureFrame !== undefined) {
    cancelAnimationFrame(measureFrame)
  }

  measureFrame = requestAnimationFrame(() => {
    measureFrame = undefined

    const element = activeElement

    if (element && typeof element.measure === 'function') {
      element.measure()
    }
  })
}

function configureVirtualList(element: VirtualListElement): void {
  element.count = activities.length
  element.estimateSize = 52
  element.overscan = 4
  element.setAttribute('aria-label', ui.value.listLabel)
  scheduleMeasure()
}

function scrollTo(index: number): void {
  const element = virtualList.value

  if (element && typeof element.scrollToIndex === 'function') {
    element.scrollToIndex(index, 'center')
  }
}

onMounted(() => {
  const element = virtualList.value

  if (!element) return

  activeElement = element
  element.addEventListener('range-change', handleRangeChange)

  if (typeof element.componentOnReady === 'function') {
    element.componentOnReady().then(
      () => configureVirtualList(element),
      () => configureVirtualList(element),
    )
  } else {
    configureVirtualList(element)
  }
})

onUnmounted(() => {
  if (measureFrame !== undefined) {
    cancelAnimationFrame(measureFrame)
    measureFrame = undefined
  }

  if (activeElement) {
    activeElement.removeEventListener('range-change', handleRangeChange)
  }

  activeElement = null
})
</script>

<template>
  <div class="advanced-demo" data-playground-demo="virtual">
    <div class="demo-toolbar" :aria-label="ui.controlsLabel">
      <button type="button" @click="scrollTo(0)">{{ ui.first }}</button>
      <button type="button" @click="scrollTo(249)">{{ ui.middle }}</button>
      <button type="button" @click="scrollTo(499)">{{ ui.last }}</button>
      <span>{{ rangeLabel }}</span>
    </div>

    <zw-virtual-list ref="virtualList">
      <div class="virtual-items">
        <article
          v-for="item in visibleItems"
          :key="item.key"
          class="virtual-row"
          :style="{
            height: `${item.size}px`,
            transform: `translateY(${item.start}px)`,
          }"
        >
          <strong>{{ activities[item.index].label }}</strong>
          <span>{{ activities[item.index].description }}</span>
          <small v-if="activities[item.index].priority">
            {{ activities[item.index].priority }}
          </small>
        </article>
      </div>
    </zw-virtual-list>
  </div>
</template>

<style scoped>
.advanced-demo {
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
  margin-left: auto;
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}

button {
  padding: 0.4rem 0.7rem;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.45rem;
  cursor: pointer;
}

button:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

zw-virtual-list {
  display: block;
}

:deep(zw-virtual-list [data-slot='virtual-list-viewport']) {
  position: relative;
  height: 19rem;
  overflow: auto;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.75rem;
}

:deep(zw-virtual-list [data-slot='virtual-list-spacer']) {
  display: block;
}

:deep(zw-virtual-list [data-slot='virtual-list-items']) {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.virtual-items {
  position: absolute;
  inset: 0;
}

.virtual-row {
  position: absolute;
  top: 0;
  right: 0.5rem;
  left: 0.5rem;
  display: grid;
  grid-template-columns: minmax(7rem, 0.7fr) minmax(10rem, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  box-sizing: border-box;
  padding: 0.5rem 0.75rem;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  border-left: 3px solid var(--vp-c-brand-1);
  border-radius: 0.5rem;
  pointer-events: auto;
}

.virtual-row span {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
}

.virtual-row small {
  padding: 0.125rem 0.45rem;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border-radius: 999px;
  font-weight: 700;
}

@media (max-width: 640px) {
  .demo-toolbar span {
    flex-basis: 100%;
    margin-left: 0;
  }

  .virtual-row {
    grid-template-columns: 1fr auto;
  }

  .virtual-row span {
    display: none;
  }
}
</style>
