<script setup lang="ts">
defineProps<{
  states: string[]
}>()
</script>

<template>
  <div v-if="states.length === 0" class="showcase-empty">
    No states documented yet.
  </div>

  <div v-else class="showcase-state-matrix">
    <div v-for="state in states" :key="state" class="showcase-state-cell">
      <span class="showcase-badge">{{ state }}</span>
      <div class="showcase-state-preview">
        <span>{{ state }}</span>
      </div>
    </div>
  </div>
</template>
