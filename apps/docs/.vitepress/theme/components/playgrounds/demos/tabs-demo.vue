<script setup lang="ts">
import { useLocalizedMessages } from '../../../composables/use-docs-locale'

const messages = useLocalizedMessages({
  en: {
    overview: 'Overview',
    activity: 'Activity',
    settings: 'Settings',
    overviewDescription: 'Review the current workspace summary.',
    activityDescription: 'Inspect recent component activity.',
    settingsDescription: 'Configure the playground experience.',
  },
  zh: {
    overview: '概览',
    activity: '活动',
    settings: '设置',
    overviewDescription: '查看当前工作区摘要。',
    activityDescription: '检查最近的组件活动。',
    settingsDescription: '配置交互演示体验。',
  },
})
</script>

<template>
  <div class="primitive-demo" data-playground-demo="tabs">
    <zw-tabs default-value="overview">
      <zw-tabs-list>
        <zw-tabs-trigger value="overview">{{
          messages.overview
        }}</zw-tabs-trigger>
        <zw-tabs-trigger value="activity">{{
          messages.activity
        }}</zw-tabs-trigger>
        <zw-tabs-trigger value="settings">{{
          messages.settings
        }}</zw-tabs-trigger>
      </zw-tabs-list>
      <zw-tabs-content value="overview">
        <p>{{ messages.overviewDescription }}</p>
      </zw-tabs-content>
      <zw-tabs-content value="activity">
        <p>{{ messages.activityDescription }}</p>
      </zw-tabs-content>
      <zw-tabs-content value="settings">
        <p>{{ messages.settingsDescription }}</p>
      </zw-tabs-content>
    </zw-tabs>
  </div>
</template>

<style scoped>
.primitive-demo {
  min-height: 9rem;
}

.primitive-demo p {
  margin: 0;
  color: var(--vp-c-text-2);
}
</style>
