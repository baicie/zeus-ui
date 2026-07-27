<script setup lang="ts">
import { ref } from 'vue'

interface CheckedChangeDetail {
  checked?: boolean
}

const enabled = ref(true)

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
        Automatic updates
      </zw-switch>
      <zw-switch size="sm">Compact mode</zw-switch>
      <zw-switch disabled>Managed by administrator</zw-switch>
    </div>
    <p class="demo-status">
      Automatic updates: <strong>{{ enabled ? 'on' : 'off' }}</strong>
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
