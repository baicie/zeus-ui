下面给 **Phase 8：Showcase 工程化收尾与 CI 稳定化** 的详细设计与完整代码。

Phase 8 不再新增组件能力页。它解决 Phase 0-7 累积下来的工程化问题：

```txt id="3ih7tk"
1. build:deps 过长，React/Vue showcase package.json 很难维护。
2. 已实现 demo 的组件清单分散在 React/Vue registry 里，缺少统一事实源。
3. 缺少“所有已实现组件路由都能打开”的 smoke test。
4. site:check 还没有校验 showcase 实现清单和 demo 文件是否一致。
5. 缺少 showcase roadmap 文档，Phase 0-7 完成状态不清晰。
```

当前根脚本已经有 `examples:check / examples:build / showcase:build / showcase:test / site:check / site:build`。
但 React 和 Vue showcase 的 `build:deps` 已经非常长，分别硬编码了二十多个 `--filter`。
同时 React/Vue demo registry 已经合并了 P0、Forms、Visual、Disclosure 四批 demo。

---

# Phase 8 目标

```txt id="id1krt"
目标：
1. 在 showcase-shared 中新增已实现组件统一 manifest。
2. 抽 scripts/examples/build-showcase-deps.ts，替换 React/Vue showcase 里超长 build:deps。
3. 新增 scripts/checks/check-showcase-implementation.ts，校验 manifest、demo 文件、package deps、build:deps 是否一致。
4. React/Vue 新增 route-smoke 测试，遍历所有已实现组件路由。
5. site:check 接入 check:showcase-implementation。
6. 新增 docs/internal/examples/showcase-roadmap.md，记录 Phase 0-8 状态。
```

不做：

```txt id="ch237s"
不新增新组件 demo 页。
不引入 Playwright。
不改 primitive 组件源码。
不改 registry metadata 结构。
不改 release 逻辑。
```

---

# 文件变更清单

```txt id="n0th76"
examples/showcase-shared/src/implemented.ts
examples/showcase-shared/src/index.ts

scripts/examples/build-showcase-deps.ts
scripts/checks/check-showcase-implementation.ts

examples/react-showcase/package.json
examples/vue-showcase/package.json
package.json

examples/react-showcase/src/__tests__/route-smoke.spec.tsx
examples/vue-showcase/src/__tests__/route-smoke.spec.ts

docs/internal/examples/showcase-roadmap.md
```

---

# 1. Shared manifest

## 1.1 新增 `examples/showcase-shared/src/implemented.ts`

```ts id="opxd3r"
import { showcaseComponents } from './components'
import type { ShowcaseComponent } from './types'

export const showcaseDemoBatches = {
  p0: ['button', 'input', 'checkbox', 'switch', 'tabs', 'dialog'],
  forms: ['label', 'textarea', 'radio-group', 'select'],
  visual: [
    'card',
    'badge',
    'separator',
    'skeleton',
    'alert',
    'progress',
    'avatar',
  ],
  disclosure: ['collapsible', 'accordion', 'tooltip'],
} as const

export const implementedShowcaseComponentNames = [
  ...showcaseDemoBatches.p0,
  ...showcaseDemoBatches.forms,
  ...showcaseDemoBatches.visual,
  ...showcaseDemoBatches.disclosure,
] as const

export type ShowcaseDemoBatchName = keyof typeof showcaseDemoBatches

export type ImplementedShowcaseComponentName =
  (typeof implementedShowcaseComponentNames)[number]

export function isImplementedShowcaseComponent(
  name: string,
): name is ImplementedShowcaseComponentName {
  return implementedShowcaseComponentNames.includes(
    name as ImplementedShowcaseComponentName,
  )
}

export function getImplementedShowcaseComponents(
  components: readonly ShowcaseComponent[] = showcaseComponents,
): ShowcaseComponent[] {
  const names = new Set<string>(implementedShowcaseComponentNames)

  return components.filter(component => names.has(component.name))
}

export function getImplementedShowcasePackageNames(
  components: readonly ShowcaseComponent[] = showcaseComponents,
): string[] {
  return Array.from(
    new Set(
      getImplementedShowcaseComponents(components).map(
        component => component.packageName,
      ),
    ),
  ).sort()
}

export function getShowcaseDemoBatchName(
  componentName: string,
): ShowcaseDemoBatchName | undefined {
  for (const [batch, names] of Object.entries(showcaseDemoBatches)) {
    if ((names as readonly string[]).includes(componentName)) {
      return batch as ShowcaseDemoBatchName
    }
  }

  return undefined
}
```

---

## 1.2 修改 `examples/showcase-shared/src/index.ts`

完整替换为：

```ts id="nsiidm"
export * from './components'
export * from './demo'
export * from './icons'
export * from './implemented'
export * from './routes'
export * from './themes'
export * from './types'
export * from './validate'
```

---

# 2. 抽 build:deps 脚本

## 2.1 新增 `scripts/examples/build-showcase-deps.ts`

```ts id="o9lafp"
import { execa } from 'execa'
import pc from 'picocolors'

import { getImplementedShowcasePackageNames } from '../../examples/showcase-shared/src/implemented'

interface Options {
  dryRun: boolean
  printOnly: boolean
  includeIcons: boolean
}

function readOptions(argv: string[]): Options {
  return {
    dryRun: argv.includes('--dry-run'),
    printOnly: argv.includes('--print'),
    includeIcons: !argv.includes('--no-icons'),
  }
}

function createPnpmArgs(options: Options): string[] {
  const packages = getImplementedShowcasePackageNames()

  const packageNames = options.includeIcons
    ? ['@zeus-web/icons', ...packages]
    : packages

  const filters = packageNames.flatMap(packageName => ['--filter', packageName])

  return ['-w', ...filters, 'build']
}

async function main(): Promise<void> {
  const options = readOptions(process.argv.slice(2))
  const args = createPnpmArgs(options)
  const command = `pnpm ${args.join(' ')}`

  if (options.printOnly || options.dryRun) {
    console.log(command)
  }

  if (options.dryRun || options.printOnly) {
    return
  }

  console.log(pc.cyan(`Building showcase dependencies with: ${command}`))

  await execa('pnpm', args, {
    stdio: 'inherit',
  })
}

main().catch(error => {
  console.error(pc.red('Failed to build showcase dependencies.'))
  console.error(error)
  process.exit(1)
})
```

说明：

```txt id="ezu8jp"
默认 includeIcons=true，因为 React showcase 里 Button/Input 等 demo 已经使用 icons。
Vue showcase 多构建 icons 不影响正确性，换来两边 build:deps 脚本完全一致。
```

---

# 3. 新增实现一致性检查

## 3.1 新增 `scripts/checks/check-showcase-implementation.ts`

```ts id="b5g3oz"
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

import {
  getImplementedShowcasePackageNames,
  getShowcaseDemoBatchName,
  implementedShowcaseComponentNames,
  showcaseDemoBatches,
} from '../../examples/showcase-shared/src/implemented'

const root = process.cwd()

const expectedBuildDepsScript =
  'pnpm -w exec tsx scripts/examples/build-showcase-deps.ts'

interface PackageJson {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function readPackageJson(path: string): PackageJson {
  const absolutePath = resolve(root, path)
  return JSON.parse(readFileSync(absolutePath, 'utf-8')) as PackageJson
}

function toPascalCase(name: string): string {
  return name
    .split('-')
    .map(part => {
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join('')
}

function checkNoDuplicateNames(): string[] {
  const seen = new Set<string>()
  const errors: string[] = []

  for (const name of implementedShowcaseComponentNames) {
    if (seen.has(name)) {
      errors.push(`Duplicate implemented showcase component name: ${name}`)
    }

    seen.add(name)
  }

  return errors
}

function checkBatchCoverage(): string[] {
  const errors: string[] = []

  for (const name of implementedShowcaseComponentNames) {
    if (!getShowcaseDemoBatchName(name)) {
      errors.push(`Missing demo batch for implemented component: ${name}`)
    }
  }

  for (const [batchName, names] of Object.entries(showcaseDemoBatches)) {
    if (names.length === 0) {
      errors.push(`Showcase demo batch "${batchName}" must not be empty.`)
    }
  }

  return errors
}

function checkDemoFiles(): string[] {
  const errors: string[] = []

  for (const name of implementedShowcaseComponentNames) {
    const batchName = getShowcaseDemoBatchName(name)

    if (!batchName) {
      continue
    }

    const componentFileName = `${toPascalCase(name)}DemoPage`
    const reactPath = resolve(
      root,
      `examples/react-showcase/src/demos/${batchName}/${componentFileName}.tsx`,
    )
    const vuePath = resolve(
      root,
      `examples/vue-showcase/src/demos/${batchName}/${componentFileName}.vue`,
    )

    if (!existsSync(reactPath)) {
      errors.push(
        `Missing React showcase demo for "${name}": examples/react-showcase/src/demos/${batchName}/${componentFileName}.tsx`,
      )
    }

    if (!existsSync(vuePath)) {
      errors.push(
        `Missing Vue showcase demo for "${name}": examples/vue-showcase/src/demos/${batchName}/${componentFileName}.vue`,
      )
    }
  }

  return errors
}

function checkPackageDeps(): string[] {
  const errors: string[] = []
  const packageNames = getImplementedShowcasePackageNames()

  const reactPackage = readPackageJson('examples/react-showcase/package.json')
  const vuePackage = readPackageJson('examples/vue-showcase/package.json')

  for (const packageName of packageNames) {
    if (!reactPackage.dependencies?.[packageName]) {
      errors.push(
        `examples/react-showcase/package.json is missing dependency "${packageName}".`,
      )
    }

    if (!vuePackage.dependencies?.[packageName]) {
      errors.push(
        `examples/vue-showcase/package.json is missing dependency "${packageName}".`,
      )
    }
  }

  if (!reactPackage.dependencies?.['@zeus-web/icons']) {
    errors.push(
      'examples/react-showcase/package.json is missing dependency "@zeus-web/icons".',
    )
  }

  return errors
}

function checkBuildDepsScripts(): string[] {
  const errors: string[] = []

  const reactPackage = readPackageJson('examples/react-showcase/package.json')
  const vuePackage = readPackageJson('examples/vue-showcase/package.json')

  if (reactPackage.scripts?.['build:deps'] !== expectedBuildDepsScript) {
    errors.push(
      `React showcase build:deps must be "${expectedBuildDepsScript}".`,
    )
  }

  if (vuePackage.scripts?.['build:deps'] !== expectedBuildDepsScript) {
    errors.push(`Vue showcase build:deps must be "${expectedBuildDepsScript}".`)
  }

  return errors
}

function checkRootScripts(): string[] {
  const errors: string[] = []
  const rootPackage = readPackageJson('package.json')

  if (
    rootPackage.scripts?.['check:showcase-implementation'] !==
    'tsx scripts/checks/check-showcase-implementation.ts'
  ) {
    errors.push(
      'Root package.json must define "check:showcase-implementation".',
    )
  }

  const siteCheck = rootPackage.scripts?.['site:check'] ?? ''

  if (!siteCheck.includes('pnpm check:showcase-implementation')) {
    errors.push(
      'Root package.json site:check must include "pnpm check:showcase-implementation".',
    )
  }

  return errors
}

function main(): void {
  const errors = [
    ...checkNoDuplicateNames(),
    ...checkBatchCoverage(),
    ...checkDemoFiles(),
    ...checkPackageDeps(),
    ...checkBuildDepsScripts(),
    ...checkRootScripts(),
  ]

  if (errors.length > 0) {
    console.error(pc.red('Showcase implementation check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Showcase implementation check passed.'))
}

main()
```

---

# 4. package.json 修改

## 4.1 修改根 `package.json`

只需要改 scripts 片段。

当前根脚本已有 `site:check`、`showcase:build`、`showcase:test` 等。

将相关片段调整为：

```json id="z9jny5"
{
  "scripts": {
    "examples:contract": "tsx scripts/checks/check-examples.ts",
    "examples:check": "pnpm examples:contract && pnpm -F \"@zeus-web/example-*\" check",
    "examples:build": "pnpm -F \"@zeus-web/example-*\" build",

    "showcase:react": "pnpm --filter @zeus-web/example-react-showcase dev",
    "showcase:vue": "pnpm --filter @zeus-web/example-vue-showcase dev",
    "showcase:build": "pnpm --filter @zeus-web/example-react-showcase build && pnpm --filter @zeus-web/example-vue-showcase build",
    "showcase:test": "pnpm --filter @zeus-web/example-react-showcase test && pnpm --filter @zeus-web/example-vue-showcase test",

    "check:component-coverage": "tsx scripts/checks/check-component-coverage.ts",
    "check:showcase-metadata": "tsx scripts/checks/check-showcase-metadata.ts",
    "check:showcase-implementation": "tsx scripts/checks/check-showcase-implementation.ts",

    "site:check": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm docs:check && pnpm docs:build && pnpm examples:check && pnpm showcase:test",
    "site:build": "pnpm docs:build && pnpm examples:build"
  }
}
```

---

## 4.2 替换 `examples/react-showcase/package.json`

完整文件：

```json id="qgvj3d"
{
  "name": "@zeus-web/example-react-showcase",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build:deps": "pnpm -w exec tsx scripts/examples/build-showcase-deps.ts",
    "dev": "pnpm build:deps && vite --host 0.0.0.0",
    "build": "pnpm build:deps && vite build",
    "check": "pnpm build:deps && tsc -p tsconfig.json --noEmit",
    "test": "pnpm build:deps && vitest --run"
  },
  "dependencies": {
    "@tanstack/react-router": "^1.170.15",
    "@zeus-web/accordion": "workspace:*",
    "@zeus-web/alert": "workspace:*",
    "@zeus-web/avatar": "workspace:*",
    "@zeus-web/badge": "workspace:*",
    "@zeus-web/button": "workspace:*",
    "@zeus-web/card": "workspace:*",
    "@zeus-web/checkbox": "workspace:*",
    "@zeus-web/collapsible": "workspace:*",
    "@zeus-web/dialog": "workspace:*",
    "@zeus-web/example-showcase-shared": "workspace:*",
    "@zeus-web/icons": "workspace:*",
    "@zeus-web/input": "workspace:*",
    "@zeus-web/label": "workspace:*",
    "@zeus-web/progress": "workspace:*",
    "@zeus-web/radio-group": "workspace:*",
    "@zeus-web/select": "workspace:*",
    "@zeus-web/separator": "workspace:*",
    "@zeus-web/skeleton": "workspace:*",
    "@zeus-web/switch": "workspace:*",
    "@zeus-web/tabs": "workspace:*",
    "@zeus-web/textarea": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "@zeus-web/tooltip": "workspace:*",
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.2",
    "jsdom": "^29.1.1",
    "typescript": "^6.0.3",
    "vite": "^8.0.16",
    "vitest": "^4.1.8"
  }
}
```

---

## 4.3 替换 `examples/vue-showcase/package.json`

完整文件：

```json id="o7ntip"
{
  "name": "@zeus-web/example-vue-showcase",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build:deps": "pnpm -w exec tsx scripts/examples/build-showcase-deps.ts",
    "dev": "pnpm build:deps && vite --host 0.0.0.0 --port 5174",
    "build": "pnpm build:deps && vite build",
    "check": "pnpm build:deps && vue-tsc -p tsconfig.json --noEmit",
    "test": "pnpm build:deps && vitest --run"
  },
  "dependencies": {
    "@zeus-web/accordion": "workspace:*",
    "@zeus-web/alert": "workspace:*",
    "@zeus-web/avatar": "workspace:*",
    "@zeus-web/badge": "workspace:*",
    "@zeus-web/button": "workspace:*",
    "@zeus-web/card": "workspace:*",
    "@zeus-web/checkbox": "workspace:*",
    "@zeus-web/collapsible": "workspace:*",
    "@zeus-web/dialog": "workspace:*",
    "@zeus-web/example-showcase-shared": "workspace:*",
    "@zeus-web/input": "workspace:*",
    "@zeus-web/label": "workspace:*",
    "@zeus-web/progress": "workspace:*",
    "@zeus-web/radio-group": "workspace:*",
    "@zeus-web/select": "workspace:*",
    "@zeus-web/separator": "workspace:*",
    "@zeus-web/skeleton": "workspace:*",
    "@zeus-web/switch": "workspace:*",
    "@zeus-web/tabs": "workspace:*",
    "@zeus-web/textarea": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "@zeus-web/tooltip": "workspace:*",
    "vue": "^3.5.35",
    "vue-router": "^5.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^6.0.7",
    "@vue/test-utils": "^2.4.11",
    "jsdom": "^29.1.1",
    "typescript": "^6.0.3",
    "vite": "^8.0.16",
    "vitest": "^4.1.8",
    "vue-tsc": "^3.3.4"
  }
}
```

---

# 5. Route smoke tests

## 5.1 新增 `examples/react-showcase/src/__tests__/route-smoke.spec.tsx`

```tsx id="g2f6j7"
import { RouterProvider } from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { implementedShowcaseComponentNames } from '@zeus-web/example-showcase-shared'

import { createShowcaseRouter } from '../router'

function renderRoute(initialPath: string) {
  const router = createShowcaseRouter({ initialPath })

  return render(<RouterProvider router={router} />)
}

describe('react showcase implemented route smoke', () => {
  afterEach(() => {
    cleanup()
  })

  it.each(implementedShowcaseComponentNames)(
    'renders implemented component route: %s',
    async componentName => {
      renderRoute(`/components/${componentName}`)

      expect(
        await screen.findByRole('heading', {
          name: /capability page/i,
        }),
      ).toBeInTheDocument()
    },
  )
})
```

---

## 5.2 新增 `examples/vue-showcase/src/__tests__/route-smoke.spec.ts`

```ts id="e0eo3j"
import { flushPromises, mount } from '@vue/test-utils'
import { implementedShowcaseComponentNames } from '@zeus-web/example-showcase-shared'

import App from '../App.vue'
import { createShowcaseRouter } from '../router'

async function renderRoute(initialPath: string) {
  const router = createShowcaseRouter({ initialPath })

  await router.isReady()

  const wrapper = mount(App, {
    global: {
      plugins: [router],
    },
  })

  await flushPromises()

  return wrapper
}

describe('vue showcase implemented route smoke', () => {
  it.each(implementedShowcaseComponentNames)(
    'renders implemented component route: %s',
    async componentName => {
      const wrapper = await renderRoute(`/components/${componentName}`)

      expect(wrapper.text()).toContain('capability page')
    },
  )
})
```

---

# 6. Roadmap 文档

## 6.1 新增 `docs/internal/examples/showcase-roadmap.md`

````md id="mtimcy"
# Zeus Web Showcase Roadmap

This document tracks the implementation status of the React and Vue showcase applications.

## Status

| Phase   | Status | Scope                                                                                |
| ------- | ------ | ------------------------------------------------------------------------------------ |
| Phase 0 | Done   | Shared metadata, component inventory and validation baseline                         |
| Phase 1 | Done   | React showcase router shell                                                          |
| Phase 2 | Done   | Vue showcase router shell                                                            |
| Phase 3 | Done   | Shared page templates and scaffold components                                        |
| Phase 4 | Done   | P0 component pages: button, input, checkbox, switch, tabs, dialog                    |
| Phase 5 | Done   | Form component pages: label, textarea, radio-group, select                           |
| Phase 6 | Done   | Visual and feedback pages: card, badge, separator, skeleton, alert, progress, avatar |
| Phase 7 | Done   | Disclosure and overlay pages: collapsible, accordion, tooltip                        |
| Phase 8 | Done   | CI hardening, build dependency orchestration, route smoke tests and roadmap          |

## Implemented component pages

### P0

- button
- input
- checkbox
- switch
- tabs
- dialog

### Forms

- label
- textarea
- radio-group
- select

### Visual and feedback

- card
- badge
- separator
- skeleton
- alert
- progress
- avatar

### Disclosure and overlay

- collapsible
- accordion
- tooltip

## Engineering guarantees

The showcase has three layers of checks:

1. Metadata checks validate component metadata coverage.
2. Implementation checks validate that implemented demos have React and Vue files, dependencies and build dependency scripts.
3. Route smoke tests validate that every implemented component route renders in React and Vue.

## Commands

```bash
pnpm check:showcase-metadata
pnpm check:showcase-implementation
pnpm showcase:test
pnpm showcase:build
pnpm site:check
pnpm site:build
```
````

## Next work

Future phases should focus on quality rather than expanding the number of pages:

- Add Playwright smoke tests for React and Vue showcase.
- Add visual snapshots for the most important component states.
- Replace demo-only CSS with exported component theme styles where appropriate.
- Reduce route smoke runtime if it becomes slow.
- Generate this roadmap from `examples/showcase-shared/src/implemented.ts`.

````

---

# 7. 验收命令

```bash id="o5favc"
pnpm check:showcase-implementation
pnpm --filter @zeus-web/example-showcase-shared check
pnpm --filter @zeus-web/example-react-showcase check
pnpm --filter @zeus-web/example-react-showcase test
pnpm --filter @zeus-web/example-react-showcase build
pnpm --filter @zeus-web/example-vue-showcase check
pnpm --filter @zeus-web/example-vue-showcase test
pnpm --filter @zeus-web/example-vue-showcase build
pnpm showcase:test
pnpm showcase:build
pnpm examples:check
pnpm examples:build
pnpm site:check
pnpm site:build
````

完整验收：

```bash id="3tk68a"
pnpm format-check
pnpm lint
pnpm test
pnpm check
pnpm build
pnpm check:component-coverage
pnpm check:showcase-metadata
pnpm check:showcase-implementation
pnpm examples:check
pnpm examples:build
pnpm showcase:test
pnpm showcase:build
pnpm site:check
pnpm site:build
pnpm release:verify --allow-zero
```

---

# Phase 8 完成标准

```txt id="f4oud1"
Phase 8 done 当且仅当：

1. implementedShowcaseComponentNames 成为已实现 demo 的唯一事实源。
2. React/Vue showcase build:deps 不再硬编码超长 filter 列表。
3. build-showcase-deps.ts 能构建全部已实现组件依赖。
4. check-showcase-implementation.ts 能校验 demo 文件、deps、build:deps 和 root site:check。
5. React route smoke 能遍历所有已实现组件路由。
6. Vue route smoke 能遍历所有已实现组件路由。
7. site:check 包含 check:showcase-implementation。
8. showcase-roadmap.md 记录 Phase 0-8 状态。
9. showcase:test 通过。
10. showcase:build 通过。
11. site:check 通过。
```

---

# 建议提交

```txt id="dgvfdx"
chore(examples): harden showcase implementation checks
```

---

# Phase 9 建议

Phase 9 建议做 **E2E 与视觉质量兜底**：

```txt id="4g18ki"
1. 引入 Playwright。
2. React showcase route smoke e2e。
3. Vue showcase route smoke e2e。
4. 截图 smoke：button/input/dialog/tabs/card/tooltip。
5. 验证 sidebar 搜索、组件详情页、主题页、icons 页。
6. CI 分离 examples:check / showcase:test / showcase:e2e，避免 site:check 过慢。
```

Phase 8 完成后，showcase 从“能跑”升级为“有实现清单、有依赖构建、有一致性检查、有路由烟测”的稳定工程模块。
