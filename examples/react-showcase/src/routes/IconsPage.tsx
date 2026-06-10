import { showcaseIcons } from '@zeus-web/example-showcase-shared'

export function IconsPage() {
  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">Foundations</p>
        <h1 className="showcase-title">Icons</h1>
        <p className="showcase-description">
          Icon metadata page. Full visual icon wall and copy actions are planned
          for a later phase.
        </p>
      </header>

      <section className="showcase-grid showcase-grid-3">
        {showcaseIcons.map(icon => (
          <div key={icon.name} className="showcase-card">
            <h2 className="showcase-card-title">{icon.label}</h2>
            <p className="showcase-card-description">{icon.name}</p>

            <div
              style={{
                display: 'flex',
                gap: '0.4rem',
                flexWrap: 'wrap',
                marginTop: '1rem',
              }}
            >
              {icon.tags.map(tag => (
                <span key={tag} className="showcase-badge">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
