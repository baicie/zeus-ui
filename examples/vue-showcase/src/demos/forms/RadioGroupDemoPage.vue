<script setup lang="ts">
import { RadioGroup, RadioGroupItem } from '@zeus-web/radio-group/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

const value = ref('weekly')
const events = useDemoEventLog()

function handleValueChange(event: unknown) {
  const next = readDetailValue(event, value.value)
  value.value = next
  events.log('value-change', { value: next })
}

const eventLogRows = [
  {
    name: 'value-change',
    reactName: 'onValueChange',
    vueName: 'value-change',
    description: 'Emitted when selected value changes.',
  },
]

const propTableRows = [
  {
    name: 'value',
    type: 'string',
    description: 'Controlled selected value.',
  },
  {
    name: 'defaultValue',
    type: 'string',
    description: 'Initial uncontrolled value.',
  },
  {
    name: 'orientation',
    type: "'horizontal' | 'vertical'",
    defaultValue: "'vertical'",
    description: 'Radio group layout direction.',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    defaultValue: "'md'",
    description: 'Radio item size.',
  },
]
</script>

<template>
  <DemoPage
    eyebrow="Forms"
    title="Radio Group capability page"
    description="Tests RadioGroup orientation, sizes, controlled value, disabled items and valueChange events."
  >
    <template #meta>
      <span class="showcase-badge">radio-group</span>
      <span class="showcase-badge">@zeus-web/radio-group/vue</span>
    </template>

    <DemoSection title="Basic">
      <RadioGroup default-value="daily" aria-label="Notification frequency">
        <RadioGroupItem value="daily">Daily</RadioGroupItem>
        <RadioGroupItem value="weekly">Weekly</RadioGroupItem>
        <RadioGroupItem value="monthly">Monthly</RadioGroupItem>
      </RadioGroup>
    </DemoSection>

    <DemoSection title="Orientation and sizes">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <strong>Horizontal</strong>
          <RadioGroup orientation="horizontal" default-value="staging">
            <RadioGroupItem value="dev">Dev</RadioGroupItem>
            <RadioGroupItem value="staging">Staging</RadioGroupItem>
            <RadioGroupItem value="prod">Prod</RadioGroupItem>
          </RadioGroup>
        </div>

        <div class="showcase-demo-card">
          <strong>Large</strong>
          <RadioGroup size="lg" default-value="owner">
            <RadioGroupItem value="viewer">Viewer</RadioGroupItem>
            <RadioGroupItem value="editor">Editor</RadioGroupItem>
            <RadioGroupItem value="owner">Owner</RadioGroupItem>
          </RadioGroup>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="2">
        <RadioGroup disabled default-value="disabled">
          <RadioGroupItem value="disabled">Disabled group</RadioGroupItem>
          <RadioGroupItem value="other">Other</RadioGroupItem>
        </RadioGroup>

        <RadioGroup invalid required default-value="required">
          <RadioGroupItem value="required">Required invalid</RadioGroupItem>
          <RadioGroupItem value="other">Other</RadioGroupItem>
        </RadioGroup>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <RadioGroup
          :value="value"
          name="vue-controlled-radio"
          @value-change="handleValueChange"
        >
          <RadioGroupItem value="daily">Daily</RadioGroupItem>
          <RadioGroupItem value="weekly">Weekly</RadioGroupItem>
          <RadioGroupItem value="monthly">Monthly</RadioGroupItem>
        </RadioGroup>

        <div class="showcase-demo-card">
          <strong>Selected</strong>
          <pre class="showcase-code">{{ value }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog :events="eventLogRows" />
    </DemoSection>

    <DemoSection title="Props">
      <PropTable :rows="propTableRows" />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview :tokens="['primary', 'ring', 'muted-foreground']" />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card">
        <strong>Deployment strategy</strong>
        <RadioGroup default-value="rolling" name="deployment-strategy">
          <RadioGroupItem value="rolling"> Rolling deployment </RadioGroupItem>
          <RadioGroupItem value="blue-green">
            Blue/green deployment
          </RadioGroupItem>
          <RadioGroupItem value="canary">Canary deployment</RadioGroupItem>
        </RadioGroup>
      </div>
    </DemoSection>
  </DemoPage>
</template>
