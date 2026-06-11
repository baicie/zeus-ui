<script setup lang="ts">
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@zeus-web/accordion/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailValue, useDemoEventLog } from '../p0/event-utils'

const value = ref('metrics')
const events = useDemoEventLog()

function handleValueChange(event: unknown) {
  const next = readDetailValue(event, value.value)
  value.value = next
  events.log('value-change', { value: next })
}
</script>

<template>
  <DemoPage
    eyebrow="Disclosure"
    title="Accordion capability page"
    description="Tests Accordion single and multiple modes, collapsible behavior, controlled value, disabled items and valueChange events."
  >
    <template #meta>
      <span class="showcase-badge">accordion</span>
      <span class="showcase-badge">@zeus-web/accordion/vue</span>
    </template>

    <DemoSection title="Single">
      <Accordion type="single" default-value="overview" collapsible>
        <AccordionItem value="overview">
          <AccordionTrigger>Overview</AccordionTrigger>
          <AccordionContent>
            <div class="showcase-disclosure-panel">
              The overview panel explains high-level usage.
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="usage">
          <AccordionTrigger>Usage</AccordionTrigger>
          <AccordionContent>
            <div class="showcase-disclosure-panel">
              The usage panel explains composition and state.
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </DemoSection>

    <DemoSection title="Multiple">
      <Accordion type="multiple" default-value="logs,traces">
        <AccordionItem value="logs">
          <AccordionTrigger>Logs</AccordionTrigger>
          <AccordionContent>
            <div class="showcase-disclosure-panel">
              Log pipeline is enabled.
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="traces">
          <AccordionTrigger>Traces</AccordionTrigger>
          <AccordionContent>
            <div class="showcase-disclosure-panel">
              Trace sampling is at 20%.
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="metrics">
          <AccordionTrigger>Metrics</AccordionTrigger>
          <AccordionContent>
            <div class="showcase-disclosure-panel">
              Metrics scrape interval is 30s.
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <Accordion
          type="single"
          :value="value"
          collapsible
          @value-change="handleValueChange"
        >
          <AccordionItem value="logs">
            <AccordionTrigger>Logs</AccordionTrigger>
            <AccordionContent>
              <div class="showcase-disclosure-panel">Logs settings</div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="metrics">
            <AccordionTrigger>Metrics</AccordionTrigger>
            <AccordionContent>
              <div class="showcase-disclosure-panel">Metrics settings</div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="disabled" disabled>
            <AccordionTrigger>Disabled</AccordionTrigger>
            <AccordionContent>
              <div class="showcase-disclosure-panel">Disabled content</div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div class="showcase-demo-card">
          <strong>Active value</strong>
          <pre class="showcase-code">{{ value || '(none)' }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Horizontal orientation">
      <Accordion type="single" orientation="horizontal" default-value="one">
        <AccordionItem value="one">
          <AccordionTrigger>One</AccordionTrigger>
          <AccordionContent>
            <div class="showcase-disclosure-panel">Horizontal item one.</div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="two">
          <AccordionTrigger>Two</AccordionTrigger>
          <AccordionContent>
            <div class="showcase-disclosure-panel">Horizontal item two.</div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'value-change',
            reactName: 'onValueChange',
            vueName: 'value-change',
            description: 'Emitted when active accordion item changes.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Props">
      <PropTable
        :rows="[
          {
            name: 'type',
            type: 'single | multiple',
            defaultValue: 'single',
            description: 'Controls whether one or many items can be open.',
          },
          {
            name: 'value',
            type: 'string',
            description:
              'Controlled active value. Multiple values are comma-separated.',
          },
          {
            name: 'defaultValue',
            type: 'string',
            description: 'Initial uncontrolled active value.',
          },
          {
            name: 'collapsible',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Allows the active single item to be collapsed.',
          },
          {
            name: 'orientation',
            type: 'vertical | horizontal',
            defaultValue: 'vertical',
            description: 'Accordion orientation.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['border', 'muted', 'muted-foreground', 'ring']"
      />
    </DemoSection>
  </DemoPage>
</template>
