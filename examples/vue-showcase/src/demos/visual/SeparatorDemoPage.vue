<script setup lang="ts">
import { Separator } from '@zeus-web/separator/vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'

const propTableRows = [
  {
    name: 'orientation',
    type: '\'horizontal\' | \'vertical\'',
    defaultValue: '\'horizontal\'',
    description: 'Separator direction.',
  },
  {
    name: 'decorative',
    type: 'boolean',
    defaultValue: 'true',
    description: 'Whether the separator is hidden from assistive tech.',
  },
]
</script>

<template>
  <DemoPage
    eyebrow="Layout"
    title="Separator capability page"
    description="Tests horizontal, vertical, decorative and semantic separators."
  >
    <template #meta>
      <span class="showcase-badge">separator</span>
      <span class="showcase-badge">@zeus-web/separator/vue</span>
    </template>

    <DemoSection title="Horizontal">
      <div class="showcase-demo-card">
        <p>Account settings</p>
        <Separator />
        <p class="showcase-form-note">
          Configure billing, members and deployment permissions.
        </p>
      </div>
    </DemoSection>

    <DemoSection title="Vertical">
      <div class="showcase-demo-card showcase-toolbar-row">
        <span>Overview</span>
        <Separator orientation="vertical" />
        <span>Usage</span>
        <Separator orientation="vertical" />
        <span>Settings</span>
      </div>
    </DemoSection>

    <DemoSection title="Semantic separator">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <strong>Decorative</strong>
          <Separator decorative />
        </div>

        <div class="showcase-demo-card">
          <strong>Semantic</strong>
          <Separator :decorative="false" orientation="horizontal" />
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Props">
      <PropTable :rows="propTableRows" />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview :tokens="['border', 'muted-foreground']" />
    </DemoSection>
  </DemoPage>
</template>
