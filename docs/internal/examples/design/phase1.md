下面给 **Phase 1：React Router Showcase App Shell** 的完整设计与代码。

这个阶段只做 React Showcase 的 **路由骨架 + AppShell + 元数据驱动的页面占位 + 单测**。
不在 Phase 1 实现每个组件的完整能力页。完整能力页放到后续 Phase 3/4。

当前仓库已经有 `examples/*` workspace，所以新增 `examples/react-showcase` 会被 workspace 管理。
当前 CLI 也已经支持 `zweb init/add/list/diff/update/doctor/theme/icon/ai`，后续 React Showcase 可以继续接入 registry source-copy 流程。

---

# Phase 1 目标

```txt
目标：
1. 新增 examples/react-showcase。
2. 使用 TanStack Router 建立生产级 React 路由骨架。
3. 消费 examples/showcase-shared 元数据生成导航和组件页。
4. 提供 /、/components、/components/:componentName、/icons、/themes、/playground。
5. 提供 AppShell、Sidebar、Topbar、基础页面布局。
6. 提供单测，验证路由、导航、组件详情页、搜索。
7. 接入根 package.json 的 showcase:react / showcase:build / showcase:test。
```

不做：

```txt
1. 不实现所有组件完整 demo。
2. 不接入 Playwright e2e。
3. 不运行 zweb add --all。
4. 不生成 registry 本地组件。
```

原因：Phase 1 的核心是 **路由和应用结构稳定**。
组件能力页后续按组件逐个填充。

---

# Phase 1 文件结构

```txt
examples/react-showcase/
  package.json
  index.html
  tsconfig.json
  vite.config.ts
  src/
    main.tsx
    router.tsx
    app.css
    test.setup.ts
    app/
      AppShell.tsx
      Sidebar.tsx
      Topbar.tsx
      RouteCard.tsx
    routes/
      HomePage.tsx
      ComponentsIndexPage.tsx
      ComponentDetailPage.tsx
      IconsPage.tsx
      ThemesPage.tsx
      PlaygroundPage.tsx
      NotFoundPage.tsx
    __tests__/
      router.spec.tsx
```

---

# 1. 新增 `examples/react-showcase/package.json`

```json
{
  "name": "@zeus-web/example-react-showcase",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --run"
  },
  "dependencies": {
    "@tanstack/react-router": "^1.0.0",
    "@zeus-web/example-showcase-shared": "workspace:*",
    "@zeus-web/icons": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "react": "^19.2.17",
    "react-dom": "^19.2.17"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "jsdom": "^29.1.1",
    "vite": "^7.2.0",
    "vitest": "^4.0.0",
    "typescript": "^5.9.0"
  }
}
```

---

# 2. 新增 `examples/react-showcase/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "vite.config.ts"]
}
```

---

# 3. 新增 `examples/react-showcase/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zeus Web React Showcase</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

# 4. 新增 `examples/react-showcase/vite.config.ts`

```ts
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test.setup.ts'],
    globals: true,
  },
})
```

---

# 5. 新增 `examples/react-showcase/src/test.setup.ts`

```ts
import '@testing-library/jest-dom/vitest'
```

---

# 6. 新增 `examples/react-showcase/src/main.tsx`

```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'

import '@zeus-web/themes/default.css'
import './app.css'

import { createShowcaseRouter } from './router'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Missing #root element')
}

const router = createShowcaseRouter()

createRoot(root).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
```

---

# 7. 新增 `examples/react-showcase/src/router.tsx`

这里不用 TanStack file-based router，先用 code-based route tree。
这样 Phase 1 更稳定，不需要引入 routeTree 生成器。

```tsx
import {
  Outlet,
  Router,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
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
```

---

# 8. 新增 `examples/react-showcase/src/app.css`

这份 CSS 只做 app shell 和展示页基础样式，不污染组件库实现。

```css
:root {
  color-scheme: light;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  min-height: 100%;
  margin: 0;
}

body {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

button,
input {
  font: inherit;
}

a {
  color: inherit;
  text-decoration: none;
}

.showcase-shell {
  min-height: 100vh;
  background:
    radial-gradient(
      circle at top left,
      hsl(var(--primary) / 0.08),
      transparent 34rem
    ),
    hsl(var(--background));
  color: hsl(var(--foreground));
}

.showcase-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--background) / 0.86);
  backdrop-filter: blur(18px);
}

.showcase-topbar-inner {
  display: flex;
  height: 4rem;
  align-items: center;
  gap: 1rem;
  padding: 0 1.5rem;
}

.showcase-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 700;
}

.showcase-brand-mark {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.65rem;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.showcase-search {
  margin-left: auto;
  width: min(24rem, 38vw);
  border: 1px solid hsl(var(--input));
  border-radius: 0.65rem;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 0.625rem 0.75rem;
  outline: none;
}

.showcase-search:focus {
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.35);
}

.showcase-layout {
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr);
  min-height: calc(100vh - 4rem);
}

.showcase-sidebar {
  border-right: 1px solid hsl(var(--border));
  padding: 1rem;
}

.showcase-sidebar-section {
  margin-bottom: 1.25rem;
}

.showcase-sidebar-title {
  margin: 0 0 0.5rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.showcase-nav {
  display: grid;
  gap: 0.25rem;
}

.showcase-nav-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 0.55rem;
  padding: 0.5rem 0.65rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.showcase-nav-link:hover,
.showcase-nav-link[data-active='true'] {
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.showcase-content {
  min-width: 0;
  padding: 1.5rem;
}

.showcase-page {
  margin: 0 auto;
  max-width: 72rem;
}

.showcase-page-header {
  margin-bottom: 1.5rem;
}

.showcase-eyebrow {
  margin: 0 0 0.5rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  font-weight: 600;
}

.showcase-title {
  margin: 0;
  font-size: clamp(2rem, 3vw, 3.25rem);
  letter-spacing: -0.045em;
}

.showcase-description {
  max-width: 52rem;
  margin: 0.75rem 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 1rem;
  line-height: 1.65;
}

.showcase-grid {
  display: grid;
  gap: 1rem;
}

.showcase-grid-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.showcase-grid-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.showcase-card {
  border: 1px solid hsl(var(--border));
  border-radius: 1rem;
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  padding: 1rem;
  box-shadow: 0 1px 2px hsl(0 0% 0% / 0.04);
}

.showcase-card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.showcase-card-description {
  margin: 0.35rem 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  line-height: 1.5;
}

.showcase-badge {
  display: inline-flex;
  align-items: center;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  padding: 0.15rem 0.5rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 600;
}

.showcase-section {
  margin-top: 1rem;
}

.showcase-section-title {
  margin: 0 0 0.75rem;
  font-size: 1.125rem;
}

.showcase-list {
  display: grid;
  gap: 0.5rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.showcase-code {
  overflow-x: auto;
  border-radius: 0.75rem;
  background: hsl(var(--muted));
  padding: 0.75rem;
  color: hsl(var(--foreground));
  font-size: 0.825rem;
}

.showcase-empty {
  border: 1px dashed hsl(var(--border));
  border-radius: 1rem;
  padding: 2rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

@media (max-width: 900px) {
  .showcase-layout {
    grid-template-columns: 1fr;
  }

  .showcase-sidebar {
    display: none;
  }

  .showcase-search {
    width: min(18rem, 48vw);
  }

  .showcase-grid-2,
  .showcase-grid-3 {
    grid-template-columns: 1fr;
  }
}
```

---

# 9. 新增 `examples/react-showcase/src/app/Topbar.tsx`

```tsx
import { useMemo } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'
import { IconCheck, IconSearch } from '@zeus-web/icons/react'

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
      void navigate({ to: component.routePath })
    }
  }

  return (
    <header className="showcase-topbar">
      <div className="showcase-topbar-inner">
        <a className="showcase-brand" href="/">
          <span className="showcase-brand-mark">
            <IconCheck aria-hidden="true" width="16" height="16" />
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

        <IconSearch aria-hidden="true" width="18" height="18" />
      </div>
    </header>
  )
}
```

---

# 10. 新增 `examples/react-showcase/src/app/Sidebar.tsx`

```tsx
import { Link, useRouterState } from '@tanstack/react-router'
import {
  componentRoutes,
  foundationRoutes,
  showcaseComponents,
} from '@zeus-web/example-showcase-shared'

const groupedComponents = Object.groupBy(showcaseComponents, item => item.group)

export function Sidebar() {
  const pathname = useRouterState({
    select: state => state.location.pathname,
  })

  return (
    <aside className="showcase-sidebar" aria-label="Showcase navigation">
      <section className="showcase-sidebar-section">
        <h2 className="showcase-sidebar-title">Overview</h2>
        <nav className="showcase-nav">
          {foundationRoutes.map(route => (
            <Link
              key={route.path}
              className="showcase-nav-link"
              data-active={pathname === route.path}
              to={route.path}
            >
              {route.label}
            </Link>
          ))}
        </nav>
      </section>

      <section className="showcase-sidebar-section">
        <h2 className="showcase-sidebar-title">Components</h2>

        {Object.entries(groupedComponents).map(([group, components]) => {
          if (!components) return null

          return (
            <div key={group} className="showcase-sidebar-section">
              <h3 className="showcase-sidebar-title">{group}</h3>
              <nav className="showcase-nav">
                {components.map(component => (
                  <Link
                    key={component.name}
                    className="showcase-nav-link"
                    data-active={pathname === component.routePath}
                    to={component.routePath}
                  >
                    <span>{component.title}</span>
                    <span className="showcase-badge">{component.name}</span>
                  </Link>
                ))}
              </nav>
            </div>
          )
        })}
      </section>

      <section className="showcase-sidebar-section">
        <h2 className="showcase-sidebar-title">Route count</h2>
        <div className="showcase-card">
          <div className="showcase-card-title">{componentRoutes.length}</div>
          <p className="showcase-card-description">component pages planned</p>
        </div>
      </section>
    </aside>
  )
}
```

> 如果当前 TS 配置的 lib 不支持 `Object.groupBy`，就用下面的兼容版替换 `groupedComponents`。

```ts
const groupedComponents = showcaseComponents.reduce<
  Record<string, typeof showcaseComponents>
>((groups, item) => {
  groups[item.group] ??= []
  groups[item.group].push(item)
  return groups
}, {})
```

为避免兼容风险，我建议直接使用兼容版。完整 Sidebar 建议用下面这版：

```tsx
import { Link, useRouterState } from '@tanstack/react-router'
import {
  componentRoutes,
  foundationRoutes,
  showcaseComponents,
} from '@zeus-web/example-showcase-shared'

const groupedComponents = showcaseComponents.reduce<
  Record<string, typeof showcaseComponents>
>((groups, item) => {
  groups[item.group] ??= []
  groups[item.group].push(item)
  return groups
}, {})

export function Sidebar() {
  const pathname = useRouterState({
    select: state => state.location.pathname,
  })

  return (
    <aside className="showcase-sidebar" aria-label="Showcase navigation">
      <section className="showcase-sidebar-section">
        <h2 className="showcase-sidebar-title">Overview</h2>
        <nav className="showcase-nav">
          {foundationRoutes.map(route => (
            <Link
              key={route.path}
              className="showcase-nav-link"
              data-active={pathname === route.path}
              to={route.path}
            >
              {route.label}
            </Link>
          ))}
        </nav>
      </section>

      <section className="showcase-sidebar-section">
        <h2 className="showcase-sidebar-title">Components</h2>

        {Object.entries(groupedComponents).map(([group, components]) => (
          <div key={group} className="showcase-sidebar-section">
            <h3 className="showcase-sidebar-title">{group}</h3>
            <nav className="showcase-nav">
              {components.map(component => (
                <Link
                  key={component.name}
                  className="showcase-nav-link"
                  data-active={pathname === component.routePath}
                  to={component.routePath}
                >
                  <span>{component.title}</span>
                  <span className="showcase-badge">{component.name}</span>
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </section>

      <section className="showcase-sidebar-section">
        <h2 className="showcase-sidebar-title">Route count</h2>
        <div className="showcase-card">
          <div className="showcase-card-title">{componentRoutes.length}</div>
          <p className="showcase-card-description">component pages planned</p>
        </div>
      </section>
    </aside>
  )
}
```

---

# 11. 新增 `examples/react-showcase/src/app/AppShell.tsx`

```tsx
import type { ReactNode } from 'react'

import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell(props: { children: ReactNode }) {
  return (
    <div className="showcase-shell">
      <Topbar />

      <div className="showcase-layout">
        <Sidebar />
        <main className="showcase-content">{props.children}</main>
      </div>
    </div>
  )
}
```

---

# 12. 新增 `examples/react-showcase/src/app/RouteCard.tsx`

```tsx
import { Link } from '@tanstack/react-router'

export function RouteCard(props: {
  to: string
  title: string
  description: string
  badge?: string
}) {
  return (
    <Link to={props.to} className="showcase-card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div>
          <h3 className="showcase-card-title">{props.title}</h3>
          <p className="showcase-card-description">{props.description}</p>
        </div>

        {props.badge ? (
          <span className="showcase-badge">{props.badge}</span>
        ) : null}
      </div>
    </Link>
  )
}
```

---

# 13. 新增 `examples/react-showcase/src/routes/HomePage.tsx`

```tsx
import {
  componentRoutes,
  deferredComponents,
  showcaseComponents,
  showcaseIcons,
  showcaseThemes,
} from '@zeus-web/example-showcase-shared'

import { RouteCard } from '../app/RouteCard'

export function HomePage() {
  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">React router showcase</p>
        <h1 className="showcase-title">Zeus Web component laboratory</h1>
        <p className="showcase-description">
          A production-grade React showcase for validating Zeus Web components,
          route structure, icon usage, theme tokens and future component pages.
        </p>
      </header>

      <section className="showcase-grid showcase-grid-3">
        <Metric
          title={String(showcaseComponents.length)}
          description="components planned"
        />
        <Metric
          title={String(showcaseIcons.length)}
          description="icons in metadata"
        />
        <Metric
          title={String(showcaseThemes.length)}
          description="theme variants"
        />
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Start here</h2>
        <div className="showcase-grid showcase-grid-2">
          <RouteCard
            to="/components"
            title="Components"
            description="Browse every planned component page."
            badge={`${componentRoutes.length} routes`}
          />
          <RouteCard
            to="/icons"
            title="Icons"
            description="Preview icon metadata and planned import patterns."
            badge={`${showcaseIcons.length} icons`}
          />
          <RouteCard
            to="/themes"
            title="Themes"
            description="Inspect theme variants and semantic token groups."
            badge={`${showcaseThemes.length} themes`}
          />
          <RouteCard
            to="/playground"
            title="Playground"
            description="Production-like composition scenarios planned for later phases."
            badge="phase 6"
          />
        </div>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Deferred overlays</h2>
        <div className="showcase-card">
          <p className="showcase-card-description">
            Overlay primitives are intentionally deferred from the first beta.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginTop: '1rem',
            }}
          >
            {deferredComponents.map(name => (
              <span key={name} className="showcase-badge">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function Metric(props: { title: string; description: string }) {
  return (
    <div className="showcase-card">
      <h2 className="showcase-title" style={{ fontSize: '2rem' }}>
        {props.title}
      </h2>
      <p className="showcase-card-description">{props.description}</p>
    </div>
  )
}
```

---

# 14. 新增 `examples/react-showcase/src/routes/ComponentsIndexPage.tsx`

```tsx
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

import { RouteCard } from '../app/RouteCard'

const groupedComponents = showcaseComponents.reduce<
  Record<string, typeof showcaseComponents>
>((groups, item) => {
  groups[item.group] ??= []
  groups[item.group].push(item)
  return groups
}, {})

export function ComponentsIndexPage() {
  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">Components</p>
        <h1 className="showcase-title">Component routes</h1>
        <p className="showcase-description">
          Each route will become a full capability page with variants, states,
          controlled usage, events, theme tokens, accessibility notes and
          production patterns.
        </p>
      </header>

      <div className="showcase-grid">
        {Object.entries(groupedComponents).map(([group, components]) => (
          <section key={group} className="showcase-section">
            <h2 className="showcase-section-title">{group}</h2>
            <div className="showcase-grid showcase-grid-2">
              {components.map(component => (
                <RouteCard
                  key={component.name}
                  to={component.routePath}
                  title={component.title}
                  description={component.description}
                  badge={component.name}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
```

---

# 15. 新增 `examples/react-showcase/src/routes/ComponentDetailPage.tsx`

```tsx
import { useParams } from '@tanstack/react-router'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

export function ComponentDetailPage() {
  const { componentName } = useParams({
    from: '/components/$componentName',
  })

  const component = showcaseComponents.find(item => item.name === componentName)

  if (!component) {
    return (
      <div className="showcase-page">
        <div className="showcase-empty">
          Component "{componentName}" is not part of the current showcase
          metadata.
        </div>
      </div>
    )
  }

  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">{component.group}</p>
        <h1 className="showcase-title">{component.title}</h1>
        <p className="showcase-description">{component.description}</p>
      </header>

      <section className="showcase-grid showcase-grid-2">
        <div className="showcase-card">
          <h2 className="showcase-card-title">Package</h2>
          <pre className="showcase-code">{component.packageName}</pre>
        </div>

        <div className="showcase-card">
          <h2 className="showcase-card-title">Registry command</h2>
          <pre className="showcase-code">{component.registryCommand}</pre>
        </div>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Imports</h2>
        <div className="showcase-grid">
          <ImportBlock title="React" value={component.imports.react} />
          <ImportBlock title="Vue" value={component.imports.vue} />
          <ImportBlock
            title="Web Component"
            value={component.imports.webComponent}
          />
        </div>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Planned sections</h2>
        <div className="showcase-card">
          <ul className="showcase-list">
            {component.sections.map(section => (
              <li key={section}>
                <span className="showcase-badge">{section}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">States</h2>
        <div className="showcase-card">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {component.states.map(state => (
              <span key={state} className="showcase-badge">
                {state}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Events</h2>
        {component.events.length > 0 ? (
          <div className="showcase-grid">
            {component.events.map(event => (
              <div key={event.name} className="showcase-card">
                <h3 className="showcase-card-title">{event.name}</h3>
                <p className="showcase-card-description">{event.description}</p>
                <pre className="showcase-code">
                  {[
                    event.reactName ? `React: ${event.reactName}` : '',
                    event.vueName ? `Vue: ${event.vueName}` : '',
                  ]
                    .filter(Boolean)
                    .join('\n')}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <div className="showcase-empty">No custom events planned.</div>
        )}
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Theme tokens</h2>
        <div className="showcase-card">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {component.themeTokens.map(token => (
              <span key={token} className="showcase-badge">
                {token}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Production patterns</h2>
        <div className="showcase-card">
          <ul className="showcase-list">
            {component.productionPatterns.map(pattern => (
              <li key={pattern}>{pattern}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

function ImportBlock(props: { title: string; value?: string }) {
  return (
    <div className="showcase-card">
      <h3 className="showcase-card-title">{props.title}</h3>
      <pre className="showcase-code">{props.value ?? 'Not planned'}</pre>
    </div>
  )
}
```

---

# 16. 新增 `examples/react-showcase/src/routes/IconsPage.tsx`

```tsx
import { showcaseIcons } from '@zeus-web/example-showcase-shared'
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconInfo,
  IconMenu,
  IconMoon,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSun,
  IconTrash,
  IconUser,
  IconX,
} from '@zeus-web/icons/react'

const previewIcons: Record<
  string,
  React.ComponentType<{ width?: number; height?: number }>
> = {
  check: IconCheck,
  x: IconX,
  plus: IconPlus,
  search: IconSearch,
  menu: IconMenu,
  settings: IconSettings,
  user: IconUser,
  copy: IconCopy,
  'external-link': IconExternalLink,
  info: IconInfo,
  'alert-triangle': IconAlertTriangle,
  sun: IconSun,
  moon: IconMoon,
  trash: IconTrash,
}

export function IconsPage() {
  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">Foundations</p>
        <h1 className="showcase-title">Icons</h1>
        <p className="showcase-description">
          Phase 1 renders icon metadata and a partial visual preview. Full icon
          search and copy actions are planned for a later phase.
        </p>
      </header>

      <section className="showcase-grid showcase-grid-3">
        {showcaseIcons.map(icon => {
          const Icon = previewIcons[icon.name]

          return (
            <div key={icon.name} className="showcase-card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <span className="showcase-brand-mark">
                  {Icon ? (
                    <Icon width={16} height={16} />
                  ) : (
                    icon.name.slice(0, 1).toUpperCase()
                  )}
                </span>
                <div>
                  <h2 className="showcase-card-title">{icon.label}</h2>
                  <p className="showcase-card-description">{icon.name}</p>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '0.4rem',
                  flexWrap: 'wrap',
                  marginTop: '1rem',
                }}
              >
                {icon.tags.map(tag => (
                  <span key={tag} className="showcase-badge">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
```

> 注意：如果当前 icons 包的导出名和这里不一致，Phase 1 可以先把 visual preview 简化为纯 metadata 卡片。Phase 1 的核心不是 icon 全量渲染。

保守版 `IconsPage.tsx`：

```tsx
import { showcaseIcons } from '@zeus-web/example-showcase-shared'

export function IconsPage() {
  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">Foundations</p>
        <h1 className="showcase-title">Icons</h1>
        <p className="showcase-description">
          Icon metadata page. Full visual icon wall and copy actions are planned
          for a later phase.
        </p>
      </header>

      <section className="showcase-grid showcase-grid-3">
        {showcaseIcons.map(icon => (
          <div key={icon.name} className="showcase-card">
            <h2 className="showcase-card-title">{icon.label}</h2>
            <p className="showcase-card-description">{icon.name}</p>

            <div
              style={{
                display: 'flex',
                gap: '0.4rem',
                flexWrap: 'wrap',
                marginTop: '1rem',
              }}
            >
              {icon.tags.map(tag => (
                <span key={tag} className="showcase-badge">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
```

我建议 Phase 1 使用保守版，避免 icon 导出名不一致影响 AppShell 阶段。

---

# 17. 新增 `examples/react-showcase/src/routes/ThemesPage.tsx`

```tsx
import {
  semanticTokens,
  showcaseThemes,
} from '@zeus-web/example-showcase-shared'

export function ThemesPage() {
  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">Foundations</p>
        <h1 className="showcase-title">Themes</h1>
        <p className="showcase-description">
          Theme variants and semantic token groups. Interactive theme switching
          is planned for a later phase.
        </p>
      </header>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Theme variants</h2>
        <div className="showcase-grid showcase-grid-3">
          {showcaseThemes.map(theme => (
            <div key={theme.name} className="showcase-card">
              <h2 className="showcase-card-title">{theme.label}</h2>
              <p className="showcase-card-description">{theme.description}</p>
              <pre className="showcase-code">{theme.cssImport}</pre>
            </div>
          ))}
        </div>
      </section>

      <section className="showcase-section">
        <h2 className="showcase-section-title">Semantic tokens</h2>
        <div className="showcase-grid showcase-grid-3">
          {semanticTokens.map(token => (
            <div key={token} className="showcase-card">
              <span className="showcase-badge">{token}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
```

---

# 18. 新增 `examples/react-showcase/src/routes/PlaygroundPage.tsx`

```tsx
export function PlaygroundPage() {
  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">Playground</p>
        <h1 className="showcase-title">Production composition playground</h1>
        <p className="showcase-description">
          This route will host production-like composed scenarios in later
          phases: admin dashboard, settings form and project creation flow.
        </p>
      </header>

      <section className="showcase-grid showcase-grid-3">
        <Scenario
          title="Admin dashboard"
          description="Cards, badges, progress, alerts and icons."
        />
        <Scenario
          title="Settings form"
          description="Labels, inputs, selects, checkboxes, switches and validation."
        />
        <Scenario
          title="Project creation"
          description="Dialog, form controls, tooltips and event logs."
        />
      </section>
    </div>
  )
}

function Scenario(props: { title: string; description: string }) {
  return (
    <div className="showcase-card">
      <h2 className="showcase-card-title">{props.title}</h2>
      <p className="showcase-card-description">{props.description}</p>
      <span className="showcase-badge">planned</span>
    </div>
  )
}
```

---

# 19. 新增 `examples/react-showcase/src/routes/NotFoundPage.tsx`

```tsx
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
```

---

# 20. 新增单测 `examples/react-showcase/src/__tests__/router.spec.tsx`

```tsx
import { RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createShowcaseRouter } from '../router'

function renderRoute(initialPath = '/') {
  const router = createShowcaseRouter({ initialPath })

  return render(<RouterProvider router={router} />)
}

describe('React showcase router', () => {
  it('renders the home page', async () => {
    renderRoute('/')

    expect(
      await screen.findByText('Zeus Web component laboratory'),
    ).toBeInTheDocument()
    expect(screen.getByText('React router showcase')).toBeInTheDocument()
  })

  it('renders the component index page', async () => {
    renderRoute('/components')

    expect(await screen.findByText('Component routes')).toBeInTheDocument()
    expect(screen.getByText('Button')).toBeInTheDocument()
    expect(screen.getByText('Input')).toBeInTheDocument()
  })

  it('renders a component detail page from metadata', async () => {
    renderRoute('/components/button')

    expect(await screen.findByText('Button')).toBeInTheDocument()
    expect(screen.getByText('@zeus-web/button')).toBeInTheDocument()
    expect(screen.getByText('zweb add button')).toBeInTheDocument()
  })

  it('renders icons and themes routes', async () => {
    renderRoute('/icons')
    expect(await screen.findByText('Icons')).toBeInTheDocument()

    renderRoute('/themes')
    expect(await screen.findByText('Themes')).toBeInTheDocument()
  })

  it('navigates from sidebar to a component page', async () => {
    const user = userEvent.setup()

    renderRoute('/')

    await user.click(await screen.findByRole('link', { name: /Button/i }))

    expect(await screen.findByText('@zeus-web/button')).toBeInTheDocument()
  })

  it('searches component from topbar using enter', async () => {
    const user = userEvent.setup()

    renderRoute('/')

    const input = await screen.findByLabelText('Search components')

    await user.clear(input)
    await user.type(input, 'input{Enter}')

    expect(await screen.findByText('@zeus-web/input')).toBeInTheDocument()
  })
})
```

---

# 21. 修改根 `package.json`

新增脚本：

```json
{
  "scripts": {
    "showcase:react": "pnpm --filter @zeus-web/example-react-showcase dev",
    "showcase:build": "pnpm --filter @zeus-web/example-react-showcase build",
    "showcase:test": "pnpm --filter @zeus-web/example-react-showcase test"
  }
}
```

如果你已经有 `showcase:*`，则合并，不要重复。

同时建议改 `examples:check`：

```json
{
  "scripts": {
    "examples:check": "pnpm examples:contract && pnpm -F \"@zeus-web/example-*\" check"
  }
}
```

Phase 1 暂时不把 `showcase:build` 接入 `site:check`，避免这个阶段和 docs/examples 原有检查互相耦合。Phase 2/3 稳定后再接。

---

# 22. Phase 1 验收命令

```bash
pnpm install

pnpm --filter @zeus-web/example-showcase-shared check
pnpm --filter @zeus-web/example-react-showcase check
pnpm --filter @zeus-web/example-react-showcase test
pnpm --filter @zeus-web/example-react-showcase build

pnpm showcase:build
pnpm showcase:test
```

完整仓库验收：

```bash
pnpm format-check
pnpm lint
pnpm test
pnpm check
pnpm build
pnpm check:component-coverage
pnpm check:showcase-metadata
pnpm site:check
```

---

# 23. Phase 1 完成标准

```txt
Phase 1 done 当且仅当：

1. examples/react-showcase 存在。
2. React app 能启动。
3. TanStack Router code-based route tree 可用。
4. / 能访问。
5. /components 能访问。
6. /components/button 能访问。
7. /icons 能访问。
8. /themes 能访问。
9. /playground 能访问。
10. Sidebar 根据 shared metadata 渲染。
11. Topbar 搜索能跳转到组件页。
12. unit tests 通过。
13. build 通过。
```

---

# 24. 后续 Phase 2 接口

Phase 2 做 Vue 时，可以复用：

```txt
examples/showcase-shared/src/components.ts
examples/showcase-shared/src/routes.ts
examples/showcase-shared/src/icons.ts
examples/showcase-shared/src/themes.ts
```

Vue 的 route tree 要和 React 保持一致。

---

# 建议提交

```txt
feat(examples): add React showcase router shell
```

这个 Phase 1 完成后，你就已经有一个能跑、能测、能构建的 React Router Showcase 骨架了。
后续只需要往 `/components/:componentName` 下逐步替换 placeholder 为真实组件能力页即可。
