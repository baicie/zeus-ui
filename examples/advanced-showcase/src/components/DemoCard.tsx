import type { ReactNode } from 'react'

export interface DemoCardProps {
  title: string
  description: string
  children: ReactNode
  aside?: ReactNode
}

export function DemoCard({
  title,
  description,
  children,
  aside,
}: DemoCardProps) {
  return (
    <section className="advanced-section">
      <header className="advanced-section-header">
        <h2>{title}</h2>
        <p>{description}</p>
        {aside ? <div className="advanced-section-aside">{aside}</div> : null}
      </header>
      <div className="advanced-section-body">{children}</div>
    </section>
  )
}
