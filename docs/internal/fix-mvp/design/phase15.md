下面给 **Phase 15：Zeus-UI Product Layering Contract** 的详细设计与完整代码。

这一阶段不要实现 `@zeus-web/ui`、registry、CLI，也不要继续改 showcase 页面。Phase 15 的唯一目标是：**把 Zeus-UI 的产品分层、使用入口、包边界写成可检查的契约，防止后续 Phase 16+ 再偏路线。**

当前 `fix/mvp` 已经有完整 showcase/test/e2e/CI 脚本，`site:check` 也已经覆盖 metadata、docs、examples、showcase unit tests。 roadmap 已经完成到 Phase 14。 Phase 15 就是在这个基础上补“架构契约”。

---

# Phase 15 目标

```txt
Phase 15 = Product Layering Contract

新增：
  - Zeus-UI 产品分层设计文档
  - 三种使用方式设计文档
  - 包边界设计文档
  - product layer contract check
  - roadmap 标记 Phase 15 Done
  - site:check 接入架构契约检查

不做：
  - 不新增 @zeus-web/ui 包
  - 不新增 registry 包
  - 不新增 CLI init/add
  - 不修改 React/Vue showcase 使用方式
  - 不做 native showcase
```

---

# 1. 修改根 `package.json`

新增脚本：

```json
"check:product-layers": "tsx scripts/checks/check-product-layers.ts"
```

并把 `site:check` 改成包含它。

## 修改后 scripts 片段

```json
{
  "scripts": {
    "check:component-coverage": "tsx scripts/checks/check-component-coverage.ts",
    "check:showcase-metadata": "tsx scripts/checks/check-showcase-metadata.ts",
    "check:showcase-implementation": "tsx scripts/checks/check-showcase-implementation.ts",
    "check:product-layers": "tsx scripts/checks/check-product-layers.ts",
    "site:check": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:product-layers && pnpm docs:check && pnpm docs:build && pnpm examples:check && pnpm showcase:test"
  }
}
```

说明：
Phase 15 是架构契约，所以必须进入 `site:check`。否则后续很容易又把 primitive、styled native、registry、CLI 的边界写乱。

---

# 2. 新增 `docs/internal/design/zeus-ui-product-layers.md`

````md
# Zeus-UI Product Layers

## Status

Phase 15 design contract.

This document defines the product layers of Zeus-UI after the MVP showcase work.

The goal is to prevent the project from collapsing primitive components, styled native Web Components, React / Vue source components and CLI installation into one ambiguous package.

## Final layering

```txt
Zeus
  -> compiler
  -> runtime
  -> Web-C output
  -> React / Vue wrapper output
  -> lazy registration

Zeus-UI primitives
  -> headless behavior
  -> accessibility states
  -> events
  -> stable data attributes
  -> stable part names
  -> Web-C / React / Vue primitive wrappers

Zeus-UI themes
  -> CSS variables
  -> semantic tokens
  -> theme presets
  -> native CSS consumption
  -> Tailwind token consumption

Zeus-UI native styled Web-C
  -> @zeus-web/ui
  -> styled Web Component distribution
  -> ready-to-use native HTML / micro frontend usage

Zeus-UI registry
  -> React source templates
  -> Vue source templates
  -> CSS globals
  -> cn utility
  -> component metadata

Zeus-UI CLI
  -> init
  -> add
  -> update
  -> diff
  -> install registry files into user projects

Showcase
  -> verifies real usage
  -> React / Vue showcase should eventually consume registry-installed styled components
  -> Native showcase should consume @zeus-web/ui
```
````

## Layer 1: Zeus

Zeus is the infrastructure layer.

It owns:

- compiler
- runtime
- Web-C output
- React wrapper output
- Vue wrapper output
- lazy registration
- component analyzer
- dts generation

Zeus must not own Zeus-UI product styles.

## Layer 2: primitives

Primitive packages are headless behavior packages.

Examples:

```txt
@zeus-web/button
@zeus-web/input
@zeus-web/dialog
@zeus-web/select
```

Primitive packages may expose:

```txt
@zeus-web/button/wc
@zeus-web/button/react
@zeus-web/button/vue
```

Primitive packages should provide:

- behavior
- accessibility attributes
- keyboard interaction
- stable events
- stable attributes
- stable `data-slot`
- stable `data-state`
- stable `data-variant`
- stable `data-size`
- stable `part`

Primitive packages should not provide:

- full product visual design
- Tailwind-based final styles
- theme preset ownership
- shadcn-like source ownership

A primitive package may include only minimal reset styles when needed, for example:

```css
:host {
  display: inline-block;
}

button,
input {
  font: inherit;
}
```

It should not include final visual styles such as primary backgrounds, radius systems, hover colors, dark mode or product spacing.

## Layer 3: themes

The theme package owns design tokens.

Example package:

```txt
@zeus-web/themes
```

It should provide:

- token CSS files
- theme preset CSS files
- semantic CSS variables
- optional helper metadata

It should not own framework-specific component wrappers.

Tokens should be framework-agnostic:

```css
:root {
  --zeus-primary: 222 47% 11%;
  --zeus-primary-foreground: 210 40% 98%;
  --zeus-radius-md: 0.375rem;
}
```

Tailwind should consume tokens.

Native CSS should also consume tokens.

## Layer 4: native styled Web-C

Native styled Web-C is the default styled entry for native HTML, micro frontend and no-framework usage.

Example package:

```txt
@zeus-web/ui
```

Native styled Web-C should provide:

```txt
@zeus-web/ui/styles.css
@zeus-web/ui/button
@zeus-web/ui/button.css
@zeus-web/ui/input
@zeus-web/ui/input.css
```

Usage:

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

This usage must be styled by default.

Native styled Web-C must not reimplement behavior. It should compose primitive Web-C packages and CSS.

## Layer 5: registry

The registry is the shadcn-like source template layer.

It should provide:

- React component templates
- Vue component templates
- CSS globals
- utility templates
- metadata
- dependency declarations

The registry is not the runtime package consumed directly by applications.

The registry is consumed by the CLI.

Example future structure:

```txt
packages/registry/
  registry.json
  react/button.tsx
  vue/button.vue
  css/globals.css
  lib/cn.ts
```

## Layer 6: CLI

The CLI is the recommended React / Vue user entry.

Commands:

```bash
zeus-web init
zeus-web add button input dialog
zeus-web diff button
zeus-web update button
```

The CLI should install source files into the user project.

React / Vue users should not be required to import primitive wrappers directly for normal product usage.

Recommended React usage:

```tsx
import { Button } from '@/components/ui/button'
```

Recommended Vue usage:

```vue
<script setup lang="ts">
import Button from '@/components/ui/button.vue'
</script>
```

## Layer 7: showcase

The showcase verifies usage models.

Current showcase verifies primitives and foundation pages.

Future showcase should verify:

- React registry-installed styled usage
- Vue registry-installed styled usage
- native styled Web-C usage
- primitive advanced usage only as a secondary path

## Public entry policy

Recommended public entries:

| User type                 | Entry                             | Styled by default | Source owned by user |
| ------------------------- | --------------------------------- | ----------------- | -------------------- |
| React application         | `zeus-web add button`             | Yes               | Yes                  |
| Vue application           | `zeus-web add button`             | Yes               | Yes                  |
| Native Web Component user | `@zeus-web/ui/button`             | Yes               | No                   |
| Design system author      | `@zeus-web/button/react` or `/wc` | No                | No                   |

## Non-goals

Phase 15 does not implement:

- `@zeus-web/ui`
- `@zeus-web/registry`
- `@zeus-web/cli`
- native showcase
- registry showcase sync

Those belong to later phases.

## Decisions

1. Keep primitives headless.
2. Add styled native Web-C as a separate `@zeus-web/ui` layer later.
3. Add React / Vue source registry as a separate layer later.
4. Use CLI as the recommended React / Vue product entry later.
5. Do not make primitive packages the default styled user experience.

````

---

# 3. 新增 `docs/internal/design/zeus-ui-usage-model.md`

```md
# Zeus-UI Usage Model

## Status

Phase 15 design contract.

This document defines the intended usage model for Zeus-UI.

## Summary

Zeus-UI supports three official usage paths:

```txt
1. React / Vue application usage
   -> use CLI
   -> source components installed into the project

2. Native Web Component usage
   -> use @zeus-web/ui
   -> styled Web Components

3. Advanced primitive usage
   -> use @zeus-web/<component>
   -> headless behavior and wrappers
````

The default user experience should not be headless.

## React usage

Recommended future usage:

```bash
pnpm dlx zeus-web init
pnpm dlx zeus-web add button input dialog
```

Application code:

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginForm() {
  return (
    <form>
      <Input placeholder="Email" />
      <Button variant="primary">Sign in</Button>
    </form>
  )
}
```

The installed source component may internally use primitive wrappers:

```tsx
import { Button as ButtonPrimitive } from '@zeus-web/button/react'
```

But the application should import from its local `components/ui` path.

## Vue usage

Recommended future usage:

```bash
pnpm dlx zeus-web init
pnpm dlx zeus-web add button input dialog
```

Application code:

```vue
<script setup lang="ts">
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
</script>

<template>
  <form>
    <Input placeholder="Email" />
    <Button variant="primary">Sign in</Button>
  </form>
</template>
```

## Native Web Component usage

Recommended future usage:

```bash
pnpm add @zeus-web/ui
```

Application code:

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

HTML:

```html
<zw-input placeholder="Email"></zw-input>
<zw-button variant="primary">Sign in</zw-button>
```

Native usage must be styled by default.

## Advanced primitive usage

Advanced users may import primitives directly.

```ts
import '@zeus-web/button/wc'
```

```html
<zw-button>Custom styled button</zw-button>
```

or:

```tsx
import { Button } from '@zeus-web/button/react'
```

This path is for:

- design system authors
- users who want full style ownership
- users who do not want Zeus-UI product styles
- integration tests
- low-level wrapper validation

Primitive usage is not the recommended application-level styled path.

## Styling model

### React / Vue

React / Vue styled components are installed as source files.

The source files contain Tailwind classes, so Tailwind content scanning can see them in the user project.

Do not require users to scan `node_modules` for Tailwind classes.

### Native Web Components

Native styled Web-C uses plain CSS and CSS variables.

It must not depend on Tailwind runtime scanning.

### Themes

Both React / Vue registry templates and native styled Web-C should consume the same CSS variables.

Example token:

```css
--zeus-primary: 222 47% 11%;
```

React / Vue templates may use Tailwind classes that map to the token.

Native Web-C CSS may use:

```css
background: hsl(var(--zeus-primary));
```

## Install model

### `init`

Future CLI `init` should:

- detect framework
- detect TypeScript
- detect package manager
- create `zeus-ui.json`
- create `cn` utility
- create global CSS token file
- optionally update Tailwind config

### `add`

Future CLI `add` should:

- read `zeus-ui.json`
- resolve registry items
- copy component source files
- install primitive package dependencies
- preserve user modifications by default
- support `--overwrite`
- support `--dry-run`

## Documentation model

Documentation should start with recommended usage:

1. React / Vue CLI usage
2. Native styled Web-C usage
3. Advanced primitive usage

Primitive imports should not be the first path shown to normal React / Vue users.

## Showcase model

Current React / Vue showcase can keep primitive usage until registry exists.

After registry exists, React / Vue showcase should switch to local `components/ui` imports that match CLI output.

A future native showcase should verify:

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/ui/button'
```

## Non-goals

This phase does not implement CLI behavior.

This phase only locks the intended usage model.

````

---

# 4. 新增 `docs/internal/design/zeus-ui-package-boundaries.md`

```md
# Zeus-UI Package Boundaries

## Status

Phase 15 design contract.

This document defines package responsibilities and forbidden dependencies.

## Package map

```txt
@zeus-web/<primitive>
  -> primitive behavior package

@zeus-web/themes
  -> token and theme package

@zeus-web/icons
  -> icon source and framework outputs

@zeus-web/ui
  -> future native styled Web-C package

@zeus-web/registry
  -> future source template registry

@zeus-web/cli or zeus-web
  -> future CLI
````

## Primitive packages

Examples:

```txt
@zeus-web/button
@zeus-web/input
@zeus-web/dialog
```

Allowed responsibilities:

- Web-C implementation
- React primitive wrapper
- Vue primitive wrapper
- types
- events
- methods
- accessibility states
- slots
- stable `data-*`
- stable `part`

Forbidden responsibilities:

- final design system styles
- Tailwind-only final styles
- registry templates
- CLI logic
- global theme ownership

Allowed dependencies:

```txt
@zeus-js/*
@zeus-web/themes only if used for type-safe token metadata, not required runtime style
```

Primitive packages should avoid depending on `@zeus-web/ui`, `@zeus-web/registry` or CLI packages.

## Themes package

Package:

```txt
@zeus-web/themes
```

Allowed responsibilities:

- CSS variables
- theme presets
- semantic tokens
- radius tokens
- motion tokens
- helper metadata

Forbidden responsibilities:

- component behavior
- CLI commands
- React / Vue component templates
- Web-C registration

Allowed consumers:

- `@zeus-web/ui`
- registry templates
- docs
- showcase
- user applications

## Icons package

Package:

```txt
@zeus-web/icons
```

Allowed responsibilities:

- raw SVG
- React icon output
- Vue icon output
- Web Component icon output
- metadata

Forbidden responsibilities:

- button/input component styling
- CLI registry installation logic

## Native styled Web-C package

Future package:

```txt
@zeus-web/ui
```

Allowed responsibilities:

- compose primitive `/wc` entries
- provide styled CSS
- provide `styles.css`
- provide per-component CSS
- provide native styled entrypoints

Example exports:

```txt
@zeus-web/ui/styles.css
@zeus-web/ui/button
@zeus-web/ui/button.css
@zeus-web/ui/input
@zeus-web/ui/input.css
```

Allowed dependencies:

```txt
@zeus-web/<primitive>
@zeus-web/themes
@zeus-web/icons
```

Forbidden responsibilities:

- React source registry templates
- Vue source registry templates
- CLI file writing
- reimplementing primitive behavior

## Registry package

Future package:

```txt
@zeus-web/registry
```

Allowed responsibilities:

- registry metadata
- React source templates
- Vue source templates
- CSS global templates
- utility templates
- dependency metadata

Forbidden responsibilities:

- running CLI commands
- defining Web-C behavior
- replacing primitive packages
- requiring runtime dependency from user code

The registry is data and templates.

## CLI package

Future package:

```txt
zeus-web
```

Allowed responsibilities:

- project detection
- `init`
- `add`
- `diff`
- `update`
- dependency installation
- file writes
- dry-run
- overwrite handling

Forbidden responsibilities:

- component runtime behavior
- primitive implementation
- theme token ownership

## Dependency direction

Allowed direction:

```txt
primitives -> Zeus
ui -> primitives + themes
registry -> primitive package names + template files
cli -> registry
showcase -> registry output or primitives during transition
docs -> all public APIs
```

Forbidden direction:

```txt
primitives -> ui
primitives -> registry
primitives -> cli
themes -> ui
themes -> cli
registry -> cli
```

## Public import guidance

Recommended application-level imports:

### React / Vue

```tsx
import { Button } from '@/components/ui/button'
```

Generated by CLI.

### Native

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/ui/button'
```

### Advanced primitive

```tsx
import { Button } from '@zeus-web/button/react'
```

or:

```ts
import '@zeus-web/button/wc'
```

## Compatibility policy

Primitive APIs should be more stable than styled templates.

Registry templates are user-owned once installed.

Native styled Web-C CSS can evolve with semver.

## Phase boundaries

### Phase 15

Define this package boundary contract.

### Phase 16

Introduce `@zeus-web/ui` for button and input.

### Phase 17

Introduce registry metadata and button/input templates.

### Phase 18

Introduce CLI `init`.

### Phase 19

Introduce CLI `add`.

### Phase 20

Switch React / Vue showcase to registry-installed styled usage.

````

---

# 5. 新增检查脚本 `scripts/checks/check-product-layers.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

interface RequiredDoc {
  path: string
  mustContain: string[]
}

const root = process.cwd()

const docs: RequiredDoc[] = [
  {
    path: 'docs/internal/design/zeus-ui-product-layers.md',
    mustContain: [
      '# Zeus-UI Product Layers',
      'Zeus-UI primitives',
      'Zeus-UI themes',
      'Zeus-UI native styled Web-C',
      'Zeus-UI registry',
      'Zeus-UI CLI',
      '@zeus-web/ui',
      '@zeus-web/registry',
      'Keep primitives headless',
      'Do not make primitive packages the default styled user experience',
    ],
  },
  {
    path: 'docs/internal/design/zeus-ui-usage-model.md',
    mustContain: [
      '# Zeus-UI Usage Model',
      'React / Vue application usage',
      'Native Web Component usage',
      'Advanced primitive usage',
      'pnpm dlx zeus-web init',
      'pnpm dlx zeus-web add button input dialog',
      "import '@zeus-web/ui/styles.css'",
      "import '@zeus-web/ui/button'",
      "import { Button } from '@/components/ui/button'",
      "import { Button } from '@zeus-web/button/react'",
      "import '@zeus-web/button/wc'",
    ],
  },
  {
    path: 'docs/internal/design/zeus-ui-package-boundaries.md',
    mustContain: [
      '# Zeus-UI Package Boundaries',
      '@zeus-web/<primitive>',
      '@zeus-web/themes',
      '@zeus-web/ui',
      '@zeus-web/registry',
      'zeus-web',
      'Primitive packages should avoid depending on `@zeus-web/ui`, `@zeus-web/registry` or CLI packages.',
      'Forbidden direction',
      'primitives -> ui',
      'primitives -> registry',
      'primitives -> cli',
    ],
  },
  {
    path: 'docs/internal/examples/showcase-roadmap.md',
    mustContain: [
      '| Phase 15 | Done | Product layering contract for primitives, themes, native styled Web-C, registry, CLI and showcase usage |',
      'The showcase has eight layers of checks:',
      'Product layer checks validate Zeus-UI package boundaries and usage entry decisions.',
      'pnpm check:product-layers',
      'Phase 16: Add @zeus-web/ui native styled Web-C package for button and input.',
    ],
  },
]

const forbiddenDocsPatterns = [
  {
    pattern: 'Delete headless primitives',
    message: 'docs must not suggest deleting headless primitives',
  },
  {
    pattern: 'Primitive packages own final product styles',
    message: 'primitive packages must not own final product styles',
  },
  {
    pattern: 'React users should import primitive wrappers by default',
    message: 'React default usage must be CLI registry output, not primitive wrappers',
  },
  {
    pattern: 'Vue users should import primitive wrappers by default',
    message: 'Vue default usage must be CLI registry output, not primitive wrappers',
  },
]

function filePath(relativePath: string): string {
  return resolve(root, relativePath)
}

function readRequiredFile(relativePath: string, errors: string[]): string | null {
  const absolutePath = filePath(relativePath)

  if (!existsSync(absolutePath)) {
    errors.push(`Missing required product layer document: ${relativePath}`)
    return null
  }

  return readFileSync(absolutePath, 'utf-8')
}

function checkMustContain(doc: RequiredDoc, source: string): string[] {
  const errors: string[] = []

  for (const text of doc.mustContain) {
    if (!source.includes(text)) {
      errors.push(`${doc.path} must contain "${text}"`)
    }
  }

  return errors
}

function checkForbiddenPatterns(path: string, source: string): string[] {
  const errors: string[] = []

  for (const item of forbiddenDocsPatterns) {
    if (source.includes(item.pattern)) {
      errors.push(`${path}: ${item.message}`)
    }
  }

  return errors
}

function checkPhaseOrder(source: string): string[] {
  const errors: string[] = []
  const phase15Index = source.indexOf('| Phase 15 |')
  const phase16Index = source.indexOf('Phase 16:')

  if (phase15Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 15 status row')
  }

  if (phase16Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 16 next work')
  }

  if (phase15Index >= 0 && phase16Index >= 0 && phase16Index < phase15Index) {
    errors.push('Phase 16 next work must appear after Phase 15 status')
  }

  return errors
}

function main(): void {
  const errors: string[] = []

  for (const doc of docs) {
    const source = readRequiredFile(doc.path, errors)
    if (!source) continue

    errors.push(...checkMustContain(doc, source))
    errors.push(...checkForbiddenPatterns(doc.path, source))

    if (doc.path === 'docs/internal/examples/showcase-roadmap.md') {
      errors.push(...checkPhaseOrder(source))
    }
  }

  if (errors.length > 0) {
    console.error(pc.red('Product layer contract check failed:'))
    for (const error of errors) console.error(`- ${error}`)
    process.exit(1)
  }

  console.log(pc.green('Product layer contract check passed.'))
}

main()
````

---

# 6. 修改 roadmap

## `docs/internal/examples/showcase-roadmap.md`

### Status 表追加 Phase 15

在 Phase 14 后面追加：

```md
| Phase 15 | Done | Product layering contract for primitives, themes, native styled Web-C, registry, CLI and showcase usage |
```

### Engineering guarantees 改成 8 层

替换当前这一段：

```md
The showcase has seven layers of checks:
```

为：

```md
The showcase has eight layers of checks:

1. Metadata checks validate component metadata coverage.
2. Implementation checks validate that implemented demos have React and Vue files, dependencies and build dependency scripts.
3. Route smoke tests validate that every implemented component route renders in React and Vue.
4. Foundation page tests validate icons, themes and playground interaction behavior.
5. Shared unit tests validate metadata helpers, icon snippets, theme helpers and playground fixtures.
6. Vitest-powered Playwright E2E tests validate React and Vue showcase routes and critical browser interactions.
7. CI gates run showcase metadata, unit tests, builds and browser E2E as separate jobs.
8. Product layer checks validate Zeus-UI package boundaries and usage entry decisions.
```

### Commands 增加

```bash
pnpm check:product-layers
```

完整 Commands：

````md
## Commands

```bash
pnpm check:product-layers
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

### Next work 改成产品化路线

替换当前 Next work：

```md
## Next work

Future phases should continue with product usage and distribution quality:

- Phase 16: Add @zeus-web/ui native styled Web-C package for button and input.
- Phase 17: Add registry foundation with React and Vue button/input templates.
- Phase 18: Add CLI init command and project configuration.
- Phase 19: Add CLI add command for registry component installation.
- Phase 20: Switch React and Vue showcase to registry-installed styled usage.
- Phase 21: Add native showcase for @zeus-web/ui.
- Phase 22: Rewrite public docs around CLI, native styled Web-C and advanced primitive usage.
````

---

# 7. Phase 15 文件清单

```txt
package.json
scripts/checks/check-product-layers.ts
docs/internal/design/zeus-ui-product-layers.md
docs/internal/design/zeus-ui-usage-model.md
docs/internal/design/zeus-ui-package-boundaries.md
docs/internal/examples/showcase-roadmap.md
```

---

# 8. 验收命令

```bash
pnpm check:product-layers
pnpm site:check
pnpm showcase:ci
```

完整合并前：

```bash
pnpm check
pnpm build
pnpm site:check
pnpm showcase:ci
pnpm release:verify --allow-zero
```

---

# 9. Phase 15 完成判断

```txt
完成：
  - product layers 文档存在
  - usage model 文档存在
  - package boundaries 文档存在
  - check-product-layers.ts 存在
  - package.json 有 check:product-layers
  - site:check 接入 check:product-layers
  - roadmap 标记 Phase 15 Done
  - roadmap Next work 改成 Phase 16–22 产品化路线

未做：
  - 没有新增 @zeus-web/ui
  - 没有新增 registry
  - 没有新增 cli
  - 没有改 showcase 消费方式
```

---

# 10. 建议分支与 PR

分支名：

```txt
docs/product-layer-contract
```

PR title：

```txt
docs(examples): define Zeus UI product layering contract
```

这个 Phase 15 的意义是：先把“primitive 不是最终用户主入口、native 要有 styled Web-C、React/Vue 要走 CLI registry”写成工程契约，并让 CI 能检查。后面 Phase 16 再开始真正做 `@zeus-web/ui`。
