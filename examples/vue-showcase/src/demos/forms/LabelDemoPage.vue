<script setup lang="ts">
import { Input } from '@zeus-web/input/vue'
import { Label } from '@zeus-web/label/vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'

const propTableRows = [
  {
    name: 'for',
    type: 'string',
    description: 'Associates the label with a form control id.',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    defaultValue: "'md'",
    description: 'Controls label size.',
  },
  {
    name: 'required',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Shows required indicator.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Marks label as disabled.',
  },
  {
    name: 'visuallyHidden',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Keeps label accessible while hiding it visually.',
  },
]
</script>

<template>
  <DemoPage
    eyebrow="Forms"
    title="Label capability page"
    description="Tests Label sizes, required marker, disabled state, visually hidden labels and production form association."
  >
    <template #meta>
      <span class="showcase-badge">label</span>
      <span class="showcase-badge">@zeus-web/label/vue</span>
    </template>

    <DemoSection title="Basic">
      <div class="showcase-demo-card">
        <Label for="vue-label-email">Email</Label>
        <Input id="vue-label-email" placeholder="user@example.com" />
      </div>
    </DemoSection>

    <DemoSection title="Sizes">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Label size="sm" for="vue-label-sm">Small label</Label>
          <Input id="vue-label-sm" size="sm" placeholder="Small field" />
        </div>

        <div class="showcase-demo-card">
          <Label size="md" for="vue-label-md">Medium label</Label>
          <Input id="vue-label-md" size="md" placeholder="Medium field" />
        </div>

        <div class="showcase-demo-card">
          <Label size="lg" for="vue-label-lg">Large label</Label>
          <Input id="vue-label-lg" size="lg" placeholder="Large field" />
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Label required for="vue-label-required">Required field</Label>
          <Input id="vue-label-required" required placeholder="Required" />
        </div>

        <div class="showcase-demo-card">
          <Label disabled for="vue-label-disabled">Disabled field</Label>
          <Input id="vue-label-disabled" disabled placeholder="Disabled" />
        </div>

        <div class="showcase-demo-card">
          <Label visually-hidden for="vue-label-hidden">
            Hidden accessible label
          </Label>
          <Input id="vue-label-hidden" placeholder="Label is visually hidden" />
          <span class="showcase-badge">visually-hidden</span>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Props">
      <PropTable :rows="propTableRows" />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['foreground', 'destructive', 'muted-foreground']"
      />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card showcase-form-stack">
        <div class="showcase-field">
          <Label required for="vue-project-name">Project name</Label>
          <Input id="vue-project-name" placeholder="observability-platform" />
        </div>

        <div class="showcase-field">
          <Label for="vue-project-owner">Owner email</Label>
          <Input id="vue-project-owner" placeholder="owner@example.com" />
        </div>
      </div>
    </DemoSection>
  </DemoPage>
</template>
