import { Link } from '@tanstack/react-router'

export function RouteCard(props: {
  to: string
  title: string
  description: string
  badge?: string
}) {
  return (
    <Link to={props.to as string} className="showcase-card">
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
    </Link>
  )
}
