<script setup lang="ts">
import { useLocalizedMessages } from '../../../composables/use-docs-locale'

const messages = useLocalizedMessages({
  en: {
    trigger: 'Open project dialog',
    title: 'Create project',
    description:
      'Start a new workspace with the default Zeus Web configuration.',
    cancel: 'Cancel',
    create: 'Create project',
    hintPrefix: 'Open the dialog, use',
    hintMiddle: 'to move focus, or press',
    hintSuffix: 'to close it.',
  },
  zh: {
    trigger: '打开项目对话框',
    title: '创建项目',
    description: '使用默认 Zeus Web 配置创建新的工作区。',
    cancel: '取消',
    create: '创建项目',
    hintPrefix: '打开对话框后，使用',
    hintMiddle: '移动焦点，或按',
    hintSuffix: '将其关闭。',
  },
})
</script>

<template>
  <div class="primitive-demo" data-playground-demo="dialog">
    <zw-dialog>
      <zw-dialog-trigger>{{ messages.trigger }}</zw-dialog-trigger>
      <zw-dialog-content>
        <zw-dialog-title>{{ messages.title }}</zw-dialog-title>
        <zw-dialog-description>
          {{ messages.description }}
        </zw-dialog-description>
        <div class="demo-actions">
          <zw-dialog-close>{{ messages.cancel }}</zw-dialog-close>
          <zw-dialog-close>{{ messages.create }}</zw-dialog-close>
        </div>
      </zw-dialog-content>
    </zw-dialog>
    <p class="demo-hint">
      {{ messages.hintPrefix }} <kbd>Tab</kbd> {{ messages.hintMiddle }}
      <kbd>Escape</kbd> {{ messages.hintSuffix }}
    </p>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 1rem;
  justify-items: start;
}

.demo-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.demo-hint {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}
</style>
