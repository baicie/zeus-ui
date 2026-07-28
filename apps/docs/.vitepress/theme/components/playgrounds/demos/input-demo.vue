<script setup lang="ts">
import { ref } from 'vue'

import { useLocalizedMessages } from '../../../composables/use-docs-locale'

interface ValueChangeDetail {
  value?: string
}

const value = ref('')
const messages = useLocalizedMessages({
  en: {
    emailAddress: 'Email address',
    invalidEmail: 'Invalid email',
    disabledInput: 'Disabled input',
    disabled: 'Disabled',
    currentValue: 'Current value',
    empty: 'empty',
  },
  zh: {
    emailAddress: '电子邮箱地址',
    invalidEmail: '无效的电子邮箱',
    disabledInput: '已禁用的输入框',
    disabled: '已禁用',
    currentValue: '当前值',
    empty: '空',
  },
})

function handleValueChange(event: Event): void {
  const customEvent = event as CustomEvent<ValueChangeDetail>
  const detail = customEvent.detail
  value.value = detail && typeof detail.value === 'string' ? detail.value : ''
}
</script>

<template>
  <div class="primitive-demo" data-playground-demo="input">
    <div class="demo-stack">
      <zw-input
        :aria-label="messages.emailAddress"
        type="email"
        placeholder="you@example.com"
        @value-change="handleValueChange"
      />
      <zw-input
        :aria-label="messages.invalidEmail"
        value="invalid-email"
        invalid
      />
      <zw-input
        :aria-label="messages.disabledInput"
        :placeholder="messages.disabled"
        disabled
      />
    </div>
    <p class="demo-status">
      {{ messages.currentValue }}: <code>{{ value || messages.empty }}</code>
    </p>
  </div>
</template>

<style scoped>
.primitive-demo,
.demo-stack {
  display: grid;
  gap: 0.875rem;
}

.demo-stack {
  max-width: 28rem;
}

.demo-status {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}
</style>
