import { implementedShowcaseComponentNames } from '@zeus-web/example-showcase-shared'

import { mountVueShowcaseRoute } from '../test-utils/mount-route'

const staticRoutes = [
  {
    path: '/',
    assertion: 'Zeus Web',
  },
  {
    path: '/components',
    assertion: 'Components',
  },
  {
    path: '/icons',
    assertion: 'Icons',
  },
  {
    path: '/themes',
    assertion: 'Themes',
  },
  {
    path: '/playground',
    assertion: 'Production composition playground',
  },
] as const

describe('vue showcase routes', () => {
  it.each(staticRoutes)('renders $path', async route => {
    const { wrapper } = await mountVueShowcaseRoute(route.path)

    expect(wrapper.text()).toContain(route.assertion)
  })

  it.each(implementedShowcaseComponentNames)(
    'renders component route: %s',
    async componentName => {
      const { wrapper } = await mountVueShowcaseRoute(
        `/components/${componentName}`,
      )

      expect(wrapper.text()).toContain(componentName)
      expect(wrapper.text().toLowerCase()).not.toContain('not found')
    },
  )

  it('renders not found route for unknown path', async () => {
    const { wrapper } = await mountVueShowcaseRoute('/unknown-route')

    expect(wrapper.text().toLowerCase()).toContain('not found')
  })
})
