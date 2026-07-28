<script setup lang="ts">
import { computed, ref } from 'vue'

import { useLocalizedMessages } from '../../../composables/use-docs-locale'

interface ValueChangeDetail {
  value?: string
}

const value = ref('balanced')
const messages = useLocalizedMessages({
  en: {
    performanceProfile: 'Performance profile',
    efficient: 'Efficient',
    balanced: 'Balanced',
    performance: 'Performance',
    selectedProfile: 'Selected profile',
  },
  zh: {
    performanceProfile: '性能配置',
    efficient: '节能',
    balanced: '均衡',
    performance: '高性能',
    selectedProfile: '已选配置',
  },
})
const selectedLabel = computed(
  () => messages.value[value.value as keyof typeof messages.value],
)

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
      :aria-label="messages.performanceProfile"
      default-value="balanced"
      name="performance-profile"
      @value-change="handleValueChange"
    >
      <zw-radio-group-item value="efficient">{{
        messages.efficient
      }}</zw-radio-group-item>
      <zw-radio-group-item value="balanced">{{
        messages.balanced
      }}</zw-radio-group-item>
      <zw-radio-group-item value="performance">
        {{ messages.performance }}
      </zw-radio-group-item>
    </zw-radio-group>
    <p class="demo-status">
      {{ messages.selectedProfile }}: <strong>{{ selectedLabel }}</strong>
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
