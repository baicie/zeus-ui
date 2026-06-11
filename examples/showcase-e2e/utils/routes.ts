import { implementedShowcaseComponentNames } from '@zeus-web/example-showcase-shared'

export const showcaseFoundationRoutes = [
  {
    path: '/',
    title: /Zeus Web component laboratory/i,
  },
  {
    path: '/components',
    title: /Components/i,
  },
  {
    path: '/icons',
    title: /Icons/i,
  },
  {
    path: '/themes',
    title: /Themes/i,
  },
  {
    path: '/playground',
    title: /Production composition playground/i,
  },
] as const

export const showcaseComponentRoutes = implementedShowcaseComponentNames
