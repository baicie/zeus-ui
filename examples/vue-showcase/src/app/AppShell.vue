<script setup lang="ts">
import Sidebar from './Sidebar.vue'
import Topbar from './Topbar.vue'
</script>

<template>
  <div class="showcase-shell">
    <Topbar />

    <div class="showcase-layout">
      <Sidebar />

      <main class="showcase-content">
        <slot />
      </main>
    </div>
  </div>
</template>
