<script setup lang="ts">
import { ref } from 'vue'

const progress = ref(64)

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
      <span>Deployment</span>
      <strong>{{ progress }}%</strong>
    </div>
    <zw-progress
      :value="progress"
      max="100"
      :label="`Deployment ${progress}% complete`"
      :style="`--demo-progress: ${progress}%`"
    />
    <div class="demo-actions">
      <button type="button" :disabled="progress === 0" @click="decrease">
        Decrease
      </button>
      <button type="button" :disabled="progress === 100" @click="increase">
        Increase
      </button>
    </div>
    <div class="progress-label">
      <span>Preparing deployment</span>
    </div>
    <zw-progress :indeterminate="true" label="Preparing deployment" />
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

zw-progress {
  position: relative;
  display: block;
  height: 0.625rem;
  overflow: hidden;
  background: var(--vp-c-divider);
  border-radius: 999px;
}

:deep(zw-progress > [data-slot='progress-indicator']) {
  display: block;
  width: var(--demo-progress, 0%);
  height: 100%;
  background: var(--vp-c-brand-1);
  border-radius: inherit;
  transition: width 160ms ease;
}

:deep(
  zw-progress[data-state='indeterminate'] > [data-slot='progress-indicator']
) {
  width: 35%;
  transform: translateX(90%);
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
