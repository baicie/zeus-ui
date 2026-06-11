<script setup lang="ts">
defineProps<{
  to: string
  title: string
  description: string
  badge?: string
}>()
</script>

<template>
  <RouterLink :to="to" class="showcase-card">
    <div style="display: flex; justify-content: space-between; gap: 1rem">
      <div>
        <h3 class="showcase-card-title">{{ title }}</h3>
        <p class="showcase-card-description">{{ description }}</p>
      </div>

      <span v-if="badge" class="showcase-badge">{{ badge }}</span>
    </div>
  </RouterLink>
</template>
