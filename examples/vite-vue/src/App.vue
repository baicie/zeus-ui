<script setup lang="ts">
import { Input } from '@zeus-web/input/vue'
import { ref } from 'vue'
import '@zeus-web/themes/default.css'

const value = ref('')
</script>

<template>
  <div class="page">
    <h1 class="title">
      Zeus Web - Vue 3 Demo
    </h1>
    <div class="card">
      <h2 class="subtitle">
        Input 组件（Vue 3）
      </h2>
      <Input v-model:value="value" placeholder="请输入内容..." />
      <p class="value-text">
        当前值:
        <span class="value-display">{{ value || '(空)' }}</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  padding: 2rem;
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
  min-height: 100vh;
}
.title {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  color: hsl(var(--foreground));
}
.card {
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  padding: 1.5rem;
  border-radius: var(--radius);
  border: 1px solid hsl(var(--border));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  max-width: 400px;
}
.subtitle {
  font-size: 1rem;
  margin-bottom: 1rem;
  color: hsl(var(--muted-foreground));
}
.value-text {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}
.value-display {
  color: hsl(var(--foreground));
  font-weight: 500;
}
</style>
