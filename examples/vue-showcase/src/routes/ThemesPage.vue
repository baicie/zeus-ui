<script setup lang="ts">
import {
  semanticTokens,
  showcaseThemes,
} from '@zeus-web/example-showcase-shared'
</script>

<template>
  <div class="showcase-page">
    <header class="showcase-page-header">
      <p class="showcase-eyebrow">Foundations</p>
      <h1 class="showcase-title">Themes</h1>
      <p class="showcase-description">
        Theme variants and semantic token groups. Interactive theme switching is
        planned for a later phase.
      </p>
    </header>

    <section class="showcase-section">
      <h2 class="showcase-section-title">Theme variants</h2>

      <div class="showcase-grid showcase-grid-3">
        <div
          v-for="theme in showcaseThemes"
          :key="theme.name"
          class="showcase-card"
        >
          <h2 class="showcase-card-title">{{ theme.label }}</h2>
          <p class="showcase-card-description">{{ theme.description }}</p>
          <pre class="showcase-code">{{ theme.cssImport }}</pre>
        </div>
      </div>
    </section>

    <section class="showcase-section">
      <h2 class="showcase-section-title">Semantic tokens</h2>

      <div class="showcase-grid showcase-grid-3">
        <div v-for="token in semanticTokens" :key="token" class="showcase-card">
          <span class="showcase-badge">{{ token }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
