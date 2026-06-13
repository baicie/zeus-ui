下面给 **Phase 21：Native Showcase for `@zeus-web/ui`** 的详细设计与完整代码。

Phase 21 的目标是补齐第三条使用路径：

```txt id="zv8p9i"
React/Vue 应用：
  zweb init
  zweb add button input
  import { Button } from '@/components/ui/button'

Native Web Component 应用：
  import '@zeus-web/ui'
  <zw-button variant="primary">Save</zw-button>
  <zw-input placeholder="Email"></zw-input>

Advanced primitive：
  import '@zeus-web/button/wc'
  import '@zeus-web/button/react'
```

当前 `@zeus-web/ui` 已经是 native styled Web-C 包，导出了 `styles.css / button / input`，并且 `button.ts/input.ts` 内部都是 `default.css + 组件 CSS + primitive wc` 组合。  
所以 Phase 21 不需要改 `@zeus-web/ui`，而是新增一个 **纯原生 Web Component showcase** 来验证 native styled 分发层。

---

# Phase 21 目标

```txt id="c5vqvd"
Phase 21 = Native Showcase for @zeus-web/ui

新增：
  - examples/native-showcase
  - native showcase Vite app
  - native showcase button/input demo
  - native showcase unit test
  - check:native-showcase 脚本
  - root showcase:native / showcase:native:build / showcase:native:test
  - showcase:build / showcase:test / showcase:ci 纳入 native showcase
  - docs/internal/design/zeus-ui-native-showcase.md
  - roadmap Phase 21 Done

不做：
  - 不改 @zeus-web/ui 包实现
  - 不切更多 registry 组件
  - 不做 CLI update/diff
  - 不重写 public docs
  - 不引入框架 runtime
```

---

# 1. 修改根 `package.json`

当前 workspace 已经覆盖 `examples/*`，所以新增 `examples/native-showcase` 会自动进入 workspace。

新增脚本：

```json id="rle67w"
{
  "showcase:native": "pnpm --filter @zeus-web/example-native-showcase dev",
  "showcase:native:build": "pnpm --filter @zeus-web/example-native-showcase build",
  "showcase:native:test": "pnpm --filter @zeus-web/example-native-showcase test",
  "check:native-showcase": "tsx scripts/checks/check-native-showcase.ts"
}
```

并更新已有脚本：

```json id="fnwc9u"
{
  "showcase:build": "pnpm --filter @zeus-web/example-react-showcase build && pnpm --filter @zeus-web/example-vue-showcase build && pnpm --filter @zeus-web/example-native-showcase build",
  "showcase:test": "pnpm --filter @zeus-web/example-react-showcase test && pnpm --filter @zeus-web/example-vue-showcase test && pnpm --filter @zeus-web/example-native-showcase test",
  "showcase:ci:metadata": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:showcase-registry && pnpm check:native-showcase && pnpm showcase:registry:check",
  "site:check": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:product-layers && pnpm check:ui-package && pnpm check:registry && pnpm check:cli-init && pnpm check:cli-add && pnpm check:showcase-registry && pnpm check:native-showcase && pnpm showcase:registry:check && pnpm docs:check && pnpm docs:build && pnpm examples:check && pnpm showcase:test"
}
```

完整相关片段：

```json id="pqlqa7"
{
  "scripts": {
    "showcase:react": "pnpm --filter @zeus-web/example-react-showcase dev",
    "showcase:vue": "pnpm --filter @zeus-web/example-vue-showcase dev",
    "showcase:native": "pnpm --filter @zeus-web/example-native-showcase dev",
    "showcase:build": "pnpm --filter @zeus-web/example-react-showcase build && pnpm --filter @zeus-web/example-vue-showcase build && pnpm --filter @zeus-web/example-native-showcase build",
    "showcase:test": "pnpm --filter @zeus-web/example-react-showcase test && pnpm --filter @zeus-web/example-vue-showcase test && pnpm --filter @zeus-web/example-native-showcase test",
    "showcase:native:build": "pnpm --filter @zeus-web/example-native-showcase build",
    "showcase:native:test": "pnpm --filter @zeus-web/example-native-showcase test",
    "check:native-showcase": "tsx scripts/checks/check-native-showcase.ts",
    "showcase:ci:metadata": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:showcase-registry && pnpm check:native-showcase && pnpm showcase:registry:check",
    "site:check": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:product-layers && pnpm check:ui-package && pnpm check:registry && pnpm check:cli-init && pnpm check:cli-add && pnpm check:showcase-registry && pnpm check:native-showcase && pnpm showcase:registry:check && pnpm docs:check && pnpm docs:build && pnpm examples:check && pnpm showcase:test"
  }
}
```

---

# 2. 新增 `examples/native-showcase/package.json`

```json id="wtx6fr"
{
  "name": "@zeus-web/example-native-showcase",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "pnpm build:deps && vite --host 0.0.0.0 --port 5175",
    "build": "pnpm build:deps && vite build",
    "build:deps": "pnpm -w exec tsx scripts/examples/build-showcase-deps.ts --force",
    "check": "pnpm build:deps && tsc -p tsconfig.json --noEmit",
    "test": "pnpm build:deps && vitest --run"
  },
  "dependencies": {
    "@zeus-web/ui": "workspace:*"
  },
  "devDependencies": {
    "jsdom": "^29.1.1",
    "typescript": "^6.0.3",
    "vite": "^8.0.16",
    "vitest": "^4.1.8"
  }
}
```

说明：

```txt id="xav9nw"
native showcase 只依赖 @zeus-web/ui。
不依赖 React/Vue。
不直接依赖 @zeus-web/button/input。
```

React/Vue showcase 现在还直接依赖一堆 primitive 包，native showcase 则只验证 `@zeus-web/ui` 分发层。当前 React/Vue showcase 的依赖里没有 `@zeus-web/ui`，只有 primitive 和 themes。

---

# 3. 新增 `examples/native-showcase/tsconfig.json`

```json id="u7ee3d"
{
  "extends": "../../scripts/config/tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals", "vite/client"]
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

---

# 4. 新增 `examples/native-showcase/vite.config.ts`

```ts id="4rqjae"
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5175,
  },
  preview: {
    host: '0.0.0.0',
    port: 4175,
  },
})
```

---

# 5. 新增 `examples/native-showcase/vitest.config.ts`

```ts id="vm00of"
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts'],
  },
})
```

---

# 6. 新增 `examples/native-showcase/index.html`

```html id="81opvk"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zeus Web Native Showcase</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

---

# 7. 新增 `examples/native-showcase/src/main.ts`

```ts id="vov6pe"
import '@zeus-web/ui'

import './styles.css'

import { renderNativeShowcase } from './showcase'

const root = document.querySelector<HTMLDivElement>('#app')

if (!root) {
  throw new Error('Missing #app root element')
}

renderNativeShowcase(root)
```

这里使用 `import '@zeus-web/ui'`，验证 aggregate entry。
`@zeus-web/ui` 本身导出 package aggregate entry，并且包含 button/input。

---

# 8. 新增 `examples/native-showcase/src/showcase.ts`

```ts id="j11grw"
const buttonVariants = [
  'default',
  'primary',
  'secondary',
  'outline',
  'ghost',
  'danger',
]

const buttonSizes = ['sm', 'md', 'lg', 'icon']

function createSection(params: {
  title: string
  description: string
}): HTMLElement {
  const section = document.createElement('section')
  section.className = 'showcase-section'

  const heading = document.createElement('div')
  heading.className = 'showcase-section-header'

  const title = document.createElement('h2')
  title.textContent = params.title

  const description = document.createElement('p')
  description.textContent = params.description

  heading.append(title, description)
  section.append(heading)

  return section
}

function createCodeBlock(code: string): HTMLElement {
  const pre = document.createElement('pre')
  pre.className = 'showcase-code'

  const element = document.createElement('code')
  element.textContent = code

  pre.append(element)

  return pre
}

function createNativeButton(params: {
  variant?: string
  size?: string
  disabled?: boolean
  text: string
}): HTMLElement {
  const button = document.createElement('zw-button')

  if (params.variant) button.setAttribute('variant', params.variant)
  if (params.size) button.setAttribute('size', params.size)
  if (params.disabled) button.setAttribute('disabled', '')

  button.textContent = params.text

  return button
}

function createNativeInput(params: {
  placeholder?: string
  value?: string
  disabled?: boolean
  invalid?: boolean
}): HTMLElement {
  const input = document.createElement('zw-input')

  if (params.placeholder) input.setAttribute('placeholder', params.placeholder)
  if (params.value) input.setAttribute('value', params.value)
  if (params.disabled) input.setAttribute('disabled', '')
  if (params.invalid) input.setAttribute('invalid', '')

  return input
}

function renderButtonSection(root: HTMLElement): void {
  const section = createSection({
    title: 'Button',
    description:
      'Styled native Web Component buttons from @zeus-web/ui/button.',
  })

  const grid = document.createElement('div')
  grid.className = 'showcase-grid'

  for (const variant of buttonVariants) {
    grid.append(
      createNativeButton({
        variant,
        text: variant,
      }),
    )
  }

  const sizes = document.createElement('div')
  sizes.className = 'showcase-row'

  for (const size of buttonSizes) {
    sizes.append(
      createNativeButton({
        variant: 'primary',
        size,
        text: size === 'icon' ? '+' : size,
      }),
    )
  }

  section.append(
    createCodeBlock(
      'import \'@zeus-web/ui/button\'\n\n<zw-button variant="primary">Save</zw-button>',
    ),
    grid,
    sizes,
    createNativeButton({
      variant: 'primary',
      disabled: true,
      text: 'Disabled',
    }),
  )

  root.append(section)
}

function renderInputSection(root: HTMLElement): void {
  const section = createSection({
    title: 'Input',
    description: 'Styled native Web Component inputs from @zeus-web/ui/input.',
  })

  const stack = document.createElement('div')
  stack.className = 'showcase-stack'

  stack.append(
    createNativeInput({
      placeholder: 'Email address',
    }),
    createNativeInput({
      placeholder: 'Readonly value',
      value: 'Readonly',
    }),
    createNativeInput({
      placeholder: 'Invalid email',
      invalid: true,
    }),
    createNativeInput({
      placeholder: 'Disabled input',
      disabled: true,
    }),
  )

  section.append(
    createCodeBlock(
      'import \'@zeus-web/ui/input\'\n\n<zw-input placeholder="Email address"></zw-input>',
    ),
    stack,
  )

  root.append(section)
}

function renderUsageSection(root: HTMLElement): void {
  const section = createSection({
    title: 'Native usage',
    description:
      'Use @zeus-web/ui when you want styled Web Components without React or Vue wrappers.',
  })

  const list = document.createElement('ul')
  list.className = 'showcase-list'

  for (const text of [
    'No React runtime.',
    'No Vue runtime.',
    'Uses native custom elements.',
    'Consumes @zeus-web/ui aggregate entry.',
    'Useful for static pages, micro-frontends and framework-neutral demos.',
  ]) {
    const item = document.createElement('li')
    item.textContent = text
    list.append(item)
  }

  section.append(
    createCodeBlock(
      'import \'@zeus-web/ui\'\n\n<zw-button variant="primary">Save</zw-button>\n<zw-input placeholder="Email" />',
    ),
    list,
  )

  root.append(section)
}

export function renderNativeShowcase(root: HTMLElement): void {
  root.innerHTML = ''

  const app = document.createElement('main')
  app.className = 'showcase-shell'

  const header = document.createElement('header')
  header.className = 'showcase-hero'

  const eyebrow = document.createElement('p')
  eyebrow.className = 'showcase-eyebrow'
  eyebrow.textContent = '@zeus-web/ui'

  const title = document.createElement('h1')
  title.textContent = 'Native Web Component Showcase'

  const description = document.createElement('p')
  description.textContent =
    'A framework-free showcase for styled Zeus Web Components.'

  header.append(eyebrow, title, description)
  app.append(header)

  renderUsageSection(app)
  renderButtonSection(app)
  renderInputSection(app)

  root.append(app)
}
```

---

# 9. 新增 `examples/native-showcase/src/styles.css`

```css id="ug6oiw"
:root {
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  color: hsl(var(--zw-foreground));
  background:
    radial-gradient(
      circle at top left,
      hsl(var(--zw-primary) / 0.12),
      transparent 32rem
    ),
    hsl(var(--zw-background));
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
}

button,
input {
  font: inherit;
}

.showcase-shell {
  width: min(1040px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 56px 0;
}

.showcase-hero {
  display: grid;
  gap: 12px;
  margin-bottom: 32px;
}

.showcase-eyebrow {
  margin: 0;
  color: hsl(var(--zw-primary));
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.showcase-hero h1 {
  max-width: 720px;
  margin: 0;
  color: hsl(var(--zw-foreground));
  font-size: clamp(2rem, 5vw, 4rem);
  line-height: 1;
  letter-spacing: -0.04em;
}

.showcase-hero p:last-child {
  max-width: 640px;
  margin: 0;
  color: hsl(var(--zw-foreground) / 0.64);
  font-size: 1.125rem;
  line-height: 1.7;
}

.showcase-section {
  display: grid;
  gap: 20px;
  margin-top: 24px;
  padding: 24px;
  border: 1px solid hsl(var(--zw-border));
  border-radius: var(--zw-radius-lg);
  background: hsl(var(--zw-background) / 0.86);
  box-shadow: 0 16px 48px hsl(var(--zw-foreground) / 0.08);
}

.showcase-section-header {
  display: grid;
  gap: 6px;
}

.showcase-section h2 {
  margin: 0;
  color: hsl(var(--zw-foreground));
  font-size: 1.25rem;
}

.showcase-section-header p {
  margin: 0;
  color: hsl(var(--zw-foreground) / 0.64);
  line-height: 1.6;
}

.showcase-code {
  overflow-x: auto;
  margin: 0;
  padding: 16px;
  border: 1px solid hsl(var(--zw-border));
  border-radius: var(--zw-radius-md);
  background: hsl(var(--zw-foreground) / 0.04);
  color: hsl(var(--zw-foreground));
  font-size: 0.8125rem;
  line-height: 1.6;
}

.showcase-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.showcase-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.showcase-stack {
  display: grid;
  max-width: 420px;
  gap: 12px;
}

.showcase-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 1.25rem;
  color: hsl(var(--zw-foreground) / 0.72);
  line-height: 1.6;
}
```

---

# 10. 新增 `examples/native-showcase/src/showcase.spec.ts`

```ts id="yrtdj7"
import { describe, expect, it } from 'vitest'

import { renderNativeShowcase } from './showcase'

describe('native showcase', () => {
  it('renders styled native Web Component examples', () => {
    const root = document.createElement('div')

    renderNativeShowcase(root)

    expect(root.querySelector('h1')?.textContent).toBe(
      'Native Web Component Showcase',
    )

    expect(root.querySelectorAll('zw-button').length).toBeGreaterThanOrEqual(8)
    expect(root.querySelectorAll('zw-input')).toHaveLength(4)

    expect(
      root.querySelector('zw-button[variant="primary"]')?.textContent,
    ).toBe('primary')

    expect(
      root.querySelector('zw-input[placeholder="Email address"]'),
    ).toBeTruthy()

    expect(root.textContent).toContain("import '@zeus-web/ui'")
    expect(root.textContent).toContain("import '@zeus-web/ui/button'")
    expect(root.textContent).toContain("import '@zeus-web/ui/input'")
  })
})
```

---

# 11. 新增 `scripts/checks/check-native-showcase.ts`

```ts id="t44hcd"
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

const requiredFiles = [
  'examples/native-showcase/package.json',
  'examples/native-showcase/tsconfig.json',
  'examples/native-showcase/vite.config.ts',
  'examples/native-showcase/vitest.config.ts',
  'examples/native-showcase/index.html',
  'examples/native-showcase/src/main.ts',
  'examples/native-showcase/src/showcase.ts',
  'examples/native-showcase/src/styles.css',
  'examples/native-showcase/src/showcase.spec.ts',
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
        '"showcase:native"',
        '"showcase:native:build"',
        '"showcase:native:test"',
        '"check:native-showcase"',
      ],
      errors,
    )

    checkSourceContains(
      'examples/native-showcase/package.json',
      [
        '"@zeus-web/example-native-showcase"',
        '"@zeus-web/ui"',
        '"vite"',
        '"vitest"',
      ],
      errors,
    )

    checkSourceNotContains(
      'examples/native-showcase/package.json',
      ['"react"', '"react-dom"', '"vue"', '"vue-router"'],
      errors,
    )

    checkSourceContains(
      'examples/native-showcase/src/main.ts',
      [
        "import '@zeus-web/ui'",
        "import './styles.css'",
        'renderNativeShowcase',
      ],
      errors,
    )

    checkSourceContains(
      'examples/native-showcase/src/showcase.ts',
      [
        'document.createElement',
        "'zw-button'",
        "'zw-input'",
        "import '@zeus-web/ui'",
        "import '@zeus-web/ui/button'",
        "import '@zeus-web/ui/input'",
      ],
      errors,
    )

    checkSourceNotContains(
      'examples/native-showcase/src/showcase.ts',
      ['from "react"', "from 'react'", "from 'vue'", 'from "vue"'],
      errors,
    )

    checkSourceContains(
      'examples/native-showcase/src/showcase.spec.ts',
      [
        'renderNativeShowcase',
        "root.querySelectorAll('zw-button')",
        "root.querySelectorAll('zw-input')",
      ],
      errors,
    )
  }

  if (errors.length > 0) {
    console.error(pc.red('Native showcase check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Native showcase check passed.'))
}

main()
```

---

# 12. 更新 `scripts/checks/check-product-layers.ts`

把 roadmap 相关检查更新到 Phase 21。

```ts id="xefhdc"
{
  path: 'docs/internal/examples/showcase-roadmap.md',
  mustContain: [
    '| Phase 15 | Done',
    '| Phase 16 | Done',
    '| Phase 17 | Done',
    '| Phase 18 | Done',
    '| Phase 19 | Done',
    '| Phase 20 | Done',
    '| Phase 21 | Done',
    'The showcase has fourteen layers of checks:',
    'Product layer checks validate Zeus-UI package boundaries and usage entry decisions.',
    'Native styled Web-C checks validate @zeus-web/ui package exports, CSS entrypoints and primitive composition.',
    'Registry checks validate @zeus-web/registry schema, metadata, templates and primitive dependencies.',
    'CLI init checks validate zeus-ui.json initialization, project detection and base file generation.',
    'CLI add checks validate registry dependency expansion, framework-specific template filtering and lockfile tracking.',
    'Showcase registry checks validate React and Vue demos consume registry-synced local styled components.',
    'Native showcase checks validate @zeus-web/ui can be consumed without React or Vue.',
    'pnpm check:product-layers',
    'pnpm check:ui-package',
    'pnpm check:registry',
    'pnpm check:cli-init',
    'pnpm check:cli-add',
    'pnpm check:showcase-registry',
    'pnpm check:native-showcase',
    'pnpm showcase:native:test',
    'Phase 22: Rewrite public docs around CLI, native styled Web-C and advanced primitive usage.',
  ],
}
```

替换 `checkPhaseOrder()`：

```ts id="qzzk02"
function checkPhaseOrder(source: string): string[] {
  const errors: string[] = []
  const phase15Index = source.indexOf('| Phase 15 |')
  const phase16Index = source.indexOf('| Phase 16 |')
  const phase17Index = source.indexOf('| Phase 17 |')
  const phase18Index = source.indexOf('| Phase 18 |')
  const phase19Index = source.indexOf('| Phase 19 |')
  const phase20Index = source.indexOf('| Phase 20 |')
  const phase21Index = source.indexOf('| Phase 21 |')
  const phase22Index = source.indexOf('Phase 22:')

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
    errors.push('showcase-roadmap.md must contain Phase 21 status row')
  }

  if (phase22Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 22 next work')
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
    errors.push('Phase 21 status must appear after Phase 20 status')
  }

  if (phase21Index >= 0 && phase22Index >= 0 && phase22Index < phase21Index) {
    errors.push('Phase 22 next work must appear after Phase 21 status')
  }

  return errors
}
```

---

# 13. 新增设计文档

## `docs/internal/design/zeus-ui-native-showcase.md`

````md id="57t0av"
# Zeus-UI Native Showcase

## Status

Phase 21 design.

This document defines the framework-free native Web Component showcase for `@zeus-web/ui`.

## Goal

The native showcase verifies that styled Web Components can be consumed without React or Vue.

It validates the second product usage path:

```ts
import '@zeus-web/ui'
```
````

```html
<zw-button variant="primary">Save</zw-button> <zw-input placeholder="Email" />
```

## Package

```txt
@zeus-web/example-native-showcase
```

## Runtime model

The native showcase uses:

- Vite
- TypeScript
- native DOM APIs
- `@zeus-web/ui`

It must not use:

- React
- React DOM
- Vue
- Vue Router

## Why a separate showcase?

React and Vue showcase validate the registry-installed source usage path.

The native showcase validates package-owned styled Web-C usage:

```txt
@zeus-web/ui
```

That package is useful for:

- static pages
- micro-frontends
- no-framework demos
- framework-neutral embed surfaces

## Scope

Phase 21 includes:

- button examples
- input examples
- aggregate import example
- per-component import snippets
- unit test
- build/check scripts

Phase 21 does not include:

- all primitive components
- native E2E
- CLI update
- CLI diff
- public docs rewrite

## Validation

```bash
pnpm check:native-showcase
pnpm showcase:native:test
pnpm showcase:native:build
```

## Next phase

Phase 22 should rewrite public docs around:

- CLI source registry usage
- native styled Web-C usage
- advanced headless primitive usage

````

---

# 14. 更新 roadmap

## `docs/internal/examples/showcase-roadmap.md`

追加：

```md id="v6fbhx"
| Phase 21 | Done   | Native showcase for @zeus-web/ui styled Web Components without React or Vue                                      |
````

工程保障改成 14 层：

```md id="c81e0k"
The showcase has fourteen layers of checks:

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
14. Native showcase checks validate @zeus-web/ui can be consumed without React or Vue.
```

Commands 增加：

```bash id="pmk33g"
pnpm check:native-showcase
pnpm showcase:native
pnpm showcase:native:test
pnpm showcase:native:build
```

Next work 改成：

```md id="o84i4n"
## Next work

Future phases should rewrite public docs around the final product usage paths:

- Phase 22: Rewrite public docs around CLI, native styled Web-C and advanced primitive usage.
```

---

# 15. 文件清单

```txt id="hjzgl7"
package.json

examples/native-showcase/package.json
examples/native-showcase/tsconfig.json
examples/native-showcase/vite.config.ts
examples/native-showcase/vitest.config.ts
examples/native-showcase/index.html
examples/native-showcase/src/main.ts
examples/native-showcase/src/showcase.ts
examples/native-showcase/src/styles.css
examples/native-showcase/src/showcase.spec.ts

scripts/checks/check-native-showcase.ts
scripts/checks/check-product-layers.ts

docs/internal/design/zeus-ui-native-showcase.md
docs/internal/examples/showcase-roadmap.md
```

---

# 16. 验收命令

```bash id="bfb2m7"
pnpm check:native-showcase
pnpm showcase:native:test
pnpm showcase:native:build
```

showcase 全量：

```bash id="ko23ah"
pnpm showcase:test
pnpm showcase:build
pnpm showcase:ci
```

项目全量：

```bash id="s4kpkx"
pnpm check
pnpm build
pnpm site:check
pnpm showcase:ci
pnpm release:verify --allow-zero
```

---

# 17. Phase 21 完成判断

```txt id="66jtau"
完成：
  - examples/native-showcase 存在
  - native showcase 只依赖 @zeus-web/ui
  - native showcase 不依赖 React/Vue
  - main.ts 使用 import '@zeus-web/ui'
  - 页面渲染 zw-button / zw-input
  - 有 button variants/sizes 示例
  - 有 input normal/invalid/disabled 示例
  - 有 native usage code snippets
  - 有 unit test
  - root showcase:build/test 纳入 native showcase
  - site:check 纳入 check:native-showcase
  - roadmap Phase 21 Done

未做：
  - 没有 native E2E
  - 没有 public docs rewrite
  - 没有 CLI update/diff
```

---

# 18. 建议分支与 PR

分支名：

```txt id="91gtid"
feat/native-showcase
```

PR title：

```txt id="51zk0u"
feat(showcase): add native styled Web Component showcase
```
