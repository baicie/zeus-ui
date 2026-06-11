<script setup lang="ts">
import { Button } from '@zeus-web/button/vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@zeus-web/tooltip/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailOpen, useDemoEventLog } from '../p0/event-utils'

const open = ref(false)
const events = useDemoEventLog()
const sides = ['top', 'right', 'bottom', 'left'] as const

function handleOpenChange(event: unknown) {
  const next = readDetailOpen(event, open.value)
  open.value = next
  events.log('open-change', { open: next })
}
</script>

<template>
  <DemoPage
    eyebrow="Overlay"
    title="Tooltip capability page"
    description="Tests Tooltip trigger/content composition, side placement, controlled open state, delay duration and openChange events."
  >
    <template #meta>
      <span class="showcase-badge">tooltip</span>
      <span class="showcase-badge">@zeus-web/tooltip/vue</span>
    </template>

    <DemoSection title="Basic" description="Hover or focus the trigger.">
      <Tooltip>
        <TooltipTrigger>
          <Button variant="outline">Hover for tooltip</Button>
        </TooltipTrigger>
        <TooltipContent>Helpful context for this action.</TooltipContent>
      </Tooltip>
    </DemoSection>

    <DemoSection title="Sides">
      <DemoGrid :columns="4">
        <Tooltip v-for="side in sides" :key="side" default-open>
          <TooltipTrigger>
            <Button variant="outline">{{ side }}</Button>
          </TooltipTrigger>
          <TooltipContent :side="side" force-mount>
            {{ side }} tooltip
          </TooltipContent>
        </Tooltip>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <Tooltip
          :open="open"
          :delay-duration="0"
          @open-change="handleOpenChange"
        >
          <TooltipTrigger>
            <Button variant="primary">Controlled tooltip</Button>
          </TooltipTrigger>
          <TooltipContent force-mount
            >Controlled tooltip content.</TooltipContent
          >
        </Tooltip>

        <div class="showcase-demo-card">
          <strong>Open</strong>
          <pre class="showcase-code">{{ open }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="2">
        <Tooltip disabled default-open>
          <TooltipTrigger>
            <Button variant="outline">Disabled tooltip</Button>
          </TooltipTrigger>
          <TooltipContent force-mount>
            This should not open from trigger interaction.
          </TooltipContent>
        </Tooltip>

        <Tooltip :delay-duration="800">
          <TooltipTrigger>
            <Button variant="outline">Delayed tooltip</Button>
          </TooltipTrigger>
          <TooltipContent>Opens after 800ms.</TooltipContent>
        </Tooltip>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'open-change',
            reactName: 'onOpenChange',
            vueName: 'open-change',
            description: 'Emitted when tooltip open state changes.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Props">
      <PropTable
        :rows="[
          {
            name: 'open',
            type: 'boolean',
            description: 'Controlled open state.',
          },
          {
            name: 'defaultOpen',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Initial uncontrolled open state.',
          },
          {
            name: 'disabled',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Disables tooltip interaction.',
          },
          {
            name: 'delayDuration',
            type: 'number',
            defaultValue: '300',
            description: 'Delay before opening on hover/focus.',
          },
          {
            name: 'side',
            type: 'top | right | bottom | left',
            defaultValue: 'top',
            description: 'Preferred content side.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['popover', 'popover-foreground', 'border', 'ring']"
      />
    </DemoSection>
  </DemoPage>
</template>
