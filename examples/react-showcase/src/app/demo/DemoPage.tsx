import type { ReactNode } from 'react'

export function DemoPage(props: {
  eyebrow?: string
  title: string
  description: string
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        {props.eyebrow ? (
          <p className="showcase-eyebrow">{props.eyebrow}</p>
        ) : null}

        <h1 className="showcase-title">{props.title}</h1>
        <p className="showcase-description">{props.description}</p>

        {props.meta ? (
          <div className="showcase-page-meta">{props.meta}</div>
        ) : null}
      </header>

      <div className="showcase-demo-stack">{props.children}</div>
    </div>
  )
}
