<script setup lang="ts">
import { showcaseComponents } from '@zeus-web/example-showcase-shared'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import ComponentPageScaffold from '../app/demo/ComponentPageScaffold.vue'
import { p0VueDemoPages } from '../demos/p0'

const route = useRoute()

const componentName = computed(() => {
  const value = route.params.componentName
  return typeof value === 'string' ? value : ''
})

const component = computed(() => {
  return showcaseComponents.find(item => item.name === componentName.value)
})

const P0DemoPage = computed(() => {
  return component.value ? p0VueDemoPages[component.value.name] : undefined
})
</script>

<template>
  <div v-if="!component" class="showcase-page">
    <div class="showcase-empty">
      Component &quot;{{ componentName }}&quot; is not part of the current
      showcase metadata.
    </div>
  </div>

  <component :is="P0DemoPage" v-else-if="P0DemoPage" />

  <ComponentPageScaffold v-else :component="component" />
</template>
