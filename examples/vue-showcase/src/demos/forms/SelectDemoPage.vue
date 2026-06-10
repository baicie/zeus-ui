<script setup lang="ts">
import { Select } from '@zeus-web/select/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

const value = ref('production')
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
  {
    name: 'focus-change',
    reactName: 'onFocusChange',
    vueName: 'focus-change',
    description: 'Emitted when focus state changes.',
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
    name: 'multiple',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Enables multiple selection.',
  },
  {
    name: 'invalid',
    type: 'boolean',
    defaultValue: 'false',
    description: 'Marks select as invalid.',
  },
]
</script>

<template>
  <DemoPage
    eyebrow="Forms"
    title="Select capability page"
    description="Tests Select sizes, disabled/invalid states, controlled value, multiple mode and value/focus events."
  >
    <template #meta>
      <span class="showcase-badge">select</span>
      <span class="showcase-badge">@zeus-web/select/vue</span>
    </template>

    <DemoSection title="Basic">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <Select default-value="staging" aria-label="Environment">
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </Select>
        </div>

        <div class="showcase-demo-card">
          <Select aria-label="Role" default-value="editor">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="owner">Owner</option>
          </Select>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Sizes and states">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Select size="sm" default-value="sm" aria-label="Small select">
            <option value="sm">Small</option>
          </Select>
        </div>

        <div class="showcase-demo-card">
          <Select size="md" default-value="md" aria-label="Medium select">
            <option value="md">Medium</option>
          </Select>
        </div>

        <div class="showcase-demo-card">
          <Select size="lg" default-value="lg" aria-label="Large select">
            <option value="lg">Large</option>
          </Select>
        </div>

        <div class="showcase-demo-card">
          <Select
            disabled
            default-value="disabled"
            aria-label="Disabled select"
          >
            <option value="disabled">Disabled</option>
          </Select>
        </div>

        <div class="showcase-demo-card">
          <Select
            invalid
            aria-errormessage="select-error"
            aria-label="Invalid select"
          >
            <option value="">Choose one</option>
          </Select>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <Select
            :value="value"
            name="vue-controlled-select"
            aria-label="Controlled environment"
            @value-change="handleValueChange"
            @focus-change="events.log('focus-change', $event)"
          >
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </Select>
        </div>

        <div class="showcase-demo-card">
          <strong>Selected</strong>
          <pre class="showcase-code">{{ value }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Multiple">
      <Select multiple aria-label="Multiple select">
        <option value="rum">RUM</option>
        <option value="logs">Logs</option>
        <option value="traces">Traces</option>
        <option value="metrics">Metrics</option>
      </Select>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog :events="eventLogRows" />
    </DemoSection>

    <DemoSection title="Props">
      <PropTable :rows="propTableRows" />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['input', 'ring', 'background', 'foreground']"
      />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card showcase-form-stack">
        <label class="showcase-field">
          <span>Environment</span>
          <Select default-value="production" name="environment">
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </Select>
        </label>

        <label class="showcase-field">
          <span>Owner role</span>
          <Select default-value="owner" name="role">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="owner">Owner</option>
          </Select>
        </label>
      </div>
    </DemoSection>
  </DemoPage>
</template>
