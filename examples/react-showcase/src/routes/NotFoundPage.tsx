import { Link } from '@tanstack/react-router'

export function NotFoundPage() {
  return (
    <div className="showcase-page">
      <div className="showcase-empty">
        <h1>Route not found</h1>
        <p>This page does not exist in the React showcase.</p>
        <Link to="/" className="showcase-nav-link">
          Back to overview
        </Link>
      </div>
    </div>
  )
}
