import type { ReactNode } from 'react'

import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell(props: { children: ReactNode }) {
  return (
    <div className="showcase-shell">
      <Topbar />

      <div className="showcase-layout">
        <Sidebar />
        <main className="showcase-content">{props.children}</main>
      </div>
    </div>
  )
}
