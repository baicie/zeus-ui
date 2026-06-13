<script setup lang="ts">
import Button from '@/components/ui/button.vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { useDemoEventLog } from './event-utils'

const events = useDemoEventLog()

// Destructure so records auto-unwraps in template (Vue 3 only unwraps top-level refs)
const records = events.records

const variants = [
  'default',
  'primary',
  'secondary',
  'outline',
  'ghost',
  'danger',
] as const
</script>

<template>
  <DemoPage
    eyebrow="Actions"
    title="Button capability page"
    description="Tests Button variants, sizes, states, icon slots, press events and production usage."
  >
    <template #meta>
      <span class="showcase-badge">button</span>
      <span class="showcase-badge">@/components/ui/button.vue</span>
    </template>

    <DemoSection title="Basic" description="Default button usage.">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <Button @press="events.log('press', 'Default button')">
            Default button
          </Button>
        </div>
        <div class="showcase-demo-card">
          <Button variant="primary" @press="events.log('press', 'Primary CTA')">
            Primary CTA
          </Button>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Variants" description="Semantic visual variants.">
      <DemoGrid :columns="3">
        <div
          v-for="variant in variants"
          :key="variant"
          class="showcase-demo-card"
        >
          <Button :variant="variant" @press="events.log('press', variant)">
            {{ variant }}
          </Button>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Sizes">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Button size="sm">Small</Button>
        </div>
        <div class="showcase-demo-card">
          <Button size="md">Medium</Button>
        </div>
        <div class="showcase-demo-card">
          <Button size="lg">Large</Button>
        </div>
        <div class="showcase-demo-card">
          <Button size="icon" aria-label="Add item">+</Button>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Button disabled>Disabled</Button>
        </div>
        <div class="showcase-demo-card">
          <Button loading>Loading</Button>
        </div>
        <div class="showcase-demo-card">
          <Button pressed>Pressed</Button>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'press',
            reactName: 'onPress',
            vueName: 'press',
            description: 'Emitted when the button is activated.',
          },
        ]"
      />

      <div class="showcase-event-feed">
        <template v-if="records.length === 0">
          <div class="showcase-empty">Click a button to record events.</div>
        </template>

        <div
          v-for="record in records"
          :key="record.id"
          class="showcase-event-record"
        >
          <strong>{{ record.name }}</strong>
          <span v-if="record.detail">{{ record.detail }}</span>
        </div>
      </div>
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="[
          'primary',
          'primary-foreground',
          'ring',
          'border',
          'destructive',
        ]"
      />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card showcase-production-row">
        <Button variant="outline">Cancel</Button>
        <Button variant="primary">Save changes</Button>
        <Button variant="danger">Delete project</Button>
      </div>
    </DemoSection>
  </DemoPage>
</template>
