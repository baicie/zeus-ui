<script setup lang="ts">
import { useLocalizedMessages } from '../../../composables/use-docs-locale'

const messages = useLocalizedMessages({
  en: {
    account: 'Account',
    description: 'Manage your profile and preferences.',
    overview: 'Overview',
    activity: 'Activity',
    settings: 'Settings',
  },
  zh: {
    account: '账户',
    description: '管理个人资料和偏好设置。',
    overview: '概览',
    activity: '活动',
    settings: '设置',
  },
})
</script>

<template>
  <div class="primitive-demo" data-playground-demo="separator">
    <section>
      <strong>{{ messages.account }}</strong>
      <p>{{ messages.description }}</p>
    </section>
    <zw-separator orientation="horizontal" />
    <div class="demo-toolbar">
      <span>{{ messages.overview }}</span>
      <zw-separator orientation="vertical" :decorative="false" />
      <span>{{ messages.activity }}</span>
      <zw-separator orientation="vertical" :decorative="false" />
      <span>{{ messages.settings }}</span>
    </div>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 1rem;
}

.primitive-demo p {
  margin: 0.25rem 0 0;
  color: var(--vp-c-text-2);
}

.demo-toolbar {
  display: flex;
  gap: 0.875rem;
  align-items: center;
}
</style>
