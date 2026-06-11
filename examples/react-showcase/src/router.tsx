import type { Router } from '@tanstack/react-router'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'

import { AppShell } from './app/AppShell'
import { ComponentDetailPage } from './routes/ComponentDetailPage'
import { ComponentsIndexPage } from './routes/ComponentsIndexPage'
import { HomePage } from './routes/HomePage'
import { IconsPage } from './routes/IconsPage'
import { NotFoundPage } from './routes/NotFoundPage'
import { PlaygroundPage } from './routes/PlaygroundPage'
import { ThemesPage } from './routes/ThemesPage'

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
  notFoundComponent: NotFoundPage,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const componentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/components',
  component: ComponentsIndexPage,
})

const componentDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/components/$componentName',
  component: ComponentDetailPage,
})

const iconsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/icons',
  component: IconsPage,
})

const themesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/themes',
  component: ThemesPage,
})

const playgroundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/playground',
  component: PlaygroundPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  componentsRoute,
  componentDetailRoute,
  iconsRoute,
  themesRoute,
  playgroundRoute,
])

export function createShowcaseRouter(options?: {
  initialPath?: string
}): Router<typeof routeTree> {
  const history = options?.initialPath
    ? createMemoryHistory({
        initialEntries: [options.initialPath],
      })
    : undefined

  return createRouter({
    routeTree,
    history,
    defaultPreload: 'intent',
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createShowcaseRouter>
  }
}
