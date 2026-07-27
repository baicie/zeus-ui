<script setup lang="ts">
import { ref } from 'vue'

interface ValueChangeDetail {
  value?: string
}

const value = ref('Ship the new component playground.')

function handleValueChange(event: Event): void {
  const customEvent = event as CustomEvent<ValueChangeDetail>
  const detail = customEvent.detail
  value.value = detail && typeof detail.value === 'string' ? detail.value : ''
}
</script>

<template>
  <div class="primitive-demo" data-playground-demo="textarea">
    <zw-textarea
      aria-label="Release notes"
      default-value="Ship the new component playground."
      placeholder="Describe this release"
      rows="4"
      maxlength="160"
      resize="vertical"
      @value-change="handleValueChange"
    />
    <p class="demo-status">{{ value.length }} / 160 characters</p>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 0.75rem;
  max-width: 32rem;
}

.demo-status {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
  text-align: right;
}
</style>
