import { useNavigate, useRouterState } from '@tanstack/react-router'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'
import { CheckIcon, SearchIcon } from '@zeus-web/icons/react'
import { useMemo } from 'react'

export function Topbar() {
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: state => state.location.pathname,
  })

  const currentComponent = useMemo(() => {
    const match = pathname.match(/^\/components\/(.+)$/)
    return match?.[1] ?? ''
  }, [pathname])

  function handleSearch(value: string) {
    const normalized = value.trim().toLowerCase()

    if (!normalized) return

    const component = showcaseComponents.find(item => {
      return (
        item.name.includes(normalized) ||
        item.title.toLowerCase().includes(normalized) ||
        item.group.toLowerCase().includes(normalized)
      )
    })

    if (component) {
      void navigate({ to: component.routePath as string })
    }
  }

  return (
    <header className="showcase-topbar">
      <div className="showcase-topbar-inner">
        <a className="showcase-brand" href="/">
          <span className="showcase-brand-mark">
            <CheckIcon aria-hidden="true" width="16" height="16" />
          </span>
          <span>Zeus Web React Showcase</span>
        </a>

        <input
          aria-label="Search components"
          className="showcase-search"
          defaultValue={currentComponent}
          placeholder="Search components..."
          onKeyDown={event => {
            if (event.key === 'Enter') {
              handleSearch(event.currentTarget.value)
            }
          }}
        />

        <SearchIcon aria-hidden="true" width="18" height="18" />
      </div>
    </header>
  )
}
