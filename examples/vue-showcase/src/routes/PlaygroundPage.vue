<script setup lang="ts">
const scenarios = [
  {
    title: 'Admin dashboard',
    description: 'Cards, badges, progress, alerts and icons.',
  },
  {
    title: 'Settings form',
    description:
      'Labels, inputs, selects, checkboxes, switches and validation.',
  },
  {
    title: 'Project creation',
    description: 'Dialog, form controls, tooltips and event logs.',
  },
]
</script>

<template>
  <div class="showcase-page">
    <header class="showcase-page-header">
      <p class="showcase-eyebrow">Playground</p>
      <h1 class="showcase-title">Production composition playground</h1>
      <p class="showcase-description">
        This route will host production-like composed scenarios in later phases:
        admin dashboard, settings form and project creation flow.
      </p>
    </header>

    <section class="showcase-grid showcase-grid-3">
      <div
        v-for="scenario in scenarios"
        :key="scenario.title"
        class="showcase-card"
      >
        <h2 class="showcase-card-title">{{ scenario.title }}</h2>
        <p class="showcase-card-description">{{ scenario.description }}</p>
        <span class="showcase-badge">planned</span>
      </div>
    </section>
  </div>
</template>
