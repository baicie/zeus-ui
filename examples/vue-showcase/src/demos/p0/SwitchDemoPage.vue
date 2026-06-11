<script setup lang="ts">
import { Switch } from '@zeus-web/switch/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailChecked, useDemoEventLog } from './event-utils'

const checked = ref(false)
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
    title="Switch capability page"
    description="Tests switch on/off states, sizes, controlled usage and checkedChange events."
  >
    <template #meta>
      <span class="showcase-badge">switch</span>
      <span class="showcase-badge">@zeus-web/switch/vue</span>
    </template>

    <DemoSection title="Basic">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Switch>Notifications</Switch>
        </div>
        <div class="showcase-demo-card">
          <Switch default-checked>Enabled</Switch>
        </div>
        <div class="showcase-demo-card">
          <Switch disabled>Disabled</Switch>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Sizes and states">
      <DemoGrid :columns="3">
        <div class="showcase-demo-card">
          <Switch size="sm">Small</Switch>
        </div>
        <div class="showcase-demo-card">
          <Switch size="md">Medium</Switch>
        </div>
        <div class="showcase-demo-card">
          <Switch size="lg">Large</Switch>
        </div>
        <div class="showcase-demo-card">
          <Switch invalid>Invalid</Switch>
        </div>
        <div class="showcase-demo-card">
          <Switch required>Required</Switch>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <div class="showcase-demo-card">
          <Switch :checked="checked" @checked-change="handleCheckedChange">
            Controlled switch
          </Switch>
        </div>

        <div class="showcase-demo-card">
          <strong>Enabled</strong>
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
      <ThemeTokenPreview :tokens="['primary', 'input', 'ring']" />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card">
        <Switch default-checked>Enable dark mode</Switch>
        <Switch>Send deployment alerts</Switch>
        <Switch default-checked>Auto-refresh dashboard</Switch>
      </div>
    </DemoSection>
  </DemoPage>
</template>
