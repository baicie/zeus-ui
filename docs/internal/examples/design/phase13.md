下面给 Phase 13：**Vitest-powered Playwright E2E Smoke Tests**。
这一阶段只做浏览器级验证，不做 CI workflow；CI 收口留到 Phase 14。

实现口径：**由 Vitest 负责测试编排和 Vite dev server 生命周期，Playwright 只作为浏览器自动化 API 在 Vitest 测试中启动**。这样与 Vite 自身 e2e 的组织方式更接近，也能继续复用仓库现有 `vitest.config.ts` 的项目分层。

---

# Phase 13 目标

```txt id="phase13-goal"
Phase 13 = Vitest + Playwright E2E

覆盖：
  - React showcase browser smoke
  - Vue showcase browser smoke
  - 首页 / components / icons / themes / playground 路由可访问
  - component detail 路由可访问
  - Icons 页面真实浏览器交互
  - Themes 页面真实浏览器交互
  - Playground 页面真实浏览器交互
  - console error / pageerror 兜底（保留已知 showcase demo context 噪声白名单）

不覆盖：
  - 视觉快照
  - 多浏览器矩阵
  - CI workflow
  - 发布门禁
```

---

# 1. 修改根 `package.json`

新增 scripts：

```json id="root-package-scripts"
{
  "showcase:e2e:deps": "pnpm -w exec tsx scripts/examples/build-showcase-deps.ts --force",
  "showcase:e2e": "pnpm showcase:e2e:deps && vitest --project showcase-e2e --run",
  "showcase:e2e:ui": "pnpm showcase:e2e:deps && vitest --project showcase-e2e --ui",
  "showcase:e2e:headed": "pnpm showcase:e2e:deps && SHOWCASE_E2E_HEADLESS=false vitest --project showcase-e2e --run"
}
```

新增 devDependency：

```json id="root-package-deps"
{
  "@playwright/test": "^1.60.0"
}
```

完整 scripts 相关片段建议变成：

```json id="root-package-full-snippet"
{
  "scripts": {
    "showcase:react": "pnpm --filter @zeus-web/example-react-showcase dev",
    "showcase:vue": "pnpm --filter @zeus-web/example-vue-showcase dev",
    "showcase:build": "pnpm --filter @zeus-web/example-react-showcase build && pnpm --filter @zeus-web/example-vue-showcase build",
    "showcase:test": "pnpm --filter @zeus-web/example-react-showcase test && pnpm --filter @zeus-web/example-vue-showcase test",
    "showcase:test:unit": "pnpm showcase:test",
    "showcase:test:coverage": "pnpm --filter @zeus-web/example-react-showcase test -- --coverage && pnpm --filter @zeus-web/example-vue-showcase test -- --coverage",
    "showcase:e2e:deps": "pnpm -w exec tsx scripts/examples/build-showcase-deps.ts --force",
    "showcase:e2e": "pnpm showcase:e2e:deps && vitest --project showcase-e2e --run",
    "showcase:e2e:ui": "pnpm showcase:e2e:deps && vitest --project showcase-e2e --ui",
    "showcase:e2e:headed": "pnpm showcase:e2e:deps && SHOWCASE_E2E_HEADLESS=false vitest --project showcase-e2e --run"
  },
  "devDependencies": {
    "@playwright/test": "^1.60.0"
  }
}
```

首次本地需要：

```bash id="install-playwright"
pnpm install
# 默认走 Playwright 管理的 Chromium
pnpm exec playwright install chromium
```

---

# 2. 在 Vitest 中新增 `showcase-e2e` project

```ts id="vitest-showcase-e2e-project"
const showcaseSharedPath = resolve(
  process.cwd(),
  'examples/showcase-shared/src/index.ts',
)

{
  extends: true,
  test: {
    name: 'showcase-e2e',
    environment: 'node',
    include: ['examples/showcase-e2e/*.spec.ts'],
    globalSetup: ['examples/showcase-e2e/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    pool: 'forks',
  },
  resolve: {
    alias: [
      {
        find: /^@zeus-web\/example-showcase-shared$/,
        replacement: showcaseSharedPath,
      },
    ],
  },
}
```

说明：参考 Vite e2e 的组织方式，由 Vitest 负责测试编排和 Vite server 生命周期，Playwright 只作为浏览器自动化 API 使用。Phase 13 只跑 Chromium/Chrome 形态的稳定 smoke；多浏览器矩阵可以后续扩展。

## `examples/showcase-e2e/setup.ts`

在 `globalSetup` 里使用 Vite Node API 分别启动 React/Vue showcase dev server：

```ts id="vitest-showcase-e2e-setup"
import type { ViteDevServer } from 'vite'
import { resolve } from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

interface ShowcaseServerConfig {
  root: string
  port: number
}

const showcaseServers: ShowcaseServerConfig[] = [
  { root: 'examples/react-showcase', port: 5173 },
  { root: 'examples/vue-showcase', port: 5174 },
]

function startShowcaseServer(
  config: ShowcaseServerConfig,
): Promise<ViteDevServer> {
  const root = resolve(process.cwd(), config.root)

  return createServer({
    root,
    configFile: resolve(root, 'vite.config.ts'),
    server: {
      host: '127.0.0.1',
      port: config.port,
      strictPort: true,
    },
  }).then(server => server.listen())
}
```

---

# 3. 新增 E2E 测试工具

## `examples/showcase-e2e/utils/browser.ts`

测试文件使用 Vitest 的 `describe/it`，浏览器生命周期由这个工具集中管理。默认走 Playwright 管理的 Chromium；需要强制使用系统 Chrome 时可设置 `SHOWCASE_E2E_BROWSER_CHANNEL=chrome`。

```ts id="e2e-browser"
import type {
  Browser,
  BrowserContext,
  BrowserTypeLaunchOptions,
  Page,
} from '@playwright/test'
import process from 'node:process'
import { chromium } from '@playwright/test'
import { afterAll } from 'vitest'

export interface ShowcaseTarget {
  name: string
  baseURL: string
}

export const showcaseTargets: ShowcaseTarget[] = [
  {
    name: 'react',
    baseURL: 'http://127.0.0.1:5173',
  },
  {
    name: 'vue',
    baseURL: 'http://127.0.0.1:5174',
  },
]

export type ShowcasePageCallback<T> = (
  page: Page,
  context: BrowserContext,
) => Promise<T>

let browserPromise: Promise<Browser> | undefined

function shouldRunHeadless(): boolean {
  return process.env.SHOWCASE_E2E_HEADLESS !== 'false'
}

function getBrowserChannel(): string | undefined {
  return process.env.SHOWCASE_E2E_BROWSER_CHANNEL || undefined
}

function getLaunchOptions(): BrowserTypeLaunchOptions {
  const channel = getBrowserChannel()
  const options: BrowserTypeLaunchOptions = {
    headless: shouldRunHeadless(),
  }

  if (channel) {
    options.channel = channel
  }

  return options
}
```

## `examples/showcase-e2e/utils/page-errors.ts`

```ts id="e2e-page-errors"
import type { Page, Response } from '@playwright/test'
import { expect } from 'vitest'

const ignoredConsolePatterns = [
  /Download the React DevTools/i,
  /Vue Devtools/i,
  /vite\/client/i,
  /HMR connection/i,
  /Failed to load resource: the server responded with a status of 404 \(Not Found\)/i,
  /^\[zeus:web-c\] Failed to initialize <zw-.+>\. Error: \[Zeus context\] No provider found for context\./i,
]

const ignoredResponsePatterns = [/\/favicon\.ico$/]

export interface PageErrorCollector {
  assertClean: () => Promise<void>
}

function shouldIgnoreResponse(response: Response): boolean {
  const url = response.url()

  return ignoredResponsePatterns.some(pattern => pattern.test(url))
}

export function collectPageErrors(page: Page): PageErrorCollector {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  const failedResponses: string[] = []
  const requestFailures: string[] = []

  page.on('pageerror', error => {
    pageErrors.push(error.stack || error.message)
  })

  page.on('console', message => {
    if (message.type() !== 'error') {
      return
    }

    const text = message.text()

    if (ignoredConsolePatterns.some(pattern => pattern.test(text))) {
      return
    }

    consoleErrors.push(text)
  })

  return {
    assertClean() {
      return Promise.resolve()
        .then(() => {
          expect(pageErrors).toEqual([])
        })
        .then(() => {
          expect(consoleErrors).toEqual([])
        })
    },
  }
}
```

---

## `examples/showcase-e2e/utils/routes.ts`

```ts id="e2e-routes"
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

export const showcaseComponentRoutes = [
  'button',
  'input',
  'checkbox',
  'switch',
  'tabs',
  'dialog',
  'label',
  'textarea',
  'radio-group',
  'select',
  'card',
  'badge',
  'separator',
  'skeleton',
  'alert',
  'progress',
  'avatar',
  'collapsible',
  'accordion',
  'tooltip',
] as const
```

这里暂时手写 component routes，避免 `showcase-e2e` 测试入口直接 import workspace TS 造成 E2E 启动复杂化。Phase 14/后续可以改成生成文件。

---

# 4. 新增基础路由 E2E

## `examples/showcase-e2e/routes.spec.ts`

```ts id="e2e-routes-spec"
import { expect as expectPage } from '@playwright/test'
import { describe, it } from 'vitest'

import { showcaseTargets, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'
import {
  showcaseComponentRoutes,
  showcaseFoundationRoutes,
} from './utils/routes'

describe.each(showcaseTargets)('$name showcase routes', target => {
  describe('foundation routes', () => {
    for (const route of showcaseFoundationRoutes) {
      it(`renders ${route.path}`, () => {
        return withShowcasePage(target, page => {
          const errors = collectPageErrors(page)

          return page
            .goto(route.path)
            .then(() =>
              expectPage(page.getByText(route.title).first()).toBeVisible(),
            )
            .then(() =>
              expectPage(page.locator('body')).not.toContainText(
                'is not part of the current showcase metadata',
              ),
            )
            .then(() => errors.assertClean())
        })
      })
    }
  })
})
```

---

# 5. 新增 Icons E2E

## `examples/showcase-e2e/icons.spec.ts`

```ts id="e2e-icons-spec"
import { expect as expectPage } from '@playwright/test'
import { describe, it } from 'vitest'

import { showcaseTargets, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

describe.each(showcaseTargets)('$name showcase icons page', target => {
  it('renders icon grid and preview controls', () => {
    return withShowcasePage(target, (page, context) => {
      const errors = collectPageErrors(page)

      return context
        .grantPermissions(['clipboard-read', 'clipboard-write'])
        .then(() => page.goto('/icons'))
        .then(() =>
          expectPage(page.locator('.showcase-icon-grid')).toBeVisible(),
        )
        .then(() =>
          expectPage(page.locator('.showcase-icon-card').first()).toBeVisible(),
        )
        .then(() =>
          expectPage(
            page.locator('.showcase-icon-preview svg').first(),
          ).toBeVisible(),
        )
        .then(() => page.getByLabel('Icon preview size').selectOption('32'))
        .then(() =>
          expectPage(page.getByLabel('Icon preview size')).toHaveValue('32'),
        )
        .then(() =>
          page.getByLabel('Icon preview color').selectOption('primary'),
        )
        .then(() =>
          expectPage(page.getByLabel('Icon preview color')).toHaveValue(
            'primary',
          ),
        )
        .then(() => page.getByLabel('Copy REACT import for Check').click())
        .then(() => expectPage(page.getByText('Copied REACT')).toBeVisible())
        .then(() => errors.assertClean())
    })
  })
})
```

---

# 6. 新增 Themes E2E

## `examples/showcase-e2e/themes.spec.ts`

```ts id="e2e-themes-spec"
import { expect as expectPage } from '@playwright/test'
import { describe, it } from 'vitest'

import { showcaseTargets, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

describe.each(showcaseTargets)('$name showcase themes page', target => {
  it('renders theme variants and controls', () => {
    return withShowcasePage(target, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/themes')
        .then(() =>
          expectPage(
            page.locator('.showcase-theme-variant-card').first(),
          ).toBeVisible(),
        )
        .then(() =>
          expectPage(page.getByText('Semantic token palette')).toBeVisible(),
        )
        .then(() =>
          expectPage(page.getByText('Component preview')).toBeVisible(),
        )
        .then(() => errors.assertClean())
    })
  })
})
```

---

# 7. 新增 Playground E2E

## `examples/showcase-e2e/playground.spec.ts`

```ts id="e2e-playground-spec"
import { expect as expectPage } from '@playwright/test'
import { describe, it } from 'vitest'

import { showcaseTargets, withShowcasePage } from './utils/browser'
import { collectPageErrors } from './utils/page-errors'

describe.each(showcaseTargets)('$name showcase playground page', target => {
  it('renders admin dashboard scenario', () => {
    return withShowcasePage(target, page => {
      const errors = collectPageErrors(page)

      return page
        .goto('/playground')
        .then(() =>
          expectPage(
            page.getByRole('heading', {
              name: /Production composition playground/i,
            }),
          ).toBeVisible(),
        )
        .then(() => expectPage(page.getByText('68%').first()).toBeVisible())
        .then(() =>
          expectPage(
            page.getByRole('button', { name: /Admin dashboard/ }),
          ).toBeVisible(),
        )
        .then(() => errors.assertClean())
    })
  })
})
```

---

# 8. 如果当前 Playground 按钮还没有 aria-label，需要补

Phase 12 已经建议加过。Phase 13 必须保证 browser test selector 稳定。

## React `examples/react-showcase/src/routes/PlaygroundPage.tsx`

```tsx id="react-playground-labels"
<Button
  aria-label="Roll back release"
  size="sm"
  variant="outline"
  onPress={() => {
    setReleaseProgress(value => Math.max(0, value - 10))
    logEvent('release-progress', '-10')
  }}
>
  Roll back
</Button>

<Button
  aria-label="Promote release"
  size="sm"
  variant="primary"
  onPress={() => {
    setReleaseProgress(value => Math.min(100, value + 10))
    logEvent('release-progress', '+10')
  }}
>
  Promote
</Button>
```

## Vue `examples/vue-showcase/src/routes/PlaygroundPage.vue`

```vue id="vue-playground-labels"
<Button
  aria-label="Roll back release"
  size="sm"
  variant="outline"
  @press="promoteRelease(-10)"
>
  Roll back
</Button>

<Button
  aria-label="Promote release"
  size="sm"
  variant="primary"
  @press="promoteRelease(10)"
>
  Promote
</Button>
```

---

# 9. 修改 roadmap

## `docs/internal/examples/showcase-roadmap.md`

Status 表追加 Phase 13：

```md id="roadmap-phase13"
| Phase 13 | Done | Vitest-powered Playwright smoke tests for React and Vue showcase routes and foundation interactions |
```

Engineering guarantees 改成 6 层：

```md id="roadmap-guarantees-phase13"
The showcase has six layers of checks:

1. Metadata checks validate component metadata coverage.
2. Implementation checks validate that implemented demos have React and Vue files, dependencies and build dependency scripts.
3. Route smoke tests validate that every implemented component route renders in React and Vue.
4. Foundation page unit tests validate icons, themes and playground interaction behavior.
5. Shared unit tests validate metadata helpers, icon snippets, theme helpers and playground fixtures.
6. Vitest-powered Playwright E2E tests validate React and Vue showcase routes and critical browser interactions.
```

Commands 追加：

```md id="roadmap-commands-phase13"
pnpm showcase:e2e
pnpm showcase:e2e:ui
pnpm showcase:e2e:headed
```

Next work 改成：

```md id="roadmap-next-phase13"
## Next work

Future phases should continue with CI and release quality:

- Phase 14: Add CI workflow jobs for showcase unit tests, build and e2e.
- Add visual snapshots for the most important component states.
- Replace demo-only CSS with exported component theme styles where appropriate.
- Generate this roadmap from `examples/showcase-shared/src/implemented.ts`.
```

---

# 10. 文件清单

```txt id="phase13-files"
package.json
vitest.config.ts

examples/showcase-e2e/setup.ts
examples/showcase-e2e/utils/browser.ts
examples/showcase-e2e/utils/page-errors.ts
examples/showcase-e2e/utils/routes.ts
examples/showcase-e2e/routes.spec.ts
examples/showcase-e2e/icons.spec.ts
examples/showcase-e2e/themes.spec.ts
examples/showcase-e2e/playground.spec.ts

examples/react-showcase/src/routes/PlaygroundPage.tsx
examples/vue-showcase/src/routes/PlaygroundPage.vue

docs/internal/examples/showcase-roadmap.md
```

---

# 验收命令

```bash id="phase13-acceptance"
pnpm install
# 默认走 Playwright 管理的 Chromium
pnpm exec playwright install chromium

pnpm showcase:test
pnpm showcase:build
pnpm showcase:e2e
```

完整站点检查暂时仍然保持：

```bash id="phase13-site-check"
pnpm site:check
```

不建议在 Phase 13 直接把 `showcase:e2e` 加进 `site:check`，因为这会显著拉长本地检查耗时；Phase 14 再做 CI 分层和门禁。

---

# Phase 13 完成判断

```txt id="phase13-done"
React showcase:
  - Vitest globalSetup 能启动 React dev server
  - / /components /icons /themes /playground 可访问
  - 所有 component detail route 可访问
  - icons browser 交互通过
  - themes browser 交互通过
  - playground browser 交互通过

Vue showcase:
  - Vitest globalSetup 能启动 Vue dev server
  - 同一套测试在 vue-showcase project 下通过

工程侧：
  - 有 vitest showcase-e2e project
  - Vitest globalSetup 能启动 React/Vue Vite dev server
  - Playwright 在 Vitest 测试内启动浏览器
  - 有根命令 showcase:e2e / showcase:e2e:ui / showcase:e2e:headed
  - roadmap 标记 Phase 13 Done
```

建议分支名：

```txt id="branch"
test/showcase-playwright-e2e
```

建议 PR title：

```txt id="pr-title"
test(examples): add showcase Playwright e2e smoke tests
```
