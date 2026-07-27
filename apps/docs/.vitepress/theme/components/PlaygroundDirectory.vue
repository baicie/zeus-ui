<script setup lang="ts">
import { withBase } from 'vitepress'

import { playgroundComponents } from '../../data/playground-manifest'
import { playgroundSources } from '../../data/playground-sources'

function frameworkLabels(name: (typeof playgroundComponents)[number]['name']) {
  const sources = playgroundSources[name]
  const labels: string[] = []

  if (sources.webComponent) labels.push(sources.webComponent.label)
  if (sources.react) labels.push(sources.react.label)
  if (sources.vue) labels.push(sources.vue.label)

  return labels
}
</script>

<template>
  <div class="playground-directory">
    <a
      v-for="component in playgroundComponents"
      :key="component.name"
      class="playground-directory__card"
      :href="withBase(component.route)"
      :data-playground-link="component.name"
    >
      <span class="playground-directory__group">{{ component.group }}</span>
      <strong>{{ component.title }}</strong>
      <span>{{ component.description }}</span>
      <span class="playground-directory__frameworks">
        <small v-for="label in frameworkLabels(component.name)" :key="label">
          {{ label }}
        </small>
      </span>
    </a>
  </div>
</template>
