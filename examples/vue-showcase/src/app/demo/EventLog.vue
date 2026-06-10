<script setup lang="ts">
import type { ShowcaseEventSpec } from '@zeus-web/example-showcase-shared'

defineProps<{
  events: ShowcaseEventSpec[]
}>()

function formatEvent(event: ShowcaseEventSpec): string {
  return [
    event.reactName ? `React: ${event.reactName}` : '',
    event.vueName ? `Vue: ${event.vueName}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
</script>

<template>
  <div v-if="events.length === 0" class="showcase-empty">
    No custom events planned.
  </div>

  <div v-else class="showcase-demo-grid showcase-demo-grid-2">
    <div v-for="event in events" :key="event.name" class="showcase-card">
      <h3 class="showcase-card-title">{{ event.name }}</h3>
      <p class="showcase-card-description">{{ event.description }}</p>
      <pre class="showcase-code">{{ formatEvent(event) }}</pre>
    </div>
  </div>
</template>
