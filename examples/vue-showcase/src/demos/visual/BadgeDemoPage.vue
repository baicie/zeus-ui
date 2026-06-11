<script setup lang="ts">
import { Badge } from '@zeus-web/badge/vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'

const variants = [
  'default',
  'secondary',
  'outline',
  'danger',
  'success',
  'warning',
] as const
const sizes = ['sm', 'md', 'lg'] as const

const propTableRows = [
  {
    name: 'variant',
    type: "'default' | 'secondary' | 'outline' | 'danger' | 'success' | 'warning'",
    defaultValue: "'default'",
    description: 'Visual semantic variant.',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    defaultValue: "'md'",
    description: 'Badge size.',
  },
]
</script>

<template>
  <DemoPage
    eyebrow="Feedback"
    title="Badge capability page"
    description="Tests Badge variants, sizes and production status usage."
  >
    <template #meta>
      <span class="showcase-badge">badge</span>
      <span class="showcase-badge">@zeus-web/badge/vue</span>
    </template>

    <DemoSection title="Variants">
      <DemoGrid :columns="3">
        <div
          v-for="variant in variants"
          :key="variant"
          class="showcase-demo-card"
        >
          <Badge :variant="variant">{{ variant }}</Badge>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Sizes">
      <DemoGrid :columns="3">
        <div v-for="size in sizes" :key="size" class="showcase-demo-card">
          <Badge :size="size">{{ size }}</Badge>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card showcase-production-row">
        <Badge variant="success">healthy</Badge>
        <Badge variant="warning">degraded</Badge>
        <Badge variant="danger">incident</Badge>
        <Badge variant="outline">canary</Badge>
      </div>
    </DemoSection>

    <DemoSection title="Props">
      <PropTable :rows="propTableRows" />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['primary', 'secondary', 'destructive', 'border']"
      />
    </DemoSection>
  </DemoPage>
</template>
