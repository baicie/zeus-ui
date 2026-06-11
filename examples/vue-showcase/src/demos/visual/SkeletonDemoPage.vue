<script setup lang="ts">
import { Skeleton } from '@zeus-web/skeleton/vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'

const propTableRows = [
  {
    name: 'variant',
    type: "'text' | 'rect' | 'circle'",
    defaultValue: "'rect'",
    description: 'Skeleton shape variant.',
  },
  {
    name: 'animated',
    type: 'boolean',
    defaultValue: 'true',
    description: 'Enables loading animation.',
  },
]
</script>

<template>
  <DemoPage
    eyebrow="Feedback"
    title="Skeleton capability page"
    description="Tests Skeleton variants, animation toggle and loading-card composition."
  >
    <template #meta>
      <span class="showcase-badge">skeleton</span>
      <span class="showcase-badge">@zeus-web/skeleton/vue</span>
    </template>

    <DemoSection title="Variants">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Skeleton variant="text" />
          <Skeleton variant="text" />
          <Skeleton variant="text" />
        </div>

        <div class="showcase-demo-card">
          <Skeleton variant="rect" />
        </div>

        <div class="showcase-demo-card">
          <Skeleton variant="circle" />
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Animation">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <strong>Animated</strong>
          <Skeleton animated variant="rect" />
        </div>

        <div class="showcase-demo-card">
          <strong>Static</strong>
          <Skeleton :animated="false" variant="rect" />
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card">
        <div class="showcase-loading-row">
          <Skeleton variant="circle" />
          <div class="showcase-loading-stack">
            <Skeleton variant="text" />
            <Skeleton variant="text" />
          </div>
        </div>
        <Skeleton variant="rect" />
      </div>
    </DemoSection>

    <DemoSection title="Props">
      <PropTable :rows="propTableRows" />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview :tokens="['muted', 'muted-foreground']" />
    </DemoSection>
  </DemoPage>
</template>
