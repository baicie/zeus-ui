<script setup lang="ts">
import { useLocalizedMessages } from '../../../composables/use-docs-locale'

const messages = useLocalizedMessages({
  en: {
    title: 'Build status',
    description: 'Production deployment for zeus-ui.',
    branch: 'Branch',
    checks: 'Checks',
    passed: '21 passed',
    action: 'View deployment',
  },
  zh: {
    title: '构建状态',
    description: 'zeus-ui 的生产环境部署。',
    branch: '分支',
    checks: '检查项',
    passed: '21 项通过',
    action: '查看部署',
  },
})
</script>

<template>
  <div class="primitive-demo" data-playground-demo="card">
    <zw-card>
      <zw-card-header>
        <zw-card-title>{{ messages.title }}</zw-card-title>
        <zw-card-description>
          {{ messages.description }}
        </zw-card-description>
      </zw-card-header>
      <zw-card-content>
        <dl>
          <div>
            <dt>{{ messages.branch }}</dt>
            <dd>main</dd>
          </div>
          <div>
            <dt>{{ messages.checks }}</dt>
            <dd>{{ messages.passed }}</dd>
          </div>
        </dl>
      </zw-card-content>
      <zw-card-footer>
        <button type="button">{{ messages.action }}</button>
      </zw-card-footer>
    </zw-card>
  </div>
</template>

<style scoped>
.primitive-demo {
  max-width: 30rem;
}

dl {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}

dl div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

dt {
  color: var(--vp-c-text-2);
}

dd {
  margin: 0;
  font-weight: 600;
}

button {
  padding: 0.5rem 0.75rem;
  color: var(--vp-c-brand-1);
  background: transparent;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 0.5rem;
  cursor: pointer;
}
</style>
