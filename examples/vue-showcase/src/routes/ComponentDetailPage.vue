<script setup lang="ts">
import { showcaseComponents } from '@zeus-web/example-showcase-shared'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const componentName = computed(() => {
  const value = route.params.componentName
  return typeof value === 'string' ? value : ''
})

const component = computed(() => {
  return showcaseComponents.find(item => item.name === componentName.value)
})
</script>

<template>
  <div class="showcase-page">
    <div v-if="!component" class="showcase-empty">
      Component "{{ componentName }}" is not part of the current showcase
      metadata.
    </div>

    <template v-else>
      <header class="showcase-page-header">
        <p class="showcase-eyebrow">{{ component.group }}</p>
        <h1 class="showcase-title">{{ component.title }}</h1>
        <p class="showcase-description">{{ component.description }}</p>
      </header>

      <section class="showcase-grid showcase-grid-2">
        <div class="showcase-card">
          <h2 class="showcase-card-title">Package</h2>
          <pre class="showcase-code">{{ component.packageName }}</pre>
        </div>

        <div class="showcase-card">
          <h2 class="showcase-card-title">Registry command</h2>
          <pre class="showcase-code">{{ component.registryCommand }}</pre>
        </div>
      </section>

      <section class="showcase-section">
        <h2 class="showcase-section-title">Imports</h2>

        <div class="showcase-grid">
          <div class="showcase-card">
            <h3 class="showcase-card-title">React</h3>
            <pre class="showcase-code">{{
              component.imports.react || 'Not planned'
            }}</pre>
          </div>

          <div class="showcase-card">
            <h3 class="showcase-card-title">Vue</h3>
            <pre class="showcase-code">{{
              component.imports.vue || 'Not planned'
            }}</pre>
          </div>

          <div class="showcase-card">
            <h3 class="showcase-card-title">Web Component</h3>
            <pre class="showcase-code">{{
              component.imports.webComponent || 'Not planned'
            }}</pre>
          </div>
        </div>
      </section>

      <section class="showcase-section">
        <h2 class="showcase-section-title">Planned sections</h2>

        <div class="showcase-card">
          <ul class="showcase-list">
            <li v-for="section in component.sections" :key="section">
              <span class="showcase-badge">{{ section }}</span>
            </li>
          </ul>
        </div>
      </section>

      <section class="showcase-section">
        <h2 class="showcase-section-title">States</h2>

        <div class="showcase-card">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap">
            <span
              v-for="state in component.states"
              :key="state"
              class="showcase-badge"
            >
              {{ state }}
            </span>
          </div>
        </div>
      </section>

      <section class="showcase-section">
        <h2 class="showcase-section-title">Events</h2>

        <div v-if="component.events.length > 0" class="showcase-grid">
          <div
            v-for="event in component.events"
            :key="event.name"
            class="showcase-card"
          >
            <h3 class="showcase-card-title">{{ event.name }}</h3>
            <p class="showcase-card-description">{{ event.description }}</p>
            <pre class="showcase-code">{{
              [
                event.reactName ? `React: ${event.reactName}` : '',
                event.vueName ? `Vue: ${event.vueName}` : '',
              ]
                .filter(Boolean)
                .join('\n')
            }}</pre>
          </div>
        </div>

        <div v-else class="showcase-empty">No custom events planned.</div>
      </section>

      <section class="showcase-section">
        <h2 class="showcase-section-title">Theme tokens</h2>

        <div class="showcase-card">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap">
            <span
              v-for="token in component.themeTokens"
              :key="token"
              class="showcase-badge"
            >
              {{ token }}
            </span>
          </div>
        </div>
      </section>

      <section class="showcase-section">
        <h2 class="showcase-section-title">Production patterns</h2>

        <div class="showcase-card">
          <ul class="showcase-list">
            <li v-for="pattern in component.productionPatterns" :key="pattern">
              {{ pattern }}
            </li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>
