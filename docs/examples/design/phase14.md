下面给 **Phase 14：Showcase CI Gates**。
基于当前 `mvp-examples@2dc60b`：Phase 13 已经落地为 **Vitest-powered Playwright E2E**，根脚本已有 `showcase:e2e:deps / showcase:e2e / showcase:e2e:ui / showcase:e2e:headed`，并且 `@playwright/test` 已经加入 devDependencies。 Vitest 里也已有独立 `showcase-e2e` project。
现在 CI 只有通用 `ci.yml` + reusable `test.yml`，其中 `ci.yml` 的 build job 仍然跑 `site:check`，但没有单独 showcase e2e 门禁。 `test.yml` 也只有 unit / windows unit / e2e-test / lint-and-test-dts，未单独拆出 showcase CI。

---

# Phase 14 目标

```txt
Phase 14 = CI workflow jobs for showcase

新增：
  - 独立 .github/workflows/showcase.yml
  - metadata / unit / build / e2e 四类 showcase CI job
  - E2E job 安装 Playwright Chromium
  - E2E 失败时上传 trace / screenshot artifacts
  - ci.yml 调用 showcase.yml，成为 PR / push 门禁
  - package.json 增加 showcase:ci:* 本地等价命令
  - roadmap 标记 Phase 14 Done

不做：
  - visual snapshots
  - 多浏览器矩阵
  - 发布 release gate 改造
```

---

# 1. 修改根 `package.json`

在 scripts 里追加这些命令，放在 `showcase:e2e:headed` 后面即可：

```json
{
  "showcase:ci:metadata": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation",
  "showcase:ci:unit": "pnpm showcase:test",
  "showcase:ci:build": "pnpm showcase:build",
  "showcase:ci:e2e": "pnpm showcase:e2e",
  "showcase:ci": "pnpm showcase:ci:metadata && pnpm showcase:ci:unit && pnpm showcase:ci:build && pnpm showcase:ci:e2e"
}
```

完整相关片段：

```json
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
    "showcase:e2e:headed": "pnpm showcase:e2e:deps && SHOWCASE_E2E_HEADLESS=false vitest --project showcase-e2e --run",
    "showcase:ci:metadata": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation",
    "showcase:ci:unit": "pnpm showcase:test",
    "showcase:ci:build": "pnpm showcase:build",
    "showcase:ci:e2e": "pnpm showcase:e2e",
    "showcase:ci": "pnpm showcase:ci:metadata && pnpm showcase:ci:unit && pnpm showcase:ci:build && pnpm showcase:ci:e2e"
  }
}
```

---

# 2. 新增 E2E 失败产物能力

Phase 13 当前 `withShowcasePage()` 只创建 context/page，失败时没有 trace 或 screenshot。
Phase 14 需要 CI 失败可定位，所以要补 artifacts。

## 替换 `examples/showcase-e2e/utils/browser.ts`

```ts
import type {
  Browser,
  BrowserContext,
  BrowserTypeLaunchOptions,
  Page,
} from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
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

function shouldRecordArtifacts(): boolean {
  return (
    process.env.CI === 'true' || process.env.SHOWCASE_E2E_ARTIFACTS === 'true'
  )
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

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch(getLaunchOptions())
  }

  return browserPromise
}

function toSafeFileName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '')
}

function createArtifactPrefix(target: ShowcaseTarget): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `${timestamp}-${toSafeFileName(target.name)}`
}

async function ensureArtifactDir(): Promise<string> {
  const artifactDir = resolve(process.cwd(), 'examples/showcase-e2e/.artifacts')
  await mkdir(artifactDir, {
    recursive: true,
  })

  return artifactDir
}

afterAll(() => {
  if (!browserPromise) {
    return Promise.resolve()
  }

  return browserPromise
    .then(browser => browser.close())
    .then(() => {
      browserPromise = undefined
    })
})

export function withShowcasePage<T>(
  target: ShowcaseTarget,
  callback: ShowcasePageCallback<T>,
): Promise<T> {
  return getBrowser().then(async browser => {
    const context = await browser.newContext({
      baseURL: target.baseURL,
      viewport: {
        width: 1280,
        height: 720,
      },
    })

    const shouldTrace = shouldRecordArtifacts()
    let traceStopped = false

    if (shouldTrace) {
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      })
    }

    const page = await context.newPage()

    try {
      const result = await callback(page, context)

      if (shouldTrace) {
        await context.tracing.stop()
        traceStopped = true
      }

      return result
    } catch (error) {
      if (shouldTrace) {
        const artifactDir = await ensureArtifactDir()
        const artifactPrefix = createArtifactPrefix(target)

        await page
          .screenshot({
            path: resolve(artifactDir, `${artifactPrefix}.png`),
            fullPage: true,
          })
          .catch(() => {})

        await context.tracing
          .stop({
            path: resolve(artifactDir, `${artifactPrefix}.trace.zip`),
          })
          .then(() => {
            traceStopped = true
          })
          .catch(() => {})
      }

      throw error
    } finally {
      if (shouldTrace && !traceStopped) {
        await context.tracing.stop().catch(() => {})
      }

      await context.close()
    }
  })
}
```

---

# 3. 修改 `.gitignore`

追加：

```gitignore
# Showcase E2E artifacts
examples/showcase-e2e/.artifacts
playwright-report
test-results
```

---

# 4. 新增 reusable workflow：`.github/workflows/showcase.yml`

```yaml
name: showcase

on:
  workflow_call:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  PUPPETEER_SKIP_DOWNLOAD: 'true'
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: 'true'
  CI: 'true'

jobs:
  metadata:
    name: metadata
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v5
        with:
          node-version-file: .node-version
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Validate showcase metadata and implementation
        run: pnpm showcase:ci:metadata

  unit:
    name: unit
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v5
        with:
          node-version-file: .node-version
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Run React and Vue showcase unit tests
        run: pnpm showcase:ci:unit

  build:
    name: build
    runs-on: ubuntu-latest
    timeout-minutes: 25

    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v5
        with:
          node-version-file: .node-version
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Build React and Vue showcase
        run: pnpm showcase:ci:build

  e2e:
    name: e2e
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs:
      - metadata
      - unit
      - build

    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v5
        with:
          node-version-file: .node-version
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Set Playwright cache path and version
        run: |
          echo "PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/playwright-bin" >> "$GITHUB_ENV"
          PLAYWRIGHT_VERSION="$(node -p "require('./node_modules/@playwright/test/package.json').version")"
          echo "PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION" >> "$GITHUB_ENV"

      - name: Cache Playwright Chromium
        uses: actions/cache@v4
        with:
          key: ${{ runner.os }}-playwright-bin-v1-${{ env.PLAYWRIGHT_VERSION }}
          path: ${{ env.PLAYWRIGHT_BROWSERS_PATH }}
          restore-keys: |
            ${{ runner.os }}-playwright-bin-v1-

      - name: Install Playwright Chromium
        run: pnpm exec playwright install --with-deps chromium

      - name: Run showcase browser E2E
        env:
          SHOWCASE_E2E_ARTIFACTS: 'true'
        run: pnpm showcase:ci:e2e

      - name: Upload showcase E2E artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: showcase-e2e-artifacts
          path: |
            examples/showcase-e2e/.artifacts
          if-no-files-found: ignore
          retention-days: 7
```

设计点：

```txt
metadata/unit/build 先跑，e2e needs 它们：
  - metadata 失败：说明元数据或实现检查就不闭环，不需要起浏览器
  - unit 失败：说明页面交互单测有问题，不需要浏览器
  - build 失败：说明 app 无法构建，不需要 e2e
  - e2e 只在前三者通过后跑，减少 CI 浪费
```

Playwright 下载缓存参考 Vite CI 的模式：

```txt
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true:
  pnpm install 阶段不隐式下载浏览器

PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/playwright-bin:
  浏览器二进制放到独立缓存目录

cache key = runner.os + playwright version:
  @playwright/test 升级时自动刷新缓存

pnpm exec playwright install --with-deps chromium:
  cache hit 时复用 Chromium 二进制，同时仍确认 Linux 系统依赖
```

---

# 5. 修改 `.github/workflows/ci.yml`

当前 `ci.yml` 只调用 `test.yml`，然后自己跑 build/site/release verify。
Phase 14 需要把 showcase workflow 纳入 PR / push 门禁。

替换为：

```yaml
name: CI

on:
  push:
    branches:
      - '**'
    tags-ignore:
      - 'v*'
  pull_request:
    branches:
      - main
      - minor

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    if: ${{ ! startsWith(github.event.head_commit.message, 'release:') && (github.event_name == 'push' || github.event.pull_request.head.repo.full_name != github.repository) }}
    uses: ./.github/workflows/test.yml

  showcase:
    if: ${{ ! startsWith(github.event.head_commit.message, 'release:') && (github.event_name == 'push' || github.event.pull_request.head.repo.full_name != github.repository) }}
    uses: ./.github/workflows/showcase.yml

  build:
    runs-on: ubuntu-latest
    env:
      PUPPETEER_SKIP_DOWNLOAD: 'true'
    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v5
        with:
          node-version-file: .node-version
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm check:zeus-baseline
      - run: pnpm check:workspace-overrides
      - run: pnpm check:zeus-imports
      - run: pnpm check
      - run: pnpm build
      - run: pnpm check:exports
      - run: pnpm check:build-output
      - run: pnpm site:check
      - run: pnpm release:verify --allow-zero
```

说明：这里 **没有把 `showcase:e2e` 加进 `site:check`**。
`site:check` 保持本地/通用检查含义，浏览器 E2E 由 CI 的 `showcase` job 单独负责。

---

# 6. 可选优化：减少 `test.yml` 与 showcase workflow 重叠

当前 `test.yml` 的 `e2e-test` job 会跑：

```yaml
- run: pnpm build
- run: pnpm site:check
- run: pnpm check:build-output
```

这会和 `ci.yml` 的 `build` job 有一些重复。Phase 14 可以先不动，避免影响主线；如果想更干净，后续可以把 `test.yml` 改成只负责 library unit / lint / dts，showcase 独立由 `showcase.yml` 负责。

---

# 7. 修改 roadmap

## `docs/internal/examples/showcase-roadmap.md`

在 Status 表追加：

```md
| Phase 14 | Done | CI workflow gates for showcase metadata, unit tests, builds and Vitest-powered Playwright E2E |
```

把 Engineering guarantees 改成 7 层：

```md
## Engineering guarantees

The showcase has seven layers of checks:

1. Metadata checks validate component metadata coverage.
2. Implementation checks validate that implemented demos have React and Vue files, dependencies and build dependency scripts.
3. Route smoke tests validate that every implemented component route renders in React and Vue.
4. Foundation page tests validate icons, themes and playground interaction behavior.
5. Shared unit tests validate metadata helpers, icon snippets, theme helpers and playground fixtures.
6. Vitest-powered Playwright E2E tests validate React and Vue showcase routes and critical browser interactions.
7. CI gates run showcase metadata, unit tests, builds and browser E2E as separate jobs.
```

Commands 更新为：

````md
## Commands

```bash
pnpm check:showcase-metadata
pnpm check:showcase-implementation
pnpm showcase:test
pnpm showcase:build
pnpm showcase:e2e
pnpm showcase:e2e:ui
pnpm showcase:e2e:headed
pnpm showcase:ci
pnpm site:check
pnpm site:build
```
````

````

替换 Phase 13 的提示：

```md
> `pnpm site:check` intentionally does not run `pnpm showcase:e2e`.
> Browser E2E is wired into CI through `.github/workflows/showcase.yml`.
````

Next work 改成：

```md
## Next work

Future phases should continue with visual and release quality:

- Add visual snapshots for the most important component states.
- Add optional multi-browser showcase E2E matrix.
- Replace demo-only CSS with exported component theme styles where appropriate.
- Generate this roadmap from `examples/showcase-shared/src/implemented.ts`.
```

---

# 8. 新增设计文档

## `docs/internal/examples/showcase-phase-14-ci.md`

````md
# Phase 14 - Showcase CI Gates

Phase 14 wires the showcase quality checks into GitHub Actions.

## Goals

- Run showcase metadata checks in CI.
- Run React and Vue showcase unit tests in CI.
- Run React and Vue showcase builds in CI.
- Run Vitest-powered Playwright E2E in CI.
- Upload browser E2E artifacts on failure.
- Keep browser E2E outside `site:check` to avoid slowing local checks.

## Workflow

The dedicated workflow lives at:

```txt
.github/workflows/showcase.yml
```
````

It exposes:

```yaml
on:
  workflow_call:
  workflow_dispatch:
```

`ci.yml` calls it as a reusable workflow, and developers can run it manually from GitHub Actions.

## Jobs

### metadata

Runs:

```bash
pnpm showcase:ci:metadata
```

This validates:

- component coverage
- showcase metadata
- showcase implementation

### unit

Runs:

```bash
pnpm showcase:ci:unit
```

This validates React and Vue showcase unit tests.

### build

Runs:

```bash
pnpm showcase:ci:build
```

This validates that React and Vue showcase apps can build.

### e2e

Runs after metadata, unit and build.

```bash
pnpm exec playwright install --with-deps chromium
pnpm showcase:ci:e2e
```

On failure it uploads:

```txt
examples/showcase-e2e/.artifacts
```

## Local commands

```bash
pnpm showcase:ci:metadata
pnpm showcase:ci:unit
pnpm showcase:ci:build
pnpm showcase:ci:e2e
pnpm showcase:ci
```

## Why `site:check` does not run browser E2E

`site:check` remains a local-friendly metadata/docs/unit/build check.

Browser E2E is slower because it installs and launches Chromium. It is gated in CI through the dedicated `showcase.yml` workflow instead.

````

---

# 9. 验收命令

本地：

```bash
pnpm install
pnpm exec playwright install chromium

pnpm showcase:ci:metadata
pnpm showcase:ci:unit
pnpm showcase:ci:build
pnpm showcase:ci:e2e
pnpm showcase:ci
````

CI 验收：

```txt
CI should show these checks:

- test / unit-test
- test / unit-test-windows
- test / e2e-test
- test / lint-and-test-dts
- showcase / metadata
- showcase / unit
- showcase / build
- showcase / e2e
- build
```

---

# Phase 14 完成判断

```txt
代码层：
  - package.json 有 showcase:ci:* scripts
  - .github/workflows/showcase.yml 存在
  - .github/workflows/ci.yml 调用 showcase.yml
  - E2E 失败可上传 trace/screenshot artifacts
  - .gitignore 忽略 showcase e2e artifacts

文档层：
  - roadmap Phase 14 Done
  - Engineering guarantees 更新为 7 层
  - 新增 showcase-phase-14-ci.md

执行层：
  - pnpm showcase:ci:metadata 通过
  - pnpm showcase:ci:unit 通过
  - pnpm showcase:ci:build 通过
  - pnpm showcase:ci:e2e 通过
  - PR / push 上 showcase workflow 可作为独立门禁
```

建议分支名：

```txt
ci/showcase-quality-gates
```

建议 PR title：

```txt
ci(examples): add showcase quality gates
```
