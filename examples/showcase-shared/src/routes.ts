import type { ShowcaseRoute } from './types'
import { showcaseComponents } from './components'

export const foundationRoutes: ShowcaseRoute[] = [
  {
    path: '/',
    label: 'Overview',
    description: 'Showcase overview and current beta scope.',
    group: 'Overview',
  },
  {
    path: '/components',
    label: 'Components',
    description: 'All component pages.',
    group: 'Components',
  },
  {
    path: '/icons',
    label: 'Icons',
    description: 'Icon grid, import snippets and visual states.',
    group: 'Foundations',
  },
  {
    path: '/themes',
    label: 'Themes',
    description: 'Theme tokens and visual previews.',
    group: 'Foundations',
  },
  {
    path: '/playground',
    label: 'Playground',
    description: 'Production-like composed pages.',
    group: 'Playground',
  },
]

export const componentRoutes: ShowcaseRoute[] = showcaseComponents.map(
  component => ({
    path: component.routePath,
    label: component.title,
    description: component.description,
    group: 'Components',
    componentName: component.name,
  }),
)

export const showcaseRoutes: ShowcaseRoute[] = [
  ...foundationRoutes,
  ...componentRoutes,
]
