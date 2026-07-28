<script setup lang="ts">
import { ref } from 'vue'

import { useLocalizedMessages } from '../../../composables/use-docs-locale'

interface CheckedChangeDetail {
  checked?: boolean
}

const checked = ref(true)
const messages = useLocalizedMessages({
  en: {
    emailNotifications: 'Email notifications',
    partiallySelected: 'Partially selected',
    unavailableOption: 'Unavailable option',
    notifications: 'Notifications',
    enabled: 'enabled',
    disabled: 'disabled',
  },
  zh: {
    emailNotifications: '邮件通知',
    partiallySelected: '部分选中',
    unavailableOption: '不可用选项',
    notifications: '通知',
    enabled: '已启用',
    disabled: '已禁用',
  },
})

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
        {{ messages.emailNotifications }}
      </zw-checkbox>
      <zw-checkbox indeterminate>{{ messages.partiallySelected }}</zw-checkbox>
      <zw-checkbox disabled>{{ messages.unavailableOption }}</zw-checkbox>
    </div>
    <p class="demo-status">
      {{ messages.notifications }}:
      <strong>{{ checked ? messages.enabled : messages.disabled }}</strong>
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
