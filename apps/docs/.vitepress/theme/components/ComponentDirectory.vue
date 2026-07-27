<script setup lang="ts">
import type {
  ComponentCategory,
  ComponentName,
} from '../../data/component-catalog'

import { withBase } from 'vitepress'

import {
  componentCatalog,
  componentCategories,
} from '../../data/component-catalog'
import { playgroundSources } from '../../data/playground-sources'

function componentsInCategory(category: ComponentCategory) {
  return componentCatalog.filter(component => component.category === category)
}

function frameworkLabels(name: ComponentName) {
  const sources = playgroundSources[name]
  const labels: string[] = []

  if (sources.webComponent) labels.push(sources.webComponent.label)
  if (sources.react) labels.push(sources.react.label)
  if (sources.vue) labels.push(sources.vue.label)

  return labels
}
</script>

<template>
  <div class="component-directory">
    <section
      v-for="category in componentCategories"
      :key="category.id"
      class="component-directory__section"
      :data-component-category="category.id"
    >
      <header class="component-directory__header">
        <h2>{{ category.label }}</h2>
        <p>{{ category.description }}</p>
      </header>

      <div class="component-directory__grid">
        <a
          v-for="component in componentsInCategory(category.id)"
          :key="component.name"
          class="component-directory__card"
          :href="withBase(component.route)"
          :data-component-link="component.name"
        >
          <span class="component-directory__package">
            {{ component.packageName }}
          </span>
          <strong>{{ component.title }}</strong>
          <span>{{ component.description }}</span>
          <span class="component-directory__frameworks">
            <small
              v-for="label in frameworkLabels(component.name)"
              :key="label"
            >
              {{ label }}
            </small>
          </span>
        </a>
      </div>
    </section>
  </div>
</template>
