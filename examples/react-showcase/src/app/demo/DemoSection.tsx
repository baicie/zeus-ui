import type { ReactNode } from 'react'

export function DemoSection(props: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="showcase-demo-section">
      <header className="showcase-demo-section-header">
        <h2 className="showcase-section-title">{props.title}</h2>
        {props.description ? (
          <p className="showcase-card-description">{props.description}</p>
        ) : null}
      </header>

      <div className="showcase-demo-section-body">{props.children}</div>
    </section>
  )
}
