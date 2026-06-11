<script setup lang="ts">
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@zeus-web/collapsible/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailOpen, useDemoEventLog } from '../p0/event-utils'

const open = ref(true)
const events = useDemoEventLog()

function handleOpenChange(event: unknown) {
  const next = readDetailOpen(event, open.value)
  open.value = next
  events.log('open-change', { open: next })
}
</script>

<template>
  <DemoPage
    eyebrow="Disclosure"
    title="Collapsible capability page"
    description="Tests Collapsible uncontrolled state, controlled open state, disabled trigger, force mounted content and openChange events."
  >
    <template #meta>
      <span class="showcase-badge">collapsible</span>
      <span class="showcase-badge">@zeus-web/collapsible/vue</span>
    </template>

    <DemoSection
      title="Basic"
      description="Uncontrolled collapsible disclosure."
    >
      <Collapsible default-open>
        <CollapsibleTrigger>Toggle release notes</CollapsibleTrigger>
        <CollapsibleContent>
          <div class="showcase-disclosure-panel">
            Canary build includes route shell, component metadata and visual
            demos.
          </div>
        </CollapsibleContent>
      </Collapsible>
    </DemoSection>

    <DemoSection
      title="Controlled"
      description="Open state synchronized with Vue state."
    >
      <DemoGrid :columns="2">
        <Collapsible :open="open" @open-change="handleOpenChange">
          <CollapsibleTrigger>Toggle controlled panel</CollapsibleTrigger>
          <CollapsibleContent>
            <div class="showcase-disclosure-panel">
              Controlled content is {{ open ? 'open' : 'closed' }}.
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div class="showcase-demo-card">
          <strong>Open</strong>
          <pre class="showcase-code">{{ open }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="2">
        <Collapsible disabled default-open>
          <CollapsibleTrigger>Disabled trigger</CollapsibleTrigger>
          <CollapsibleContent>
            <div class="showcase-disclosure-panel">Disabled content</div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible :default-open="false">
          <CollapsibleTrigger>Force mounted content</CollapsibleTrigger>
          <CollapsibleContent force-mount>
            <div class="showcase-disclosure-panel">
              This stays mounted and toggles visibility state.
            </div>
          </CollapsibleContent>
        </Collapsible>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'open-change',
            reactName: 'onOpenChange',
            vueName: 'open-change',
            description: 'Emitted when collapsible open state changes.',
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
            description: 'Disables trigger interaction.',
          },
          {
            name: 'forceMount',
            type: 'boolean',
            defaultValue: 'false',
            description: 'Keeps content mounted when closed.',
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
