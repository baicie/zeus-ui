<script setup lang="ts">
import type { Component } from 'vue'

import type { ComponentName } from '../../data/component-catalog'

import { computed, defineAsyncComponent, onMounted, ref } from 'vue'

import { findComponentCatalogItem } from '../../data/component-catalog'

type PlaygroundDensity = 'compact' | 'default' | 'large'
type PlaygroundTheme = 'light' | 'dark'

interface DemoModule {
  default: Component
}

type ComponentLoader = () => Promise<unknown>
type DemoLoader = () => Promise<DemoModule>

const props = defineProps<{
  name: ComponentName
}>()

const componentLoaders: Record<ComponentName, ComponentLoader> = Object.assign(
  {
    button: () => import('@zeus-web/button/wc/auto'),
    input: () => import('@zeus-web/input/wc/auto'),
    checkbox: () => import('@zeus-web/checkbox/wc/auto'),
    switch: () => import('@zeus-web/switch/wc/auto'),
    tabs: () => import('@zeus-web/tabs/wc/auto'),
    dialog: () => import('@zeus-web/dialog/wc/auto'),
    label: () => import('@zeus-web/label/wc/auto'),
    textarea: () => import('@zeus-web/textarea/wc/auto'),
    select: () => import('@zeus-web/select/wc/auto'),
    card: () => import('@zeus-web/card/wc/auto'),
    badge: () => import('@zeus-web/badge/wc/auto'),
    separator: () => import('@zeus-web/separator/wc/auto'),
    skeleton: () => import('@zeus-web/skeleton/wc/auto'),
    alert: () => import('@zeus-web/alert/wc/auto'),
    collapsible: () => import('@zeus-web/collapsible/wc/auto'),
    accordion: () => import('@zeus-web/accordion/wc/auto'),
    tooltip: () => import('@zeus-web/tooltip/wc/auto'),
    progress: () => import('@zeus-web/progress/wc/auto'),
    avatar: () => import('@zeus-web/avatar/wc/auto'),
    chat: () => import('@zeus-web/chat/wc/auto'),
    virtual: () => import('@zeus-web/virtual/wc/auto'),
  },
  {
    'radio-group': () => import('@zeus-web/radio-group/wc/auto'),
    'agent-console': () => import('@zeus-web/agent-console/wc/auto'),
    'data-grid': () => import('@zeus-web/data-grid/wc/auto'),
    'revogrid-adapter': () => import('@zeus-web/revogrid-adapter/wc/auto'),
  },
)

const demoLoaders: Partial<Record<ComponentName, DemoLoader>> = Object.assign(
  {
    button: () => import('./playgrounds/demos/button-demo.vue'),
    input: () => import('./playgrounds/demos/input-demo.vue'),
    checkbox: () => import('./playgrounds/demos/checkbox-demo.vue'),
    switch: () => import('./playgrounds/demos/switch-demo.vue'),
    tabs: () => import('./playgrounds/demos/tabs-demo.vue'),
    dialog: () => import('./playgrounds/demos/dialog-demo.vue'),
    label: () => import('./playgrounds/demos/label-demo.vue'),
    textarea: () => import('./playgrounds/demos/textarea-demo.vue'),
    select: () => import('./playgrounds/demos/select-demo.vue'),
    card: () => import('./playgrounds/demos/card-demo.vue'),
    badge: () => import('./playgrounds/demos/badge-demo.vue'),
    separator: () => import('./playgrounds/demos/separator-demo.vue'),
    skeleton: () => import('./playgrounds/demos/skeleton-demo.vue'),
    alert: () => import('./playgrounds/demos/alert-demo.vue'),
    collapsible: () => import('./playgrounds/demos/collapsible-demo.vue'),
    accordion: () => import('./playgrounds/demos/accordion-demo.vue'),
    tooltip: () => import('./playgrounds/demos/tooltip-demo.vue'),
    progress: () => import('./playgrounds/demos/progress-demo.vue'),
    avatar: () => import('./playgrounds/demos/avatar-demo.vue'),
    chat: () => import('./playgrounds/demos/chat-demo.vue'),
    virtual: () => import('./playgrounds/demos/virtual-demo.vue'),
  },
  {
    'radio-group': () => import('./playgrounds/demos/radio-group-demo.vue'),
    'agent-console': () => import('./playgrounds/demos/agent-console-demo.vue'),
    'revogrid-adapter': () =>
      import('./playgrounds/demos/revogrid-adapter-demo.vue'),
  },
)

const ready = ref(false)
const errorMessage = ref('')
const density = ref<PlaygroundDensity>('default')
const theme = ref<PlaygroundTheme>('light')

const definition = computed(() => {
  return findComponentCatalogItem(props.name)
})

const playgroundClass = computed(() => {
  return [
    'zeus-playground',
    'component-playground',
    `zeus-playground--${theme.value}`,
    `zeus-playground--${density.value}`,
    `component-playground--${theme.value}`,
    `component-playground--${density.value}`,
  ]
})

const demo = computed<Component | undefined>(() => {
  const loader = demoLoaders[props.name]
  if (!loader) return undefined

  return defineAsyncComponent(loader)
})

onMounted(() => {
  const loader = componentLoaders[props.name]
  const currentDefinition = definition.value
  const currentDemo = demo.value

  if (!loader || !currentDefinition || !currentDemo) {
    errorMessage.value = `No Playground is registered for "${props.name}".`
    return
  }

  loader().then(
    () => {
      ready.value = true
    },
    error => {
      errorMessage.value =
        error instanceof Error
          ? error.message
          : `Unable to load ${currentDefinition.title}.`
    },
  )
})
</script>

<template>
  <section
    :class="playgroundClass"
    :data-playground="name"
    :data-ready="ready ? 'true' : 'false'"
  >
    <header class="component-playground__toolbar zeus-playground__toolbar">
      <div>
        <p class="component-playground__eyebrow zeus-playground__eyebrow">
          Live Web Component preview
        </p>
        <h2>{{ definition ? definition.title : name }}</h2>
      </div>

      <div class="component-playground__controls zeus-playground__controls">
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
            <option value="compact">Compact</option>
            <option value="default">Default</option>
            <option value="large">Large</option>
          </select>
        </label>
      </div>
    </header>

    <p v-if="errorMessage" class="component-playground__error">
      {{ errorMessage }}
    </p>

    <p
      v-else-if="!ready"
      class="component-playground__loading zeus-playground__loading"
    >
      Loading {{ definition ? definition.title : name }}...
    </p>

    <div v-else class="component-playground__preview">
      <component :is="demo" />
    </div>
  </section>
</template>
