<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from '@zeus-web/avatar/vue'

import DemoGrid from '../../app/demo/DemoGrid.vue'
import DemoPage from '../../app/demo/DemoPage.vue'
import DemoSection from '../../app/demo/DemoSection.vue'
import EventLog from '../../app/demo/EventLog.vue'
import PropTable from '../../app/demo/PropTable.vue'
import ThemeTokenPreview from '../../app/demo/ThemeTokenPreview.vue'
import { useDemoEventLog } from '../p0/event-utils'

const events = useDemoEventLog()

const eventLogRows = [
  {
    name: 'image-load',
    reactName: 'onImageLoad',
    vueName: 'image-load',
    description: 'Emitted when avatar image loads.',
  },
  {
    name: 'image-error',
    reactName: 'onImageError',
    vueName: 'image-error',
    description: 'Emitted when avatar image fails.',
  },
]

const propTableRows = [
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    defaultValue: "'md'",
    description: 'Avatar size.',
  },
  {
    name: 'shape',
    type: "'circle' | 'square'",
    defaultValue: "'circle'",
    description: 'Avatar shape.',
  },
  {
    name: 'imageStatus',
    type: "'idle' | 'loading' | 'loaded' | 'error'",
    defaultValue: "'idle'",
    description: 'Current image loading status.',
  },
  {
    name: 'delayMs',
    type: 'number',
    defaultValue: '0',
    description: 'AvatarFallback display delay in milliseconds.',
  },
]
</script>

<template>
  <DemoPage
    eyebrow="Data display"
    title="Avatar capability page"
    description="Tests Avatar sizes, shapes, image/fallback composition and image load/error events."
  >
    <template #meta>
      <span class="showcase-badge">avatar</span>
      <span class="showcase-badge">@zeus-web/avatar/vue</span>
    </template>

    <DemoSection title="Basic">
      <DemoGrid :columns="3">
        <Avatar>
          <AvatarFallback>BC</AvatarFallback>
        </Avatar>

        <Avatar shape="square">
          <AvatarFallback>ZW</AvatarFallback>
        </Avatar>

        <Avatar image-status="error">
          <AvatarImage
            src="/missing-avatar.png"
            alt="Missing avatar"
            @image-error="events.log('image-error', $event)"
          />
          <AvatarFallback>ER</AvatarFallback>
        </Avatar>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Sizes and shapes">
      <DemoGrid :columns="3">
        <Avatar size="sm">
          <AvatarFallback>SM</AvatarFallback>
        </Avatar>

        <Avatar size="md">
          <AvatarFallback>MD</AvatarFallback>
        </Avatar>

        <Avatar size="lg">
          <AvatarFallback>LG</AvatarFallback>
        </Avatar>

        <Avatar shape="circle">
          <AvatarFallback>CI</AvatarFallback>
        </Avatar>

        <Avatar shape="square">
          <AvatarFallback>SQ</AvatarFallback>
        </Avatar>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Fallback">
      <DemoGrid :columns="2">
        <Avatar image-status="idle">
          <AvatarFallback :delay-ms="0">JD</AvatarFallback>
        </Avatar>

        <Avatar image-status="loading">
          <AvatarFallback :delay-ms="300">LD</AvatarFallback>
        </Avatar>
      </DemoGrid>
    </DemoSection>

    <DemoSection title="Events">
      <EventLog :events="eventLogRows" />
    </DemoSection>

    <DemoSection title="Props">
      <PropTable :rows="propTableRows" />
    </DemoSection>

    <DemoSection title="Theme tokens">
      <ThemeTokenPreview :tokens="['muted', 'muted-foreground', 'border']" />
    </DemoSection>

    <DemoSection title="Production pattern">
      <div class="showcase-demo-card showcase-user-row">
        <Avatar size="lg">
          <AvatarFallback>BC</AvatarFallback>
        </Avatar>

        <div>
          <strong>bai cie</strong>
          <p class="showcase-form-note">Maintainer · Zeus Web</p>
        </div>
      </div>
    </DemoSection>
  </DemoPage>
</template>
