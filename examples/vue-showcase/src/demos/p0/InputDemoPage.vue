<script setup lang="ts">
import { Input } from '@zeus-web/input/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailValue, useDemoEventLog } from './event-utils'

const value = ref('zeus')
const events = useDemoEventLog()

function handleValueChange(event: unknown) {
  const next = readDetailValue(event, value.value)
  value.value = next
  events.log('value-change', { value: next })
}
</script>

<template>
  <DemoPage
    eyebrow="Forms"
    title="Input capability page"
    description="Tests Input types, sizes, controlled value, formatter, focus events and validation states."
  >
    <template #meta>
      <span class="showcase-badge">input</span>
      <span class="showcase-badge">@zeus-web/input/vue</span>
    </template>

    <DemoSection title="Basic">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <Input placeholder="Email address" type="email" />
        </div>
        <div class="showcase-demo-card">
          <Input default-value="Default value" />
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Types and sizes">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Input size="sm" placeholder="Small search" type="search" />
        </div>
        <div class="showcase-demo-card">
          <Input size="md" placeholder="Medium email" type="email" />
        </div>
        <div class="showcase-demo-card">
          <Input size="lg" placeholder="Large password" type="password" />
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Input disabled placeholder="Disabled" />
        </div>
        <div class="showcase-demo-card">
          <Input readonly value="Readonly" />
        </div>
        <div class="showcase-demo-card">
          <Input
            invalid
            aria-errormessage="input-error"
            placeholder="Invalid"
          />
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <Input
            :value="value"
            placeholder="Controlled input"
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
      <Input
        placeholder="Uppercase formatter"
        :formatter="(input: string) => input.toUpperCase()"
        @value-change="
          events.log('formatted-value-change', {
            value: readDetailValue($event),
          })
        "
      />
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'value-change',
            reactName: 'onValueChange',
            vueName: 'value-change',
            description: 'Emitted when input value changes.',
          },
          {
            name: 'focus-change',
            reactName: 'onFocusChange',
            vueName: 'focus-change',
            description: 'Emitted when focus state changes.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['input', 'ring', 'muted-foreground', 'destructive']"
      />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card">
        <label class="showcase-field">
          <span>Project name</span>
          <Input placeholder="observability-platform" required />
        </label>

        <label class="showcase-field">
          <span>Search members</span>
          <Input placeholder="Search by email" type="search" />
        </label>
      </div>
    </DemoSection>
  </DemoPage>
</template>
