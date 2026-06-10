import {
  componentRoutes,
  deferredComponents,
  showcaseComponents,
  showcaseIcons,
  showcaseThemes,
} from '@zeus-web/example-showcase-shared'

import { RouteCard } from '../app/RouteCard'

export function HomePage() {
  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">React router showcase</p>
        <h1 className="showcase-title">Zeus Web component laboratory</h1>
        <p className="showcase-description">
          A production-grade React showcase for validating Zeus Web components,
          route structure, icon usage, theme tokens and future component pages.
        </p>
      </header>

      <section className="showcase-grid showcase-grid-3">
        <Metric
          title={String(showcaseComponents.length)}
          description="components planned"
        />
        <Metric
          title={String(showcaseIcons.length)}
          description="icons in metadata"
        />
        <Metric
          title={String(showcaseThemes.length)}
          description="theme variants"
        />
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Start here</h2>
        <div className="showcase-grid showcase-grid-2">
          <RouteCard
            to="/components"
            title="Components"
            description="Browse every planned component page."
            badge={`${componentRoutes.length} routes`}
          />
          <RouteCard
            to="/icons"
            title="Icons"
            description="Preview icon metadata and planned import patterns."
            badge={`${showcaseIcons.length} icons`}
          />
          <RouteCard
            to="/themes"
            title="Themes"
            description="Inspect theme variants and semantic token groups."
            badge={`${showcaseThemes.length} themes`}
          />
          <RouteCard
            to="/playground"
            title="Playground"
            description="Production-like composition scenarios planned for later phases."
            badge="phase 6"
          />
        </div>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Deferred overlays</h2>
        <div className="showcase-card">
          <p className="showcase-card-description">
            Overlay primitives are intentionally deferred from the first beta.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginTop: '1rem',
            }}
          >
            {deferredComponents.map(name => (
              <span key={name} className="showcase-badge">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function Metric(props: { title: string; description: string }) {
  return (
    <div className="showcase-card">
      <h2 className="showcase-title" style={{ fontSize: '2rem' }}>
        {props.title}
      </h2>
      <p className="showcase-card-description">{props.description}</p>
    </div>
  )
}
