<script setup lang="ts">
import { showcaseComponents } from '@zeus-web/example-showcase-shared'
import { computed } from 'vue'

import RouteCard from '../app/RouteCard.vue'

const groupedComponents = computed(() => {
  return showcaseComponents.reduce<Record<string, typeof showcaseComponents>>(
    (groups, item) => {
      groups[item.group] ??= []
      groups[item.group].push(item)
      return groups
    },
    {},
  )
})
</script>

<template>
  <div class="showcase-page">
    <header class="showcase-page-header">
      <p class="showcase-eyebrow">Components</p>
      <h1 class="showcase-title">Component routes</h1>
      <p class="showcase-description">
        Each route will become a full capability page with variants, states,
        controlled usage, events, theme tokens, accessibility notes and
        production patterns.
      </p>
    </header>

    <div class="showcase-grid">
      <section
        v-for="[group, components] in Object.entries(groupedComponents)"
        :key="group"
        class="showcase-section"
      >
        <h2 class="showcase-section-title">{{ group }}</h2>

        <div class="showcase-grid showcase-grid-2">
          <RouteCard
            v-for="component in components"
            :key="component.name"
            :to="component.routePath"
            :title="component.title"
            :description="component.description"
            :badge="component.name"
          />
        </div>
      </section>
    </div>
  </div>
</template>
