import type { ReactNode } from 'react'

export function DemoGrid(props: { children: ReactNode; columns?: 1 | 2 | 3 }) {
  const columns = props.columns ?? 2

  return (
    <div className={`showcase-demo-grid showcase-demo-grid-${columns}`}>
      {props.children}
    </div>
  )
}
