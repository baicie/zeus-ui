<script setup lang="ts">
import { Input } from '@zeus-web/input/vue'
import { ref } from 'vue'

const value = ref('')

function handleChange(e: CustomEvent<{ value: string }>) {
  value.value = e.detail.value
}
</script>

<template>
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 2rem; background: #f5f5f5; color: #333; min-height: 100vh;">
    <h1 style="font-size: 1.5rem; margin-bottom: 1.5rem;">
      Zeus Web - Vue 3 Demo
    </h1>
    <div style="background: #fff; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.1); max-width: 400px;">
      <h2 style="font-size: 1rem; margin-bottom: 1rem; color: #666;">
        Input 组件（Vue 3）
      </h2>
      <Input
        placeholder="请输入内容..."
        :value="value"
        @value-change="handleChange"
      />
      <p style="margin-top: 1rem; font-size: .875rem; color: #666;">
        当前值: <span style="color: #333; font-weight: 500;">{{ value || '(空)' }}</span>
      </p>
    </div>
  </div>
</template>
