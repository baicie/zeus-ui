下面给 **Phase 2：Vue Router Showcase App Shell** 的完整设计与代码。

这个阶段的目标是：**把 Vue Showcase 的路由骨架、AppShell、元数据驱动页面、基础单测跑起来**，并且和 Phase 1 的 React Showcase 保持同一套 route structure。

当前 workspace 已经包含 `examples/*`，所以新增 `examples/vue-showcase` 会被 pnpm workspace 自动识别。
Phase 0 的 `showcase-shared` 已经有 `build/check/test`，可被 `examples:build` 匹配。
共享 route metadata 已经包含 `/`、`/components`、`/icons`、`/themes`、`/playground`，并从 `showcaseComponents` 自动生成组件 routes。

---

# Phase 2 目标

```txt
目标：
1. 新增 examples/vue-showcase。
2. 使用 vue-router 建立 Vue Showcase 路由骨架。
3. 复用 @zeus-web/example-showcase-shared 的 components/routes/icons/themes 元数据。
4. 实现 /、/components、/components/:componentName、/icons、/themes、/playground。
5. 实现 Vue AppShell / Sidebar / Topbar / RouteCard。
6. 提供基础单测，验证路由、导航、搜索、组件详情页。
7. 修改根 package.json 的 showcase:build / showcase:test，同步跑 React + Vue。
```

不做：

```txt
1. 不实现每个组件完整能力页。
2. 不引入 @zeus-web/*/vue 组件包。
3. 不引入 icons/vue 实际渲染。
4. 不做 Playwright e2e。
```

原因：Phase 2 是 **Vue 路由壳子阶段**。
先避免依赖 icons/primitives 的 dist 产物，确保 shell 稳定可测。组件真实能力页放到 Phase 4/5。

---

# 新增目录

```txt
examples/vue-showcase/
  package.json
  index.html
  tsconfig.json
  vite.config.ts
  src/
    main.ts
    App.vue
    router.ts
    app.css
    env.d.ts
    app/
      AppShell.vue
      Sidebar.vue
      Topbar.vue
      RouteCard.vue
    routes/
      HomePage.vue
      ComponentsIndexPage.vue
      ComponentDetailPage.vue
      IconsPage.vue
      ThemesPage.vue
      PlaygroundPage.vue
      NotFoundPage.vue
    __tests__/
      router.spec.ts
```

---

# 1. `examples/vue-showcase/package.json`

```json
{
  "name": "@zeus-web/example-vue-showcase",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5174",
    "build": "vite build",
    "check": "vue-tsc -p tsconfig.json --noEmit",
    "test": "vitest --run"
  },
  "dependencies": {
    "@zeus-web/example-showcase-shared": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "vue": "^3.5.35",
    "vue-router": "^4.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^6.0.0",
    "@vue/test-utils": "^2.4.0",
    "jsdom": "^29.1.1",
    "typescript": "^6.0.3",
    "vite": "^8.0.16",
    "vitest": "^4.1.8",
    "vue-tsc": "^3.1.0"
  }
}
```

---

# 2. `examples/vue-showcase/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]
}
```

---

# 3. `examples/vue-showcase/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zeus Web Vue Showcase</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

---

# 4. `examples/vue-showcase/vite.config.ts`

```ts
import vue from '@vitejs/plugin-vue'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

---

# 5. `examples/vue-showcase/src/env.d.ts`

```ts
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, unknown>
  export default component
}
```

---

# 6. `examples/vue-showcase/src/main.ts`

```ts
import { createApp } from 'vue'

import '@zeus-web/themes/default.css'
import './app.css'

import App from './App.vue'
import { createShowcaseRouter } from './router'

const app = createApp(App)

app.use(createShowcaseRouter())
app.mount('#app')
```

---

# 7. `examples/vue-showcase/src/router.ts`

```ts
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
```

---

# 8. `examples/vue-showcase/src/App.vue`

```vue
<script setup lang="ts">
import AppShell from './app/AppShell.vue'
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
</template>
```

---

# 9. `examples/vue-showcase/src/app.css`

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
#app {
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
  font-weight: 800;
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
  border: 0;
  width: 100%;
  cursor: pointer;
  border-radius: 0.55rem;
  background: transparent;
  padding: 0.5rem 0.65rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  text-align: left;
}

.showcase-nav-link:hover,
.showcase-nav-link[aria-current='page'],
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
  display: block;
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

# 10. `examples/vue-showcase/src/app/AppShell.vue`

```vue
<script setup lang="ts">
import Sidebar from './Sidebar.vue'
import Topbar from './Topbar.vue'
</script>

<template>
  <div class="showcase-shell">
    <Topbar />

    <div class="showcase-layout">
      <Sidebar />

      <main class="showcase-content">
        <slot />
      </main>
    </div>
  </div>
</template>
```

---

# 11. `examples/vue-showcase/src/app/Topbar.vue`

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

const route = useRoute()
const router = useRouter()

const searchValue = ref('')

const currentComponent = computed(() => {
  const componentName = route.params.componentName

  return typeof componentName === 'string' ? componentName : ''
})

function handleSearch() {
  const normalized = searchValue.value.trim().toLowerCase()

  if (!normalized) return

  const component = showcaseComponents.find(item => {
    return (
      item.name.includes(normalized) ||
      item.title.toLowerCase().includes(normalized) ||
      item.group.toLowerCase().includes(normalized)
    )
  })

  if (!component) return

  void router.push(component.routePath)
}
</script>

<template>
  <header class="showcase-topbar">
    <div class="showcase-topbar-inner">
      <RouterLink class="showcase-brand" to="/">
        <span class="showcase-brand-mark">Z</span>
        <span>Zeus Web Vue Showcase</span>
      </RouterLink>

      <input
        v-model="searchValue"
        aria-label="Search components"
        class="showcase-search"
        :placeholder="currentComponent || 'Search components...'"
        @keydown.enter="handleSearch"
      />

      <span aria-hidden="true" class="showcase-badge">Vue</span>
    </div>
  </header>
</template>
```

---

# 12. `examples/vue-showcase/src/app/Sidebar.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  componentRoutes,
  foundationRoutes,
  showcaseComponents,
} from '@zeus-web/example-showcase-shared'

const route = useRoute()

const groupedComponents = computed(() => {
  return showcaseComponents.reduce<Record<string, typeof showcaseComponents>>(
    (groups, item) => {
      groups[item.group] ??= []
      groups[item.group].push(item)
      return groups
    },
    {},
  )
})
</script>

<template>
  <aside class="showcase-sidebar" aria-label="Showcase navigation">
    <section class="showcase-sidebar-section">
      <h2 class="showcase-sidebar-title">Overview</h2>
      <nav class="showcase-nav">
        <RouterLink
          v-for="item in foundationRoutes"
          :key="item.path"
          class="showcase-nav-link"
          :data-active="route.path === item.path"
          :to="item.path"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </section>

    <section class="showcase-sidebar-section">
      <h2 class="showcase-sidebar-title">Components</h2>

      <div
        v-for="[group, components] in Object.entries(groupedComponents)"
        :key="group"
        class="showcase-sidebar-section"
      >
        <h3 class="showcase-sidebar-title">{{ group }}</h3>

        <nav class="showcase-nav">
          <RouterLink
            v-for="component in components"
            :key="component.name"
            class="showcase-nav-link"
            :data-active="route.path === component.routePath"
            :to="component.routePath"
          >
            <span>{{ component.title }}</span>
            <span class="showcase-badge">{{ component.name }}</span>
          </RouterLink>
        </nav>
      </div>
    </section>

    <section class="showcase-sidebar-section">
      <h2 class="showcase-sidebar-title">Route count</h2>
      <div class="showcase-card">
        <div class="showcase-card-title">{{ componentRoutes.length }}</div>
        <p class="showcase-card-description">component pages planned</p>
      </div>
    </section>
  </aside>
</template>
```

---

# 13. `examples/vue-showcase/src/app/RouteCard.vue`

```vue
<script setup lang="ts">
defineProps<{
  to: string
  title: string
  description: string
  badge?: string
}>()
</script>

<template>
  <RouterLink :to="to" class="showcase-card">
    <div
      style="
        display: flex;
        justify-content: space-between;
        gap: 1rem;
      "
    >
      <div>
        <h3 class="showcase-card-title">{{ title }}</h3>
        <p class="showcase-card-description">{{ description }}</p>
      </div>

      <span v-if="badge" class="showcase-badge">{{ badge }}</span>
    </div>
  </RouterLink>
</template>
```

---

# 14. `examples/vue-showcase/src/routes/HomePage.vue`

```vue
<script setup lang="ts">
import {
  componentRoutes,
  deferredComponents,
  showcaseComponents,
  showcaseIcons,
  showcaseThemes,
} from '@zeus-web/example-showcase-shared'

import RouteCard from '../app/RouteCard.vue'
</script>

<template>
  <div class="showcase-page">
    <header class="showcase-page-header">
      <p class="showcase-eyebrow">Vue router showcase</p>
      <h1 class="showcase-title">Zeus Web component laboratory</h1>
      <p class="showcase-description">
        A production-grade Vue showcase for validating Zeus Web components,
        route structure, icon metadata, theme tokens and future component pages.
      </p>
    </header>

    <section class="showcase-grid showcase-grid-3">
      <div class="showcase-card">
        <h2 class="showcase-title" style="font-size: 2rem">
          {{ showcaseComponents.length }}
        </h2>
        <p class="showcase-card-description">components planned</p>
      </div>

      <div class="showcase-card">
        <h2 class="showcase-title" style="font-size: 2rem">
          {{ showcaseIcons.length }}
        </h2>
        <p class="showcase-card-description">icons in metadata</p>
      </div>

      <div class="showcase-card">
        <h2 class="showcase-title" style="font-size: 2rem">
          {{ showcaseThemes.length }}
        </h2>
        <p class="showcase-card-description">theme variants</p>
      </div>
    </section>

    <section class="showcase-section">
      <h2 class="showcase-section-title">Start here</h2>

      <div class="showcase-grid showcase-grid-2">
        <RouteCard
          to="/components"
          title="Components"
          description="Browse every planned Vue component page."
          :badge="`${componentRoutes.length} routes`"
        />

        <RouteCard
          to="/icons"
          title="Icons"
          description="Preview icon metadata and planned import patterns."
          :badge="`${showcaseIcons.length} icons`"
        />

        <RouteCard
          to="/themes"
          title="Themes"
          description="Inspect theme variants and semantic token groups."
          :badge="`${showcaseThemes.length} themes`"
        />

        <RouteCard
          to="/playground"
          title="Playground"
          description="Production-like composition scenarios planned for later phases."
          badge="phase 6"
        />
      </div>
    </section>

    <section class="showcase-section">
      <h2 class="showcase-section-title">Deferred overlays</h2>

      <div class="showcase-card">
        <p class="showcase-card-description">
          Overlay primitives are intentionally deferred from the first beta.
        </p>

        <div
          style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem"
        >
          <span
            v-for="name in deferredComponents"
            :key="name"
            class="showcase-badge"
          >
            {{ name }}
          </span>
        </div>
      </div>
    </section>
  </div>
</template>
```

---

# 15. `examples/vue-showcase/src/routes/ComponentsIndexPage.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

import RouteCard from '../app/RouteCard.vue'

const groupedComponents = computed(() => {
  return showcaseComponents.reduce<Record<string, typeof showcaseComponents>>(
    (groups, item) => {
      groups[item.group] ??= []
      groups[item.group].push(item)
      return groups
    },
    {},
  )
})
</script>

<template>
  <div class="showcase-page">
    <header class="showcase-page-header">
      <p class="showcase-eyebrow">Components</p>
      <h1 class="showcase-title">Component routes</h1>
      <p class="showcase-description">
        Each route will become a full capability page with variants, states,
        controlled usage, events, theme tokens, accessibility notes and
        production patterns.
      </p>
    </header>

    <div class="showcase-grid">
      <section
        v-for="[group, components] in Object.entries(groupedComponents)"
        :key="group"
        class="showcase-section"
      >
        <h2 class="showcase-section-title">{{ group }}</h2>

        <div class="showcase-grid showcase-grid-2">
          <RouteCard
            v-for="component in components"
            :key="component.name"
            :to="component.routePath"
            :title="component.title"
            :description="component.description"
            :badge="component.name"
          />
        </div>
      </section>
    </div>
  </div>
</template>
```

---

# 16. `examples/vue-showcase/src/routes/ComponentDetailPage.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

const route = useRoute()

const componentName = computed(() => {
  const value = route.params.componentName
  return typeof value === 'string' ? value : ''
})

const component = computed(() => {
  return showcaseComponents.find(item => item.name === componentName.value)
})
</script>

<template>
  <div class="showcase-page">
    <div v-if="!component" class="showcase-empty">
      Component "{{ componentName }}" is not part of the current showcase
      metadata.
    </div>

    <template v-else>
      <header class="showcase-page-header">
        <p class="showcase-eyebrow">{{ component.group }}</p>
        <h1 class="showcase-title">{{ component.title }}</h1>
        <p class="showcase-description">{{ component.description }}</p>
      </header>

      <section class="showcase-grid showcase-grid-2">
        <div class="showcase-card">
          <h2 class="showcase-card-title">Package</h2>
          <pre class="showcase-code">{{ component.packageName }}</pre>
        </div>

        <div class="showcase-card">
          <h2 class="showcase-card-title">Registry command</h2>
          <pre class="showcase-code">{{ component.registryCommand }}</pre>
        </div>
      </section>

      <section class="showcase-section">
        <h2 class="showcase-section-title">Imports</h2>

        <div class="showcase-grid">
          <div class="showcase-card">
            <h3 class="showcase-card-title">React</h3>
            <pre class="showcase-code">{{
              component.imports.react || 'Not planned'
            }}</pre>
          </div>

          <div class="showcase-card">
            <h3 class="showcase-card-title">Vue</h3>
            <pre class="showcase-code">{{
              component.imports.vue || 'Not planned'
            }}</pre>
          </div>

          <div class="showcase-card">
            <h3 class="showcase-card-title">Web Component</h3>
            <pre class="showcase-code">{{
              component.imports.webComponent || 'Not planned'
            }}</pre>
          </div>
        </div>
      </section>

      <section class="showcase-section">
        <h2 class="showcase-section-title">Planned sections</h2>

        <div class="showcase-card">
          <ul class="showcase-list">
            <li v-for="section in component.sections" :key="section">
              <span class="showcase-badge">{{ section }}</span>
            </li>
          </ul>
        </div>
      </section>

      <section class="showcase-section">
        <h2 class="showcase-section-title">States</h2>

        <div class="showcase-card">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap">
            <span
              v-for="state in component.states"
              :key="state"
              class="showcase-badge"
            >
              {{ state }}
            </span>
          </div>
        </div>
      </section>

      <section class="showcase-section">
        <h2 class="showcase-section-title">Events</h2>

        <div v-if="component.events.length > 0" class="showcase-grid">
          <div
            v-for="event in component.events"
            :key="event.name"
            class="showcase-card"
          >
            <h3 class="showcase-card-title">{{ event.name }}</h3>
            <p class="showcase-card-description">{{ event.description }}</p>
            <pre class="showcase-code">{{
              [
                event.reactName ? `React: ${event.reactName}` : '',
                event.vueName ? `Vue: ${event.vueName}` : '',
              ]
                .filter(Boolean)
                .join('\n')
            }}</pre>
          </div>
        </div>

        <div v-else class="showcase-empty">No custom events planned.</div>
      </section>

      <section class="showcase-section">
        <h2 class="showcase-section-title">Theme tokens</h2>

        <div class="showcase-card">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap">
            <span
              v-for="token in component.themeTokens"
              :key="token"
              class="showcase-badge"
            >
              {{ token }}
            </span>
          </div>
        </div>
      </section>

      <section class="showcase-section">
        <h2 class="showcase-section-title">Production patterns</h2>

        <div class="showcase-card">
          <ul class="showcase-list">
            <li v-for="pattern in component.productionPatterns" :key="pattern">
              {{ pattern }}
            </li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>
```

---

# 17. `examples/vue-showcase/src/routes/IconsPage.vue`

```vue
<script setup lang="ts">
import { showcaseIcons } from '@zeus-web/example-showcase-shared'
</script>

<template>
  <div class="showcase-page">
    <header class="showcase-page-header">
      <p class="showcase-eyebrow">Foundations</p>
      <h1 class="showcase-title">Icons</h1>
      <p class="showcase-description">
        Icon metadata page. Full visual icon wall and copy actions are planned
        for a later phase.
      </p>
    </header>

    <section class="showcase-grid showcase-grid-3">
      <div v-for="icon in showcaseIcons" :key="icon.name" class="showcase-card">
        <h2 class="showcase-card-title">{{ icon.label }}</h2>
        <p class="showcase-card-description">{{ icon.name }}</p>

        <div
          style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 1rem"
        >
          <span v-for="tag in icon.tags" :key="tag" class="showcase-badge">
            {{ tag }}
          </span>
        </div>
      </div>
    </section>
  </div>
</template>
```

---

# 18. `examples/vue-showcase/src/routes/ThemesPage.vue`

```vue
<script setup lang="ts">
import {
  semanticTokens,
  showcaseThemes,
} from '@zeus-web/example-showcase-shared'
</script>

<template>
  <div class="showcase-page">
    <header class="showcase-page-header">
      <p class="showcase-eyebrow">Foundations</p>
      <h1 class="showcase-title">Themes</h1>
      <p class="showcase-description">
        Theme variants and semantic token groups. Interactive theme switching is
        planned for a later phase.
      </p>
    </header>

    <section class="showcase-section">
      <h2 class="showcase-section-title">Theme variants</h2>

      <div class="showcase-grid showcase-grid-3">
        <div
          v-for="theme in showcaseThemes"
          :key="theme.name"
          class="showcase-card"
        >
          <h2 class="showcase-card-title">{{ theme.label }}</h2>
          <p class="showcase-card-description">{{ theme.description }}</p>
          <pre class="showcase-code">{{ theme.cssImport }}</pre>
        </div>
      </div>
    </section>

    <section class="showcase-section">
      <h2 class="showcase-section-title">Semantic tokens</h2>

      <div class="showcase-grid showcase-grid-3">
        <div v-for="token in semanticTokens" :key="token" class="showcase-card">
          <span class="showcase-badge">{{ token }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
```

---

# 19. `examples/vue-showcase/src/routes/PlaygroundPage.vue`

```vue
<script setup lang="ts">
const scenarios = [
  {
    title: 'Admin dashboard',
    description: 'Cards, badges, progress, alerts and icons.',
  },
  {
    title: 'Settings form',
    description:
      'Labels, inputs, selects, checkboxes, switches and validation.',
  },
  {
    title: 'Project creation',
    description: 'Dialog, form controls, tooltips and event logs.',
  },
]
</script>

<template>
  <div class="showcase-page">
    <header class="showcase-page-header">
      <p class="showcase-eyebrow">Playground</p>
      <h1 class="showcase-title">Production composition playground</h1>
      <p class="showcase-description">
        This route will host production-like composed scenarios in later phases:
        admin dashboard, settings form and project creation flow.
      </p>
    </header>

    <section class="showcase-grid showcase-grid-3">
      <div
        v-for="scenario in scenarios"
        :key="scenario.title"
        class="showcase-card"
      >
        <h2 class="showcase-card-title">{{ scenario.title }}</h2>
        <p class="showcase-card-description">{{ scenario.description }}</p>
        <span class="showcase-badge">planned</span>
      </div>
    </section>
  </div>
</template>
```

---

# 20. `examples/vue-showcase/src/routes/NotFoundPage.vue`

```vue
<template>
  <div class="showcase-page">
    <div class="showcase-empty">
      <h1>Route not found</h1>
      <p>This page does not exist in the Vue showcase.</p>
      <RouterLink to="/" class="showcase-nav-link">
        Back to overview
      </RouterLink>
    </div>
  </div>
</template>
```

---

# 21. `examples/vue-showcase/src/__tests__/router.spec.ts`

```ts
import { mount } from '@vue/test-utils'

import App from '../App.vue'
import { createShowcaseRouter } from '../router'

async function renderRoute(initialPath = '/') {
  const router = createShowcaseRouter({ initialPath })

  await router.isReady()

  return mount(App, {
    global: {
      plugins: [router],
    },
  })
}

describe('Vue showcase router', () => {
  it('renders the home page', async () => {
    const wrapper = await renderRoute('/')

    expect(wrapper.text()).toContain('Zeus Web component laboratory')
    expect(wrapper.text()).toContain('Vue router showcase')
  })

  it('renders the component index page', async () => {
    const wrapper = await renderRoute('/components')

    expect(wrapper.text()).toContain('Component routes')
    expect(wrapper.text()).toContain('Button')
    expect(wrapper.text()).toContain('Input')
  })

  it('renders a component detail page from metadata', async () => {
    const wrapper = await renderRoute('/components/button')

    expect(wrapper.text()).toContain('Button')
    expect(wrapper.text()).toContain('@zeus-web/button')
    expect(wrapper.text()).toContain('zweb add button')
  })

  it('renders icons and themes routes', async () => {
    const icons = await renderRoute('/icons')
    expect(icons.text()).toContain('Icons')

    const themes = await renderRoute('/themes')
    expect(themes.text()).toContain('Themes')
  })

  it('navigates from sidebar to a component page', async () => {
    const wrapper = await renderRoute('/')

    const links = wrapper.findAll('a')
    const buttonLink = links.find(link => link.text().includes('Button'))

    expect(buttonLink).toBeTruthy()

    await buttonLink!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('@zeus-web/button')
  })

  it('searches component from topbar using enter', async () => {
    const wrapper = await renderRoute('/')

    const input = wrapper.get('input[aria-label="Search components"]')

    await input.setValue('input')
    await input.trigger('keydown.enter')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('@zeus-web/input')
  })
})
```

---

# 22. 修改根 `package.json`

当前根脚本只有 React showcase。

替换为：

```json
{
  "scripts": {
    "showcase:react": "pnpm --filter @zeus-web/example-react-showcase dev",
    "showcase:vue": "pnpm --filter @zeus-web/example-vue-showcase dev",
    "showcase:build": "pnpm --filter @zeus-web/example-react-showcase build && pnpm --filter @zeus-web/example-vue-showcase build",
    "showcase:test": "pnpm --filter @zeus-web/example-react-showcase test && pnpm --filter @zeus-web/example-vue-showcase test"
  }
}
```

如果你已经修了 Phase 1 里的 `build:deps`，这里不需要在根脚本里重复构建 icons。

---

# 23. 是否接入 `site:check`

Phase 2 建议 **暂时不接入** `site:check`。

当前 `site:check` 已经包含：

```txt
check:component-coverage
check:showcase-metadata
docs:check
docs:build
examples:check
```

Phase 2 只接入 `examples:check` 即可，因为 `examples:check` 会跑 `@zeus-web/example-*` 的 check。
等 Phase 3/4 组件页更完整，再把 `showcase:build` / `showcase:test` 接进 CI 或 `site:check`。

---

# 24. 验收命令

```bash
pnpm install

pnpm --filter @zeus-web/example-showcase-shared check
pnpm --filter @zeus-web/example-vue-showcase check
pnpm --filter @zeus-web/example-vue-showcase test
pnpm --filter @zeus-web/example-vue-showcase build

pnpm showcase:vue
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
pnpm examples:check
pnpm examples:build
pnpm showcase:build
pnpm showcase:test
pnpm site:check
```

---

# 25. Phase 2 完成标准

```txt
Phase 2 done 当且仅当：

1. examples/vue-showcase 存在。
2. Vue app 能启动。
3. vue-router route tree 可用。
4. / 能访问。
5. /components 能访问。
6. /components/button 能访问。
7. /icons 能访问。
8. /themes 能访问。
9. /playground 能访问。
10. Sidebar 根据 showcase-shared metadata 渲染。
11. Topbar 搜索能跳转到组件页。
12. unit tests 通过。
13. build 通过。
14. 根 showcase:build 同时跑 React + Vue。
15. 根 showcase:test 同时跑 React + Vue。
```

---

# 建议提交

```txt
feat(examples): add Vue showcase router shell
```

Phase 2 完成后，React/Vue 两个 showcase 的路由骨架就都齐了。

下一阶段建议进入：

```txt
Phase 3：Showcase Page Template 抽象
```

也就是把 React/Vue 现在的详情页 placeholder 抽成统一的：

```txt
DemoPage
DemoSection
DemoGrid
EventLog
PropTable
StateMatrix
ThemeTokenPreview
```

再从 Phase 4 开始按组件逐个填完整能力页。
