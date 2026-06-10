import type { ShowcaseEventSpec } from '@zeus-web/example-showcase-shared'

export function EventLog(props: { events: ShowcaseEventSpec[] }) {
  if (props.events.length === 0) {
    return <div className="showcase-empty">No custom events planned.</div>
  }

  return (
    <div className="showcase-demo-grid showcase-demo-grid-2">
      {props.events.map(event => (
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
  )
}
