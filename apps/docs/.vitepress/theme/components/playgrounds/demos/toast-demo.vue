<script setup lang="ts">
import { ref } from 'vue'

import { useLocalizedMessages } from '../../../composables/use-docs-locale'

interface ToastElement extends HTMLElement {
  show: () => void
}

const toast = ref<ToastElement | null>(null)
const messages = useLocalizedMessages({
  en: {
    show: 'Show notification',
    title: 'Deployment complete',
    description: 'The production build is now live.',
    dismiss: 'Dismiss',
  },
  zh: {
    show: '显示通知',
    title: '部署完成',
    description: '生产版本现已上线。',
    dismiss: '关闭',
  },
})

function showToast(): void {
  toast.value?.show()
}
</script>

<template>
  <div class="primitive-demo" data-playground-demo="toast">
    <button type="button" @click="showToast">{{ messages.show }}</button>
    <zw-toast ref="toast" duration="0">
      <zw-toast-title>{{ messages.title }}</zw-toast-title>
      <zw-toast-description>{{ messages.description }}</zw-toast-description>
      <zw-toast-close>{{ messages.dismiss }}</zw-toast-close>
    </zw-toast>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
}
</style>
