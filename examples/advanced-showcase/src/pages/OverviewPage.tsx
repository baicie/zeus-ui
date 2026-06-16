import { Link } from 'react-router-dom'

import { advancedShowcaseRoutes } from '../routes'

export function OverviewPage() {
  const pages = advancedShowcaseRoutes.filter(route => route.path !== '/')

  return (
    <section className="overview-grid">
      {pages.map(page => (
        <Link key={page.path} to={page.path} className="overview-card">
          <span className="overview-card-title">{page.label}</span>
          <span className="overview-card-description">{page.description}</span>
        </Link>
      ))}
    </section>
  )
}
