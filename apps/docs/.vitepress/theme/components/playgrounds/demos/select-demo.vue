<script setup lang="ts">
import { ref } from 'vue'

interface ValueChangeDetail {
  value?: string
}

const value = ref('staging')

function handleValueChange(event: Event): void {
  const customEvent = event as CustomEvent<ValueChangeDetail>
  const detail = customEvent.detail

  if (detail && typeof detail.value === 'string') {
    value.value = detail.value
  }
}
</script>

<template>
  <div class="primitive-demo" data-playground-demo="select">
    <zw-select
      aria-label="Deployment environment"
      default-value="staging"
      @value-change="handleValueChange"
    >
      <option value="development">Development</option>
      <option value="staging">Staging</option>
      <option value="production">Production</option>
    </zw-select>
    <p class="demo-status">
      Deploy to: <strong>{{ value }}</strong>
    </p>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 0.75rem;
  max-width: 24rem;
}

.demo-status {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}
</style>
