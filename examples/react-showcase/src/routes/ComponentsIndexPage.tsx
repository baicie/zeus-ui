import { showcaseComponents } from '@zeus-web/example-showcase-shared'

import { RouteCard } from '../app/RouteCard'

const groupedComponents = showcaseComponents.reduce<
  Record<string, typeof showcaseComponents>
>((groups, item) => {
  groups[item.group] ??= []
  groups[item.group].push(item)
  return groups
}, {})

export function ComponentsIndexPage() {
  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">Components</p>
        <h1 className="showcase-title">Component routes</h1>
        <p className="showcase-description">
          Each route will become a full capability page with variants, states,
          controlled usage, events, theme tokens, accessibility notes and
          production patterns.
        </p>
      </header>

      <div className="showcase-grid">
        {Object.entries(groupedComponents).map(([group, components]) => (
          <section key={group} className="showcase-section">
            <h2 className="showcase-section-title">{group}</h2>
            <div className="showcase-grid showcase-grid-2">
              {components.map(component => (
                <RouteCard
                  key={component.name}
                  to={component.routePath}
                  title={component.title}
                  description={component.description}
                  badge={component.name}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
