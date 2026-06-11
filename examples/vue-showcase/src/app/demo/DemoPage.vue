<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  description: string
}>()
</script>

<template>
  <div class="showcase-page">
    <header class="showcase-page-header">
      <p v-if="eyebrow" class="showcase-eyebrow">{{ eyebrow }}</p>
      <h1 class="showcase-title">{{ title }}</h1>
      <p class="showcase-description">{{ description }}</p>

      <div v-if="$slots.meta" class="showcase-page-meta">
        <slot name="meta" />
      </div>
    </header>

    <div class="showcase-demo-stack">
      <slot />
    </div>
  </div>
</template>
