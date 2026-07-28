<script setup lang="ts">
import { useLocalizedMessages } from '../../../composables/use-docs-locale'

const messages = useLocalizedMessages({
  en: {
    trigger: 'Advanced settings',
    strategy: 'Cache strategy',
    description: 'Reuse verified build artifacts across CI jobs.',
  },
  zh: {
    trigger: '高级设置',
    strategy: '缓存策略',
    description: '在多个 CI 任务之间复用已验证的构建产物。',
  },
})
</script>

<template>
  <div class="primitive-demo" data-playground-demo="collapsible">
    <zw-collapsible default-open>
      <zw-collapsible-trigger>{{ messages.trigger }}</zw-collapsible-trigger>
      <zw-collapsible-content>
        <div class="demo-content">
          <p>
            <strong>{{ messages.strategy }}</strong>
          </p>
          <p>{{ messages.description }}</p>
        </div>
      </zw-collapsible-content>
    </zw-collapsible>
  </div>
</template>

<style scoped>
.primitive-demo {
  max-width: 32rem;
}

.demo-content {
  padding: 0.875rem 0;
  color: var(--vp-c-text-2);
}

.demo-content p {
  margin: 0;
}

.demo-content p + p {
  margin-top: 0.375rem;
}
</style>
