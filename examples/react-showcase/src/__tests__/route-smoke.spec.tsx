import { cleanup, screen } from '@testing-library/react'
import { implementedShowcaseComponentNames } from '@zeus-web/example-showcase-shared'

import { renderReactShowcaseRoute } from '../test-utils/render-route'

const staticRoutes = [
  {
    path: '/',
    assertion: /Zeus Web component laboratory/i,
  },
  {
    path: '/components',
    assertion: /Components/i,
  },
  {
    path: '/icons',
    assertion: /Icons/i,
  },
  {
    path: '/themes',
    assertion: /Themes/i,
  },
  {
    path: '/playground',
    assertion: /Production composition playground/i,
  },
] as const

describe('react showcase routes', () => {
  afterEach(() => {
    cleanup()
  })

  it.each(staticRoutes)('renders $path', async route => {
    await renderReactShowcaseRoute(route.path)

    expect(screen.getAllByText(route.assertion).length).toBeGreaterThan(0)
  })

  it.each(implementedShowcaseComponentNames)(
    'renders component route: %s',
    async componentName => {
      const { container } = await renderReactShowcaseRoute(
        `/components/${componentName}`,
      )

      expect(container.textContent).toContain(componentName)
      expect(container.textContent).not.toMatch(/not found/i)
    },
  )

  it('renders not found route for unknown path', async () => {
    const { container } = await renderReactShowcaseRoute('/unknown-route')

    expect(container.textContent).toMatch(/not found/i)
  })
})
