<script setup lang="ts">
import type {
  ShowcaseThemeMode,
  ShowcaseThemeName,
  ShowcaseThemeSnippetKind,
} from '@zeus-web/example-showcase-shared'
import type { MotionPresetName, RadiusPresetName } from '@zeus-web/themes'
import {
  createShowcaseThemeSnippet,
  createShowcaseThemeStyle,
  formatShowcaseThemeTokenCssVar,
  semanticTokens,
  showcaseDarkModeStrategies,
  showcaseMotionPresets,
  showcaseRadiusPresets,
  showcaseThemeModes,
  showcaseThemes,
  showcaseThemeTokenGroups,
} from '@zeus-web/example-showcase-shared'
import { computed, ref } from 'vue'

/* eslint-disable no-restricted-globals */

const snippetKinds: Array<{
  kind: ShowcaseThemeSnippetKind
  label: string
}> = [
  { kind: 'css', label: 'CSS import' },
  { kind: 'html', label: 'HTML usage' },
  { kind: 'tokens', label: 'Token usage' },
]

const activeTheme = ref<ShowcaseThemeName>('default')
const mode = ref<ShowcaseThemeMode>('light')
const radius = ref<RadiusPresetName>('md')
const motion = ref<MotionPresetName>('normal')
const activeSnippet = ref<ShowcaseThemeSnippetKind>('css')
const copiedSnippet = ref<ShowcaseThemeSnippetKind | null>(null)

const themeStyle = computed(() => {
  return createShowcaseThemeStyle({
    themeName: activeTheme.value,
    mode: mode.value,
    radius: radius.value,
    motion: motion.value,
  })
})

const activeThemeMeta = computed(() => {
  return showcaseThemes.find(theme => theme.name === activeTheme.value)
})

const activeSnippetCode = computed(() => {
  return createShowcaseThemeSnippet(activeSnippet.value, {
    themeName: activeTheme.value,
    mode: mode.value,
    radius: radius.value,
    motion: motion.value,
  })
})

function setActiveTheme(themeName: string) {
  activeTheme.value = themeName as ShowcaseThemeName
}

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

async function copySnippet(kind: ShowcaseThemeSnippetKind) {
  await copyText(
    createShowcaseThemeSnippet(kind, {
      themeName: activeTheme.value,
      mode: mode.value,
      radius: radius.value,
      motion: motion.value,
    }),
  )

  copiedSnippet.value = kind

  window.setTimeout(() => {
    if (copiedSnippet.value === kind) {
      copiedSnippet.value = null
    }
  }, 1200)
}
</script>

<template>
  <div class="showcase-page">
    <header class="showcase-page-header">
      <p class="showcase-eyebrow">Foundations</p>
      <h1 class="showcase-title">Themes</h1>
      <p class="showcase-description">
        Explore Zeus Web theme variants, semantic tokens, dark mode, radius
        presets, motion presets and component-level previews.
      </p>

      <div class="showcase-page-meta">
        <span class="showcase-badge">{{ showcaseThemes.length }} themes</span>
        <span class="showcase-badge">
          {{ semanticTokens.length }} semantic tokens
        </span>
        <span class="showcase-badge">
          {{ showcaseRadiusPresets.length }} radius presets
        </span>
        <span class="showcase-badge">
          {{ showcaseMotionPresets.length }} motion presets
        </span>
      </div>
    </header>

    <section class="showcase-section">
      <h2 class="showcase-section-title">Theme variants</h2>

      <div class="showcase-theme-variant-grid">
        <button
          v-for="theme in showcaseThemes"
          :key="theme.name"
          type="button"
          class="showcase-theme-variant-card"
          :data-active="theme.name === activeTheme"
          :aria-pressed="theme.name === activeTheme"
          @click="setActiveTheme(theme.name)"
        >
          <span class="showcase-theme-variant-title">{{ theme.label }}</span>
          <span class="showcase-theme-variant-description">
            {{ theme.description }}
          </span>
          <code>{{ theme.cssImport }}</code>
        </button>
      </div>
    </section>

    <section class="showcase-theme-toolbar" aria-label="Theme controls">
      <label class="showcase-theme-control">
        <span>Mode</span>
        <select v-model="mode" aria-label="Theme mode">
          <option v-for="item in showcaseThemeModes" :key="item" :value="item">
            {{ item }}
          </option>
        </select>
      </label>

      <label class="showcase-theme-control">
        <span>Radius</span>
        <select v-model="radius" aria-label="Radius preset">
          <option
            v-for="item in showcaseRadiusPresets"
            :key="item.name"
            :value="item.name"
          >
            {{ item.label }} · {{ item.value }}
          </option>
        </select>
      </label>

      <label class="showcase-theme-control">
        <span>Motion</span>
        <select v-model="motion" aria-label="Motion preset">
          <option
            v-for="item in showcaseMotionPresets"
            :key="item.name"
            :value="item.name"
          >
            {{ item.label }}
          </option>
        </select>
      </label>
    </section>

    <section class="showcase-theme-preview-layout">
      <div
        class="showcase-theme-preview"
        :data-mode="mode"
        :data-theme="activeTheme"
        :data-motion="motion"
        :style="themeStyle"
      >
        <div class="showcase-theme-preview-header">
          <div>
            <span class="showcase-badge">{{ activeThemeMeta?.label }}</span>
            <h2>Component preview</h2>
            <p>
              This preview is scoped with local CSS variables, so switching
              themes does not mutate the whole showcase shell.
            </p>
          </div>

          <button class="showcase-theme-button" type="button">
            Primary action
          </button>
        </div>

        <div class="showcase-theme-component-grid">
          <article class="showcase-theme-surface-card">
            <span class="showcase-badge">Card</span>
            <h3>Project health</h3>
            <p>
              Surface, text, border and muted tokens update with the selected
              theme.
            </p>
            <div class="showcase-theme-progress">
              <span />
            </div>
          </article>

          <article class="showcase-theme-surface-card">
            <span class="showcase-badge">Form</span>
            <label class="showcase-theme-form-field">
              <span>Email</span>
              <input value="zeus@example.com" />
            </label>
            <button class="showcase-theme-secondary-button" type="button">
              Save settings
            </button>
          </article>

          <article class="showcase-theme-alert-card">
            <span class="showcase-badge">Feedback</span>
            <h3>Destructive token</h3>
            <p>Used by alert, validation and danger actions.</p>
          </article>
        </div>
      </div>

      <aside class="showcase-theme-snippet-card">
        <div class="showcase-theme-snippet-tabs">
          <button
            v-for="item in snippetKinds"
            :key="item.kind"
            type="button"
            :data-active="item.kind === activeSnippet"
            @click="activeSnippet = item.kind"
          >
            {{ item.label }}
          </button>
        </div>

        <pre
          class="showcase-code showcase-theme-snippet"
        ><code>{{ activeSnippetCode }}</code></pre>

        <button
          type="button"
          class="showcase-theme-copy-button"
          @click="copySnippet(activeSnippet)"
        >
          {{ copiedSnippet === activeSnippet ? 'Copied' : 'Copy snippet' }}
        </button>
      </aside>
    </section>

    <section class="showcase-section">
      <h2 class="showcase-section-title">Semantic token palette</h2>

      <div
        class="showcase-theme-token-groups"
        :data-mode="mode"
        :style="themeStyle"
      >
        <article
          v-for="group in showcaseThemeTokenGroups"
          :key="group.name"
          class="showcase-theme-token-group"
        >
          <h3>{{ group.name }}</h3>

          <div class="showcase-theme-token-grid">
            <div
              v-for="token in group.tokens"
              :key="token"
              class="showcase-theme-token-card"
            >
              <span
                class="showcase-theme-token-swatch"
                :style="{ background: formatShowcaseThemeTokenCssVar(token) }"
              />
              <code>{{ token }}</code>
              <small>{{ formatShowcaseThemeTokenCssVar(token) }}</small>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section class="showcase-section">
      <h2 class="showcase-section-title">Dark mode strategies</h2>

      <div class="showcase-grid showcase-grid-3">
        <div
          v-for="strategy in showcaseDarkModeStrategies"
          :key="strategy.name"
          class="showcase-card"
        >
          <h3 class="showcase-card-title">{{ strategy.label }}</h3>
          <p class="showcase-card-description">
            Strategy option exposed by @zeus-web/themes.
          </p>
          <pre class="showcase-code">{{ strategy.name }}</pre>
        </div>
      </div>
    </section>
  </div>
</template>
