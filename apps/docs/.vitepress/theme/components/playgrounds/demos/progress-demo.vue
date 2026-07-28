<script setup lang="ts">
import { ref } from 'vue'

import { useLocalizedMessages } from '../../../composables/use-docs-locale'

const progress = ref(64)
const messages = useLocalizedMessages({
  en: {
    deployment: 'Deployment',
    progressLabel: (value: number) => `Deployment ${value}% complete`,
    decrease: 'Decrease',
    increase: 'Increase',
    preparing: 'Preparing deployment',
  },
  zh: {
    deployment: '部署进度',
    progressLabel: (value: number) => `部署已完成 ${value}%`,
    decrease: '减少',
    increase: '增加',
    preparing: '正在准备部署',
  },
})

function decrease(): void {
  progress.value = Math.max(0, progress.value - 10)
}

function increase(): void {
  progress.value = Math.min(100, progress.value + 10)
}
</script>

<template>
  <div class="primitive-demo" data-playground-demo="progress">
    <div class="progress-label">
      <span>{{ messages.deployment }}</span>
      <strong>{{ progress }}%</strong>
    </div>
    <zw-progress
      :value="progress"
      max="100"
      :label="messages.progressLabel(progress)"
    />
    <div class="demo-actions">
      <button type="button" :disabled="progress === 0" @click="decrease">
        {{ messages.decrease }}
      </button>
      <button type="button" :disabled="progress === 100" @click="increase">
        {{ messages.increase }}
      </button>
    </div>
    <div class="progress-label">
      <span>{{ messages.preparing }}</span>
    </div>
    <zw-progress :indeterminate="true" :label="messages.preparing" />
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 1rem;
  max-width: 32rem;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.demo-actions {
  display: flex;
  gap: 0.75rem;
}

button {
  padding: 0.45rem 0.75rem;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.5rem;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
