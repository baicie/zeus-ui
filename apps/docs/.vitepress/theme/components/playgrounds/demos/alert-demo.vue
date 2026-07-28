<script setup lang="ts">
import { useLocalizedMessages } from '../../../composables/use-docs-locale'

const messages = useLocalizedMessages({
  en: {
    updateTitle: 'New version available',
    updateDescription: 'Review the release notes before updating.',
    successTitle: 'Deployment complete',
    successDescription: 'All production health checks passed.',
    failureTitle: 'Build failed',
    failureDescription: 'Open the build log to inspect the failing step.',
  },
  zh: {
    updateTitle: '发现新版本',
    updateDescription: '更新前请先查看发行说明。',
    successTitle: '部署完成',
    successDescription: '所有生产环境健康检查均已通过。',
    failureTitle: '构建失败',
    failureDescription: '请打开构建日志检查失败步骤。',
  },
})
</script>

<template>
  <div class="primitive-demo" data-playground-demo="alert">
    <zw-alert variant="info" live="polite">
      <zw-alert-title>{{ messages.updateTitle }}</zw-alert-title>
      <zw-alert-description>
        {{ messages.updateDescription }}
      </zw-alert-description>
    </zw-alert>
    <zw-alert variant="success" live="polite">
      <zw-alert-title>{{ messages.successTitle }}</zw-alert-title>
      <zw-alert-description>
        {{ messages.successDescription }}
      </zw-alert-description>
    </zw-alert>
    <zw-alert variant="danger" live="assertive">
      <zw-alert-title>{{ messages.failureTitle }}</zw-alert-title>
      <zw-alert-description>
        {{ messages.failureDescription }}
      </zw-alert-description>
    </zw-alert>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 0.875rem;
}
</style>
