import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router'

import ComponentDetailPage from './routes/ComponentDetailPage.vue'
import ComponentsIndexPage from './routes/ComponentsIndexPage.vue'
import HomePage from './routes/HomePage.vue'
import IconsPage from './routes/IconsPage.vue'
import NotFoundPage from './routes/NotFoundPage.vue'
import PlaygroundPage from './routes/PlaygroundPage.vue'
import ThemesPage from './routes/ThemesPage.vue'

export function createShowcaseRouter(options?: { initialPath?: string }) {
  const history = options?.initialPath
    ? createMemoryHistory()
    : createWebHistory()

  const router = createRouter({
    history,
    routes: [
      {
        path: '/',
        name: 'home',
        component: HomePage,
      },
      {
        path: '/components',
        name: 'components',
        component: ComponentsIndexPage,
      },
      {
        path: '/components/:componentName',
        name: 'component-detail',
        component: ComponentDetailPage,
        props: true,
      },
      {
        path: '/icons',
        name: 'icons',
        component: IconsPage,
      },
      {
        path: '/themes',
        name: 'themes',
        component: ThemesPage,
      },
      {
        path: '/playground',
        name: 'playground',
        component: PlaygroundPage,
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: NotFoundPage,
      },
    ],
    scrollBehavior() {
      return { top: 0 }
    },
  })

  if (options?.initialPath) {
    void router.push(options.initialPath)
  }

  return router
}
