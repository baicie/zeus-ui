import { Link, useRouterState } from '@tanstack/react-router'
import {
  componentRoutes,
  foundationRoutes,
  showcaseComponents,
} from '@zeus-web/example-showcase-shared'

const groupedComponents = showcaseComponents.reduce<
  Record<string, typeof showcaseComponents>
>((groups, item) => {
  groups[item.group] ??= []
  groups[item.group].push(item)
  return groups
}, {})

type FoundationRouteTo =
  | '/'
  | '/components'
  | '/icons'
  | '/themes'
  | '/playground'

function isFoundationRoute(path: string): path is FoundationRouteTo {
  return (
    path === '/' ||
    path === '/components' ||
    path === '/icons' ||
    path === '/themes' ||
    path === '/playground'
  )
}

export function Sidebar() {
  const pathname = useRouterState({
    select: state => state.location.pathname,
  })

  return (
    <aside className="showcase-sidebar" aria-label="Showcase navigation">
      <section className="showcase-sidebar-section">
        <h2 className="showcase-sidebar-title">Overview</h2>
        <nav className="showcase-nav">
          {foundationRoutes.map(
            route =>
              isFoundationRoute(route.path) && (
                <Link
                  key={route.path}
                  className="showcase-nav-link"
                  data-active={pathname === route.path}
                  to={route.path}
                >
                  {route.label}
                </Link>
              ),
          )}
        </nav>
      </section>

      <section className="showcase-sidebar-section">
        <h2 className="showcase-sidebar-title">Components</h2>

        {Object.entries(groupedComponents).map(([group, components]) => (
          <div key={group} className="showcase-sidebar-section">
            <h3 className="showcase-sidebar-title">{group}</h3>
            <nav className="showcase-nav">
              {components.map(component => (
                <Link
                  key={component.name}
                  className="showcase-nav-link"
                  data-active={pathname === component.routePath}
                  to="/components/$componentName"
                  params={{ componentName: component.name }}
                >
                  <span>{component.title}</span>
                  <span className="showcase-badge">{component.name}</span>
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </section>

      <section className="showcase-sidebar-section">
        <h2 className="showcase-sidebar-title">Route count</h2>
        <div className="showcase-card">
          <div className="showcase-card-title">{componentRoutes.length}</div>
          <p className="showcase-card-description">component pages planned</p>
        </div>
      </section>
    </aside>
  )
}
