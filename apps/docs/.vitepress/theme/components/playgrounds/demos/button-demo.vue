<script setup lang="ts">
import { ref } from 'vue'

import { useLocalizedMessages } from '../../../composables/use-docs-locale'

const pressCount = ref(0)
const messages = useLocalizedMessages({
  en: {
    primary: 'Primary',
    outline: 'Outline',
    delete: 'Delete',
    loading: 'Loading',
    disabled: 'Disabled',
    pressEvents: 'Press events',
  },
  zh: {
    primary: '主要按钮',
    outline: '描边按钮',
    delete: '删除',
    loading: '加载中',
    disabled: '已禁用',
    pressEvents: '点击次数',
  },
})

function handlePress(): void {
  pressCount.value += 1
}
</script>

<template>
  <div class="primitive-demo" data-playground-demo="button">
    <div class="demo-row">
      <zw-button variant="primary" @press="handlePress">{{
        messages.primary
      }}</zw-button>
      <zw-button variant="outline" @press="handlePress">{{
        messages.outline
      }}</zw-button>
      <zw-button variant="danger" @press="handlePress">{{
        messages.delete
      }}</zw-button>
      <zw-button loading>{{ messages.loading }}</zw-button>
      <zw-button disabled>{{ messages.disabled }}</zw-button>
    </div>
    <p class="demo-status">{{ messages.pressEvents }}: {{ pressCount }}</p>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 1rem;
}

.demo-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.demo-status {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}
</style>
