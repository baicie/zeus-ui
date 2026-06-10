<script setup lang="ts">
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@zeus-web/dialog/vue'
import { ref } from 'vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { readDetailOpen, useDemoEventLog } from './event-utils'

const open = ref(false)
const events = useDemoEventLog()

function handleOpenChange(event: unknown) {
  const next = readDetailOpen(event, open.value)
  open.value = next
  events.log('open-change', { open: next })
}
</script>

<template>
  <DemoPage
    eyebrow="Feedback"
    title="Dialog capability page"
    description="Tests dialog trigger, content, title, description, close, controlled open and openChange events."
  >
    <template #meta>
      <span class="showcase-badge">dialog</span>
      <span class="showcase-badge">@zeus-web/dialog/vue</span>
    </template>

    <DemoSection title="Basic">
      <Dialog>
        <DialogTrigger>Open basic dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Basic dialog</DialogTitle>
          <DialogDescription>
            This dialog is opened with an uncontrolled trigger.
          </DialogDescription>
          <div class="showcase-demo-card">Dialog body content</div>
          <DialogClose>Close</DialogClose>
        </DialogContent>
      </Dialog>
    </DemoSection>

    <DemoSection title="Controlled">
      <DemoGrid :columns="2">
        <Dialog :open="open" @open-change="handleOpenChange">
          <DialogTrigger>Open controlled dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Controlled dialog</DialogTitle>
            <DialogDescription>
              Open state is synchronized with Vue state.
            </DialogDescription>
            <DialogClose>Close controlled dialog</DialogClose>
          </DialogContent>
        </Dialog>

        <div class="showcase-demo-card">
          <strong>Open</strong>
          <pre class="showcase-code">{{ open }}</pre>
        </div>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="States">
      <DemoGrid :columns="2">
        <Dialog default-open>
          <DialogContent force-mount>
            <DialogTitle>Default open</DialogTitle>
            <DialogDescription>Rendered initially open.</DialogDescription>
            <DialogClose>Close</DialogClose>
          </DialogContent>
        </Dialog>

        <Dialog :modal="false">
          <DialogTrigger>Open non-modal dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Non-modal dialog</DialogTitle>
            <DialogDescription> Modal behavior disabled. </DialogDescription>
            <DialogClose>Close</DialogClose>
          </DialogContent>
        </Dialog>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog
        :events="[
          {
            name: 'open-change',
            reactName: 'onOpenChange',
            vueName: 'open-change',
            description: 'Emitted when open state changes.',
          },
        ]"
      />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview
        :tokens="['background', 'foreground', 'ring', 'border']"
      />
    </DemoSection>

    <DemoSection title="Production pattern">
      <Dialog>
        <DialogTrigger>Create project</DialogTrigger>
        <DialogContent>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            This production pattern will include a full form in a later phase.
          </DialogDescription>
          <div class="showcase-demo-card">Project form placeholder</div>
          <DialogClose>Cancel</DialogClose>
        </DialogContent>
      </Dialog>
    </DemoSection>
  </DemoPage>
</template>
