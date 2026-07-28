<script setup lang="ts">
import { computed, ref } from 'vue'

import { useLocalizedMessages } from '../../../composables/use-docs-locale'

interface ValueChangeDetail {
  value?: string
}

const value = ref('staging')
const messages = useLocalizedMessages({
  en: {
    deploymentEnvironment: 'Deployment environment',
    development: 'Development',
    staging: 'Staging',
    production: 'Production',
    deployTo: 'Deploy to',
  },
  zh: {
    deploymentEnvironment: '部署环境',
    development: '开发环境',
    staging: '预发布环境',
    production: '生产环境',
    deployTo: '部署到',
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
  <div class="primitive-demo" data-playground-demo="select">
    <zw-select
      :aria-label="messages.deploymentEnvironment"
      default-value="staging"
      @value-change="handleValueChange"
    >
      <option value="development">{{ messages.development }}</option>
      <option value="staging">{{ messages.staging }}</option>
      <option value="production">{{ messages.production }}</option>
    </zw-select>
    <p class="demo-status">
      {{ messages.deployTo }}: <strong>{{ selectedLabel }}</strong>
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
