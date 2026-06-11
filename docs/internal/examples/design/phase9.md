结论：Phase 9 只做 **Icons Page 完整化**。当前 React/Vue 路由里已经有 `/icons`，但页面还是“metadata page”占位，没有完成 icon grid、search、category filter、copy import、size/currentColor preview。React 路由已挂 `/icons`，React IconsPage 当前明确写着 copy actions 后续再做；Vue 侧也是同样占位。Phase 9 原 roadmap 要求 `/icons` 支持 grid、搜索、分类过滤、复制 React/Vue/WC/raw svg import、size preview、currentColor preview，并验收 check/menu/settings 搜索与复制能力。

另外当前 `@zeus-web/icons` 已经提供 `react/vue/wc/manifest/svg` exports，并且 icon 包内已有 `iconSources / iconMetadata / iconsManifest / searchIcons` 等基础能力，所以 Phase 9 不需要新造 icon 数据源，只要把 showcase 页面接到这些产物即可。

---

## Phase 9 设计

### 目标

把 `/icons` 从 metadata card 升级为真正的 Icon Laboratory：

```txt
/icons
  - 推荐 icon 全量展示
  - 关键字搜索
  - category filter
  - size preview
  - currentColor preview
  - copy React import
  - copy Vue import
  - copy WC import
  - copy raw svg import
  - React/Vue 两端视觉和能力一致
```

### 不做的事

本阶段不改 `@zeus-js/web-c-runtime`，不改 icon 编译器，也不改路由结构。你的 Web-C 懒加载路线里已经明确组件库提供 loader/auto/wc 产物，runtime 只做 bootstrapLazy、ProxyElement、HostRef 等底层能力；Phase 9 只展示 `@zeus-web/icons/wc` 的使用方式，不进入 runtime 改造。

### 变更文件

```txt
examples/showcase-shared/src/types.ts
examples/showcase-shared/src/icons.ts

examples/react-showcase/src/routes/IconsPage.tsx
examples/react-showcase/src/routes/IconsPage.test.tsx
examples/react-showcase/src/app.css

examples/vue-showcase/src/routes/IconsPage.vue
examples/vue-showcase/src/routes/IconsPage.spec.ts
examples/vue-showcase/src/app.css
examples/vue-showcase/package.json

docs/internal/examples/showcase-roadmap.md
```

---

# 1. `examples/showcase-shared/src/types.ts`

替换 `ShowcaseIcon` 类型即可。

```ts
export type ShowcaseFramework = 'react' | 'vue' | 'web-component'

export type ShowcaseComponentGroup =
  | 'Actions'
  | 'Forms'
  | 'Layout'
  | 'Feedback'
  | 'Disclosure'
  | 'Navigation'
  | 'Media'

export type ShowcaseSection =
  | 'basic'
  | 'variants'
  | 'sizes'
  | 'states'
  | 'controlled'
  | 'uncontrolled'
  | 'events'
  | 'icons'
  | 'theme'
  | 'accessibility'
  | 'production'

export interface ShowcaseImportSpec {
  react?: string
  vue?: string
  webComponent?: string
  registry?: string
}

export interface ShowcaseEventSpec {
  name: string
  reactName?: string
  vueName?: string
  description: string
}

export interface ShowcaseComponent {
  name: string
  title: string
  routePath: `/components/${string}`
  packageName: `@zeus-web/${string}`
  group: ShowcaseComponentGroup
  description: string
  registryCommand: string
  imports: ShowcaseImportSpec
  sections: readonly ShowcaseSection[]
  states: string[]
  events: ShowcaseEventSpec[]
  themeTokens: string[]
  iconExamples: string[]
  productionPatterns: string[]
}

export interface ShowcaseTheme {
  name: string
  label: string
  cssImport: string
  description: string
}

export type ShowcaseIconCategory =
  | 'action'
  | 'navigation'
  | 'status'
  | 'theme'
  | 'media'

export interface ShowcaseIcon {
  name: string
  label: string
  category: ShowcaseIconCategory
  tags: string[]
}

export interface ShowcaseRoute {
  path: string
  label: string
  description: string
  group: 'Overview' | 'Components' | 'Foundations' | 'Playground'
  componentName?: string
}

export interface ShowcaseValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}
```

---

# 2. `examples/showcase-shared/src/icons.ts`

替换为带 category 的版本，和 `@zeus-web/icons` 当前 metadata 对齐。

```ts
import type { ShowcaseIcon } from './types'

export const showcaseIcons: ShowcaseIcon[] = [
  {
    name: 'check',
    label: 'Check',
    category: 'status',
    tags: ['check', 'confirm', 'success', 'form', 'action'],
  },
  {
    name: 'x',
    label: 'X',
    category: 'action',
    tags: ['close', 'dismiss', 'remove', 'dialog'],
  },
  {
    name: 'plus',
    label: 'Plus',
    category: 'action',
    tags: ['add', 'create', 'new'],
  },
  {
    name: 'minus',
    label: 'Minus',
    category: 'action',
    tags: ['remove', 'collapse'],
  },
  {
    name: 'chevron-down',
    label: 'Chevron down',
    category: 'navigation',
    tags: ['arrow', 'down', 'select', 'disclosure'],
  },
  {
    name: 'chevron-up',
    label: 'Chevron up',
    category: 'navigation',
    tags: ['arrow', 'up', 'disclosure'],
  },
  {
    name: 'chevron-left',
    label: 'Chevron left',
    category: 'navigation',
    tags: ['arrow', 'left', 'previous'],
  },
  {
    name: 'chevron-right',
    label: 'Chevron right',
    category: 'navigation',
    tags: ['arrow', 'right', 'next'],
  },
  {
    name: 'search',
    label: 'Search',
    category: 'action',
    tags: ['find', 'filter', 'input', 'navigation'],
  },
  {
    name: 'menu',
    label: 'Menu',
    category: 'navigation',
    tags: ['hamburger', 'nav', 'layout'],
  },
  {
    name: 'settings',
    label: 'Settings',
    category: 'action',
    tags: ['gear', 'config', 'preferences'],
  },
  {
    name: 'user',
    label: 'User',
    category: 'action',
    tags: ['account', 'profile', 'avatar'],
  },
  {
    name: 'copy',
    label: 'Copy',
    category: 'action',
    tags: ['clipboard', 'duplicate'],
  },
  {
    name: 'external-link',
    label: 'External link',
    category: 'navigation',
    tags: ['open', 'link'],
  },
  {
    name: 'info',
    label: 'Info',
    category: 'status',
    tags: ['help', 'information', 'feedback'],
  },
  {
    name: 'alert-triangle',
    label: 'Alert triangle',
    category: 'status',
    tags: ['warning', 'error', 'feedback'],
  },
  {
    name: 'circle-check',
    label: 'Circle check',
    category: 'status',
    tags: ['success', 'done'],
  },
  {
    name: 'circle-x',
    label: 'Circle x',
    category: 'status',
    tags: ['error', 'failed'],
  },
  {
    name: 'loader',
    label: 'Loader',
    category: 'status',
    tags: ['loading', 'spinner', 'progress'],
  },
  {
    name: 'sun',
    label: 'Sun',
    category: 'theme',
    tags: ['light', 'theme'],
  },
  {
    name: 'moon',
    label: 'Moon',
    category: 'theme',
    tags: ['dark', 'theme'],
  },
  {
    name: 'eye',
    label: 'Eye',
    category: 'media',
    tags: ['visible', 'show', 'visibility', 'input'],
  },
  {
    name: 'eye-off',
    label: 'Eye off',
    category: 'media',
    tags: ['hidden', 'hide', 'visibility', 'input'],
  },
  {
    name: 'trash',
    label: 'Trash',
    category: 'action',
    tags: ['delete', 'remove', 'danger'],
  },
]
```

---

# 3. `examples/react-showcase/src/routes/IconsPage.tsx`

```tsx
import { iconSources } from '@zeus-web/icons'
import {
  showcaseIcons,
  type ShowcaseIcon,
  type ShowcaseIconCategory,
} from '@zeus-web/example-showcase-shared'
import { useMemo, useState } from 'react'

type IconCopyKind = 'react' | 'vue' | 'wc' | 'raw'

type IconPreviewTone = 'foreground' | 'primary' | 'muted' | 'destructive'

const iconSourceByName = new Map(iconSources.map(icon => [icon.name, icon.svg]))

const sizeOptions = [16, 20, 24, 32, 40] as const

const toneOptions: Array<{ label: string; value: IconPreviewTone }> = [
  { label: 'currentColor', value: 'foreground' },
  { label: 'primary', value: 'primary' },
  { label: 'muted', value: 'muted' },
  { label: 'destructive', value: 'destructive' },
]

function toPascalCase(name: string): string {
  return name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function getIconSvg(iconName: string): string {
  return iconSourceByName.get(iconName) ?? ''
}

function createIconSnippet(icon: ShowcaseIcon, kind: IconCopyKind): string {
  const componentName = `Icon${toPascalCase(icon.name)}`

  switch (kind) {
    case 'react':
      return `import { ${componentName} } from '@zeus-web/icons/react'`

    case 'vue':
      return `<script setup lang="ts">
import { ${componentName} } from '@zeus-web/icons/vue'
</script>`

    case 'wc':
      return `import '@zeus-web/icons/wc'

<zw-icon-${icon.name}></zw-icon-${icon.name}>`

    case 'raw':
      return `import ${componentName}Svg from '@zeus-web/icons/svg/${icon.name}.svg?raw'`

    default:
      return ''
  }
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

export function IconsPage() {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<
    ShowcaseIconCategory | 'all'
  >('all')
  const [previewSize, setPreviewSize] =
    useState<(typeof sizeOptions)[number]>(24)
  const [previewTone, setPreviewTone] = useState<IconPreviewTone>('foreground')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const categories = useMemo(() => {
    return [
      'all',
      ...Array.from(new Set(showcaseIcons.map(icon => icon.category))).sort(),
    ] as Array<ShowcaseIconCategory | 'all'>
  }, [])

  const filteredIcons = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return showcaseIcons.filter(icon => {
      const categoryMatched =
        activeCategory === 'all' || icon.category === activeCategory

      if (!categoryMatched) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      return (
        icon.name.includes(normalizedQuery) ||
        icon.label.toLowerCase().includes(normalizedQuery) ||
        icon.category.includes(normalizedQuery) ||
        icon.tags.some(tag => tag.includes(normalizedQuery))
      )
    })
  }, [activeCategory, query])

  async function handleCopy(icon: ShowcaseIcon, kind: IconCopyKind) {
    const key = `${icon.name}:${kind}`

    await copyText(createIconSnippet(icon, kind))
    setCopiedKey(key)

    window.setTimeout(() => {
      setCopiedKey(current => (current === key ? null : current))
    }, 1200)
  }

  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">Foundations</p>
        <h1 className="showcase-title">Icons</h1>
        <p className="showcase-description">
          Browse Zeus Web recommended icons, verify currentColor rendering, and
          copy framework-specific imports for React, Vue, Web Components and raw
          SVG assets.
        </p>

        <div className="showcase-page-meta">
          <span className="showcase-badge">{showcaseIcons.length} icons</span>
          <span className="showcase-badge">
            {categories.length - 1} categories
          </span>
          <span className="showcase-badge">currentColor ready</span>
        </div>
      </header>

      <section className="showcase-icon-toolbar" aria-label="Icon controls">
        <label className="showcase-icon-control">
          <span>Search</span>
          <input
            aria-label="Search icons"
            className="showcase-icon-input"
            type="search"
            value={query}
            placeholder="Search check, menu, settings..."
            onChange={event => setQuery(event.currentTarget.value)}
          />
        </label>

        <label className="showcase-icon-control">
          <span>Size</span>
          <select
            aria-label="Icon preview size"
            className="showcase-icon-select"
            value={previewSize}
            onChange={event => {
              setPreviewSize(Number(event.currentTarget.value) as 24)
            }}
          >
            {sizeOptions.map(size => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
        </label>

        <label className="showcase-icon-control">
          <span>Color</span>
          <select
            aria-label="Icon preview color"
            className="showcase-icon-select"
            value={previewTone}
            onChange={event => {
              setPreviewTone(event.currentTarget.value as IconPreviewTone)
            }}
          >
            {toneOptions.map(tone => (
              <option key={tone.value} value={tone.value}>
                {tone.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section
        className="showcase-icon-categories"
        aria-label="Icon categories"
      >
        {categories.map(category => (
          <button
            key={category}
            type="button"
            className="showcase-icon-filter"
            data-active={category === activeCategory}
            aria-pressed={category === activeCategory}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </section>

      {filteredIcons.length > 0 ? (
        <section className="showcase-icon-grid" aria-label="Icon grid">
          {filteredIcons.map(icon => {
            const svg = getIconSvg(icon.name)

            return (
              <article key={icon.name} className="showcase-icon-card">
                <div
                  className="showcase-icon-preview"
                  data-tone={previewTone}
                  style={{
                    width: `${previewSize}px`,
                    height: `${previewSize}px`,
                  }}
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />

                <div className="showcase-icon-card-main">
                  <h2 className="showcase-card-title">{icon.label}</h2>
                  <p className="showcase-card-description">{icon.name}</p>

                  <div className="showcase-icon-tags">
                    <span className="showcase-badge">{icon.category}</span>
                    {icon.tags.map(tag => (
                      <span key={tag} className="showcase-badge">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="showcase-icon-copy-grid">
                  {(['react', 'vue', 'wc', 'raw'] as const).map(kind => {
                    const key = `${icon.name}:${kind}`

                    return (
                      <button
                        key={kind}
                        type="button"
                        className="showcase-icon-copy"
                        aria-label={`Copy ${kind === 'raw' ? 'raw svg' : kind.toUpperCase()} import for ${icon.label}`}
                        onClick={() => void handleCopy(icon, kind)}
                      >
                        {copiedKey === key
                          ? `Copied ${kind.toUpperCase()}`
                          : `Copy ${kind.toUpperCase()}`}
                      </button>
                    )
                  })}
                </div>

                <pre className="showcase-code showcase-icon-code">
                  <code>{createIconSnippet(icon, 'react')}</code>
                </pre>
              </article>
            )
          })}
        </section>
      ) : (
        <div className="showcase-empty">
          No icons found. Try searching for check, menu, settings, warning or
          theme.
        </div>
      )}
    </div>
  )
}
```

---

# 4. `examples/vue-showcase/src/routes/IconsPage.vue`

```vue
<script setup lang="ts">
import { iconSources } from '@zeus-web/icons'
import {
  showcaseIcons,
  type ShowcaseIcon,
  type ShowcaseIconCategory,
} from '@zeus-web/example-showcase-shared'
import { computed, ref } from 'vue'

type IconCopyKind = 'react' | 'vue' | 'wc' | 'raw'
type IconPreviewTone = 'foreground' | 'primary' | 'muted' | 'destructive'

const iconSourceByName = new Map(iconSources.map(icon => [icon.name, icon.svg]))

const sizeOptions = [16, 20, 24, 32, 40] as const

const toneOptions: Array<{ label: string; value: IconPreviewTone }> = [
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

    if (!categoryMatched) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    return (
      icon.name.includes(normalizedQuery) ||
      icon.label.toLowerCase().includes(normalizedQuery) ||
      icon.category.includes(normalizedQuery) ||
      icon.tags.some(tag => tag.includes(normalizedQuery))
    )
  })
})

function toPascalCase(name: string): string {
  return name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function getIconSvg(iconName: string): string {
  return iconSourceByName.get(iconName) ?? ''
}

function createIconSnippet(icon: ShowcaseIcon, kind: IconCopyKind): string {
  const componentName = `Icon${toPascalCase(icon.name)}`

  switch (kind) {
    case 'react':
      return `import { ${componentName} } from '@zeus-web/icons/react'`

    case 'vue':
      return `<script setup lang="ts">
import { ${componentName} } from '@zeus-web/icons/vue'
</script>`

    case 'wc':
      return `import '@zeus-web/icons/wc'

<zw-icon-${icon.name}></zw-icon-${icon.name}>`

    case 'raw':
      return `import ${componentName}Svg from '@zeus-web/icons/svg/${icon.name}.svg?raw'`

    default:
      return ''
  }
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

async function copySnippet(icon: ShowcaseIcon, kind: IconCopyKind) {
  const key = `${icon.name}:${kind}`

  await copyText(createIconSnippet(icon, kind))
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
            <span
              v-for="tag in icon.tags"
              :key="tag"
              class="showcase-badge"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <div class="showcase-icon-copy-grid">
          <button
            v-for="kind in ['react', 'vue', 'wc', 'raw'] as const"
            :key="kind"
            type="button"
            class="showcase-icon-copy"
            :aria-label="`Copy ${kind === 'raw' ? 'raw svg' : kind.toUpperCase()} import for ${icon.label}`"
            @click="copySnippet(icon, kind)"
          >
            {{
              copiedKey === `${icon.name}:${kind}`
                ? `Copied ${kind.toUpperCase()}`
                : `Copy ${kind.toUpperCase()}`
            }}
          </button>
        </div>

        <pre class="showcase-code showcase-icon-code"><code>{{ createIconSnippet(icon, 'vue') }}</code></pre>
      </article>
    </section>

    <div v-else class="showcase-empty">
      No icons found. Try searching for check, menu, settings, warning or theme.
    </div>
  </div>
</template>
```

---

# 5. 追加 CSS：React/Vue 两个 `app.css` 都追加

追加到：

```txt
examples/react-showcase/src/app.css
examples/vue-showcase/src/app.css
```

```css
.showcase-icon-toolbar {
  display: grid;
  grid-template-columns: minmax(16rem, 1fr) 9rem 12rem;
  gap: 0.75rem;
  margin-bottom: 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: 1rem;
  background: hsl(var(--card));
  padding: 1rem;
}

.showcase-icon-control {
  display: grid;
  gap: 0.4rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.showcase-icon-input,
.showcase-icon-select {
  width: 100%;
  border: 1px solid hsl(var(--input));
  border-radius: 0.65rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 0.625rem 0.75rem;
  font: inherit;
  outline: none;
}

.showcase-icon-input:focus,
.showcase-icon-select:focus {
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.35);
}

.showcase-icon-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.showcase-icon-filter {
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  background: hsl(var(--background));
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  padding: 0.35rem 0.7rem;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
}

.showcase-icon-filter:hover,
.showcase-icon-filter[data-active='true'] {
  border-color: hsl(var(--primary));
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.showcase-icon-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.showcase-icon-card {
  display: grid;
  gap: 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: 1rem;
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  padding: 1rem;
  box-shadow: 0 1px 2px hsl(0 0% 0% / 0.04);
}

.showcase-icon-preview {
  display: grid;
  min-width: 1rem;
  min-height: 1rem;
  place-items: center;
  color: hsl(var(--foreground));
}

.showcase-icon-preview[data-tone='primary'] {
  color: hsl(var(--primary));
}

.showcase-icon-preview[data-tone='muted'] {
  color: hsl(var(--muted-foreground));
}

.showcase-icon-preview[data-tone='destructive'] {
  color: hsl(var(--destructive));
}

.showcase-icon-preview svg {
  display: block;
  width: 100%;
  height: 100%;
}

.showcase-icon-card-main {
  min-width: 0;
}

.showcase-icon-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.75rem;
}

.showcase-icon-copy-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.showcase-icon-copy {
  border: 1px solid hsl(var(--border));
  border-radius: 0.55rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  cursor: pointer;
  padding: 0.5rem 0.6rem;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
}

.showcase-icon-copy:hover {
  border-color: hsl(var(--primary));
  color: hsl(var(--primary));
}

.showcase-icon-code {
  min-height: 3rem;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 1100px) {
  .showcase-icon-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .showcase-icon-toolbar {
    grid-template-columns: 1fr;
  }

  .showcase-icon-grid {
    grid-template-columns: 1fr;
  }
}
```

---

# 6. `examples/vue-showcase/package.json`

Vue 侧当前没有 `@zeus-web/icons` 依赖，但 Phase 9 页面要直接 import `@zeus-web/icons`，所以需要补上。React 侧已经有 `@zeus-web/icons` 依赖，Vue 当前没有。

```json
{
  "name": "@zeus-web/example-vue-showcase",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build:deps": "pnpm -w exec tsx scripts/examples/build-showcase-deps.ts",
    "dev": "pnpm build:deps && vite --host 0.0.0.0 --port 5174",
    "build": "pnpm build:deps && vite build",
    "check": "pnpm build:deps && vue-tsc -p tsconfig.json --noEmit",
    "test": "pnpm build:deps && vitest --run"
  },
  "dependencies": {
    "@zeus-web/accordion": "workspace:*",
    "@zeus-web/alert": "workspace:*",
    "@zeus-web/avatar": "workspace:*",
    "@zeus-web/badge": "workspace:*",
    "@zeus-web/button": "workspace:*",
    "@zeus-web/card": "workspace:*",
    "@zeus-web/checkbox": "workspace:*",
    "@zeus-web/collapsible": "workspace:*",
    "@zeus-web/dialog": "workspace:*",
    "@zeus-web/example-showcase-shared": "workspace:*",
    "@zeus-web/icons": "workspace:*",
    "@zeus-web/input": "workspace:*",
    "@zeus-web/label": "workspace:*",
    "@zeus-web/progress": "workspace:*",
    "@zeus-web/radio-group": "workspace:*",
    "@zeus-web/select": "workspace:*",
    "@zeus-web/separator": "workspace:*",
    "@zeus-web/skeleton": "workspace:*",
    "@zeus-web/switch": "workspace:*",
    "@zeus-web/tabs": "workspace:*",
    "@zeus-web/textarea": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "@zeus-web/tooltip": "workspace:*",
    "vue": "^3.5.35",
    "vue-router": "^5.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^6.0.7",
    "@vue/test-utils": "^2.4.11",
    "jsdom": "^29.1.1",
    "typescript": "^6.0.3",
    "vite": "^8.0.16",
    "vitest": "^4.1.8",
    "vue-tsc": "^3.3.4"
  }
}
```

---

# 7. `examples/react-showcase/src/routes/IconsPage.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { IconsPage } from './IconsPage'

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

describe('React IconsPage', () => {
  it('renders recommended icons', () => {
    render(<IconsPage />)

    expect(screen.getByRole('heading', { name: 'Icons' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Check' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Menu' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
  })

  it('filters icons by search query', async () => {
    const user = userEvent.setup()

    render(<IconsPage />)

    await user.type(screen.getByLabelText('Search icons'), 'settings')

    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Menu' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Check' }),
    ).not.toBeInTheDocument()
  })

  it('filters icons by category', async () => {
    const user = userEvent.setup()

    render(<IconsPage />)

    await user.click(screen.getByRole('button', { name: 'navigation' }))

    expect(screen.getByRole('heading', { name: 'Menu' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Chevron down' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Settings' }),
    ).not.toBeInTheDocument()
  })

  it('copies React import snippet', async () => {
    const user = userEvent.setup()
    const writeText = mockClipboard()

    render(<IconsPage />)

    await user.click(screen.getByLabelText('Copy REACT import for Check'))

    expect(writeText).toHaveBeenCalledWith(
      "import { IconCheck } from '@zeus-web/icons/react'",
    )
    expect(screen.getByText('Copied REACT')).toBeInTheDocument()
  })

  it('updates preview size and currentColor tone controls', async () => {
    const user = userEvent.setup()

    render(<IconsPage />)

    await user.selectOptions(screen.getByLabelText('Icon preview size'), '32')
    await user.selectOptions(
      screen.getByLabelText('Icon preview color'),
      'primary',
    )

    expect(screen.getByLabelText('Icon preview size')).toHaveValue('32')
    expect(screen.getByLabelText('Icon preview color')).toHaveValue('primary')
  })
})
```

---

# 8. `examples/vue-showcase/src/routes/IconsPage.spec.ts`

```ts
import { mount } from '@vue/test-utils'

import IconsPage from './IconsPage.vue'

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

describe('Vue IconsPage', () => {
  it('renders recommended icons', () => {
    const wrapper = mount(IconsPage)

    expect(wrapper.text()).toContain('Icons')
    expect(wrapper.text()).toContain('Check')
    expect(wrapper.text()).toContain('Menu')
    expect(wrapper.text()).toContain('Settings')
  })

  it('filters icons by search query', async () => {
    const wrapper = mount(IconsPage)

    await wrapper.get('[aria-label="Search icons"]').setValue('settings')

    expect(wrapper.text()).toContain('Settings')
    expect(wrapper.text()).not.toContain('Menu')
    expect(wrapper.text()).not.toContain('Check')
  })

  it('filters icons by category', async () => {
    const wrapper = mount(IconsPage)

    await wrapper
      .findAll('button')
      .find(button => button.text() === 'navigation')
      ?.trigger('click')

    expect(wrapper.text()).toContain('Menu')
    expect(wrapper.text()).toContain('Chevron down')
    expect(wrapper.text()).not.toContain('Settings')
  })

  it('copies Vue import snippet', async () => {
    const writeText = mockClipboard()
    const wrapper = mount(IconsPage)

    await wrapper
      .get('[aria-label="Copy VUE import for Check"]')
      .trigger('click')

    expect(writeText).toHaveBeenCalledWith(
      `<script setup lang="ts">
import { IconCheck } from '@zeus-web/icons/vue'
</script>`,
    )
    expect(wrapper.text()).toContain('Copied VUE')
  })

  it('updates preview size and currentColor tone controls', async () => {
    const wrapper = mount(IconsPage)

    await wrapper.get('[aria-label="Icon preview size"]').setValue('32')
    await wrapper.get('[aria-label="Icon preview color"]').setValue('primary')

    expect(
      (
        wrapper.get('[aria-label="Icon preview size"]')
          .element as HTMLSelectElement
      ).value,
    ).toBe('32')
    expect(
      (
        wrapper.get('[aria-label="Icon preview color"]')
          .element as HTMLSelectElement
      ).value,
    ).toBe('primary')
  })
})
```

---

# 9. `docs/internal/examples/showcase-roadmap.md`

把 Phase 9 标记进去，避免 roadmap 又和实现脱节。当前文档只到 Phase 8 Done。

````md
# Zeus Web Showcase Roadmap

This document tracks the implementation status of the React and Vue showcase applications.

## Status

| Phase   | Status | Scope                                                                                |
| ------- | ------ | ------------------------------------------------------------------------------------ |
| Phase 0 | Done   | Shared metadata, component inventory and validation baseline                         |
| Phase 1 | Done   | React showcase router shell                                                          |
| Phase 2 | Done   | Vue showcase router shell                                                            |
| Phase 3 | Done   | Shared page templates and scaffold components                                        |
| Phase 4 | Done   | P0 component pages: button, input, checkbox, switch, tabs, dialog                    |
| Phase 5 | Done   | Form component pages: label, textarea, radio-group, select                           |
| Phase 6 | Done   | Visual and feedback pages: card, badge, separator, skeleton, alert, progress, avatar |
| Phase 7 | Done   | Disclosure and overlay pages: collapsible, accordion, tooltip                        |
| Phase 8 | Done   | CI hardening, build dependency orchestration, route smoke tests and roadmap          |
| Phase 9 | Done   | Icons page with grid, search, category filters, copy snippets and previews           |

## Implemented component pages

### P0

- button
- input
- checkbox
- switch
- tabs
- dialog

### Forms

- label
- textarea
- radio-group
- select

### Visual and feedback

- card
- badge
- separator
- skeleton
- alert
- progress
- avatar

### Disclosure and overlay

- collapsible
- accordion
- tooltip

## Implemented foundation pages

### Icons

- icon grid
- search by name, label, category and tags
- category filter
- React import copy
- Vue import copy
- Web Component import copy
- raw SVG import copy
- preview size switch
- currentColor tone preview

## Engineering guarantees

The showcase has four layers of checks:

1. Metadata checks validate component metadata coverage.
2. Implementation checks validate that implemented demos have React and Vue files, dependencies and build dependency scripts.
3. Route smoke tests validate that every implemented component route renders in React and Vue.
4. Icons page tests validate search, filtering, preview controls and import copy actions.

## Commands

```bash
pnpm check:showcase-metadata
pnpm check:showcase-implementation
pnpm showcase:test
pnpm showcase:build
pnpm site:check
pnpm site:build
```
````

## Next work

Future phases should continue with foundation quality and production-like examples:

- Complete Phase 10 themes page with theme switching and semantic token previews.
- Add Playwright smoke tests for React and Vue showcase.
- Add visual snapshots for the most important component states.
- Replace demo-only CSS with exported component theme styles where appropriate.
- Reduce route smoke runtime if it becomes slow.
- Generate this roadmap from `examples/showcase-shared/src/implemented.ts`.

````

---

## 验收命令

```bash
pnpm --filter @zeus-web/example-showcase-shared check
pnpm icons:build
pnpm showcase:test
pnpm showcase:build
pnpm site:check
````

## Phase 9 完成判断

满足下面这些就可以标记完成：

```txt
React /icons:
  - 可展示所有 showcaseIcons
  - 搜索 check/menu/settings 生效
  - category filter 生效
  - size preview 生效
  - currentColor tone preview 生效
  - React/Vue/WC/raw import copy 生效

Vue /icons:
  - 同 React 能力一致
  - 依赖 @zeus-web/icons
  - showcase:test 通过

Roadmap:
  - Phase 9 标记 Done
  - foundation pages 增加 Icons 完成项
```

建议分支名：

```txt
feat/showcase-icons-page
```

建议 PR title：

```txt
feat(examples): complete showcase icons page
```
