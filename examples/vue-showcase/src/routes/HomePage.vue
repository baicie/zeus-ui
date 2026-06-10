<script setup lang="ts">
import {
  componentRoutes,
  deferredComponents,
  showcaseComponents,
  showcaseIcons,
  showcaseThemes,
} from '@zeus-web/example-showcase-shared'

import RouteCard from '../app/RouteCard.vue'
</script>

<template>
  <div class="showcase-page">
    <header class="showcase-page-header">
      <p class="showcase-eyebrow">Vue router showcase</p>
      <h1 class="showcase-title">Zeus Web component laboratory</h1>
      <p class="showcase-description">
        A production-grade Vue showcase for validating Zeus Web components,
        route structure, icon metadata, theme tokens and future component pages.
      </p>
    </header>

    <section class="showcase-grid showcase-grid-3">
      <div class="showcase-card">
        <h2 class="showcase-title" style="font-size: 2rem">
          {{ showcaseComponents.length }}
        </h2>
        <p class="showcase-card-description">components planned</p>
      </div>

      <div class="showcase-card">
        <h2 class="showcase-title" style="font-size: 2rem">
          {{ showcaseIcons.length }}
        </h2>
        <p class="showcase-card-description">icons in metadata</p>
      </div>

      <div class="showcase-card">
        <h2 class="showcase-title" style="font-size: 2rem">
          {{ showcaseThemes.length }}
        </h2>
        <p class="showcase-card-description">theme variants</p>
      </div>
    </section>

    <section class="showcase-section">
      <h2 class="showcase-section-title">Start here</h2>

      <div class="showcase-grid showcase-grid-2">
        <RouteCard
          to="/components"
          title="Components"
          description="Browse every planned Vue component page."
          :badge="`${componentRoutes.length} routes`"
        />

        <RouteCard
          to="/icons"
          title="Icons"
          description="Preview icon metadata and planned import patterns."
          :badge="`${showcaseIcons.length} icons`"
        />

        <RouteCard
          to="/themes"
          title="Themes"
          description="Inspect theme variants and semantic token groups."
          :badge="`${showcaseThemes.length} themes`"
        />

        <RouteCard
          to="/playground"
          title="Playground"
          description="Production-like composition scenarios planned for later phases."
          badge="phase 6"
        />
      </div>
    </section>

    <section class="showcase-section">
      <h2 class="showcase-section-title">Deferred overlays</h2>

      <div class="showcase-card">
        <p class="showcase-card-description">
          Overlay primitives are intentionally deferred from the first beta.
        </p>

        <div
          style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem"
        >
          <span
            v-for="name in deferredComponents"
            :key="name"
            class="showcase-badge"
          >
            {{ name }}
          </span>
        </div>
      </div>
    </section>
  </div>
</template>
