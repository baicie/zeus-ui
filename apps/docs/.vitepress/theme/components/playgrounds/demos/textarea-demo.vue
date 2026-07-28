<script setup lang="ts">
import { ref } from 'vue'

import { useLocalizedMessages } from '../../../composables/use-docs-locale'

interface ValueChangeDetail {
  value?: string
}

const messages = useLocalizedMessages({
  en: {
    releaseNotes: 'Release notes',
    defaultValue: 'Ship the new component playground.',
    placeholder: 'Describe this release',
    characters: 'characters',
  },
  zh: {
    releaseNotes: '发布说明',
    defaultValue: '发布新的组件演练场。',
    placeholder: '描述此版本',
    characters: '个字符',
  },
})
const value = ref(messages.value.defaultValue)

function handleValueChange(event: Event): void {
  const customEvent = event as CustomEvent<ValueChangeDetail>
  const detail = customEvent.detail
  value.value = detail && typeof detail.value === 'string' ? detail.value : ''
}
</script>

<template>
  <div class="primitive-demo" data-playground-demo="textarea">
    <zw-textarea
      :aria-label="messages.releaseNotes"
      :default-value="messages.defaultValue"
      :placeholder="messages.placeholder"
      rows="4"
      maxlength="160"
      resize="vertical"
      @value-change="handleValueChange"
    />
    <p class="demo-status">
      {{ value.length }} / 160 {{ messages.characters }}
    </p>
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
