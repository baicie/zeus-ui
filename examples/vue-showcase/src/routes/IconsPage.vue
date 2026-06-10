<script setup lang="ts">
import { showcaseIcons } from '@zeus-web/example-showcase-shared'
</script>

<template>
  <div class="showcase-page">
    <header class="showcase-page-header">
      <p class="showcase-eyebrow">Foundations</p>
      <h1 class="showcase-title">Icons</h1>
      <p class="showcase-description">
        Icon metadata page. Full visual icon wall and copy actions are planned
        for a later phase.
      </p>
    </header>

    <section class="showcase-grid showcase-grid-3">
      <div v-for="icon in showcaseIcons" :key="icon.name" class="showcase-card">
        <h2 class="showcase-card-title">{{ icon.label }}</h2>
        <p class="showcase-card-description">{{ icon.name }}</p>

        <div
          style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 1rem"
        >
          <span v-for="tag in icon.tags" :key="tag" class="showcase-badge">
            {{ tag }}
          </span>
        </div>
      </div>
    </section>
  </div>
</template>
