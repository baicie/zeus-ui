<script setup lang="ts">
import { useLocalizedMessages } from '../../../composables/use-docs-locale'

const messages = useLocalizedMessages({
  en: {
    email: 'Work email',
    description: 'Use your company email address.',
    value: 'name@example.com',
    error: 'Enter a valid email address.',
  },
  zh: {
    email: '工作邮箱',
    description: '请输入公司邮箱地址。',
    value: 'name@example.com',
    error: '请输入有效的邮箱地址。',
  },
})
</script>

<template>
  <div class="primitive-demo" data-playground-demo="form-field">
    <zw-form-field id="team-email" invalid required>
      <zw-form-field-label>{{ messages.email }}</zw-form-field-label>
      <zw-form-field-description>
        {{ messages.description }}
      </zw-form-field-description>
      <zw-form-field-control>
        <input type="email" :value="messages.value" />
      </zw-form-field-control>
      <zw-form-field-message>{{ messages.error }}</zw-form-field-message>
    </zw-form-field>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 0.5rem;
  max-width: 28rem;
}

input {
  box-sizing: border-box;
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
}
</style>
