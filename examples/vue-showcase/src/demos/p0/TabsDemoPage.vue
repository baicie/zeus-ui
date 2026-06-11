<script setup lang="ts">
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zeus-web/tabs/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailValue, useDemoEventLog } from './event-utils'

const value = ref('overview')
const events = useDemoEventLog()

function handleValueChange(event: unknown) {
  const next = readDetailValue(event, value.value)
  value.value = next
  events.log('value-change', { value: next })
}
</script>

<template>
  <DemoPage
    eyebrow="Navigation"
    title="Tabs capability page"
    description="Tests tab orientation, controlled value, disabled triggers and valueChange events."
  >
    <template #meta>
      <span class="showcase-badge">tabs</span>
      <span class="showcase-badge">@zeus-web/tabs/vue</span>
    </template>

    <DemoSection title="Basic">
      <Tabs default-value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div class="showcase-demo-card">Overview panel</div>
        </TabsContent>
        <TabsContent value="usage">
          <div class="showcase-demo-card">Usage panel</div>
        </TabsContent>
        <TabsContent value="api">
          <div class="showcase-demo-card">API panel</div>
        </TabsContent>
      </Tabs>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <Tabs :value="value" @value-change="handleValueChange">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div class="showcase-demo-card">Overview settings</div>
          </TabsContent>
          <TabsContent value="billing">
            <div class="showcase-demo-card">Billing settings</div>
          </TabsContent>
          <TabsContent value="security">
            <div class="showcase-demo-card">Security settings</div>
          </TabsContent>
        </Tabs>

        <div class="showcase-demo-card">
          <strong>Active tab</strong>
          <pre class="showcase-code">{{ value }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Vertical and disabled">
      <Tabs default-value="profile" orientation="vertical">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="disabled" disabled> Disabled </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div class="showcase-demo-card">Profile panel</div>
        </TabsContent>
        <TabsContent value="team">
          <div class="showcase-demo-card">Team panel</div>
        </TabsContent>
      </Tabs>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'value-change',
            reactName: 'onValueChange',
            vueName: 'value-change',
            description: 'Emitted when active tab changes.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview :tokens="['muted', 'muted-foreground', 'ring']" />
    </DemoSection>
  </DemoPage>
</template>
