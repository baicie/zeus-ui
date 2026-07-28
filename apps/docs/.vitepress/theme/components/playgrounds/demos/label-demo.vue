<script setup lang="ts">
import { useLocalizedMessages } from '../../../composables/use-docs-locale'

const messages = useLocalizedMessages({
  en: {
    emailAddress: 'Email address',
    managedTeam: 'Managed team',
    platform: 'Platform',
  },
  zh: {
    emailAddress: '电子邮箱地址',
    managedTeam: '托管团队',
    platform: '平台',
  },
})
</script>

<template>
  <div class="primitive-demo" data-playground-demo="label">
    <div class="demo-field">
      <zw-label for="playground-email" required>{{
        messages.emailAddress
      }}</zw-label>
      <input id="playground-email" type="email" placeholder="you@example.com" />
    </div>
    <div class="demo-field">
      <zw-label for="playground-team" disabled>{{
        messages.managedTeam
      }}</zw-label>
      <input id="playground-team" :value="messages.platform" disabled />
    </div>
  </div>
</template>

<style scoped>
.primitive-demo,
.demo-field {
  display: grid;
  gap: 0.5rem;
}

.primitive-demo {
  gap: 1rem;
  max-width: 28rem;
}

input {
  min-height: 2.5rem;
  padding: 0 0.75rem;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.5rem;
}
</style>
