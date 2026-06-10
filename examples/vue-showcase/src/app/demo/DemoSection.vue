<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <section class="showcase-demo-section">
    <header class="showcase-demo-section-header">
      <h2 class="showcase-section-title">{{ title }}</h2>
      <p v-if="description" class="showcase-card-description">
        {{ description }}
      </p>
    </header>

    <div class="showcase-demo-section-body">
      <slot />
    </div>
  </section>
</template>
