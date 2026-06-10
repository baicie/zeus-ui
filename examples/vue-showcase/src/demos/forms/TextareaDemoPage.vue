<script setup lang="ts">
import { Textarea } from '@zeus-web/textarea/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

const value = ref('Initial deployment note')
const events = useDemoEventLog()

function handleValueChange(event: unknown) {
  const next = readDetailValue(event, value.value)
  value.value = next
  events.log('value-change', { value: next })
}

function uppercaseFormatter(input: string) {
  return input.toUpperCase()
}

function handleFormattedValueChange(event: unknown) {
  events.log('formatted-value-change', {
    value: readDetailValue(event),
  })
}

const eventLogRows = [
  {
    name: 'value-change',
    reactName: 'onValueChange',
    vueName: 'value-change',
    description: 'Emitted when textarea value changes.',
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
    description: 'Controlled textarea value.',
  },
  {
    name: 'defaultValue',
    type: 'string',
    description: 'Initial uncontrolled value.',
  },
  {
    name: 'resize',
    type: '\'none\' | \'vertical\' | \'horizontal\' | \'both\'',
    defaultValue: '\'vertical\'',
    description: 'Textarea resize behavior.',
  },
  {
    name: 'formatter',
    type: '(value: string) => string',
    description: 'Formats text before emitting value-change.',
  },
]
</script>

<template>
  <DemoPage
    eyebrow="Forms"
    title="Textarea capability page"
    description="Tests Textarea sizes, resize modes, controlled value, formatter, validation and value/focus events."
  >
    <template #meta>
      <span class="showcase-badge">textarea</span>
      <span class="showcase-badge">@zeus-web/textarea/vue</span>
    </template>

    <DemoSection title="Basic">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <Textarea placeholder="Write a message..." :rows="4" />
        </div>
        <div class="showcase-demo-card">
          <Textarea default-value="Default value" :rows="4" />
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Sizes and resize">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Textarea size="sm" resize="none" placeholder="Small / no resize" />
        </div>
        <div class="showcase-demo-card">
          <Textarea
            size="md"
            resize="vertical"
            placeholder="Medium / vertical"
          />
        </div>
        <div class="showcase-demo-card">
          <Textarea size="lg" resize="both" placeholder="Large / both" />
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Textarea disabled placeholder="Disabled" />
        </div>
        <div class="showcase-demo-card">
          <Textarea readonly value="Readonly" />
        </div>
        <div class="showcase-demo-card">
          <Textarea
            invalid
            aria-errormessage="textarea-error"
            placeholder="Invalid"
          />
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <Textarea
            :value="value"
            :rows="5"
            placeholder="Controlled textarea"
            @value-change="handleValueChange"
            @focus-change="events.log('focus-change', $event)"
          />
        </div>

        <div class="showcase-demo-card">
          <strong>Current value</strong>
          <pre class="showcase-code">{{ value }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Formatter">
      <Textarea
        placeholder="Uppercase formatter"
        :formatter="uppercaseFormatter"
        @value-change="handleFormattedValueChange"
      />
    </DemoSection>

    <DemoSection title="Events">
      <EventLog :events="eventLogRows" />
    </DemoSection>

    <DemoSection title="Props">
      <PropTable :rows="propTableRows" />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['input', 'ring', 'muted-foreground', 'destructive']"
      />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card showcase-form-stack">
        <Textarea
          :rows="5"
          :maxlength="240"
          placeholder="Describe the release risk and rollback plan..."
        />
        <span class="showcase-form-note">
          Max 240 characters. Include rollback plan.
        </span>
      </div>
    </DemoSection>
  </DemoPage>
</template>
