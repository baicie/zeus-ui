<script setup lang="ts">
import { ref } from 'vue'

interface CheckedChangeDetail {
  checked?: boolean
}

const checked = ref(true)

function handleCheckedChange(event: Event): void {
  const customEvent = event as CustomEvent<CheckedChangeDetail>
  const detail = customEvent.detail
  checked.value = Boolean(detail && detail.checked)
}
</script>

<template>
  <div class="primitive-demo" data-playground-demo="checkbox">
    <div class="demo-stack">
      <zw-checkbox default-checked @checked-change="handleCheckedChange">
        Email notifications
      </zw-checkbox>
      <zw-checkbox indeterminate>Partially selected</zw-checkbox>
      <zw-checkbox disabled>Unavailable option</zw-checkbox>
    </div>
    <p class="demo-status">
      Notifications: <strong>{{ checked ? 'enabled' : 'disabled' }}</strong>
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
