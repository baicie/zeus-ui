<script setup lang="ts">
withDefaults(
  defineProps<{
    columns?: 1 | 2 | 3
  }>(),
  {
    columns: 2,
  },
)
</script>

<template>
  <div :class="`showcase-demo-grid showcase-demo-grid-${columns}`">
    <slot />
  </div>
</template>
