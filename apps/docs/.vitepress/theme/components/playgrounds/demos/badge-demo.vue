<script setup lang="ts">
import { useLocalizedMessages } from '../../../composables/use-docs-locale'

const messages = useLocalizedMessages({
  en: {
    default: 'Default',
    beta: 'Beta',
    draft: 'Draft',
    healthy: 'Healthy',
    degraded: 'Degraded',
    failed: 'Failed',
  },
  zh: {
    default: '默认',
    beta: '测试版',
    draft: '草稿',
    healthy: '正常',
    degraded: '性能下降',
    failed: '失败',
  },
})
</script>

<template>
  <div class="primitive-demo" data-playground-demo="badge">
    <zw-badge variant="default">{{ messages.default }}</zw-badge>
    <zw-badge variant="secondary">{{ messages.beta }}</zw-badge>
    <zw-badge variant="outline">{{ messages.draft }}</zw-badge>
    <zw-badge variant="success">{{ messages.healthy }}</zw-badge>
    <zw-badge variant="warning">{{ messages.degraded }}</zw-badge>
    <zw-badge variant="danger">{{ messages.failed }}</zw-badge>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}
</style>
