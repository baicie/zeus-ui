下面按当前 `mvp-examples` 仓库状态给 Phase 10。当前 `/themes` 在 React/Vue 都还是占位：文案明确写着 interactive switching later phase。
shared 目前只暴露 `showcaseThemes` 和 `semanticTokens`。 但 `@zeus-web/themes` 包已经有 theme names、semantic tokens、radius、motion、dark strategy、theme registry 等能力。

Phase 10 要做的是：把 `/themes` 从“列表页”升级成 **Theme Laboratory**。

---

# Phase 10 目标

```txt
/themes
  - 主题切换：default / slate / zinc / neutral / stone
  - 明暗模式切换：light / dark
  - radius preset 切换：none / sm / md / lg / xl
  - motion preset 切换：none / reduced / normal / expressive
  - semantic token palette
  - component preview
  - CSS import / HTML usage / token usage snippet copy
  - React / Vue 两端能力一致
```

注意：**不要在 ThemesPage 里 import 所有主题 css**。原因是主题 CSS 里有 `:root, [data-theme='slate']` 这种选择器，全部 import 会互相覆盖全局 root。
所以 Phase 10 最稳实现是：页面用 `@zeus-web/themes` 的 token registry + dark token snapshot 生成局部 inline CSS variables。

---

# 1. 修改 `examples/showcase-shared/package.json`

新增 `@zeus-web/themes` 依赖，因为 shared 层要读取主题包元数据。

```json
{
  "name": "@zeus-web/example-showcase-shared",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "scripts": {
    "build": "pnpm check",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "cd ../.. && pnpm vitest --project unit --run scripts/checks/__tests__/showcase-metadata/metadata.spec.ts"
  },
  "dependencies": {
    "@zeus-web/themes": "workspace:*"
  }
}
```

---

# 2. 替换 `examples/showcase-shared/src/themes.ts`

```ts
import {
  darkModeStrategyNames,
  motionPresetNames,
  motionPresets,
  radiusPresetNames,
  radiusPresets,
  semanticColorTokens,
  themeCssImports,
  themeNames,
  themeRegistry,
  type MotionPresetName,
  type RadiusPresetName,
  type SemanticColorToken,
  type ThemeName,
} from '@zeus-web/themes'

import type { ShowcaseTheme } from './types'

export type ShowcaseThemeName = ThemeName
export type ShowcaseThemeMode = 'light' | 'dark'
export type ShowcaseThemeSnippetKind = 'css' | 'html' | 'tokens'
export type ShowcaseThemeStyle = Record<`--${string}`, string>

export interface ShowcaseThemeStyleOptions {
  themeName: ShowcaseThemeName
  mode: ShowcaseThemeMode
  radius: RadiusPresetName
  motion: MotionPresetName
}

export interface ShowcaseThemeTokenGroup {
  name: string
  tokens: readonly SemanticColorToken[]
}

const themeDescriptions: Record<ThemeName, string> = {
  default: 'Default Zeus Web theme.',
  slate: 'Cool neutral theme.',
  zinc: 'Modern neutral theme.',
  neutral: 'Balanced neutral theme.',
  stone: 'Warm neutral theme.',
}

const themeLabels: Record<ThemeName, string> = {
  default: 'Default',
  slate: 'Slate',
  zinc: 'Zinc',
  neutral: 'Neutral',
  stone: 'Stone',
}

const darkColors: Record<ThemeName, Record<SemanticColorToken, string>> = {
  default: {
    background: '240 10% 3.9%',
    foreground: '0 0% 98%',
    card: '240 10% 3.9%',
    'card-foreground': '0 0% 98%',
    popover: '240 10% 3.9%',
    'popover-foreground': '0 0% 98%',
    primary: '0 0% 98%',
    'primary-foreground': '240 5.9% 10%',
    secondary: '240 3.7% 15.9%',
    'secondary-foreground': '0 0% 98%',
    muted: '240 3.7% 15.9%',
    'muted-foreground': '240 5% 64.9%',
    accent: '240 3.7% 15.9%',
    'accent-foreground': '0 0% 98%',
    destructive: '0 62.8% 30.6%',
    'destructive-foreground': '0 0% 98%',
    border: '240 3.7% 15.9%',
    input: '240 3.7% 15.9%',
    ring: '240 4.9% 83.9%',
  },
  slate: {
    background: '222.2 84% 4.9%',
    foreground: '210 40% 98%',
    card: '222.2 84% 4.9%',
    'card-foreground': '210 40% 98%',
    popover: '222.2 84% 4.9%',
    'popover-foreground': '210 40% 98%',
    primary: '210 40% 98%',
    'primary-foreground': '222.2 47.4% 11.2%',
    secondary: '217.2 32.6% 17.5%',
    'secondary-foreground': '210 40% 98%',
    muted: '217.2 32.6% 17.5%',
    'muted-foreground': '215 20.2% 65.1%',
    accent: '217.2 32.6% 17.5%',
    'accent-foreground': '210 40% 98%',
    destructive: '0 62.8% 30.6%',
    'destructive-foreground': '210 40% 98%',
    border: '217.2 32.6% 17.5%',
    input: '217.2 32.6% 17.5%',
    ring: '212.7 26.8% 83.9%',
  },
  zinc: {
    background: '240 10% 3.9%',
    foreground: '0 0% 98%',
    card: '240 10% 3.9%',
    'card-foreground': '0 0% 98%',
    popover: '240 10% 3.9%',
    'popover-foreground': '0 0% 98%',
    primary: '0 0% 98%',
    'primary-foreground': '240 5.9% 10%',
    secondary: '240 3.7% 15.9%',
    'secondary-foreground': '0 0% 98%',
    muted: '240 3.7% 15.9%',
    'muted-foreground': '240 5% 64.9%',
    accent: '240 3.7% 15.9%',
    'accent-foreground': '0 0% 98%',
    destructive: '0 62.8% 30.6%',
    'destructive-foreground': '0 0% 98%',
    border: '240 3.7% 15.9%',
    input: '240 3.7% 15.9%',
    ring: '240 4.9% 83.9%',
  },
  neutral: {
    background: '0 0% 3.9%',
    foreground: '0 0% 98%',
    card: '0 0% 3.9%',
    'card-foreground': '0 0% 98%',
    popover: '0 0% 3.9%',
    'popover-foreground': '0 0% 98%',
    primary: '0 0% 98%',
    'primary-foreground': '0 0% 9%',
    secondary: '0 0% 14.9%',
    'secondary-foreground': '0 0% 98%',
    muted: '0 0% 14.9%',
    'muted-foreground': '0 0% 63.9%',
    accent: '0 0% 14.9%',
    'accent-foreground': '0 0% 98%',
    destructive: '0 62.8% 30.6%',
    'destructive-foreground': '0 0% 98%',
    border: '0 0% 14.9%',
    input: '0 0% 14.9%',
    ring: '0 0% 83.1%',
  },
  stone: {
    background: '20 14.3% 4.1%',
    foreground: '60 9.1% 97.8%',
    card: '20 14.3% 4.1%',
    'card-foreground': '60 9.1% 97.8%',
    popover: '20 14.3% 4.1%',
    'popover-foreground': '60 9.1% 97.8%',
    primary: '60 9.1% 97.8%',
    'primary-foreground': '24 9.8% 10%',
    secondary: '12 6.5% 15.1%',
    'secondary-foreground': '60 9.1% 97.8%',
    muted: '12 6.5% 15.1%',
    'muted-foreground': '24 5.4% 63.9%',
    accent: '12 6.5% 15.1%',
    'accent-foreground': '60 9.1% 97.8%',
    destructive: '0 62.8% 30.6%',
    'destructive-foreground': '60 9.1% 97.8%',
    border: '12 6.5% 15.1%',
    input: '12 6.5% 15.1%',
    ring: '24 5.7% 82.9%',
  },
}

export const showcaseThemes: ShowcaseTheme[] = themeNames.map(themeName => ({
  name: themeName,
  label: themeLabels[themeName],
  cssImport: themeCssImports[themeName],
  description: themeDescriptions[themeName],
}))

export const semanticTokens = semanticColorTokens

export const showcaseThemeModes = ['light', 'dark'] as const

export const showcaseRadiusPresets = radiusPresetNames.map(name => ({
  name,
  label: name,
  value: radiusPresets[name],
}))

export const showcaseMotionPresets = motionPresetNames.map(name => ({
  name,
  label: name,
  value: motionPresets[name],
}))

export const showcaseDarkModeStrategies = darkModeStrategyNames.map(name => ({
  name,
  label: name,
}))

export const showcaseThemeTokenGroups: ShowcaseThemeTokenGroup[] = [
  {
    name: 'Surface',
    tokens: [
      'background',
      'foreground',
      'card',
      'card-foreground',
      'popover',
      'popover-foreground',
    ],
  },
  {
    name: 'Brand',
    tokens: [
      'primary',
      'primary-foreground',
      'secondary',
      'secondary-foreground',
      'accent',
      'accent-foreground',
    ],
  },
  {
    name: 'Feedback',
    tokens: ['destructive', 'destructive-foreground', 'ring'],
  },
  {
    name: 'Control',
    tokens: ['border', 'input', 'muted', 'muted-foreground'],
  },
]

export function getShowcaseThemeColors(
  themeName: ShowcaseThemeName,
  mode: ShowcaseThemeMode,
): Record<SemanticColorToken, string> {
  if (mode === 'dark') {
    return darkColors[themeName]
  }

  return themeRegistry[themeName].colors
}

export function createShowcaseThemeStyle(
  options: ShowcaseThemeStyleOptions,
): ShowcaseThemeStyle {
  const colors = getShowcaseThemeColors(options.themeName, options.mode)
  const radius = radiusPresets[options.radius]
  const motion = motionPresets[options.motion]

  const style: ShowcaseThemeStyle = {
    '--radius': radius,
    '--zw-radius': 'var(--radius)',
    '--zw-radius-sm': 'calc(var(--radius) - 4px)',
    '--zw-radius-md': 'calc(var(--radius) - 2px)',
    '--zw-radius-lg': 'var(--radius)',
    '--zw-radius-xl': 'calc(var(--radius) + 4px)',
    '--zw-duration-fast': motion.durationFast,
    '--zw-duration-normal': motion.durationNormal,
    '--zw-duration-slow': motion.durationSlow,
    '--zw-easing-standard': motion.easingStandard,
    '--zw-easing-emphasized': motion.easingEmphasized,
  }

  for (const token of semanticColorTokens) {
    style[`--${token}`] = colors[token]
  }

  style['--zw-background'] = 'var(--background)'
  style['--zw-foreground'] = 'var(--foreground)'
  style['--zw-primary'] = 'var(--primary)'
  style['--zw-primary-foreground'] = 'var(--primary-foreground)'
  style['--zw-border'] = 'var(--border)'
  style['--zw-input'] = 'var(--input)'
  style['--zw-ring'] = 'var(--ring)'

  return style
}

export function createShowcaseThemeSnippet(
  kind: ShowcaseThemeSnippetKind,
  options: ShowcaseThemeStyleOptions,
): string {
  switch (kind) {
    case 'css':
      return `import '${themeCssImports[options.themeName]}'`

    case 'html':
      return `<section
  data-theme="${options.themeName}"
  data-mode="${options.mode}"
  data-motion="${options.motion}"
  style="--radius: ${radiusPresets[options.radius]}"
>
  ...
</section>`

    case 'tokens':
      return `background: hsl(var(--background));
foreground: hsl(var(--foreground));
primary: hsl(var(--primary));
radius: var(--zw-radius-lg);
duration: var(--zw-duration-normal);`

    default:
      return ''
  }
}
```

---

# 3. 替换 `examples/react-showcase/src/routes/ThemesPage.tsx`

```tsx
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'

import {
  createShowcaseThemeSnippet,
  createShowcaseThemeStyle,
  semanticTokens,
  showcaseDarkModeStrategies,
  showcaseMotionPresets,
  showcaseRadiusPresets,
  showcaseThemeModes,
  showcaseThemeTokenGroups,
  showcaseThemes,
  type ShowcaseThemeMode,
  type ShowcaseThemeName,
  type ShowcaseThemeSnippetKind,
} from '@zeus-web/example-showcase-shared'
import type { MotionPresetName, RadiusPresetName } from '@zeus-web/themes'

const snippetKinds: Array<{
  kind: ShowcaseThemeSnippetKind
  label: string
}> = [
  { kind: 'css', label: 'CSS import' },
  { kind: 'html', label: 'HTML usage' },
  { kind: 'tokens', label: 'Token usage' },
]

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

export function ThemesPage() {
  const [activeTheme, setActiveTheme] = useState<ShowcaseThemeName>('default')
  const [mode, setMode] = useState<ShowcaseThemeMode>('light')
  const [radius, setRadius] = useState<RadiusPresetName>('md')
  const [motion, setMotion] = useState<MotionPresetName>('normal')
  const [activeSnippet, setActiveSnippet] =
    useState<ShowcaseThemeSnippetKind>('css')
  const [copiedSnippet, setCopiedSnippet] =
    useState<ShowcaseThemeSnippetKind | null>(null)

  const themeStyle = useMemo(() => {
    return createShowcaseThemeStyle({
      themeName: activeTheme,
      mode,
      radius,
      motion,
    })
  }, [activeTheme, mode, radius, motion])

  const activeThemeMeta = showcaseThemes.find(
    theme => theme.name === activeTheme,
  )
  const activeSnippetCode = createShowcaseThemeSnippet(activeSnippet, {
    themeName: activeTheme,
    mode,
    radius,
    motion,
  })

  async function handleCopy(kind: ShowcaseThemeSnippetKind) {
    await copyText(
      createShowcaseThemeSnippet(kind, {
        themeName: activeTheme,
        mode,
        radius,
        motion,
      }),
    )

    setCopiedSnippet(kind)

    window.setTimeout(() => {
      setCopiedSnippet(current => (current === kind ? null : current))
    }, 1200)
  }

  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">Foundations</p>
        <h1 className="showcase-title">Themes</h1>
        <p className="showcase-description">
          Explore Zeus Web theme variants, semantic tokens, dark mode, radius
          presets, motion presets and component-level previews.
        </p>

        <div className="showcase-page-meta">
          <span className="showcase-badge">{showcaseThemes.length} themes</span>
          <span className="showcase-badge">
            {semanticTokens.length} semantic tokens
          </span>
          <span className="showcase-badge">
            {showcaseRadiusPresets.length} radius presets
          </span>
          <span className="showcase-badge">
            {showcaseMotionPresets.length} motion presets
          </span>
        </div>
      </header>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Theme variants</h2>

        <div className="showcase-theme-variant-grid">
          {showcaseThemes.map(theme => (
            <button
              key={theme.name}
              type="button"
              className="showcase-theme-variant-card"
              data-active={theme.name === activeTheme}
              aria-pressed={theme.name === activeTheme}
              onClick={() => setActiveTheme(theme.name as ShowcaseThemeName)}
            >
              <span className="showcase-theme-variant-title">
                {theme.label}
              </span>
              <span className="showcase-theme-variant-description">
                {theme.description}
              </span>
              <code>{theme.cssImport}</code>
            </button>
          ))}
        </div>
      </section>

      <section className="showcase-theme-toolbar" aria-label="Theme controls">
        <label className="showcase-theme-control">
          <span>Mode</span>
          <select
            aria-label="Theme mode"
            value={mode}
            onChange={event => {
              setMode(event.currentTarget.value as ShowcaseThemeMode)
            }}
          >
            {showcaseThemeModes.map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="showcase-theme-control">
          <span>Radius</span>
          <select
            aria-label="Radius preset"
            value={radius}
            onChange={event => {
              setRadius(event.currentTarget.value as RadiusPresetName)
            }}
          >
            {showcaseRadiusPresets.map(item => (
              <option key={item.name} value={item.name}>
                {item.label} · {item.value}
              </option>
            ))}
          </select>
        </label>

        <label className="showcase-theme-control">
          <span>Motion</span>
          <select
            aria-label="Motion preset"
            value={motion}
            onChange={event => {
              setMotion(event.currentTarget.value as MotionPresetName)
            }}
          >
            {showcaseMotionPresets.map(item => (
              <option key={item.name} value={item.name}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="showcase-theme-preview-layout">
        <div
          className="showcase-theme-preview"
          data-mode={mode}
          data-theme={activeTheme}
          data-motion={motion}
          style={themeStyle as CSSProperties}
        >
          <div className="showcase-theme-preview-header">
            <div>
              <span className="showcase-badge">{activeThemeMeta?.label}</span>
              <h2>Component preview</h2>
              <p>
                This preview is scoped with local CSS variables, so switching
                themes does not mutate the whole showcase shell.
              </p>
            </div>

            <button className="showcase-theme-button" type="button">
              Primary action
            </button>
          </div>

          <div className="showcase-theme-component-grid">
            <article className="showcase-theme-surface-card">
              <span className="showcase-badge">Card</span>
              <h3>Project health</h3>
              <p>
                Surface, text, border and muted tokens update with the selected
                theme.
              </p>
              <div className="showcase-theme-progress">
                <span />
              </div>
            </article>

            <article className="showcase-theme-surface-card">
              <span className="showcase-badge">Form</span>
              <label className="showcase-theme-form-field">
                <span>Email</span>
                <input defaultValue="zeus@example.com" />
              </label>
              <button className="showcase-theme-secondary-button" type="button">
                Save settings
              </button>
            </article>

            <article className="showcase-theme-alert-card">
              <span className="showcase-badge">Feedback</span>
              <h3>Destructive token</h3>
              <p>Used by alert, validation and danger actions.</p>
            </article>
          </div>
        </div>

        <aside className="showcase-theme-snippet-card">
          <div className="showcase-theme-snippet-tabs">
            {snippetKinds.map(item => (
              <button
                key={item.kind}
                type="button"
                data-active={item.kind === activeSnippet}
                onClick={() => setActiveSnippet(item.kind)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <pre className="showcase-code showcase-theme-snippet">
            <code>{activeSnippetCode}</code>
          </pre>

          <button
            type="button"
            className="showcase-theme-copy-button"
            onClick={() => void handleCopy(activeSnippet)}
          >
            {copiedSnippet === activeSnippet ? 'Copied' : 'Copy snippet'}
          </button>
        </aside>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Semantic token palette</h2>

        <div
          className="showcase-theme-token-groups"
          data-mode={mode}
          style={themeStyle as CSSProperties}
        >
          {showcaseThemeTokenGroups.map(group => (
            <article key={group.name} className="showcase-theme-token-group">
              <h3>{group.name}</h3>

              <div className="showcase-theme-token-grid">
                {group.tokens.map(token => (
                  <div key={token} className="showcase-theme-token-card">
                    <span
                      className="showcase-theme-token-swatch"
                      style={{ background: `hsl(var(--${token}))` }}
                    />
                    <code>{token}</code>
                    <small>hsl(var(--{token}))</small>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Dark mode strategies</h2>

        <div className="showcase-grid showcase-grid-3">
          {showcaseDarkModeStrategies.map(strategy => (
            <div key={strategy.name} className="showcase-card">
              <h3 className="showcase-card-title">{strategy.label}</h3>
              <p className="showcase-card-description">
                Strategy option exposed by @zeus-web/themes.
              </p>
              <pre className="showcase-code">{strategy.name}</pre>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
```

---

# 4. 替换 `examples/vue-showcase/src/routes/ThemesPage.vue`

```vue
<script setup lang="ts">
import type { MotionPresetName, RadiusPresetName } from '@zeus-web/themes'
import {
  createShowcaseThemeSnippet,
  createShowcaseThemeStyle,
  semanticTokens,
  showcaseDarkModeStrategies,
  showcaseMotionPresets,
  showcaseRadiusPresets,
  showcaseThemeModes,
  showcaseThemeTokenGroups,
  showcaseThemes,
  type ShowcaseThemeMode,
  type ShowcaseThemeName,
  type ShowcaseThemeSnippetKind,
} from '@zeus-web/example-showcase-shared'
import { computed, ref } from 'vue'

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
          @click="activeTheme = theme.name as ShowcaseThemeName"
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
                :style="{ background: `hsl(var(--${token}))` }"
              />
              <code>{{ token }}</code>
              <small>hsl(var(--{{ token }}))</small>
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
```

---

# 5. 追加 CSS：React/Vue 两个 `app.css` 都加

追加到：

```txt
examples/react-showcase/src/app.css
examples/vue-showcase/src/app.css
```

```css
.showcase-theme-variant-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
}

.showcase-theme-variant-card {
  display: grid;
  gap: 0.45rem;
  border: 1px solid hsl(var(--border));
  border-radius: 1rem;
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  cursor: pointer;
  padding: 1rem;
  text-align: left;
}

.showcase-theme-variant-card:hover,
.showcase-theme-variant-card[data-active='true'] {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.16);
}

.showcase-theme-variant-title {
  font-weight: 800;
}

.showcase-theme-variant-description {
  color: hsl(var(--muted-foreground));
  font-size: 0.85rem;
  line-height: 1.45;
}

.showcase-theme-variant-card code {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.showcase-theme-toolbar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 1rem 0;
  border: 1px solid hsl(var(--border));
  border-radius: 1rem;
  background: hsl(var(--card));
  padding: 1rem;
}

.showcase-theme-control {
  display: grid;
  gap: 0.4rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.showcase-theme-control select {
  width: 100%;
  border: 1px solid hsl(var(--input));
  border-radius: 0.65rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 0.625rem 0.75rem;
  font: inherit;
  outline: none;
}

.showcase-theme-control select:focus {
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.35);
}

.showcase-theme-preview-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22rem;
  gap: 1rem;
  align-items: start;
  margin-top: 1rem;
}

.showcase-theme-preview {
  border: 1px solid hsl(var(--border));
  border-radius: var(--zw-radius-xl);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 1rem;
  transition:
    background var(--zw-duration-normal) var(--zw-easing-standard),
    color var(--zw-duration-normal) var(--zw-easing-standard),
    border-color var(--zw-duration-normal) var(--zw-easing-standard);
}

.showcase-theme-preview-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--zw-radius-lg);
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  padding: 1rem;
}

.showcase-theme-preview-header h2 {
  margin: 0.75rem 0 0;
  font-size: 1.4rem;
}

.showcase-theme-preview-header p {
  max-width: 36rem;
  margin: 0.35rem 0 0;
  color: hsl(var(--muted-foreground));
  line-height: 1.55;
}

.showcase-theme-button,
.showcase-theme-secondary-button,
.showcase-theme-copy-button {
  border: 1px solid transparent;
  border-radius: var(--zw-radius-md);
  cursor: pointer;
  padding: 0.625rem 0.8rem;
  font: inherit;
  font-weight: 800;
}

.showcase-theme-button {
  align-self: start;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.showcase-theme-secondary-button {
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.showcase-theme-component-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.showcase-theme-surface-card,
.showcase-theme-alert-card {
  display: grid;
  gap: 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--zw-radius-lg);
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  padding: 1rem;
}

.showcase-theme-surface-card h3,
.showcase-theme-alert-card h3 {
  margin: 0;
}

.showcase-theme-surface-card p,
.showcase-theme-alert-card p {
  margin: 0;
  color: hsl(var(--muted-foreground));
  line-height: 1.5;
}

.showcase-theme-alert-card {
  border-color: hsl(var(--destructive) / 0.55);
  background: hsl(var(--destructive) / 0.12);
}

.showcase-theme-progress {
  overflow: hidden;
  height: 0.55rem;
  border-radius: 999px;
  background: hsl(var(--muted));
}

.showcase-theme-progress span {
  display: block;
  width: 68%;
  height: 100%;
  border-radius: inherit;
  background: hsl(var(--primary));
  transition: width var(--zw-duration-slow) var(--zw-easing-emphasized);
}

.showcase-theme-form-field {
  display: grid;
  gap: 0.4rem;
}

.showcase-theme-form-field span {
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
  font-weight: 700;
}

.showcase-theme-form-field input {
  border: 1px solid hsl(var(--input));
  border-radius: var(--zw-radius-md);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 0.6rem 0.7rem;
  font: inherit;
}

.showcase-theme-form-field input:focus {
  outline: 2px solid hsl(var(--ring) / 0.35);
  outline-offset: 2px;
}

.showcase-theme-snippet-card {
  display: grid;
  gap: 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 1rem;
  background: hsl(var(--card));
  padding: 1rem;
}

.showcase-theme-snippet-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.35rem;
}

.showcase-theme-snippet-tabs button {
  border: 1px solid hsl(var(--border));
  border-radius: 0.55rem;
  background: hsl(var(--background));
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  padding: 0.45rem 0.55rem;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 800;
}

.showcase-theme-snippet-tabs button[data-active='true'] {
  border-color: hsl(var(--primary));
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.showcase-theme-snippet {
  min-height: 11rem;
  margin: 0;
  white-space: pre-wrap;
}

.showcase-theme-copy-button {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.showcase-theme-token-groups {
  display: grid;
  gap: 1rem;
}

.showcase-theme-token-group {
  border: 1px solid hsl(var(--border));
  border-radius: 1rem;
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  padding: 1rem;
}

.showcase-theme-token-group h3 {
  margin: 0 0 0.75rem;
}

.showcase-theme-token-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.showcase-theme-token-card {
  display: grid;
  gap: 0.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--zw-radius-lg);
  background: hsl(var(--background));
  padding: 0.75rem;
}

.showcase-theme-token-swatch {
  display: block;
  height: 3rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--zw-radius-md);
}

.showcase-theme-token-card code {
  font-size: 0.78rem;
  font-weight: 800;
}

.showcase-theme-token-card small {
  color: hsl(var(--muted-foreground));
  font-size: 0.72rem;
}

@media (max-width: 1100px) {
  .showcase-theme-variant-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .showcase-theme-preview-layout {
    grid-template-columns: 1fr;
  }

  .showcase-theme-component-grid,
  .showcase-theme-token-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .showcase-theme-toolbar,
  .showcase-theme-component-grid,
  .showcase-theme-token-grid {
    grid-template-columns: 1fr;
  }
}
```

---

# 6. 新增 `examples/react-showcase/src/routes/ThemesPage.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ThemesPage } from './ThemesPage'

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText,
    },
  })

  return writeText
}

describe('react ThemesPage', () => {
  it('renders theme variants and token metadata', () => {
    render(<ThemesPage />)

    expect(screen.getByRole('heading', { name: 'Themes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Default/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Slate/ })).toBeInTheDocument()
    expect(screen.getByText('18 semantic tokens')).toBeInTheDocument()
    expect(screen.getByText('Component preview')).toBeInTheDocument()
    expect(screen.getByText('Semantic token palette')).toBeInTheDocument()
  })

  it('switches theme, mode, radius and motion controls', async () => {
    const user = userEvent.setup()

    render(<ThemesPage />)

    await user.click(screen.getByRole('button', { name: /Slate/ }))
    await user.selectOptions(screen.getByLabelText('Theme mode'), 'dark')
    await user.selectOptions(screen.getByLabelText('Radius preset'), 'xl')
    await user.selectOptions(
      screen.getByLabelText('Motion preset'),
      'expressive',
    )

    expect(screen.getByLabelText('Theme mode')).toHaveValue('dark')
    expect(screen.getByLabelText('Radius preset')).toHaveValue('xl')
    expect(screen.getByLabelText('Motion preset')).toHaveValue('expressive')
    expect(
      screen.getByText("import '@zeus-web/themes/slate.css'"),
    ).toBeInTheDocument()
  })

  it('switches snippets and copies the selected snippet', async () => {
    const user = userEvent.setup()
    const writeText = mockClipboard()

    render(<ThemesPage />)

    await user.click(screen.getByRole('button', { name: 'HTML usage' }))
    await user.click(screen.getByRole('button', { name: 'Copy snippet' }))

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('data-theme="default"'),
    )
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })
})
```

---

# 7. 新增 `examples/vue-showcase/src/routes/ThemesPage.spec.ts`

```ts
import { mount } from '@vue/test-utils'

import ThemesPage from './ThemesPage.vue'

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText,
    },
  })

  return writeText
}

describe('vue ThemesPage', () => {
  it('renders theme variants and token metadata', () => {
    const wrapper = mount(ThemesPage)

    expect(wrapper.text()).toContain('Themes')
    expect(wrapper.text()).toContain('Default')
    expect(wrapper.text()).toContain('Slate')
    expect(wrapper.text()).toContain('18 semantic tokens')
    expect(wrapper.text()).toContain('Component preview')
    expect(wrapper.text()).toContain('Semantic token palette')
  })

  it('switches theme, mode, radius and motion controls', async () => {
    const wrapper = mount(ThemesPage)

    const slateButton = wrapper
      .findAll('button')
      .find(button => button.text().includes('Slate'))

    expect(slateButton).toBeDefined()

    await slateButton?.trigger('click')
    await wrapper.get('[aria-label="Theme mode"]').setValue('dark')
    await wrapper.get('[aria-label="Radius preset"]').setValue('xl')
    await wrapper.get('[aria-label="Motion preset"]').setValue('expressive')

    expect(
      (wrapper.get('[aria-label="Theme mode"]').element as HTMLSelectElement)
        .value,
    ).toBe('dark')
    expect(
      (wrapper.get('[aria-label="Radius preset"]').element as HTMLSelectElement)
        .value,
    ).toBe('xl')
    expect(
      (wrapper.get('[aria-label="Motion preset"]').element as HTMLSelectElement)
        .value,
    ).toBe('expressive')
    expect(wrapper.text()).toContain("import '@zeus-web/themes/slate.css'")
  })

  it('switches snippets and copies the selected snippet', async () => {
    const writeText = mockClipboard()
    const wrapper = mount(ThemesPage)

    const htmlButton = wrapper
      .findAll('button')
      .find(button => button.text() === 'HTML usage')

    expect(htmlButton).toBeDefined()

    await htmlButton?.trigger('click')
    await wrapper
      .findAll('button')
      .find(button => button.text() === 'Copy snippet')
      ?.trigger('click')

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('data-theme="default"'),
    )
    expect(wrapper.text()).toContain('Copied')
  })
})
```

---

# 8. 修改 `scripts/examples/build-showcase-deps.ts`

当前 build deps 只特殊加入了 icons，themes 没有被强制 build。
Phase 10 后 shared 会 import `@zeus-web/themes` root，因此需要把 themes 永久加入 foundation deps。

替换 `createPnpmArgs()` 和 `targets` 逻辑。

```ts
function createPnpmArgs(options: Options): string[] {
  const packages = getImplementedShowcasePackageNames()

  const foundationPackages = options.includeIcons
    ? ['@zeus-web/themes', '@zeus-web/icons']
    : ['@zeus-web/themes']

  const packageNames = [...foundationPackages, ...packages]
  const filters = packageNames.flatMap(packageName => ['--filter', packageName])

  return ['-w', ...filters, 'build']
}
```

然后替换 `main()` 里的 targets：

```ts
const implementedPackages = getImplementedShowcasePackageNames()
const allPackages = discoverPackages()

const foundationPackages = options.includeIcons
  ? ['@zeus-web/themes', '@zeus-web/icons']
  : ['@zeus-web/themes']

const targets = [...foundationPackages, ...implementedPackages]
```

---

# 9. 修改 `scripts/checks/check-showcase-metadata.ts`

加 theme coverage 校验，避免 shared 主题数据和 `@zeus-web/themes` 包漂移。

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

import {
  semanticTokens,
  showcaseIcons,
  showcaseThemes,
  validateShowcaseMetadata,
} from '../../examples/showcase-shared/src'
import { iconMetadata, iconNames } from '../../packages/icons/src'
import { semanticColorTokens, themeNames } from '../../packages/themes/src'

interface RegistryItem {
  name: string
  type: string
}

interface Registry {
  items: RegistryItem[]
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf-8')) as T
}

function readRegistryComponentNames(): string[] {
  const registry = readJson<Registry>(
    resolve(process.cwd(), 'packages/registry/registry.json'),
  )

  return registry.items
    .filter(item => item.type === 'registry:ui')
    .map(item => item.name)
    .sort()
}

function validateShowcaseIconCoverage(): string[] {
  const errors: string[] = []
  const showcaseIconNames = showcaseIcons.map(icon => icon.name)
  const showcaseIconNameSet = new Set(showcaseIconNames)
  const packageIconNameSet = new Set<string>(iconNames)

  for (const icon of showcaseIcons) {
    if (!packageIconNameSet.has(icon.name)) {
      errors.push(
        `showcaseIcons contains "${icon.name}" but @zeus-web/icons does not export it.`,
      )
      continue
    }

    const packageIcon = iconMetadata[icon.name]

    if (packageIcon.category !== icon.category) {
      errors.push(
        `showcaseIcons "${icon.name}" category must be "${packageIcon.category}", got "${icon.category}".`,
      )
    }

    for (const tag of packageIcon.tags) {
      if (!icon.tags.includes(tag)) {
        errors.push(
          `showcaseIcons "${icon.name}" is missing package icon tag "${tag}".`,
        )
      }
    }
  }

  for (const iconName of iconNames) {
    if (!showcaseIconNameSet.has(iconName)) {
      errors.push(
        `@zeus-web/icons exports "${iconName}" but showcaseIcons does not include it.`,
      )
    }
  }

  return errors
}

function validateShowcaseThemeCoverage(): string[] {
  const errors: string[] = []
  const showcaseThemeNames = showcaseThemes.map(theme => theme.name)
  const showcaseTokenNames = semanticTokens.map(token => String(token))

  if (JSON.stringify(showcaseThemeNames) !== JSON.stringify(themeNames)) {
    errors.push(
      `showcaseThemes must match @zeus-web/themes themeNames. Expected ${themeNames.join(
        ', ',
      )}, got ${showcaseThemeNames.join(', ')}.`,
    )
  }

  if (
    JSON.stringify(showcaseTokenNames) !== JSON.stringify(semanticColorTokens)
  ) {
    errors.push(
      `semanticTokens must match @zeus-web/themes semanticColorTokens.`,
    )
  }

  return errors
}

const result = validateShowcaseMetadata({
  registryComponentNames: readRegistryComponentNames(),
})

const iconCoverageErrors = validateShowcaseIconCoverage()
const themeCoverageErrors = validateShowcaseThemeCoverage()

for (const warning of result.warnings) {
  console.log(pc.yellow(`warning: ${warning}`))
}

if (
  !result.valid ||
  iconCoverageErrors.length > 0 ||
  themeCoverageErrors.length > 0
) {
  for (const error of result.errors) {
    console.error(pc.red(`error: ${error}`))
  }

  for (const error of iconCoverageErrors) {
    console.error(pc.red(`error: ${error}`))
  }

  for (const error of themeCoverageErrors) {
    console.error(pc.red(`error: ${error}`))
  }

  process.exit(1)
}

console.log(pc.green('Showcase metadata check passed.'))
```

---

# 10. 修改 `docs/internal/examples/showcase-roadmap.md`

把 Phase 10 标记为 Done，并补 foundation pages。

```md
| Phase 10 | Done | Themes page with theme switcher, light/dark mode, radius, motion, token palette and component preview |
```

在 `Implemented foundation pages` 下面追加：

```md
### Themes

- theme variant switcher
- light / dark mode preview
- radius preset switcher
- motion preset switcher
- semantic token palette
- scoped component preview
- CSS import / HTML usage / token usage snippets
```

---

# 验收命令

```bash
pnpm --filter @zeus-web/themes test
pnpm --filter @zeus-web/example-showcase-shared check
pnpm check:showcase-metadata
pnpm showcase:test
pnpm showcase:build
pnpm site:check
```

# Phase 10 完成判断

```txt
React /themes:
  - 能切换 default/slate/zinc/neutral/stone
  - 能切换 light/dark
  - 能切换 radius preset
  - 能切换 motion preset
  - token palette 随主题变化
  - component preview 随主题变化
  - snippets 可复制

Vue /themes:
  - 与 React 能力一致

工程侧:
  - build-showcase-deps 会构建 @zeus-web/themes
  - metadata check 会校验 showcaseThemes 与 themeNames 对齐
  - roadmap 标记 Phase 10 Done
```

建议分支名：

```txt
feat/showcase-themes-page
```

建议 PR title：

```txt
feat(examples): complete showcase themes page
```
