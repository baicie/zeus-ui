<script setup lang="ts">
defineProps<{
  tokens: string[]
}>()
</script>

<template>
  <div v-if="tokens.length === 0" class="showcase-empty">
    No theme tokens documented yet.
  </div>

  <div v-else class="showcase-token-grid">
    <div v-for="token in tokens" :key="token" class="showcase-token-card">
      <span class="showcase-badge">{{ token }}</span>
      <div
        class="showcase-token-swatch"
        :style="{ background: `hsl(var(--${token}))` }"
      />
    </div>
  </div>
</template>
