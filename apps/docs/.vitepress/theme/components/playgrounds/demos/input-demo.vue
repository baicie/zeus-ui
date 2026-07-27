<script setup lang="ts">
import { ref } from 'vue'

interface ValueChangeDetail {
  value?: string
}

const value = ref('')

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
        aria-label="Email address"
        type="email"
        placeholder="you@example.com"
        @value-change="handleValueChange"
      />
      <zw-input aria-label="Invalid email" value="invalid-email" invalid />
      <zw-input aria-label="Disabled input" placeholder="Disabled" disabled />
    </div>
    <p class="demo-status">
      Current value: <code>{{ value || 'empty' }}</code>
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
