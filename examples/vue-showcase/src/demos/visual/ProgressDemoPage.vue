<script setup lang="ts">
import { Button } from '@zeus-web/button/vue'
import { Progress } from '@zeus-web/progress/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'

const value = ref(64)

const propTableRows = [
  {
    name: 'value',
    type: 'number',
    description: 'Current determinate progress value.',
  },
  {
    name: 'max',
    type: 'number',
    defaultValue: '100',
    description: 'Maximum progress value.',
  },
  {
    name: 'indeterminate',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Shows loading state without a known value.',
  },
  {
    name: 'label',
    type: 'string',
    description: 'Accessible label for the progressbar.',
  },
]

function decrease() {
  value.value = Math.max(0, value.value - 10)
}

function increase() {
  value.value = Math.min(100, value.value + 10)
}

function progressStyle(percent: number) {
  return {
    '--showcase-progress-value': String(percent),
  }
}
</script>

<template>
  <DemoPage
    eyebrow="Feedback"
    title="Progress capability page"
    description="Tests determinate, indeterminate, max/value clamping and production progress usage."
  >
    <template #meta>
      <span class="showcase-badge">progress</span>
      <span class="showcase-badge">@zeus-web/progress/vue</span>
    </template>

    <DemoSection title="Determinate">
      <DemoGrid :columns="3">
        <Progress
          :value="24"
          label="Upload progress"
          :style="progressStyle(24)"
        />
        <Progress
          :value="64"
          label="Build progress"
          :style="progressStyle(64)"
        />
        <Progress
          :value="100"
          label="Complete progress"
          :style="progressStyle(100)"
        />
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <div class="showcase-demo-card">
        <Progress
          :value="value"
          :max="100"
          label="Controlled progress"
          :style="progressStyle(value)"
        >
          <span class="showcase-progress-label">{{ value }}%</span>
        </Progress>

        <div class="showcase-production-row">
          <Button variant="outline" size="sm" @press="decrease">-10</Button>
          <Button variant="primary" size="sm" @press="increase">+10</Button>
        </div>
      </div>
    </DemoSection>

    <DemoSection title="Indeterminate">
      <Progress indeterminate label="Loading deployment status" />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card">
        <strong>Release rollout</strong>
        <Progress
          :value="72"
          label="Release rollout progress"
          :style="progressStyle(72)"
        >
          <span class="showcase-progress-label"> 72% traffic shifted </span>
        </Progress>
      </div>
    </DemoSection>

    <DemoSection title="Props">
      <PropTable :rows="propTableRows" />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview :tokens="['primary', 'muted', 'ring']" />
    </DemoSection>
  </DemoPage>
</template>
