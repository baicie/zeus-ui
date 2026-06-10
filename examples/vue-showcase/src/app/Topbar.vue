<script setup lang="ts">
import { showcaseComponents } from '@zeus-web/example-showcase-shared'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const searchValue = ref('')

const currentComponent = computed(() => {
  const componentName = route.params.componentName

  return typeof componentName === 'string' ? componentName : ''
})

function handleSearch() {
  const normalized = searchValue.value.trim().toLowerCase()

  if (!normalized) return

  const component = showcaseComponents.find(item => {
    return (
      item.name.includes(normalized) ||
      item.title.toLowerCase().includes(normalized) ||
      item.group.toLowerCase().includes(normalized)
    )
  })

  if (!component) return

  void router.push(component.routePath)
}
</script>

<template>
  <header class="showcase-topbar">
    <div class="showcase-topbar-inner">
      <RouterLink class="showcase-brand" to="/">
        <span class="showcase-brand-mark">Z</span>
        <span>Zeus Web Vue Showcase</span>
      </RouterLink>

      <input
        v-model="searchValue"
        aria-label="Search components"
        class="showcase-search"
        :placeholder="currentComponent || 'Search components...'"
        @keydown.enter="handleSearch"
      />

      <span aria-hidden="true" class="showcase-badge">Vue</span>
    </div>
  </header>
</template>
