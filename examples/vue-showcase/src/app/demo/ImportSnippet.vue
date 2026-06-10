<script setup lang="ts">
defineProps<{
  title: string
  value?: string
}>()
</script>

<template>
  <div class="showcase-card">
    <h3 class="showcase-card-title">{{ title }}</h3>
    <pre class="showcase-code">{{ value || 'Not planned' }}</pre>
  </div>
</template>
