<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@zeus-web/alert/vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'

const variants = ['default', 'info', 'success', 'warning', 'danger'] as const

const propTableRows = [
  {
    name: 'variant',
    type: '\'default\' | \'info\' | \'success\' | \'warning\' | \'danger\'',
    defaultValue: '\'default\'',
    description: 'Visual semantic alert variant.',
  },
  {
    name: 'live',
    type: '\'polite\' | \'assertive\' | \'off\'',
    defaultValue: '\'polite\'',
    description: 'ARIA live region politeness.',
  },
]
</script>

<template>
  <DemoPage
    eyebrow="Feedback"
    title="Alert capability page"
    description="Tests Alert variants, live region behavior and production incident messaging."
  >
    <template #meta>
      <span class="showcase-badge">alert</span>
      <span class="showcase-badge">@zeus-web/alert/vue</span>
    </template>

    <DemoSection title="Variants">
      <DemoGrid :columns="2">
        <Alert v-for="variant in variants" :key="variant" :variant="variant">
          <AlertTitle>{{ variant }} alert</AlertTitle>
          <AlertDescription>
            This is a {{ variant }} message for operational feedback.
          </AlertDescription>
        </Alert>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Live regions">
      <DemoGrid :columns="3">
        <Alert live="polite" variant="info">
          <AlertTitle>Polite</AlertTitle>
          <AlertDescription> Non-urgent background status. </AlertDescription>
        </Alert>

        <Alert live="assertive" variant="danger">
          <AlertTitle>Assertive</AlertTitle>
          <AlertDescription>
            Important incident notification.
          </AlertDescription>
        </Alert>

        <Alert live="off">
          <AlertTitle>Off</AlertTitle>
          <AlertDescription> Static decorative message. </AlertDescription>
        </Alert>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Production pattern">
      <Alert variant="warning" live="assertive">
        <AlertTitle>Canary degradation detected</AlertTitle>
        <AlertDescription>
          Error rate increased by 2.4% in the last 10 minutes. Check traces
          before promoting.
        </AlertDescription>
      </Alert>
    </DemoSection>

    <DemoSection title="Props">
      <PropTable :rows="propTableRows" />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['background', 'foreground', 'destructive', 'border']"
      />
    </DemoSection>
  </DemoPage>
</template>
