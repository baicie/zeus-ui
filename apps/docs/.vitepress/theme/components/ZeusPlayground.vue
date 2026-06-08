<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type PlaygroundTheme = 'light' | 'dark'
type PlaygroundDensity = 'default' | 'compact' | 'large'

interface EventLog {
  id: number
  name: string
  detail: string
}

const theme = ref<PlaygroundTheme>('light')
const density = ref<PlaygroundDensity>('default')
const inputValue = ref('')
const checked = ref(false)
const switched = ref(false)
const dialogOpen = ref(false)
const logs = ref<EventLog[]>([])
const ready = ref(false)

let logId = 0

const playgroundClass = computed(() => {
  return [
    'zeus-playground',
    `zeus-playground--${theme.value}`,
    `zeus-playground--${density.value}`,
  ]
})

onMounted(async () => {
  await Promise.all([
    import('@zeus-web/button/wc'),
    import('@zeus-web/checkbox/wc'),
    import('@zeus-web/dialog/wc'),
    import('@zeus-web/input/wc'),
    import('@zeus-web/switch/wc'),
    import('@zeus-web/tabs/wc'),
  ])

  ready.value = true
})

function stringifyDetail(detail: unknown): string {
  if (!detail || typeof detail !== 'object') {
    return String(detail ?? '')
  }

  try {
    return JSON.stringify(detail)
  } catch {
    return '[unserializable detail]'
  }
}

function pushLog(name: string, detail: unknown): void {
  logs.value = [
    {
      id: logId++,
      name,
      detail: stringifyDetail(detail),
    },
    ...logs.value,
  ].slice(0, 8)
}

function handlePress(event: Event): void {
  const customEvent = event as CustomEvent
  pushLog('press', customEvent.detail)
}

function handleValueChange(event: Event): void {
  const customEvent = event as CustomEvent<{ value?: string }>
  inputValue.value = customEvent.detail?.value ?? ''
  pushLog('value-change', customEvent.detail)
}

function handleCheckedChange(event: Event): void {
  const customEvent = event as CustomEvent<{ checked?: boolean }>
  checked.value = Boolean(customEvent.detail?.checked)
  pushLog('checked-change', customEvent.detail)
}

function handleSwitchChange(event: Event): void {
  const customEvent = event as CustomEvent<{ checked?: boolean }>
  switched.value = Boolean(customEvent.detail?.checked)
  pushLog('switch checked-change', customEvent.detail)
}

function handleOpenChange(event: Event): void {
  const customEvent = event as CustomEvent<{ open?: boolean }>
  dialogOpen.value = Boolean(customEvent.detail?.open)
  pushLog('open-change', customEvent.detail)
}

function clearLogs(): void {
  logs.value = []
}
</script>

<template>
  <section :class="playgroundClass">
    <div class="zeus-playground__toolbar">
      <div>
        <p class="zeus-playground__eyebrow">Live preview</p>
        <h2>Zeus Web Playground</h2>
      </div>

      <div class="zeus-playground__controls">
        <label>
          Theme
          <select v-model="theme">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <label>
          Density
          <select v-model="density">
            <option value="default">Default</option>
            <option value="compact">Compact</option>
            <option value="large">Large</option>
          </select>
        </label>
      </div>
    </div>

    <p v-if="!ready" class="zeus-playground__loading">
      Loading Zeus Web Components...
    </p>

    <div v-else class="zeus-playground__grid">
      <article class="zeus-playground__card">
        <h3>Button</h3>
        <div class="zeus-playground__row">
          <zw-button variant="primary" @press="handlePress">
            Primary
          </zw-button>
          <zw-button variant="outline" @press="handlePress">
            Outline
          </zw-button>
          <zw-button variant="danger" @press="handlePress"> Danger </zw-button>
        </div>
      </article>

      <article class="zeus-playground__card">
        <h3>Input</h3>
        <zw-input
          placeholder="Email"
          type="email"
          @value-change="handleValueChange"
        />
        <p class="zeus-playground__hint">
          Current value: <code>{{ inputValue || 'empty' }}</code>
        </p>
      </article>

      <article class="zeus-playground__card">
        <h3>Selection</h3>
        <div class="zeus-playground__stack">
          <zw-checkbox @checked-change="handleCheckedChange">
            Accept terms
          </zw-checkbox>
          <zw-switch @checked-change="handleSwitchChange">
            Enable notifications
          </zw-switch>
        </div>
        <p class="zeus-playground__hint">
          Checkbox:
          <code>{{ checked ? 'checked' : 'unchecked' }}</code> &middot; Switch:
          <code>{{ switched ? 'on' : 'off' }}</code>
        </p>
      </article>

      <article class="zeus-playground__card">
        <h3>Tabs</h3>
        <zw-tabs default-value="account">
          <zw-tabs-list>
            <zw-tabs-trigger value="account"> Account </zw-tabs-trigger>
            <zw-tabs-trigger value="password"> Password </zw-tabs-trigger>
          </zw-tabs-list>
          <zw-tabs-content value="account"> Account panel </zw-tabs-content>
          <zw-tabs-content value="password"> Password panel </zw-tabs-content>
        </zw-tabs>
      </article>

      <article class="zeus-playground__card">
        <h3>Dialog</h3>
        <zw-dialog @open-change="handleOpenChange">
          <zw-dialog-trigger>
            <zw-button>Open dialog</zw-button>
          </zw-dialog-trigger>
          <zw-dialog-content>
            <zw-dialog-title>Dialog title</zw-dialog-title>
            <zw-dialog-description>
              This dialog is rendered inside the docs playground.
            </zw-dialog-description>
            <zw-dialog-close>
              <zw-button variant="outline"> Close </zw-button>
            </zw-dialog-close>
          </zw-dialog-content>
        </zw-dialog>
        <p class="zeus-playground__hint">
          Dialog: <code>{{ dialogOpen ? 'open' : 'closed' }}</code>
        </p>
      </article>

      <article class="zeus-playground__card zeus-playground__card--logs">
        <div class="zeus-playground__logs-title">
          <h3>Event log</h3>
          <button type="button" @click="clearLogs">Clear</button>
        </div>

        <ul v-if="logs.length > 0" class="zeus-playground__logs">
          <li v-for="log in logs" :key="log.id">
            <strong>{{ log.name }}</strong>
            <code>{{ log.detail || '{}' }}</code>
          </li>
        </ul>

        <p v-else class="zeus-playground__hint">
          Interact with components to see emitted events.
        </p>
      </article>
    </div>
  </section>
</template>
