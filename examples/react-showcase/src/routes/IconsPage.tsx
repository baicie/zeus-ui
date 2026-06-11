import type {
  ShowcaseIcon,
  ShowcaseIconCategory,
  ShowcaseIconCopyKind,
} from '@zeus-web/example-showcase-shared'
import {
  createShowcaseIconSnippet,
  showcaseIcons,
} from '@zeus-web/example-showcase-shared'
/* eslint-disable no-restricted-globals */
import { iconSources } from '@zeus-web/icons'
import { useMemo, useState } from 'react'

type IconPreviewTone = 'foreground' | 'primary' | 'muted' | 'destructive'

const iconSourceByName = new Map(iconSources.map(icon => [icon.name, icon.svg]))

const sizeOptions = [16, 20, 24, 32, 40] as const

const toneOptions: Array<{ label: string; value: IconPreviewTone }> = [
  { label: 'currentColor', value: 'foreground' },
  { label: 'primary', value: 'primary' },
  { label: 'muted', value: 'muted' },
  { label: 'destructive', value: 'destructive' },
]

function getIconSvg(iconName: string): string {
  return iconSourceByName.get(iconName) ?? ''
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

  async function handleCopy(icon: ShowcaseIcon, kind: ShowcaseIconCopyKind) {
    const key = `${icon.name}:${kind}`

    await copyText(createShowcaseIconSnippet(icon, kind))
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
              setPreviewSize(
                Number(
                  event.currentTarget.value,
                ) as (typeof sizeOptions)[number],
              )
            }}
          >
            {sizeOptions.map(size => (
              <option key={size} value={size}>
                {size}
                px
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
                        aria-label={`Copy ${
                          kind === 'raw' ? 'raw svg' : kind.toUpperCase()
                        } import for ${icon.label}`}
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
                  <code>{createShowcaseIconSnippet(icon, 'react')}</code>
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
