import type { ReactNode } from 'react'

import { NavLink, Outlet } from 'react-router-dom'

import { advancedShowcaseRoutes } from '../routes'

export interface LayoutProps {
  children?: ReactNode
}

export function Layout(_props: LayoutProps) {
  return (
    <main className="advanced-shell">
      <header className="advanced-hero">
        <p className="advanced-eyebrow">@zeus-web advanced</p>
        <h1>Advanced Component Showcase</h1>
        <p>
          Operational demos for data-heavy and AI-assisted Zeus Web interfaces.
        </p>
      </header>

      <nav className="advanced-nav" aria-label="Advanced showcase routes">
        {advancedShowcaseRoutes.map(route => (
          <NavLink
            key={route.path}
            to={route.path}
            end={route.path === '/'}
            className={({ isActive }) =>
              isActive ? 'advanced-nav-link active' : 'advanced-nav-link'
            }
          >
            {route.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </main>
  )
}
