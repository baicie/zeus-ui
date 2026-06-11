<script setup lang="ts">
import {
  componentRoutes,
  foundationRoutes,
  showcaseComponents,
} from '@zeus-web/example-showcase-shared'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

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
  <aside class="showcase-sidebar" aria-label="Showcase navigation">
    <section class="showcase-sidebar-section">
      <h2 class="showcase-sidebar-title">Overview</h2>
      <nav class="showcase-nav">
        <RouterLink
          v-for="item in foundationRoutes"
          :key="item.path"
          class="showcase-nav-link"
          :data-active="route.path === item.path"
          :to="item.path"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </section>

    <section class="showcase-sidebar-section">
      <h2 class="showcase-sidebar-title">Components</h2>

      <div
        v-for="[group, components] in Object.entries(groupedComponents)"
        :key="group"
        class="showcase-sidebar-section"
      >
        <h3 class="showcase-sidebar-title">{{ group }}</h3>

        <nav class="showcase-nav">
          <RouterLink
            v-for="component in components"
            :key="component.name"
            class="showcase-nav-link"
            :data-active="route.path === component.routePath"
            :to="component.routePath"
          >
            <span>{{ component.title }}</span>
            <span class="showcase-badge">{{ component.name }}</span>
          </RouterLink>
        </nav>
      </div>
    </section>

    <section class="showcase-sidebar-section">
      <h2 class="showcase-sidebar-title">Route count</h2>
      <div class="showcase-card">
        <div class="showcase-card-title">{{ componentRoutes.length }}</div>
        <p class="showcase-card-description">component pages planned</p>
      </div>
    </section>
  </aside>
</template>
