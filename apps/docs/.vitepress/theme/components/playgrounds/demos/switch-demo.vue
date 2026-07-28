<script setup lang="ts">
import { ref } from 'vue'

import { useLocalizedMessages } from '../../../composables/use-docs-locale'

interface CheckedChangeDetail {
  checked?: boolean
}

const enabled = ref(true)
const messages = useLocalizedMessages({
  en: {
    automaticUpdates: 'Automatic updates',
    compactMode: 'Compact mode',
    managedByAdministrator: 'Managed by administrator',
    on: 'on',
    off: 'off',
  },
  zh: {
    automaticUpdates: '自动更新',
    compactMode: '紧凑模式',
    managedByAdministrator: '由管理员管理',
    on: '开启',
    off: '关闭',
  },
})

function handleCheckedChange(event: Event): void {
  const customEvent = event as CustomEvent<CheckedChangeDetail>
  const detail = customEvent.detail
  enabled.value = Boolean(detail && detail.checked)
}
</script>

<template>
  <div class="primitive-demo" data-playground-demo="switch">
    <div class="demo-stack">
      <zw-switch default-checked @checked-change="handleCheckedChange">
        {{ messages.automaticUpdates }}
      </zw-switch>
      <zw-switch size="sm">{{ messages.compactMode }}</zw-switch>
      <zw-switch disabled>{{ messages.managedByAdministrator }}</zw-switch>
    </div>
    <p class="demo-status">
      {{ messages.automaticUpdates }}:
      <strong>{{ enabled ? messages.on : messages.off }}</strong>
    </p>
  </div>
</template>

<style scoped>
.primitive-demo,
.demo-stack {
  display: grid;
  gap: 0.875rem;
}

.demo-status {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}
</style>
