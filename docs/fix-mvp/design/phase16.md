下面给 **Phase 16：`@zeus-web/ui` Native Styled Web-C 基础包** 的详细设计与完整代码。

这一阶段只做一件事：**让原生 Web Component 用户有一个开箱带样式的入口**。
不做 registry，不做 CLI，不切换 React/Vue showcase。

当前仓库 workspace 已覆盖 `packages/*` 和 `packages/primitives/*`，所以新增 `packages/ui` 是符合现有 monorepo 结构的。 当前 `@zeus-web/button` 也明确是 `Headless button primitive for Zeus Web`，说明 styled native 层应该新增在上层，而不是污染 primitive。 `@zeus-web/themes` 已经导出 `tokens.css/default.css/components.css` 等 CSS 入口，可以直接作为 `@zeus-web/ui` 的 token 基础。

---

# Phase 16 目标

```txt
Phase 16 = @zeus-web/ui native styled Web-C package

新增：
  - packages/ui
  - @zeus-web/ui package
  - @zeus-web/ui/button
  - @zeus-web/ui/input
  - @zeus-web/ui/styles.css
  - button.css / input.css
  - check-ui-package 脚本
  - unit test
  - roadmap Phase 16 Done

不做：
  - 不新增 registry
  - 不新增 CLI
  - 不切换 React/Vue showcase
  - 不新增 native-showcase
  - 不修改 primitive 行为
```

---

# 1. 修改根 `package.json`

新增脚本：

```json
{
  "check:ui-package": "tsx scripts/checks/check-ui-package.ts"
}
```

并把 `site:check` 接入它。

## 修改后相关片段

```json
{
  "scripts": {
    "check:component-coverage": "tsx scripts/checks/check-component-coverage.ts",
    "check:showcase-metadata": "tsx scripts/checks/check-showcase-metadata.ts",
    "check:showcase-implementation": "tsx scripts/checks/check-showcase-implementation.ts",
    "check:product-layers": "tsx scripts/checks/check-product-layers.ts",
    "check:ui-package": "tsx scripts/checks/check-ui-package.ts",
    "site:check": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:product-layers && pnpm check:ui-package && pnpm docs:check && pnpm docs:build && pnpm examples:check && pnpm showcase:test"
  }
}
```

---

# 2. 新增 `packages/ui/package.json`

```json
{
  "name": "@zeus-web/ui",
  "type": "module",
  "version": "0.0.0",
  "description": "Styled native Web Component entrypoints for Zeus Web.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/baicie/zeus-ui.git",
    "directory": "packages/ui"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "sideEffects": [
    "./dist/*.css",
    "./dist/**/*.css",
    "./dist/index.js",
    "./dist/button.js",
    "./dist/input.js"
  ],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./styles.css": "./dist/styles.css",
    "./button": {
      "types": "./dist/button.d.ts",
      "import": "./dist/button.js"
    },
    "./button.css": "./dist/button.css",
    "./input": {
      "types": "./dist/input.d.ts",
      "import": "./dist/input.js"
    },
    "./input.css": "./dist/input.css"
  },
  "files": ["dist"],
  "scripts": {
    "dev": "tsup src/index.ts src/button.ts src/input.ts --format esm --dts --clean --watch",
    "build": "tsup src/index.ts src/button.ts src/input.ts --format esm --dts --clean && node scripts/copy-css.mjs",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../.. --project unit packages/ui/__tests__/ui-package.spec.ts"
  },
  "dependencies": {
    "@zeus-web/button": "workspace:*",
    "@zeus-web/input": "workspace:*",
    "@zeus-web/themes": "workspace:*"
  },
  "devDependencies": {
    "tsup": "8.5.1",
    "typescript": "^6.0.3",
    "vitest": "^4.1.8"
  }
}
```

设计点：

```txt
@zeus-web/ui/button:
  自带 theme + button.css + primitive wc 注册

@zeus-web/ui/input:
  自带 theme + input.css + primitive wc 注册

@zeus-web/ui/styles.css:
  只提供聚合 CSS，给用户手动拆分使用

@zeus-web/ui:
  注册 button/input 并加载对应 CSS
```

---

# 3. 新增 `packages/ui/tsconfig.json`

沿用现有 package 的 tsconfig 风格，themes 包也是继承 `scripts/config/tsconfig.base.json`。

```json
{
  "extends": "../../scripts/config/tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "rootDir": "src",
    "outDir": "dist",
    "isolatedDeclarations": false
  },
  "include": ["src", "__tests__"]
}
```

---

# 4. 新增 `packages/ui/src/css.d.ts`

```ts
declare module '*.css'
```

这个必须有，因为 `src/button.ts` / `src/input.ts` 会直接 import CSS。

---

# 5. 新增 `packages/ui/src/button.ts`

```ts
import '@zeus-web/themes/default.css'

import './button.css'

import '@zeus-web/button/wc'
```

说明：
`import '@zeus-web/ui/button'` 必须开箱有样式，所以这里直接引入 theme 和 button CSS。

---

# 6. 新增 `packages/ui/src/input.ts`

```ts
import '@zeus-web/themes/default.css'

import './input.css'

import '@zeus-web/input/wc'
```

---

# 7. 新增 `packages/ui/src/index.ts`

```ts
import './button'
import './input'
```

这样原生用户可以：

```ts
import '@zeus-web/ui'
```

获得 button/input 的注册和样式。

---

# 8. 新增 `packages/ui/src/styles.css`

```css
@import '@zeus-web/themes/default.css';
@import './button.css';
@import './input.css';
```

说明：
这个 CSS 入口给用户手动控制样式加载时使用：

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/button/wc'
import '@zeus-web/input/wc'
```

正常推荐还是直接：

```ts
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

---

# 9. 新增 `packages/ui/src/button.css`

主题变量已有 `--zw-primary`、`--zw-primary-foreground`、`--zw-border`、`--zw-input`、`--zw-ring`。 radius / motion 变量也已有 `--zw-radius-*`、`--zw-duration-*`、`--zw-easing-*`。

```css
zw-button {
  display: inline-flex;
  vertical-align: middle;
}

zw-button [data-slot='button'],
zw-button::part(button) {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  white-space: nowrap;
  border: 1px solid transparent;
  border-radius: var(--zw-radius-md);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  user-select: none;
  outline: none;
  transition:
    color var(--zw-duration-fast) var(--zw-easing-standard),
    background-color var(--zw-duration-fast) var(--zw-easing-standard),
    border-color var(--zw-duration-fast) var(--zw-easing-standard),
    box-shadow var(--zw-duration-fast) var(--zw-easing-standard),
    opacity var(--zw-duration-fast) var(--zw-easing-standard);
}

zw-button [data-slot='button']:focus-visible,
zw-button::part(button):focus-visible {
  box-shadow:
    0 0 0 2px hsl(var(--zw-background)),
    0 0 0 4px hsl(var(--zw-ring) / 0.45);
}

zw-button [data-slot='button'][data-disabled='true'],
zw-button [data-slot='button'][aria-disabled='true'],
zw-button [data-slot='button']:disabled,
zw-button[disabled]::part(button),
zw-button[aria-disabled='true']::part(button) {
  cursor: not-allowed;
  opacity: 0.5;
  pointer-events: none;
}

/* Variants */

zw-button [data-slot='button'],
zw-button [data-slot='button'][data-variant='default'],
zw-button:not([variant])::part(button),
zw-button[variant='default']::part(button) {
  border-color: hsl(var(--zw-border));
  background: hsl(var(--zw-background));
  color: hsl(var(--zw-foreground));
}

zw-button [data-slot='button'][data-variant='default']:hover,
zw-button[variant='default']::part(button):hover,
zw-button:not([variant])::part(button):hover {
  background: hsl(var(--zw-primary) / 0.06);
}

zw-button [data-slot='button'][data-variant='primary'],
zw-button[variant='primary']::part(button) {
  border-color: hsl(var(--zw-primary));
  background: hsl(var(--zw-primary));
  color: hsl(var(--zw-primary-foreground));
}

zw-button [data-slot='button'][data-variant='primary']:hover,
zw-button[variant='primary']::part(button):hover {
  background: hsl(var(--zw-primary) / 0.9);
}

zw-button [data-slot='button'][data-variant='secondary'],
zw-button[variant='secondary']::part(button) {
  border-color: hsl(var(--zw-border));
  background: hsl(var(--zw-primary) / 0.08);
  color: hsl(var(--zw-foreground));
}

zw-button [data-slot='button'][data-variant='secondary']:hover,
zw-button[variant='secondary']::part(button):hover {
  background: hsl(var(--zw-primary) / 0.12);
}

zw-button [data-slot='button'][data-variant='outline'],
zw-button[variant='outline']::part(button) {
  border-color: hsl(var(--zw-border));
  background: transparent;
  color: hsl(var(--zw-foreground));
}

zw-button [data-slot='button'][data-variant='outline']:hover,
zw-button[variant='outline']::part(button):hover {
  background: hsl(var(--zw-primary) / 0.06);
}

zw-button [data-slot='button'][data-variant='ghost'],
zw-button[variant='ghost']::part(button) {
  border-color: transparent;
  background: transparent;
  color: hsl(var(--zw-foreground));
}

zw-button [data-slot='button'][data-variant='ghost']:hover,
zw-button[variant='ghost']::part(button):hover {
  background: hsl(var(--zw-primary) / 0.06);
}

zw-button [data-slot='button'][data-variant='danger'],
zw-button[variant='danger']::part(button),
zw-button [data-slot='button'][data-variant='destructive'],
zw-button[variant='destructive']::part(button) {
  border-color: hsl(var(--destructive));
  background: hsl(var(--destructive));
  color: hsl(var(--destructive-foreground));
}

zw-button [data-slot='button'][data-variant='danger']:hover,
zw-button[variant='danger']::part(button):hover,
zw-button [data-slot='button'][data-variant='destructive']:hover,
zw-button[variant='destructive']::part(button):hover {
  background: hsl(var(--destructive) / 0.9);
}

/* Sizes */

zw-button [data-slot='button'],
zw-button [data-slot='button'][data-size='md'],
zw-button:not([size])::part(button),
zw-button[size='md']::part(button) {
  height: 2.25rem;
  padding-inline: 1rem;
}

zw-button [data-slot='button'][data-size='sm'],
zw-button[size='sm']::part(button) {
  height: 2rem;
  padding-inline: 0.75rem;
  font-size: 0.8125rem;
}

zw-button [data-slot='button'][data-size='lg'],
zw-button[size='lg']::part(button) {
  height: 2.5rem;
  padding-inline: 1.25rem;
}

zw-button [data-slot='button'][data-size='icon'],
zw-button[size='icon']::part(button) {
  width: 2.25rem;
  height: 2.25rem;
  padding-inline: 0;
}
```

说明：

```txt
同时支持：
  - light DOM: zw-button [data-slot='button']
  - future shadow DOM: zw-button::part(button)

这样后续 primitive 切 shadow DOM 时，@zeus-web/ui 不需要推倒。
```

---

# 10. 新增 `packages/ui/src/input.css`

```css
zw-input {
  display: inline-flex;
  width: 100%;
  vertical-align: middle;
}

zw-input [data-slot='input'],
zw-input::part(input) {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 2.25rem;
  border: 1px solid hsl(var(--zw-input));
  border-radius: var(--zw-radius-md);
  background: hsl(var(--zw-background));
  color: hsl(var(--zw-foreground));
  font: inherit;
  font-size: 0.875rem;
  line-height: 1.25rem;
  outline: none;
  padding-block: 0.375rem;
  padding-inline: 0.75rem;
  transition:
    border-color var(--zw-duration-fast) var(--zw-easing-standard),
    box-shadow var(--zw-duration-fast) var(--zw-easing-standard),
    background-color var(--zw-duration-fast) var(--zw-easing-standard),
    opacity var(--zw-duration-fast) var(--zw-easing-standard);
}

zw-input [data-slot='input']::placeholder,
zw-input::part(input)::placeholder {
  color: hsl(var(--zw-foreground) / 0.48);
}

zw-input [data-slot='input']:hover,
zw-input::part(input):hover {
  border-color: hsl(var(--zw-ring) / 0.45);
}

zw-input [data-slot='input']:focus,
zw-input [data-slot='input']:focus-visible,
zw-input::part(input):focus,
zw-input::part(input):focus-visible {
  border-color: hsl(var(--zw-ring));
  box-shadow:
    0 0 0 2px hsl(var(--zw-background)),
    0 0 0 4px hsl(var(--zw-ring) / 0.35);
}

zw-input [data-slot='input'][data-invalid='true'],
zw-input [data-slot='input'][aria-invalid='true'],
zw-input[invalid]::part(input),
zw-input[aria-invalid='true']::part(input) {
  border-color: hsl(var(--destructive));
}

zw-input [data-slot='input'][data-invalid='true']:focus,
zw-input [data-slot='input'][aria-invalid='true']:focus,
zw-input[invalid]::part(input):focus,
zw-input[aria-invalid='true']::part(input):focus {
  box-shadow:
    0 0 0 2px hsl(var(--zw-background)),
    0 0 0 4px hsl(var(--destructive) / 0.35);
}

zw-input [data-slot='input'][data-disabled='true'],
zw-input [data-slot='input'][aria-disabled='true'],
zw-input [data-slot='input']:disabled,
zw-input[disabled]::part(input),
zw-input[aria-disabled='true']::part(input) {
  cursor: not-allowed;
  opacity: 0.5;
  pointer-events: none;
}

zw-input [data-slot='input'][data-size='sm'],
zw-input[size='sm']::part(input) {
  height: 2rem;
  padding-block: 0.25rem;
  padding-inline: 0.625rem;
  font-size: 0.8125rem;
}

zw-input [data-slot='input'][data-size='md'],
zw-input[size='md']::part(input),
zw-input:not([size])::part(input) {
  height: 2.25rem;
}

zw-input [data-slot='input'][data-size='lg'],
zw-input[size='lg']::part(input) {
  height: 2.5rem;
  padding-inline: 0.875rem;
}
```

---

# 11. 新增 `packages/ui/scripts/copy-css.mjs`

```js
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(root, '..')
const sourceDir = resolve(packageRoot, 'src')
const distDir = resolve(packageRoot, 'dist')

const files = ['styles.css', 'button.css', 'input.css']

await mkdir(distDir, {
  recursive: true,
})

await Promise.all(
  files.map(file => copyFile(resolve(sourceDir, file), resolve(distDir, file))),
)
```

---

# 12. 新增 `packages/ui/__tests__/ui-package.spec.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const packageRoot = resolve(process.cwd(), 'packages/ui')

function read(relativePath: string): string {
  return readFileSync(resolve(packageRoot, relativePath), 'utf-8')
}

describe('@zeus-web/ui package contract', () => {
  it('declares native styled web component exports', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      name: string
      exports: Record<string, unknown>
      dependencies: Record<string, string>
    }

    expect(packageJson.name).toBe('@zeus-web/ui')
    expect(packageJson.exports).toHaveProperty('.')
    expect(packageJson.exports).toHaveProperty('./styles.css')
    expect(packageJson.exports).toHaveProperty('./button')
    expect(packageJson.exports).toHaveProperty('./button.css')
    expect(packageJson.exports).toHaveProperty('./input')
    expect(packageJson.exports).toHaveProperty('./input.css')

    expect(packageJson.dependencies).toHaveProperty('@zeus-web/button')
    expect(packageJson.dependencies).toHaveProperty('@zeus-web/input')
    expect(packageJson.dependencies).toHaveProperty('@zeus-web/themes')
  })

  it('keeps native entries styled by default', () => {
    expect(read('src/button.ts')).toContain(
      "import '@zeus-web/themes/default.css'",
    )
    expect(read('src/button.ts')).toContain("import './button.css'")
    expect(read('src/button.ts')).toContain("import '@zeus-web/button/wc'")

    expect(read('src/input.ts')).toContain(
      "import '@zeus-web/themes/default.css'",
    )
    expect(read('src/input.ts')).toContain("import './input.css'")
    expect(read('src/input.ts')).toContain("import '@zeus-web/input/wc'")
  })

  it('ships aggregate styles', () => {
    const styles = read('src/styles.css')

    expect(styles).toContain("@import '@zeus-web/themes/default.css'")
    expect(styles).toContain("@import './button.css'")
    expect(styles).toContain("@import './input.css'")
  })

  it('styles light DOM and future part selectors', () => {
    const buttonCss = read('src/button.css')
    const inputCss = read('src/input.css')

    expect(buttonCss).toContain("zw-button [data-slot='button']")
    expect(buttonCss).toContain('zw-button::part(button)')
    expect(buttonCss).toContain("zw-button[variant='primary']::part(button)")
    expect(buttonCss).toContain('hsl(var(--zw-primary))')

    expect(inputCss).toContain("zw-input [data-slot='input']")
    expect(inputCss).toContain('zw-input::part(input)')
    expect(inputCss).toContain('hsl(var(--zw-input))')
    expect(inputCss).toContain('hsl(var(--zw-ring))')
  })

  it('has a css copy build helper', () => {
    expect(existsSync(resolve(packageRoot, 'scripts/copy-css.mjs'))).toBe(true)
  })
})
```

---

# 13. 新增检查脚本 `scripts/checks/check-ui-package.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

interface PackageJson {
  name?: string
  description?: string
  exports?: Record<string, unknown>
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  sideEffects?: string[]
}

const root = process.cwd()
const packageRoot = resolve(root, 'packages/ui')

const requiredFiles = [
  'package.json',
  'tsconfig.json',
  'src/css.d.ts',
  'src/index.ts',
  'src/styles.css',
  'src/button.ts',
  'src/button.css',
  'src/input.ts',
  'src/input.css',
  'scripts/copy-css.mjs',
  '__tests__/ui-package.spec.ts',
]

const requiredExports = [
  '.',
  './styles.css',
  './button',
  './button.css',
  './input',
  './input.css',
]

function read(relativePath: string): string {
  return readFileSync(resolve(packageRoot, relativePath), 'utf-8')
}

function assertFileExists(relativePath: string, errors: string[]): void {
  if (!existsSync(resolve(packageRoot, relativePath))) {
    errors.push(`Missing packages/ui/${relativePath}`)
  }
}

function checkPackageJson(errors: string[]): void {
  const packageJson = JSON.parse(read('package.json')) as PackageJson

  if (packageJson.name !== '@zeus-web/ui') {
    errors.push('packages/ui/package.json name must be @zeus-web/ui')
  }

  if (
    packageJson.description !==
    'Styled native Web Component entrypoints for Zeus Web.'
  ) {
    errors.push(
      'packages/ui/package.json description must describe styled native Web-C entrypoints',
    )
  }

  for (const exportName of requiredExports) {
    if (!packageJson.exports?.[exportName]) {
      errors.push(`packages/ui/package.json missing export ${exportName}`)
    }
  }

  for (const dep of [
    '@zeus-web/button',
    '@zeus-web/input',
    '@zeus-web/themes',
  ]) {
    if (!packageJson.dependencies?.[dep]) {
      errors.push(`packages/ui/package.json missing dependency ${dep}`)
    }
  }

  for (const script of ['build', 'check', 'test']) {
    if (!packageJson.scripts?.[script]) {
      errors.push(`packages/ui/package.json missing script ${script}`)
    }
  }

  const sideEffects = packageJson.sideEffects ?? []
  if (!sideEffects.some(item => item.includes('css'))) {
    errors.push('packages/ui/package.json must keep css files as side effects')
  }
}

function checkEntrySources(errors: string[]): void {
  const buttonEntry = read('src/button.ts')
  const inputEntry = read('src/input.ts')
  const indexEntry = read('src/index.ts')

  const buttonRequired = [
    "import '@zeus-web/themes/default.css'",
    "import './button.css'",
    "import '@zeus-web/button/wc'",
  ]

  const inputRequired = [
    "import '@zeus-web/themes/default.css'",
    "import './input.css'",
    "import '@zeus-web/input/wc'",
  ]

  for (const item of buttonRequired) {
    if (!buttonEntry.includes(item)) {
      errors.push(`packages/ui/src/button.ts must contain ${item}`)
    }
  }

  for (const item of inputRequired) {
    if (!inputEntry.includes(item)) {
      errors.push(`packages/ui/src/input.ts must contain ${item}`)
    }
  }

  if (!indexEntry.includes("import './button'")) {
    errors.push("packages/ui/src/index.ts must import './button'")
  }

  if (!indexEntry.includes("import './input'")) {
    errors.push("packages/ui/src/index.ts must import './input'")
  }
}

function checkCssSources(errors: string[]): void {
  const stylesCss = read('src/styles.css')
  const buttonCss = read('src/button.css')
  const inputCss = read('src/input.css')

  const stylesRequired = [
    "@import '@zeus-web/themes/default.css'",
    "@import './button.css'",
    "@import './input.css'",
  ]

  for (const item of stylesRequired) {
    if (!stylesCss.includes(item)) {
      errors.push(`packages/ui/src/styles.css must contain ${item}`)
    }
  }

  const buttonRequired = [
    "zw-button [data-slot='button']",
    'zw-button::part(button)',
    "zw-button[variant='primary']::part(button)",
    'hsl(var(--zw-primary))',
    'hsl(var(--zw-primary-foreground))',
    'var(--zw-radius-md)',
  ]

  const inputRequired = [
    "zw-input [data-slot='input']",
    'zw-input::part(input)',
    'hsl(var(--zw-input))',
    'hsl(var(--zw-ring))',
    'var(--zw-radius-md)',
  ]

  for (const item of buttonRequired) {
    if (!buttonCss.includes(item)) {
      errors.push(`packages/ui/src/button.css must contain ${item}`)
    }
  }

  for (const item of inputRequired) {
    if (!inputCss.includes(item)) {
      errors.push(`packages/ui/src/input.css must contain ${item}`)
    }
  }
}

function main(): void {
  const errors: string[] = []

  if (!existsSync(packageRoot)) {
    errors.push('Missing packages/ui package')
  } else {
    for (const file of requiredFiles) {
      assertFileExists(file, errors)
    }

    if (errors.length === 0) {
      checkPackageJson(errors)
      checkEntrySources(errors)
      checkCssSources(errors)
    }
  }

  if (errors.length > 0) {
    console.error(pc.red('@zeus-web/ui package check failed:'))
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log(pc.green('@zeus-web/ui package check passed.'))
}

main()
```

---

# 14. 更新 Phase 15 检查脚本

如果你按上一阶段加了 `scripts/checks/check-product-layers.ts`，它里面可能还要求 roadmap Next work 包含 Phase 16。Phase 16 完成后要改成 Phase 17。

## 替换 `scripts/checks/check-product-layers.ts` 中 roadmap 的 `mustContain`

把 roadmap 相关配置改成：

```ts
{
  path: 'docs/internal/examples/showcase-roadmap.md',
  mustContain: [
    '| Phase 15 | Done | Product layering contract for primitives, themes, native styled Web-C, registry, CLI and showcase usage |',
    '| Phase 16 | Done | Native styled Web-C package with styled button and input entrypoints |',
    'The showcase has nine layers of checks:',
    'Product layer checks validate Zeus-UI package boundaries and usage entry decisions.',
    'Native styled Web-C checks validate @zeus-web/ui package exports, CSS entrypoints and primitive composition.',
    'pnpm check:product-layers',
    'pnpm check:ui-package',
    'Phase 17: Add registry foundation with React and Vue button/input templates.',
  ],
}
```

并把 `checkPhaseOrder` 替换成：

```ts
function checkPhaseOrder(source: string): string[] {
  const errors: string[] = []
  const phase15Index = source.indexOf('| Phase 15 |')
  const phase16Index = source.indexOf('| Phase 16 |')
  const phase17Index = source.indexOf('Phase 17:')

  if (phase15Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 15 status row')
  }

  if (phase16Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 16 status row')
  }

  if (phase17Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 17 next work')
  }

  if (phase15Index >= 0 && phase16Index >= 0 && phase16Index < phase15Index) {
    errors.push('Phase 16 status must appear after Phase 15 status')
  }

  if (phase16Index >= 0 && phase17Index >= 0 && phase17Index < phase16Index) {
    errors.push('Phase 17 next work must appear after Phase 16 status')
  }

  return errors
}
```

---

# 15. 新增设计文档 `docs/internal/design/zeus-ui-native-styled-web-c.md`

````md
# Zeus-UI Native Styled Web-C

## Status

Phase 16 design.

This document defines the native styled Web Component package.

## Package

```txt
@zeus-web/ui
```
````

## Goal

`@zeus-web/ui` provides styled native Web Component entrypoints.

It exists because primitive packages are intentionally headless.

## Non-goals

Phase 16 does not implement:

- React registry templates
- Vue registry templates
- CLI init
- CLI add
- native showcase
- registry synchronization

## Public usage

### Single component entry

```ts
import '@zeus-web/ui/button'
```

```html
<zw-button variant="primary">Save</zw-button>
```

### Aggregate entry

```ts
import '@zeus-web/ui'
```

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

### CSS-only entry

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/button/wc'
import '@zeus-web/input/wc'
```

## Internal composition

```txt
@zeus-web/ui/button
  -> @zeus-web/themes/default.css
  -> ./button.css
  -> @zeus-web/button/wc

@zeus-web/ui/input
  -> @zeus-web/themes/default.css
  -> ./input.css
  -> @zeus-web/input/wc
```

## CSS selector strategy

The CSS must support the current light DOM output and future Shadow DOM output.

Current strategy:

```css
zw-button [data-slot='button'] {
}
zw-input [data-slot='input'] {
}
```

Future-compatible strategy:

```css
zw-button::part(button) {
}
zw-input::part(input) {
}
```

Every styled component should include both selector forms where practical.

## Token strategy

Native styled CSS consumes `@zeus-web/themes` CSS variables.

Examples:

```css
background: hsl(var(--zw-primary));
color: hsl(var(--zw-primary-foreground));
border-color: hsl(var(--zw-border));
border-radius: var(--zw-radius-md);
```

## Package boundary

`@zeus-web/ui` may depend on:

- primitive packages
- `@zeus-web/themes`
- `@zeus-web/icons`

`@zeus-web/ui` must not depend on:

- registry
- CLI
- showcase packages

Primitive packages must not depend on `@zeus-web/ui`.

## Phase 16 scope

Phase 16 includes only:

- button
- input
- aggregate styles
- package contract checks

Additional components should be added in later phases after the pattern is reviewed.

````

---

# 16. 更新 roadmap

## `docs/internal/examples/showcase-roadmap.md`

### Status 表新增 Phase 16

```md
| Phase 16 | Done | Native styled Web-C package with styled button and input entrypoints |
````

### Engineering guarantees 改成 9 层

```md
The showcase has nine layers of checks:

1. Metadata checks validate component metadata coverage.
2. Implementation checks validate that implemented demos have React and Vue files, dependencies and build dependency scripts.
3. Route smoke tests validate that every implemented component route renders in React and Vue.
4. Foundation page tests validate icons, themes and playground interaction behavior.
5. Shared unit tests validate metadata helpers, icon snippets, theme helpers and playground fixtures.
6. Vitest-powered Playwright E2E tests validate React and Vue showcase routes and critical browser interactions.
7. CI gates run showcase metadata, unit tests, builds and browser E2E as separate jobs.
8. Product layer checks validate Zeus-UI package boundaries and usage entry decisions.
9. Native styled Web-C checks validate @zeus-web/ui package exports, CSS entrypoints and primitive composition.
```

### Commands 增加

```bash
pnpm check:ui-package
pnpm --filter @zeus-web/ui build
pnpm --filter @zeus-web/ui check
pnpm --filter @zeus-web/ui test
```

完整 Commands：

````md
## Commands

```bash
pnpm check:product-layers
pnpm check:ui-package
pnpm check:showcase-metadata
pnpm check:showcase-implementation
pnpm --filter @zeus-web/ui build
pnpm --filter @zeus-web/ui check
pnpm --filter @zeus-web/ui test
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

### Next work 改成

```md
## Next work

Future phases should continue with registry and CLI usage:

- Phase 17: Add registry foundation with React and Vue button/input templates.
- Phase 18: Add CLI init command and project configuration.
- Phase 19: Add CLI add command for registry component installation.
- Phase 20: Switch React and Vue showcase to registry-installed styled usage.
- Phase 21: Add native showcase for @zeus-web/ui.
- Phase 22: Rewrite public docs around CLI, native styled Web-C and advanced primitive usage.
````

---

# 17. 文件清单

```txt
package.json
scripts/checks/check-ui-package.ts
scripts/checks/check-product-layers.ts

packages/ui/package.json
packages/ui/tsconfig.json
packages/ui/src/css.d.ts
packages/ui/src/index.ts
packages/ui/src/styles.css
packages/ui/src/button.ts
packages/ui/src/button.css
packages/ui/src/input.ts
packages/ui/src/input.css
packages/ui/scripts/copy-css.mjs
packages/ui/__tests__/ui-package.spec.ts

docs/internal/design/zeus-ui-native-styled-web-c.md
docs/internal/examples/showcase-roadmap.md
```

---

# 18. 验收命令

```bash
pnpm check:ui-package
pnpm --filter @zeus-web/ui check
pnpm --filter @zeus-web/ui build
pnpm --filter @zeus-web/ui test
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

# 19. Phase 16 完成判断

```txt
完成：
  - packages/ui 存在
  - @zeus-web/ui/button 可以注册 primitive button 并加载默认样式
  - @zeus-web/ui/input 可以注册 primitive input 并加载默认样式
  - @zeus-web/ui/styles.css 可以作为聚合 CSS 使用
  - button.css 同时支持 data-slot 和 ::part
  - input.css 同时支持 data-slot 和 ::part
  - check-ui-package 可以阻止 @zeus-web/ui 结构漂移
  - site:check 已接入 check-ui-package
  - roadmap Phase 16 Done

未做：
  - registry
  - CLI
  - native showcase
  - React/Vue showcase 切换
```

---

# 20. 建议分支与 PR

分支名：

```txt
feat/native-styled-ui
```

PR title：

```txt
feat(ui): add native styled Web-C package
```
