<script setup lang="ts">
import { Checkbox } from '@zeus-web/checkbox/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailChecked, useDemoEventLog } from './event-utils'

const checked = ref(true)
const events = useDemoEventLog()

function handleCheckedChange(event: unknown) {
  const next = readDetailChecked(event, checked.value)
  checked.value = next
  events.log('checked-change', { checked: next })
}
</script>

<template>
  <DemoPage
    eyebrow="Forms"
    title="Checkbox capability page"
    description="Tests checked, defaultChecked, indeterminate, disabled, invalid and checkedChange."
  >
    <template #meta>
      <span class="showcase-badge">checkbox</span>
      <span class="showcase-badge">@zeus-web/checkbox/vue</span>
    </template>

    <DemoSection title="Basic">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Checkbox>Accept terms</Checkbox>
        </div>
        <div class="showcase-demo-card">
          <Checkbox default-checked>Default checked</Checkbox>
        </div>
        <div class="showcase-demo-card">
          <Checkbox indeterminate>Indeterminate</Checkbox>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Sizes and states">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Checkbox size="sm">Small</Checkbox>
        </div>
        <div class="showcase-demo-card">
          <Checkbox size="md">Medium</Checkbox>
        </div>
        <div class="showcase-demo-card">
          <Checkbox size="lg">Large</Checkbox>
        </div>
        <div class="showcase-demo-card">
          <Checkbox disabled>Disabled</Checkbox>
        </div>
        <div class="showcase-demo-card">
          <Checkbox invalid>Invalid</Checkbox>
        </div>
        <div class="showcase-demo-card">
          <Checkbox required>Required</Checkbox>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <Checkbox :checked="checked" @checked-change="handleCheckedChange">
            Controlled checkbox
          </Checkbox>
        </div>

        <div class="showcase-demo-card">
          <strong>Checked</strong>
          <pre class="showcase-code">{{ checked }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'checked-change',
            reactName: 'onCheckedChange',
            vueName: 'checked-change',
            description: 'Emitted when checked state changes.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview :tokens="['primary', 'primary-foreground', 'ring']" />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card">
        <Checkbox default-checked>Enable product analytics</Checkbox>
        <Checkbox>Send weekly summary email</Checkbox>
        <Checkbox invalid required>
          I understand this destructive action
        </Checkbox>
      </div>
    </DemoSection>
  </DemoPage>
</template>
