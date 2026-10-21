<script setup lang="ts">
import { useLocalizedMessages } from '../../../composables/use-docs-locale'

const messages = useLocalizedMessages({
  en: {
    trigger: 'Deployment details',
    title: 'Production deployment',
    description: 'The latest build is ready to deploy to production.',
    hint: 'Press Escape to dismiss the popover.',
  },
  zh: {
    trigger: '部署详情',
    title: '生产环境部署',
    description: '最新构建已就绪，可以部署到生产环境。',
    hint: '按 Escape 键关闭弹出层。',
  },
})
</script>

<template>
  <div class="primitive-demo" data-playground-demo="popover">
    <zw-popover>
      <zw-popover-trigger>{{ messages.trigger }}</zw-popover-trigger>
      <zw-popover-content>
        <strong>{{ messages.title }}</strong>
        <p>{{ messages.description }}</p>
      </zw-popover-content>
    </zw-popover>
    <p class="demo-hint">{{ messages.hint }}</p>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
}

.demo-hint {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}
</style>
