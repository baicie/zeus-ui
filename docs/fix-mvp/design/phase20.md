下面给 **Phase 20：React/Vue Showcase 切换到 registry-installed styled usage** 的详细设计与完整代码。

Phase 20 的核心目标是：**React/Vue showcase 不再直接把 `@zeus-web/button/react`、`@zeus-web/input/react` 当作默认展示入口，而是使用 registry 同步出来的本地组件：**

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
```

```vue
import Button from '@/components/ui/button.vue' import Input from
'@/components/ui/input.vue'
```

当前 registry 只覆盖 `cn / globals / button / input`，其中 button/input 都有 React 和 Vue 模板，并且依赖 `cn/globals`。 所以 Phase 20 只切换 **button/input 两个 demo**，不要强行切其它组件。

React/Vue showcase 已经有 `@/* -> src/*` alias，适合直接使用 registry 模板里的 `@/lib/cn`。 button/input 依赖在 React/Vue showcase 里也已经存在。

---

# Phase 20 目标

```txt
Phase 20 = Showcase uses registry-installed styled components

新增 / 改造：
  - scripts/examples/sync-showcase-registry.ts
  - check:showcase-registry
  - React showcase 生成 src/lib/cn.ts
  - React showcase 生成 src/styles/zeus.css
  - React showcase 生成 src/components/ui/button.tsx
  - React showcase 生成 src/components/ui/input.tsx
  - Vue showcase 生成 src/lib/cn.ts
  - Vue showcase 生成 src/styles/zeus.css
  - Vue showcase 生成 src/components/ui/button.vue
  - Vue showcase 生成 src/components/ui/input.vue
  - Button/Input demo 改用本地 registry-installed 组件
  - roadmap Phase 20 Done

不做：
  - 不切其它组件
  - 不做 native showcase
  - 不做 update/diff merge
  - 不做远程 registry
```

---

# 1. 修改根 `package.json`

新增 3 个脚本：

```json
{
  "showcase:registry:sync": "tsx scripts/examples/sync-showcase-registry.ts",
  "showcase:registry:check": "tsx scripts/examples/sync-showcase-registry.ts --check",
  "check:showcase-registry": "tsx scripts/checks/check-showcase-registry.ts"
}
```

并修改：

```json
{
  "showcase:ci:metadata": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:showcase-registry && pnpm showcase:registry:check",
  "site:check": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:product-layers && pnpm check:ui-package && pnpm check:registry && pnpm check:cli-init && pnpm check:cli-add && pnpm check:showcase-registry && pnpm showcase:registry:check && pnpm docs:check && pnpm docs:build && pnpm examples:check && pnpm showcase:test"
}
```

完整相关片段：

```json
{
  "scripts": {
    "showcase:registry:sync": "tsx scripts/examples/sync-showcase-registry.ts",
    "showcase:registry:check": "tsx scripts/examples/sync-showcase-registry.ts --check",
    "check:showcase-registry": "tsx scripts/checks/check-showcase-registry.ts",
    "showcase:ci:metadata": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:showcase-registry && pnpm showcase:registry:check",
    "site:check": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:product-layers && pnpm check:ui-package && pnpm check:registry && pnpm check:cli-init && pnpm check:cli-add && pnpm check:showcase-registry && pnpm showcase:registry:check && pnpm docs:check && pnpm docs:build && pnpm examples:check && pnpm showcase:test"
  }
}
```

---

# 2. 新增 `scripts/examples/sync-showcase-registry.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'

import pc from 'picocolors'

type RegistryFramework = 'react' | 'vue' | 'native' | 'shared'
type RegistryItemType = 'component' | 'utility' | 'style'

interface RegistryFile {
  framework: RegistryFramework
  source: string
  target: string
}

interface RegistryItem {
  name: string
  type: RegistryItemType
  description: string
  frameworks: RegistryFramework[]
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFile[]
}

interface RegistryManifest {
  schemaVersion: 1
  name: string
  version: string
  items: RegistryItem[]
}

interface ShowcaseTarget {
  name: 'react' | 'vue'
  framework: 'react' | 'vue'
  root: string
}

interface PlannedFile {
  source: string
  target: string
  content: string
}

const root = process.cwd()

const registryPath = resolve(root, 'packages/registry/registry.json')
const registryTemplatesRoot = resolve(root, 'packages/registry')

const showcaseTargets: ShowcaseTarget[] = [
  {
    name: 'react',
    framework: 'react',
    root: 'examples/react-showcase',
  },
  {
    name: 'vue',
    framework: 'vue',
    root: 'examples/vue-showcase',
  },
]

const syncedComponents = ['button', 'input']

function hasArg(name: string): boolean {
  return process.argv.includes(name)
}

function toProjectPath(path: string): string {
  return relative(root, path).replace(/\\/g, '/')
}

function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}

function readRegistry(): RegistryManifest {
  return JSON.parse(readText(registryPath)) as RegistryManifest
}

function findRegistryItem(
  registry: RegistryManifest,
  name: string,
): RegistryItem {
  const item = registry.items.find(entry => entry.name === name)

  if (!item) {
    const available = registry.items.map(entry => entry.name).join(', ')
    throw new Error(`Unknown registry item "${name}". Available: ${available}`)
  }

  return item
}

function collectRegistryItems(params: {
  registry: RegistryManifest
  name: string
  collected: Map<string, RegistryItem>
  visiting: string[]
}) {
  const { registry, name, collected, visiting } = params

  if (collected.has(name)) return

  if (visiting.includes(name)) {
    throw new Error(
      `Circular registry dependency: ${[...visiting, name].join(' -> ')}`,
    )
  }

  const item = findRegistryItem(registry, name)

  for (const dependency of item.registryDependencies) {
    collectRegistryItems({
      registry,
      name: dependency,
      collected,
      visiting: [...visiting, name],
    })
  }

  collected.set(item.name, item)
}

function getSyncedRegistryItems(registry: RegistryManifest): RegistryItem[] {
  const collected = new Map<string, RegistryItem>()

  for (const component of syncedComponents) {
    collectRegistryItems({
      registry,
      name: component,
      collected,
      visiting: [],
    })
  }

  return Array.from(collected.values())
}

function shouldIncludeFile(
  target: ShowcaseTarget,
  file: RegistryFile,
): boolean {
  return file.framework === 'shared' || file.framework === target.framework
}

function createShowcaseConfig(target: ShowcaseTarget): string {
  return `${JSON.stringify(
    {
      $schema: 'https://zeus-web.dev/schema/zeus-ui.json',
      framework: target.framework,
      style: 'default',
      typescript: true,
      srcDir: 'src',
      theme: {
        radius: 'md',
        motion: 'normal',
        darkMode: 'class',
      },
      tailwind: {
        css: 'src/styles/zeus.css',
        cssVariables: true,
      },
      aliases: {
        components: '@/components',
        ui: '@/components/ui',
        lib: '@/lib',
        styles: '@/styles',
      },
    },
    null,
    2,
  )}\n`
}

function createShowcaseLock(
  target: ShowcaseTarget,
  items: RegistryItem[],
): string {
  const components: Record<
    string,
    {
      files: string[]
      dependencies: string[]
      registryDependencies: string[]
      updatedAt: string
    }
  > = {}

  for (const item of items) {
    const files = item.files
      .filter(file => shouldIncludeFile(target, file))
      .map(file => `src/${file.target}`)

    if (files.length === 0) continue

    components[item.name] = {
      files,
      dependencies: item.dependencies,
      registryDependencies: item.registryDependencies,
      updatedAt: 'showcase-registry-sync',
    }
  }

  return `${JSON.stringify(
    {
      version: 1,
      components,
    },
    null,
    2,
  )}\n`
}

function createPlannedFilesForTarget(
  registry: RegistryManifest,
  target: ShowcaseTarget,
): PlannedFile[] {
  const items = getSyncedRegistryItems(registry)
  const targetRoot = resolve(root, target.root)
  const planned: PlannedFile[] = [
    {
      source: 'generated:zeus-ui.json',
      target: resolve(targetRoot, 'zeus-ui.json'),
      content: createShowcaseConfig(target),
    },
    {
      source: 'generated:zeus-ui.lock.json',
      target: resolve(targetRoot, 'zeus-ui.lock.json'),
      content: createShowcaseLock(target, items),
    },
  ]

  for (const item of items) {
    for (const file of item.files) {
      if (!shouldIncludeFile(target, file)) continue

      const sourcePath = resolve(registryTemplatesRoot, file.source)
      const targetPath = resolve(targetRoot, 'src', file.target)

      planned.push({
        source: file.source,
        target: targetPath,
        content: readText(sourcePath),
      })
    }
  }

  return planned
}

function createPlannedFiles(registry: RegistryManifest): PlannedFile[] {
  return showcaseTargets.flatMap(target =>
    createPlannedFilesForTarget(registry, target),
  )
}

function checkPlannedFiles(planned: PlannedFile[]): string[] {
  const errors: string[] = []

  for (const file of planned) {
    if (!existsSync(file.target)) {
      errors.push(
        `Missing generated showcase registry file: ${toProjectPath(file.target)}`,
      )
      continue
    }

    const current = readText(file.target)

    if (current !== file.content) {
      errors.push(
        `Outdated showcase registry file: ${toProjectPath(file.target)}`,
      )
    }
  }

  return errors
}

async function writePlannedFiles(planned: PlannedFile[]) {
  for (const file of planned) {
    await mkdir(dirname(file.target), {
      recursive: true,
    })

    await writeFile(file.target, file.content, 'utf-8')

    console.log(`${pc.green('SYNC')} ${toProjectPath(file.target)}`)
  }
}

async function main() {
  const check = hasArg('--check')
  const registry = readRegistry()
  const planned = createPlannedFiles(registry)

  if (check) {
    const errors = checkPlannedFiles(planned)

    if (errors.length > 0) {
      console.error(pc.red('Showcase registry sync check failed:'))

      for (const error of errors) {
        console.error(`- ${error}`)
      }

      console.error('')
      console.error('Run:')
      console.error('  pnpm showcase:registry:sync')

      process.exit(1)
    }

    console.log(pc.green('Showcase registry files are up to date.'))
    return
  }

  await writePlannedFiles(planned)
}

main().catch(error => {
  console.error(pc.red((error as Error).message))
  process.exit(1)
})
```

---

# 3. 新增 `scripts/checks/check-showcase-registry.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

const requiredFiles = [
  'scripts/examples/sync-showcase-registry.ts',

  'examples/react-showcase/zeus-ui.json',
  'examples/react-showcase/zeus-ui.lock.json',
  'examples/react-showcase/src/lib/cn.ts',
  'examples/react-showcase/src/styles/zeus.css',
  'examples/react-showcase/src/components/ui/button.tsx',
  'examples/react-showcase/src/components/ui/input.tsx',

  'examples/vue-showcase/zeus-ui.json',
  'examples/vue-showcase/zeus-ui.lock.json',
  'examples/vue-showcase/src/lib/cn.ts',
  'examples/vue-showcase/src/styles/zeus.css',
  'examples/vue-showcase/src/components/ui/button.vue',
  'examples/vue-showcase/src/components/ui/input.vue',
]

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf-8')
}

function checkFileExists(path: string, errors: string[]): void {
  if (!existsSync(resolve(root, path))) {
    errors.push(`Missing ${path}`)
  }
}

function checkSourceContains(
  file: string,
  contents: string[],
  errors: string[],
): void {
  const source = read(file)

  for (const content of contents) {
    if (!source.includes(content)) {
      errors.push(`${file} must contain "${content}"`)
    }
  }
}

function checkSourceNotContains(
  file: string,
  contents: string[],
  errors: string[],
): void {
  const source = read(file)

  for (const content of contents) {
    if (source.includes(content)) {
      errors.push(`${file} must not contain "${content}"`)
    }
  }
}

function main(): void {
  const errors: string[] = []

  for (const file of requiredFiles) {
    checkFileExists(file, errors)
  }

  if (errors.length === 0) {
    checkSourceContains(
      'package.json',
      [
        '"showcase:registry:sync"',
        '"showcase:registry:check"',
        '"check:showcase-registry"',
      ],
      errors,
    )

    checkSourceContains(
      'scripts/examples/sync-showcase-registry.ts',
      [
        "const syncedComponents = ['button', 'input']",
        'createShowcaseConfig',
        'createShowcaseLock',
        'Showcase registry files are up to date.',
      ],
      errors,
    )

    checkSourceContains(
      'examples/react-showcase/src/demos/p0/ButtonDemoPage.tsx',
      [
        "import { Button } from '@/components/ui/button'",
        '<span className="showcase-badge">@/components/ui/button</span>',
      ],
      errors,
    )

    checkSourceNotContains(
      'examples/react-showcase/src/demos/p0/ButtonDemoPage.tsx',
      ['@zeus-web/button/react'],
      errors,
    )

    checkSourceContains(
      'examples/react-showcase/src/demos/p0/InputDemoPage.tsx',
      [
        "import { Input } from '@/components/ui/input'",
        '<span className="showcase-badge">@/components/ui/input</span>',
      ],
      errors,
    )

    checkSourceNotContains(
      'examples/react-showcase/src/demos/p0/InputDemoPage.tsx',
      ['@zeus-web/input/react'],
      errors,
    )

    checkSourceContains(
      'examples/vue-showcase/src/demos/p0/ButtonDemoPage.vue',
      [
        "import Button from '@/components/ui/button.vue'",
        '<span class="showcase-badge">@/components/ui/button.vue</span>',
      ],
      errors,
    )

    checkSourceNotContains(
      'examples/vue-showcase/src/demos/p0/ButtonDemoPage.vue',
      ['@zeus-web/button/vue'],
      errors,
    )

    checkSourceContains(
      'examples/vue-showcase/src/demos/p0/InputDemoPage.vue',
      [
        "import Input from '@/components/ui/input.vue'",
        '<span class="showcase-badge">@/components/ui/input.vue</span>',
      ],
      errors,
    )

    checkSourceNotContains(
      'examples/vue-showcase/src/demos/p0/InputDemoPage.vue',
      ['@zeus-web/input/vue'],
      errors,
    )
  }

  if (errors.length > 0) {
    console.error(pc.red('Showcase registry usage check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Showcase registry usage check passed.'))
}

main()
```

---

# 4. 运行同步脚本生成本地 UI 文件

执行：

```bash
pnpm showcase:registry:sync
```

会生成：

```txt
examples/react-showcase/zeus-ui.json
examples/react-showcase/zeus-ui.lock.json
examples/react-showcase/src/lib/cn.ts
examples/react-showcase/src/styles/zeus.css
examples/react-showcase/src/components/ui/button.tsx
examples/react-showcase/src/components/ui/input.tsx

examples/vue-showcase/zeus-ui.json
examples/vue-showcase/zeus-ui.lock.json
examples/vue-showcase/src/lib/cn.ts
examples/vue-showcase/src/styles/zeus.css
examples/vue-showcase/src/components/ui/button.vue
examples/vue-showcase/src/components/ui/input.vue
```

这些文件不要手写，source of truth 是：

```txt
packages/registry/templates/lib/cn.ts
packages/registry/templates/css/globals.css
packages/registry/templates/react/button.tsx
packages/registry/templates/react/input.tsx
packages/registry/templates/vue/button.vue
packages/registry/templates/vue/input.vue
```

Phase 20 之后，如果 registry template 变了，执行：

```bash
pnpm showcase:registry:sync
```

然后提交同步后的 showcase 文件即可。

---

# 5. 修改 React Button demo

## `examples/react-showcase/src/demos/p0/ButtonDemoPage.tsx`

只改两处。

### import

```diff
- import { Button } from '@zeus-web/button/react'
+ import { Button } from '@/components/ui/button'
```

### meta badge

```diff
- <span className="showcase-badge">@zeus-web/button/react</span>
+ <span className="showcase-badge">@/components/ui/button</span>
```

当前文件正是直接引用 primitive。 Phase 20 后要改成本地 registry-installed 组件。

---

# 6. 修改 React Input demo

## `examples/react-showcase/src/demos/p0/InputDemoPage.tsx`

### import

```diff
- import { Input } from '@zeus-web/input/react'
+ import { Input } from '@/components/ui/input'
```

### meta badge

```diff
- <span className="showcase-badge">@zeus-web/input/react</span>
+ <span className="showcase-badge">@/components/ui/input</span>
```

当前 Input demo 也是直接引用 primitive。

---

# 7. 修改 Vue Button demo

## `examples/vue-showcase/src/demos/p0/ButtonDemoPage.vue`

### import

```diff
- import { Button } from '@zeus-web/button/vue'
+ import Button from '@/components/ui/button.vue'
```

### meta badge

```diff
- <span class="showcase-badge">@zeus-web/button/vue</span>
+ <span class="showcase-badge">@/components/ui/button.vue</span>
```

当前 Vue Button demo 直接引用 primitive wrapper。

---

# 8. 修改 Vue Input demo

## `examples/vue-showcase/src/demos/p0/InputDemoPage.vue`

### import

```diff
- import { Input } from '@zeus-web/input/vue'
+ import Input from '@/components/ui/input.vue'
```

### meta badge

```diff
- <span class="showcase-badge">@zeus-web/input/vue</span>
+ <span class="showcase-badge">@/components/ui/input.vue</span>
```

当前 Vue Input demo 也直接引用 primitive wrapper。

---

# 9. 更新 `scripts/checks/check-product-layers.ts`

把 roadmap 相关检查更新到 Phase 20。

```ts
{
  path: 'docs/internal/examples/showcase-roadmap.md',
  mustContain: [
    '| Phase 15 | Done   | Product layering contract for primitives, themes, native styled Web-C, registry, CLI and showcase usage          |',
    '| Phase 16 | Done   | Native styled Web-C package with styled button and input entrypoints                                             |',
    '| Phase 17 | Done   | Registry foundation with React and Vue button/input templates                                                    |',
    '| Phase 18 | Done   | CLI init command with zeus-ui.json, project detection, cn utility and styles initialization                       |',
    '| Phase 19 | Done   | CLI add command with registry dependency expansion, framework filtering, file writing and lockfile tracking       |',
    '| Phase 20 | Done   | React and Vue showcase consume registry-installed styled button and input components                              |',
    'The showcase has thirteen layers of checks:',
    'Product layer checks validate Zeus-UI package boundaries and usage entry decisions.',
    'Native styled Web-C checks validate @zeus-web/ui package exports, CSS entrypoints and primitive composition.',
    'Registry checks validate @zeus-web/registry schema, metadata, templates and primitive dependencies.',
    'CLI init checks validate zeus-ui.json initialization, project detection and base file generation.',
    'CLI add checks validate registry dependency expansion, framework-specific template filtering and lockfile tracking.',
    'Showcase registry checks validate React and Vue demos consume registry-synced local styled components.',
    'pnpm check:product-layers',
    'pnpm check:ui-package',
    'pnpm check:registry',
    'pnpm check:cli-init',
    'pnpm check:cli-add',
    'pnpm check:showcase-registry',
    'pnpm showcase:registry:check',
    'Phase 21: Add native showcase for @zeus-web/ui.',
  ],
}
```

替换 `checkPhaseOrder()`：

```ts
function checkPhaseOrder(source: string): string[] {
  const errors: string[] = []
  const phase15Index = source.indexOf('| Phase 15 |')
  const phase16Index = source.indexOf('| Phase 16 |')
  const phase17Index = source.indexOf('| Phase 17 |')
  const phase18Index = source.indexOf('| Phase 18 |')
  const phase19Index = source.indexOf('| Phase 19 |')
  const phase20Index = source.indexOf('| Phase 20 |')
  const phase21Index = source.indexOf('Phase 21:')

  if (phase15Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 15 status row')
  }

  if (phase16Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 16 status row')
  }

  if (phase17Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 17 status row')
  }

  if (phase18Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 18 status row')
  }

  if (phase19Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 19 status row')
  }

  if (phase20Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 20 status row')
  }

  if (phase21Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 21 next work')
  }

  if (phase15Index >= 0 && phase16Index >= 0 && phase16Index < phase15Index) {
    errors.push('Phase 16 status must appear after Phase 15 status')
  }

  if (phase16Index >= 0 && phase17Index >= 0 && phase17Index < phase16Index) {
    errors.push('Phase 17 status must appear after Phase 16 status')
  }

  if (phase17Index >= 0 && phase18Index >= 0 && phase18Index < phase17Index) {
    errors.push('Phase 18 status must appear after Phase 17 status')
  }

  if (phase18Index >= 0 && phase19Index >= 0 && phase19Index < phase18Index) {
    errors.push('Phase 19 status must appear after Phase 18 status')
  }

  if (phase19Index >= 0 && phase20Index >= 0 && phase20Index < phase19Index) {
    errors.push('Phase 20 status must appear after Phase 19 status')
  }

  if (phase20Index >= 0 && phase21Index >= 0 && phase21Index < phase20Index) {
    errors.push('Phase 21 next work must appear after Phase 20 status')
  }

  return errors
}
```

---

# 10. 新增设计文档

## `docs/internal/design/zeus-ui-showcase-registry-usage.md`

````md
# Zeus-UI Showcase Registry Usage

## Status

Phase 20 design.

This document defines how React and Vue showcase consume registry-installed styled components.

## Goal

The React and Vue showcase should demonstrate the recommended application usage path.

Before Phase 20, the button and input demo pages imported primitive wrappers directly:

```tsx
import { Button } from '@zeus-web/button/react'
import { Input } from '@zeus-web/input/react'
```
````

After Phase 20, showcase imports local registry-synced components:

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
```

Vue uses:

```ts
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
```

## Why only button and input?

Phase 17 registry only contains styled templates for:

```txt
button
input
```

Therefore Phase 20 only switches those two demos.

Other showcase component demos continue to use primitive wrappers until their registry templates exist.

## Sync model

Registry templates remain the source of truth.

The sync command is:

```bash
pnpm showcase:registry:sync
```

The check command is:

```bash
pnpm showcase:registry:check
```

The sync command writes:

```txt
examples/react-showcase/src/lib/cn.ts
examples/react-showcase/src/styles/zeus.css
examples/react-showcase/src/components/ui/button.tsx
examples/react-showcase/src/components/ui/input.tsx

examples/vue-showcase/src/lib/cn.ts
examples/vue-showcase/src/styles/zeus.css
examples/vue-showcase/src/components/ui/button.vue
examples/vue-showcase/src/components/ui/input.vue
```

It also writes:

```txt
examples/react-showcase/zeus-ui.json
examples/react-showcase/zeus-ui.lock.json
examples/vue-showcase/zeus-ui.json
examples/vue-showcase/zeus-ui.lock.json
```

## Drift prevention

The CI check must fail if generated files drift from registry templates.

```bash
pnpm check:showcase-registry
pnpm showcase:registry:check
```

## Non-goals

Phase 20 does not:

- add native showcase
- add more registry components
- rewrite every showcase demo
- implement CLI update
- implement CLI diff
- implement remote registry

## Next phase

Phase 21 should add a native showcase for:

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

````

---

# 11. 更新 roadmap

## `docs/internal/examples/showcase-roadmap.md`

追加：

```md
| Phase 20 | Done   | React and Vue showcase consume registry-installed styled button and input components                              |
````

工程保障改成 13 层：

```md
The showcase has thirteen layers of checks:

1. Metadata checks validate component metadata coverage.
2. Implementation checks validate that implemented demos have React and Vue files, dependencies and build dependency scripts.
3. Route smoke tests validate that every implemented component route renders in React and Vue.
4. Foundation page tests validate icons, themes and playground interaction behavior.
5. Shared unit tests validate metadata helpers, icon snippets, theme helpers and playground fixtures.
6. Vitest-powered Playwright E2E tests validate React and Vue showcase routes and critical browser interactions.
7. CI gates run showcase metadata, unit tests, builds and browser E2E as separate jobs.
8. Product layer checks validate Zeus-UI package boundaries and usage entry decisions.
9. Native styled Web-C checks validate @zeus-web/ui package exports, CSS entrypoints and primitive composition.
10. Registry checks validate @zeus-web/registry schema, metadata, templates and primitive dependencies.
11. CLI init checks validate zeus-ui.json initialization, project detection and base file generation.
12. CLI add checks validate registry dependency expansion, framework-specific template filtering and lockfile tracking.
13. Showcase registry checks validate React and Vue demos consume registry-synced local styled components.
```

Commands 增加：

```bash
pnpm check:showcase-registry
pnpm showcase:registry:sync
pnpm showcase:registry:check
```

Next work 改成：

```md
## Next work

Future phases should add native styled Web-C showcase and public docs:

- Phase 21: Add native showcase for @zeus-web/ui.
- Phase 22: Rewrite public docs around CLI, native styled Web-C and advanced primitive usage.
```

---

# 12. 文件清单

```txt
package.json

scripts/examples/sync-showcase-registry.ts
scripts/checks/check-showcase-registry.ts
scripts/checks/check-product-layers.ts

examples/react-showcase/zeus-ui.json
examples/react-showcase/zeus-ui.lock.json
examples/react-showcase/src/lib/cn.ts
examples/react-showcase/src/styles/zeus.css
examples/react-showcase/src/components/ui/button.tsx
examples/react-showcase/src/components/ui/input.tsx
examples/react-showcase/src/demos/p0/ButtonDemoPage.tsx
examples/react-showcase/src/demos/p0/InputDemoPage.tsx

examples/vue-showcase/zeus-ui.json
examples/vue-showcase/zeus-ui.lock.json
examples/vue-showcase/src/lib/cn.ts
examples/vue-showcase/src/styles/zeus.css
examples/vue-showcase/src/components/ui/button.vue
examples/vue-showcase/src/components/ui/input.vue
examples/vue-showcase/src/demos/p0/ButtonDemoPage.vue
examples/vue-showcase/src/demos/p0/InputDemoPage.vue

docs/internal/design/zeus-ui-showcase-registry-usage.md
docs/internal/examples/showcase-roadmap.md
```

---

# 13. 验收命令

```bash
pnpm showcase:registry:sync
pnpm showcase:registry:check
pnpm check:showcase-registry
pnpm showcase:test
pnpm showcase:build
pnpm showcase:e2e
```

全量：

```bash
pnpm check
pnpm build
pnpm site:check
pnpm showcase:ci
pnpm release:verify --allow-zero
```

---

# 14. Phase 20 完成判断

```txt
完成：
  - React showcase 有 registry-synced Button/Input 本地组件
  - Vue showcase 有 registry-synced Button/Input 本地组件
  - React Button/Input demo 改用 @/components/ui/*
  - Vue Button/Input demo 改用 @/components/ui/*.vue
  - sync 脚本能从 packages/registry 生成 showcase 本地文件
  - check 脚本能防止 generated files 漂移
  - site:check 接入 showcase registry 检查
  - showcase:ci:metadata 接入 showcase registry 检查
  - roadmap Phase 20 Done

未做：
  - 没有 native showcase
  - 没有切换其它未进入 registry 的组件
  - 没有 CLI update/diff
```

---

# 15. 建议分支与 PR

分支名：

```txt
refactor/showcase-use-registry
```

PR title：

```txt
refactor(showcase): consume registry-installed styled components
```
