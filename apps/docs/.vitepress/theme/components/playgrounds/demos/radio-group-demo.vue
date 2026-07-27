<script setup lang="ts">
import { ref } from 'vue'

interface ValueChangeDetail {
  value?: string
}

const value = ref('balanced')

function handleValueChange(event: Event): void {
  const customEvent = event as CustomEvent<ValueChangeDetail>
  const detail = customEvent.detail

  if (detail && typeof detail.value === 'string') {
    value.value = detail.value
  }
}
</script>

<template>
  <div class="primitive-demo" data-playground-demo="radio-group">
    <zw-radio-group
      aria-label="Performance profile"
      default-value="balanced"
      name="performance-profile"
      @value-change="handleValueChange"
    >
      <zw-radio-group-item value="efficient">Efficient</zw-radio-group-item>
      <zw-radio-group-item value="balanced">Balanced</zw-radio-group-item>
      <zw-radio-group-item value="performance">
        Performance
      </zw-radio-group-item>
    </zw-radio-group>
    <p class="demo-status">
      Selected profile: <strong>{{ value }}</strong>
    </p>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 1rem;
}

zw-radio-group {
  display: grid;
  gap: 0.75rem;
}

.demo-status {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}
</style>
