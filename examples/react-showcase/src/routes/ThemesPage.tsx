import type {
  ShowcaseThemeMode,
  ShowcaseThemeName,
  ShowcaseThemeSnippetKind,
} from '@zeus-web/example-showcase-shared'
import type { MotionPresetName, RadiusPresetName } from '@zeus-web/themes'

import type { CSSProperties } from 'react'
import {
  createShowcaseThemeSnippet,
  createShowcaseThemeStyle,
  semanticTokens,
  showcaseDarkModeStrategies,
  showcaseMotionPresets,
  showcaseRadiusPresets,
  showcaseThemeModes,
  showcaseThemes,
  showcaseThemeTokenGroups,
} from '@zeus-web/example-showcase-shared'
import { useMemo, useState } from 'react'

/* eslint-disable no-restricted-globals */

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
                {item.label} ·{item.value}
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
                    <small>
                      hsl(var(--
                      {token}
                      ))
                    </small>
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
