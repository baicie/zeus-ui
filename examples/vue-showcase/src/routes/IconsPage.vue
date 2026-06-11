<script setup lang="ts">
import type {
  ShowcaseIcon,
  ShowcaseIconCategory,
  ShowcaseIconCopyKind,
} from '@zeus-web/example-showcase-shared'
import {
  createShowcaseIconSnippet,
  showcaseIcons,
} from '@zeus-web/example-showcase-shared'
import { iconSources } from '@zeus-web/icons'
import { computed, ref } from 'vue'

type IconPreviewTone = 'foreground' | 'primary' | 'muted' | 'destructive'

const iconSourceByName = new Map(iconSources.map(icon => [icon.name, icon.svg]))

const copyKinds: readonly ShowcaseIconCopyKind[] = ['react', 'vue', 'wc', 'raw']

const sizeOptions = [16, 20, 24, 32, 40] as const

const toneOptions: Array<{ label: string, value: IconPreviewTone }> = [
  { label: 'currentColor', value: 'foreground' },
  { label: 'primary', value: 'primary' },
  { label: 'muted', value: 'muted' },
  { label: 'destructive', value: 'destructive' },
]

const query = ref('')
const activeCategory = ref<ShowcaseIconCategory | 'all'>('all')
const previewSize = ref<(typeof sizeOptions)[number]>(24)
const previewTone = ref<IconPreviewTone>('foreground')
const copiedKey = ref<string | null>(null)

const categories = computed<Array<ShowcaseIconCategory | 'all'>>(() => {
  return [
    'all',
    ...Array.from(new Set(showcaseIcons.map(icon => icon.category))).sort(),
  ]
})

const filteredIcons = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  return showcaseIcons.filter(icon => {
    const categoryMatched =
      activeCategory.value === 'all' || icon.category === activeCategory.value
    if (!categoryMatched) return false
    if (!normalizedQuery) return true
    return (
      icon.name.includes(normalizedQuery) ||
      icon.label.toLowerCase().includes(normalizedQuery) ||
      icon.category.includes(normalizedQuery) ||
      icon.tags.some(tag => tag.includes(normalizedQuery))
    )
  })
})

function getIconSvg(iconName: string): string {
  return iconSourceByName.get(iconName) ?? ''
}

/* eslint-disable no-restricted-globals */
async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}

async function copySnippet(icon: ShowcaseIcon, kind: ShowcaseIconCopyKind) {
  const key = `${icon.name}:${kind}`
  await copyText(createShowcaseIconSnippet(icon, kind))
  copiedKey.value = key
  window.setTimeout(() => {
    if (copiedKey.value === key) {
      copiedKey.value = null
    }
  }, 1200)
}
</script>

<template>
  <div class="showcase-page">
    <header class="showcase-page-header">
      <p class="showcase-eyebrow">Foundations</p>
      <h1 class="showcase-title">Icons</h1>
      <p class="showcase-description">
        Browse Zeus Web recommended icons, verify currentColor rendering, and
        copy framework-specific imports for React, Vue, Web Components and raw
        SVG assets.
      </p>
      <div class="showcase-page-meta">
        <span class="showcase-badge">{{ showcaseIcons.length }} icons</span>
        <span class="showcase-badge">
          {{ categories.length - 1 }} categories
        </span>
        <span class="showcase-badge">currentColor ready</span>
      </div>
    </header>

    <section class="showcase-icon-toolbar" aria-label="Icon controls">
      <label class="showcase-icon-control">
        <span>Search</span>
        <input
          v-model="query"
          aria-label="Search icons"
          class="showcase-icon-input"
          type="search"
          placeholder="Search check, menu, settings..."
        >
      </label>

      <label class="showcase-icon-control">
        <span>Size</span>
        <select
          v-model.number="previewSize"
          aria-label="Icon preview size"
          class="showcase-icon-select"
        >
          <option v-for="size in sizeOptions" :key="size" :value="size">
            {{ size }}px
          </option>
        </select>
      </label>

      <label class="showcase-icon-control">
        <span>Color</span>
        <select
          v-model="previewTone"
          aria-label="Icon preview color"
          class="showcase-icon-select"
        >
          <option
            v-for="tone in toneOptions"
            :key="tone.value"
            :value="tone.value"
          >
            {{ tone.label }}
          </option>
        </select>
      </label>
    </section>

    <section class="showcase-icon-categories" aria-label="Icon categories">
      <button
        v-for="category in categories"
        :key="category"
        type="button"
        class="showcase-icon-filter"
        :data-active="category === activeCategory"
        :aria-pressed="category === activeCategory"
        @click="activeCategory = category"
      >
        {{ category }}
      </button>
    </section>

    <section
      v-if="filteredIcons.length > 0"
      class="showcase-icon-grid"
      aria-label="Icon grid"
    >
      <article
        v-for="icon in filteredIcons"
        :key="icon.name"
        class="showcase-icon-card"
      >
        <div
          class="showcase-icon-preview"
          :data-tone="previewTone"
          :style="{
            width: `${previewSize}px`,
            height: `${previewSize}px`,
          }"
          aria-hidden="true"
          v-html="getIconSvg(icon.name)"
        />

        <div class="showcase-icon-card-main">
          <h2 class="showcase-card-title">{{ icon.label }}</h2>
          <p class="showcase-card-description">{{ icon.name }}</p>
          <div class="showcase-icon-tags">
            <span class="showcase-badge">{{ icon.category }}</span>
            <span v-for="tag in icon.tags" :key="tag" class="showcase-badge">
              {{ tag }}
            </span>
          </div>
        </div>

        <div class="showcase-icon-copy-grid">
          <button
            v-for="kind in copyKinds"
            :key="kind"
            type="button"
            class="showcase-icon-copy"
            :aria-label="`Copy ${
              kind === 'raw' ? 'raw svg' : kind.toUpperCase()
            } import for ${icon.label}`"
            @click="copySnippet(icon, kind)"
          >
            {{
              copiedKey === `${icon.name}:${kind}`
                ? `Copied ${kind.toUpperCase()}`
                : `Copy ${kind.toUpperCase()}`
            }}
          </button>
        </div>

        <pre class="showcase-code showcase-icon-code"><code>{{
          createShowcaseIconSnippet(icon, 'vue')
        }}</code></pre>
      </article>
    </section>

    <div v-else class="showcase-empty">
      No icons found. Try searching for check, menu, settings, warning or theme.
    </div>
  </div>
</template>
