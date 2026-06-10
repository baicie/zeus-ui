import {
  semanticTokens,
  showcaseThemes,
} from '@zeus-web/example-showcase-shared'

export function ThemesPage() {
  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">Foundations</p>
        <h1 className="showcase-title">Themes</h1>
        <p className="showcase-description">
          Theme variants and semantic token groups. Interactive theme switching
          is planned for a later phase.
        </p>
      </header>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Theme variants</h2>
        <div className="showcase-grid showcase-grid-3">
          {showcaseThemes.map(theme => (
            <div key={theme.name} className="showcase-card">
              <h2 className="showcase-card-title">{theme.label}</h2>
              <p className="showcase-card-description">{theme.description}</p>
              <pre className="showcase-code">{theme.cssImport}</pre>
            </div>
          ))}
        </div>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Semantic tokens</h2>
        <div className="showcase-grid showcase-grid-3">
          {semanticTokens.map(token => (
            <div key={token} className="showcase-card">
              <span className="showcase-badge">{token}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
