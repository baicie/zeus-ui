import { Link } from '@tanstack/react-router'

type StaticRouteTo = '/' | '/components' | '/icons' | '/themes' | '/playground'
type ComponentRouteTo = `/components/${string}`
export type ShowcaseRouteTo = StaticRouteTo | ComponentRouteTo

export function RouteCard(props: {
  to: ShowcaseRouteTo
  title: string
  description: string
  badge?: string
}) {
  const content = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '1rem',
      }}
    >
      <div>
        <h3 className="showcase-card-title">{props.title}</h3>
        <p className="showcase-card-description">{props.description}</p>
      </div>

      {props.badge && <span className="showcase-badge">{props.badge}</span>}
    </div>
  )

  if (props.to.startsWith('/components/') && props.to !== '/components') {
    const componentName = props.to.slice('/components/'.length)

    return (
      <Link
        to="/components/$componentName"
        params={{ componentName }}
        className="showcase-card"
      >
        {content}
      </Link>
    )
  }

  return (
    <Link to={props.to as StaticRouteTo} className="showcase-card">
      {content}
    </Link>
  )
}
