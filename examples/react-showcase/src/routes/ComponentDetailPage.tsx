import { useParams } from '@tanstack/react-router'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

export function ComponentDetailPage() {
  const { componentName } = useParams({
    from: '/components/$componentName',
  })

  const component = showcaseComponents.find(item => item.name === componentName)

  if (!component) {
    return (
      <div className="showcase-page">
        <div className="showcase-empty">
          {/* eslint-disable-next-line style/jsx-one-expression-per-line */}
          Component &quot;{componentName}&quot; is not part of the current
          showcase metadata.
        </div>
      </div>
    )
  }

  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">{component.group}</p>
        <h1 className="showcase-title">{component.title}</h1>
        <p className="showcase-description">{component.description}</p>
      </header>

      <section className="showcase-grid showcase-grid-2">
        <div className="showcase-card">
          <h2 className="showcase-card-title">Package</h2>
          <pre className="showcase-code">{component.packageName}</pre>
        </div>

        <div className="showcase-card">
          <h2 className="showcase-card-title">Registry command</h2>
          <pre className="showcase-code">{component.registryCommand}</pre>
        </div>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Imports</h2>
        <div className="showcase-grid">
          <ImportBlock title="React" value={component.imports.react} />
          <ImportBlock title="Vue" value={component.imports.vue} />
          <ImportBlock
            title="Web Component"
            value={component.imports.webComponent}
          />
        </div>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Planned sections</h2>
        <div className="showcase-card">
          <ul className="showcase-list">
            {component.sections.map(section => (
              <li key={section}>
                <span className="showcase-badge">{section}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">States</h2>
        <div className="showcase-card">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {component.states.map(state => (
              <span key={state} className="showcase-badge">
                {state}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Events</h2>
        {/* eslint-disable-next-line style/multiline-ternary */}
        {component.events.length > 0 ? (
          <div className="showcase-grid">
            {component.events.map(event => (
              <div key={event.name} className="showcase-card">
                <h3 className="showcase-card-title">{event.name}</h3>
                <p className="showcase-card-description">{event.description}</p>
                <pre className="showcase-code">
                  {[
                    event.reactName ? `React: ${event.reactName}` : '',
                    event.vueName ? `Vue: ${event.vueName}` : '',
                  ]
                    .filter(Boolean)
                    .join('\n')}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <div className="showcase-empty">No custom events planned.</div>
        )}
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Theme tokens</h2>
        <div className="showcase-card">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {component.themeTokens.map(token => (
              <span key={token} className="showcase-badge">
                {token}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Production patterns</h2>
        <div className="showcase-card">
          <ul className="showcase-list">
            {component.productionPatterns.map(pattern => (
              <li key={pattern}>{pattern}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

function ImportBlock(props: { title: string; value?: string }) {
  return (
    <div className="showcase-card">
      <h3 className="showcase-card-title">{props.title}</h3>
      <pre className="showcase-code">{props.value ?? 'Not planned'}</pre>
    </div>
  )
}
