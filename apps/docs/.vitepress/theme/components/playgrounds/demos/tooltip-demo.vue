<script setup lang="ts">
import { useLocalizedMessages } from '../../../composables/use-docs-locale'

const messages = useLocalizedMessages({
  en: {
    trigger: 'Hover or focus for help',
    content: 'This action creates a production deployment.',
    hintPrefix: 'Focus the trigger and press',
    hintSuffix: 'to dismiss the tooltip.',
  },
  zh: {
    trigger: '悬停或聚焦以查看帮助',
    content: '此操作会创建生产环境部署。',
    hintPrefix: '聚焦触发器后按',
    hintSuffix: '关闭提示。',
  },
})
</script>

<template>
  <div class="primitive-demo" data-playground-demo="tooltip">
    <zw-tooltip delay-duration="120">
      <zw-tooltip-trigger>
        <span class="demo-trigger">{{ messages.trigger }}</span>
      </zw-tooltip-trigger>
      <zw-tooltip-content side="top">
        {{ messages.content }}
      </zw-tooltip-content>
    </zw-tooltip>
    <p class="demo-hint">
      {{ messages.hintPrefix }} <kbd>Escape</kbd> {{ messages.hintSuffix }}
    </p>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 1rem;
  justify-items: start;
  min-height: 7rem;
  padding-top: 2.5rem;
}

.demo-trigger {
  display: inline-flex;
  padding: 0.5rem 0.75rem;
  color: var(--vp-c-brand-1);
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 0.5rem;
}

.demo-hint {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}
</style>
