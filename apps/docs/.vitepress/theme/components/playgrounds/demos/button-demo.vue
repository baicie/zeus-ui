<script setup lang="ts">
import { ref } from 'vue'

const pressCount = ref(0)

function handlePress(): void {
  pressCount.value += 1
}
</script>

<template>
  <div class="primitive-demo" data-playground-demo="button">
    <div class="demo-row">
      <zw-button variant="primary" @press="handlePress">Primary</zw-button>
      <zw-button variant="outline" @press="handlePress">Outline</zw-button>
      <zw-button variant="danger" @press="handlePress">Delete</zw-button>
      <zw-button loading>Loading</zw-button>
      <zw-button disabled>Disabled</zw-button>
    </div>
    <p class="demo-status">Press events: {{ pressCount }}</p>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 1rem;
}

.demo-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.demo-status {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}
</style>
