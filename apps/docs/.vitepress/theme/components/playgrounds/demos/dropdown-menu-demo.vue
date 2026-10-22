<script setup lang="ts">
import { computed, ref } from 'vue'

import { useLocalizedMessages } from '../../../composables/use-docs-locale'

interface SelectionDetail {
  value?: string
}

const selected = ref('')
const messages = useLocalizedMessages({
  en: {
    trigger: 'Project actions',
    rename: 'Rename project',
    duplicate: 'Duplicate project',
    archive: 'Archive project',
    selected: 'Selected action',
    none: 'None',
  },
  zh: {
    trigger: '项目操作',
    rename: '重命名项目',
    duplicate: '复制项目',
    archive: '归档项目',
    selected: '已选操作',
    none: '无',
  },
})

const selectedLabel = computed(() => {
  if (selected.value === 'rename') return messages.value.rename
  if (selected.value === 'duplicate') return messages.value.duplicate
  if (selected.value === 'archive') return messages.value.archive
  return messages.value.none
})

function handleSelect(event: Event): void {
  const detail = (event as CustomEvent<SelectionDetail>).detail
  if (typeof detail?.value === 'string') selected.value = detail.value
}
</script>

<template>
  <div class="primitive-demo" data-playground-demo="dropdown-menu">
    <zw-dropdown-menu @select="handleSelect">
      <zw-dropdown-menu-trigger>{{
        messages.trigger
      }}</zw-dropdown-menu-trigger>
      <zw-dropdown-menu-content>
        <zw-dropdown-menu-item value="rename">
          {{ messages.rename }}
        </zw-dropdown-menu-item>
        <zw-dropdown-menu-item value="duplicate">
          {{ messages.duplicate }}
        </zw-dropdown-menu-item>
        <zw-dropdown-menu-item value="archive">
          {{ messages.archive }}
        </zw-dropdown-menu-item>
      </zw-dropdown-menu-content>
    </zw-dropdown-menu>
    <p class="demo-status">
      {{ messages.selected }}: <strong>{{ selectedLabel }}</strong>
    </p>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
}

.demo-status {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}
</style>
