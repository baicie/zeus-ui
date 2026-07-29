<script setup lang="ts">
import { useLocalizedMessages } from '../../../composables/use-docs-locale'

const messages = useLocalizedMessages({
  en: {
    virtualizationQuestion: 'How does virtualization work?',
    virtualizationAnswer:
      'Only the visible row and column windows are rendered into the DOM.',
    frameworksQuestion: 'Which frameworks are supported?',
    frameworksAnswer:
      'Zeus Web publishes Web Component, React, and Vue entry points.',
    accessibilityQuestion: 'Is keyboard navigation included?',
    accessibilityAnswer:
      'Arrow keys move between triggers, while Enter and Space toggle them.',
  },
  zh: {
    virtualizationQuestion: '虚拟化如何工作？',
    virtualizationAnswer: '只有可见的行列窗口会渲染到 DOM 中。',
    frameworksQuestion: '支持哪些框架？',
    frameworksAnswer: 'Zeus Web 提供 Web Component、React 和 Vue 入口。',
    accessibilityQuestion: '是否支持键盘导航？',
    accessibilityAnswer:
      '方向键可在触发器间移动，Enter 和 Space 用于展开或收起。',
  },
})
</script>

<template>
  <div class="primitive-demo" data-playground-demo="accordion">
    <zw-accordion type="single" default-value="performance" collapsible>
      <zw-accordion-item value="performance">
        <zw-accordion-trigger>{{
          messages.virtualizationQuestion
        }}</zw-accordion-trigger>
        <zw-accordion-content>
          {{ messages.virtualizationAnswer }}
        </zw-accordion-content>
      </zw-accordion-item>
      <zw-accordion-item value="frameworks">
        <zw-accordion-trigger>{{
          messages.frameworksQuestion
        }}</zw-accordion-trigger>
        <zw-accordion-content>
          {{ messages.frameworksAnswer }}
        </zw-accordion-content>
      </zw-accordion-item>
      <zw-accordion-item value="accessibility">
        <zw-accordion-trigger>{{
          messages.accessibilityQuestion
        }}</zw-accordion-trigger>
        <zw-accordion-content>
          {{ messages.accessibilityAnswer }}
        </zw-accordion-content>
      </zw-accordion-item>
    </zw-accordion>
  </div>
</template>

<style scoped>
.primitive-demo {
  max-width: 38rem;
}

zw-accordion-content {
  padding: 0.75rem 0;
  color: var(--vp-c-text-2);
}
</style>
