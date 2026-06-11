下面给 **Phase 14：Icons 生态** 的详细设计与完整代码。

这阶段按原路线不是继续做普通组件，而是做：

```txt
Phase 14：Icons 生态

目标：
  1. 新增 @zeus-web/icons 包。
  2. 使用 @zeus-js/output-icons 生成 React / Vue / WC / raw SVG。
  3. 提供 icon manifest、类型、搜索能力。
  4. CLI 增加 zweb icon list / search / show。
  5. AI metadata 增加 icons 使用规则。
  6. docs 增加 icons 文档。
```

当前仓库已经具备基础条件：

- `pnpm-workspace.yaml` 已包含 `packages/*`，所以新增 `packages/icons` 会自动进入 workspace。
- 根 `package.json` 已经依赖 `@zeus-js/output-icons`，版本为 `0.1.0-beta.5`。
- `@zeus-js/output-icons` 本身会生成 React、Vue、WC、SVG 和 dts 产物。
- `output-icons` 默认支持 `react/vue/wc/svg/dts`，并且 WC 默认 tagPrefix 是 `z-icon-`，这里我们会改成 `zw-icon-`。

---

# Phase 14 最终产物

```txt
@zeus-web/icons
  ├── .
  │   └── icon metadata / manifest helpers
  ├── ./react
  │   └── IconCheck / IconX / IconSearch ...
  ├── ./vue
  │   └── IconCheck / IconX / IconSearch ...
  ├── ./wc
  │   └── <zw-icon-check> / <zw-icon-x> ...
  ├── ./svg/check.svg
  └── ./manifest.json
```

使用方式：

```tsx
import { IconCheck, IconSearch } from '@zeus-web/icons/react'

export function Demo() {
  return (
    <button>
      <IconSearch aria-hidden />
      Search
    </button>
  )
}
```

Web Component：

```ts
import '@zeus-web/icons/wc'
```

```html
<zw-icon-check aria-hidden="true"></zw-icon-check>
```

Raw SVG：

```ts
import checkSvgUrl from '@zeus-web/icons/svg/check.svg'
```

---

# 1. 新增 `packages/icons/package.json`

```json
{
  "name": "@zeus-web/icons",
  "type": "module",
  "version": "0.0.0",
  "description": "Multi-framework icon set for Zeus Web.",
  "license": "MIT",
  "sideEffects": ["./dist/wc/index.js", "./dist/wc/*.js"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "import": "./dist/react/index.js"
    },
    "./vue": {
      "types": "./dist/vue/index.d.ts",
      "import": "./dist/vue/index.js"
    },
    "./wc": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./manifest.json": {
      "default": "./dist/manifest.json"
    },
    "./svg/*": {
      "default": "./dist/svg/*.svg"
    }
  },
  "files": ["dist"],
  "scripts": {
    "dev": "pnpm run build -- --watch",
    "build": "rimraf dist && tsup src/index.ts --format esm --dts --clean && tsx scripts/build-icons.ts",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../.. --project unit packages/icons/__tests__/icons.spec.ts"
  },
  "peerDependencies": {
    "react": ">=18 || >=19",
    "vue": ">=3"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    },
    "vue": {
      "optional": true
    }
  },
  "dependencies": {
    "@zeus-js/output-icons": "0.1.0-beta.5"
  }
}
```

---

# 2. 新增 `packages/icons/tsconfig.json`

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

# 3. 新增 `packages/icons/src/icons.ts`

第一批不要贪多，先做 24 个基础图标，覆盖组件库常用场景。

```ts
import type { IconSource } from '@zeus-js/output-icons'

export interface ZeusWebIconMeta {
  name: ZeusWebIconName
  title: string
  category: 'action' | 'navigation' | 'status' | 'theme' | 'media'
  tags: string[]
}

export const iconSources = [
  {
    name: 'check',
    title: 'Check',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  },
  {
    name: 'x',
    title: 'X',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
  },
  {
    name: 'plus',
    title: 'Plus',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
  },
  {
    name: 'minus',
    title: 'Minus',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>`,
  },
  {
    name: 'chevron-down',
    title: 'Chevron Down',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
  },
  {
    name: 'chevron-up',
    title: 'Chevron Up',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`,
  },
  {
    name: 'chevron-left',
    title: 'Chevron Left',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
  },
  {
    name: 'chevron-right',
    title: 'Chevron Right',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
  },
  {
    name: 'search',
    title: 'Search',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  },
  {
    name: 'menu',
    title: 'Menu',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>`,
  },
  {
    name: 'settings',
    title: 'Settings',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  },
  {
    name: 'user',
    title: 'User',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21a7 7 0 0 0-14 0"/><circle cx="12" cy="7" r="4"/></svg>`,
  },
  {
    name: 'copy',
    title: 'Copy',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  },
  {
    name: 'external-link',
    title: 'External Link',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`,
  },
  {
    name: 'info',
    title: 'Info',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  },
  {
    name: 'alert-triangle',
    title: 'Alert Triangle',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  },
  {
    name: 'circle-check',
    title: 'Circle Check',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  },
  {
    name: 'circle-x',
    title: 'Circle X',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`,
  },
  {
    name: 'loader',
    title: 'Loader',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>`,
  },
  {
    name: 'sun',
    title: 'Sun',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  },
  {
    name: 'moon',
    title: 'Moon',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  },
  {
    name: 'eye',
    title: 'Eye',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.06 12.35a11 11 0 0 1 19.88 0 11 11 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>`,
  },
  {
    name: 'eye-off',
    title: 'Eye Off',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 2 20 20"/><path d="M10.58 10.58A2 2 0 0 0 13.42 13.42"/><path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a16.2 16.2 0 0 1-3.04 4.31"/><path d="M6.61 6.61A16.6 16.6 0 0 0 2 12s3 8 10 8a10.9 10.9 0 0 0 5.39-1.39"/></svg>`,
  },
  {
    name: 'trash',
    title: 'Trash',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`,
  },
] as const satisfies readonly IconSource[]

export type ZeusWebIconName = (typeof iconSources)[number]['name']

export const iconNames = iconSources.map(icon => icon.name) as ZeusWebIconName[]

export const iconMetadata: Record<ZeusWebIconName, ZeusWebIconMeta> = {
  check: {
    name: 'check',
    title: 'Check',
    category: 'status',
    tags: ['check', 'confirm', 'success'],
  },
  x: {
    name: 'x',
    title: 'X',
    category: 'action',
    tags: ['close', 'dismiss', 'remove'],
  },
  plus: {
    name: 'plus',
    title: 'Plus',
    category: 'action',
    tags: ['add', 'create', 'new'],
  },
  minus: {
    name: 'minus',
    title: 'Minus',
    category: 'action',
    tags: ['remove', 'collapse'],
  },
  'chevron-down': {
    name: 'chevron-down',
    title: 'Chevron Down',
    category: 'navigation',
    tags: ['arrow', 'down', 'select'],
  },
  'chevron-up': {
    name: 'chevron-up',
    title: 'Chevron Up',
    category: 'navigation',
    tags: ['arrow', 'up'],
  },
  'chevron-left': {
    name: 'chevron-left',
    title: 'Chevron Left',
    category: 'navigation',
    tags: ['arrow', 'left', 'previous'],
  },
  'chevron-right': {
    name: 'chevron-right',
    title: 'Chevron Right',
    category: 'navigation',
    tags: ['arrow', 'right', 'next'],
  },
  search: {
    name: 'search',
    title: 'Search',
    category: 'action',
    tags: ['find', 'filter'],
  },
  menu: {
    name: 'menu',
    title: 'Menu',
    category: 'navigation',
    tags: ['hamburger', 'nav'],
  },
  settings: {
    name: 'settings',
    title: 'Settings',
    category: 'action',
    tags: ['config', 'preferences'],
  },
  user: {
    name: 'user',
    title: 'User',
    category: 'action',
    tags: ['account', 'profile'],
  },
  copy: {
    name: 'copy',
    title: 'Copy',
    category: 'action',
    tags: ['clipboard', 'duplicate'],
  },
  'external-link': {
    name: 'external-link',
    title: 'External Link',
    category: 'navigation',
    tags: ['open', 'link'],
  },
  info: {
    name: 'info',
    title: 'Info',
    category: 'status',
    tags: ['help', 'information'],
  },
  'alert-triangle': {
    name: 'alert-triangle',
    title: 'Alert Triangle',
    category: 'status',
    tags: ['warning', 'error'],
  },
  'circle-check': {
    name: 'circle-check',
    title: 'Circle Check',
    category: 'status',
    tags: ['success', 'done'],
  },
  'circle-x': {
    name: 'circle-x',
    title: 'Circle X',
    category: 'status',
    tags: ['error', 'failed'],
  },
  loader: {
    name: 'loader',
    title: 'Loader',
    category: 'status',
    tags: ['loading', 'spinner'],
  },
  sun: {
    name: 'sun',
    title: 'Sun',
    category: 'theme',
    tags: ['light', 'theme'],
  },
  moon: {
    name: 'moon',
    title: 'Moon',
    category: 'theme',
    tags: ['dark', 'theme'],
  },
  eye: {
    name: 'eye',
    title: 'Eye',
    category: 'media',
    tags: ['visible', 'show'],
  },
  'eye-off': {
    name: 'eye-off',
    title: 'Eye Off',
    category: 'media',
    tags: ['hidden', 'hide'],
  },
  trash: {
    name: 'trash',
    title: 'Trash',
    category: 'action',
    tags: ['delete', 'remove'],
  },
}

export const iconsManifest = {
  packageName: '@zeus-web/icons',
  count: iconSources.length,
  names: iconNames,
  icons: iconNames.map(name => iconMetadata[name]),
} as const

export function isIconName(value: string): value is ZeusWebIconName {
  return (iconNames as readonly string[]).includes(value)
}

export function searchIcons(query: string): ZeusWebIconMeta[] {
  const normalized = query.trim().toLowerCase()

  if (!normalized) {
    return iconNames.map(name => iconMetadata[name])
  }

  return iconNames
    .map(name => iconMetadata[name])
    .filter(icon => {
      return (
        icon.name.includes(normalized) ||
        icon.title.toLowerCase().includes(normalized) ||
        icon.tags.some(tag => tag.includes(normalized))
      )
    })
}
```

---

# 4. 新增 `packages/icons/src/index.ts`

```ts
export {
  iconMetadata,
  iconNames,
  iconsManifest,
  iconSources,
  isIconName,
  searchIcons,
} from './icons'

export type { ZeusWebIconMeta, ZeusWebIconName } from './icons'
```

---

# 5. 新增 `packages/icons/scripts/build-icons.ts`

这里直接调用 `@zeus-js/output-icons`，不手写 React/Vue/WC wrapper。

```ts
import type { ZeusOutputFile, ZeusVirtualModule } from '@zeus-js/bundler-plugin'

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import icons from '@zeus-js/output-icons'

import { iconsManifest, iconSources } from '../src/icons'

const root = process.cwd()
const outDir = resolve(root, 'dist')

function normalizeOutputPath(fileName: string): string {
  return fileName.replace(/^\.\//, '')
}

async function writeOutput(fileName: string, source: string | Uint8Array) {
  const target = resolve(outDir, normalizeOutputPath(fileName))

  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, source)
}

async function writeVirtualModules(modules: ZeusVirtualModule[]) {
  for (const module of modules) {
    await writeOutput(module.fileName, module.code)
  }
}

async function writeOutputFiles(files: ZeusOutputFile[]) {
  for (const file of files) {
    if (file.type !== 'asset') continue

    await writeOutput(file.fileName, file.source)
  }
}

async function main() {
  const plugin = icons({
    icons: [...iconSources],
    outDir: '.',
    react: {
      outDir: 'react',
    },
    vue: {
      outDir: 'vue',
    },
    wc: {
      outDir: 'wc',
      tagPrefix: 'zw-icon-',
    },
    svg: true,
    dts: true,
  })

  const modules = plugin.virtualModules?.() ?? []
  const files = plugin.generateBundle?.() ?? []

  await writeVirtualModules(modules)
  await writeOutputFiles(files)

  await writeOutput(
    'manifest.json',
    `${JSON.stringify(iconsManifest, null, 2)}\n`,
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
```

---

# 6. 新增 `packages/icons/__tests__/icons.spec.ts`

```ts
import {
  iconMetadata,
  iconNames,
  iconSources,
  isIconName,
  searchIcons,
} from '../src'

describe('@zeus-web/icons', () => {
  it('exports icon names', () => {
    expect(iconNames.length).toBeGreaterThanOrEqual(20)
    expect(iconNames).toContain('check')
    expect(iconNames).toContain('x')
    expect(iconNames).toContain('search')
    expect(iconNames).toContain('chevron-down')
  })

  it('keeps icon names unique', () => {
    expect(new Set(iconNames).size).toBe(iconNames.length)
  })

  it('keeps metadata aligned with icon sources', () => {
    for (const icon of iconSources) {
      expect(iconMetadata[icon.name]).toBeDefined()
      expect(iconMetadata[icon.name].name).toBe(icon.name)
    }
  })

  it('uses currentColor and viewBox for all icons', () => {
    for (const icon of iconSources) {
      expect(icon.svg).toContain('viewBox="0 0 24 24"')
      expect(icon.svg).toContain('currentColor')
    }
  })

  it('checks icon name guard', () => {
    expect(isIconName('check')).toBe(true)
    expect(isIconName('unknown')).toBe(false)
  })

  it('searches icons by name, title, and tags', () => {
    expect(searchIcons('check').map(icon => icon.name)).toContain('check')
    expect(searchIcons('warning').map(icon => icon.name)).toContain(
      'alert-triangle',
    )
    expect(searchIcons('theme').map(icon => icon.name)).toEqual(
      expect.arrayContaining(['sun', 'moon']),
    )
  })
})
```

---

# 7. 修改 `packages/cli/package.json`

增加 `@zeus-web/icons` 依赖：

```json
{
  "dependencies": {
    "@zeus-web/ai": "workspace:*",
    "@zeus-web/icons": "workspace:*",
    "@zeus-web/registry": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "execa": "^9.6.1",
    "picocolors": "^1.1.1"
  }
}
```

把 test script 追加 `phase14-icons.spec.ts`：

```json
{
  "scripts": {
    "test": "vitest --root ../.. --project unit packages/cli/__tests__/add.spec.ts packages/cli/__tests__/ai.spec.ts packages/cli/__tests__/config.spec.ts packages/cli/__tests__/init.spec.ts packages/cli/__tests__/package-manager.spec.ts packages/cli/__tests__/phase12-cli.spec.ts packages/cli/__tests__/phase13-theme.spec.ts packages/cli/__tests__/phase14-icons.spec.ts"
  }
}
```

---

# 8. 新增 `packages/cli/src/commands/icon.ts`

```ts
import type { ZeusWebIconName } from '@zeus-web/icons'

import {
  iconMetadata,
  iconNames,
  isIconName,
  searchIcons,
} from '@zeus-web/icons'
import pc from 'picocolors'

type IconSubcommand = 'list' | 'search' | 'show'

interface IconOptions {
  json: boolean
}

function parseIconOptions(args: string[]): {
  positional: string[]
  options: IconOptions
} {
  const positional: string[] = []
  const options: IconOptions = {
    json: false,
  }

  for (const arg of args) {
    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }

    positional.push(arg)
  }

  return {
    positional,
    options,
  }
}

function printIconUsage() {
  console.log(`\n${pc.bold('zweb icon')} - Zeus Web icon helper\n`)
  console.log('Usage:')
  console.log('  zweb icon list')
  console.log('  zweb icon list --json')
  console.log('  zweb icon search check')
  console.log('  zweb icon show check')
}

function printIconTable(names: readonly ZeusWebIconName[]) {
  for (const name of names) {
    const icon = iconMetadata[name]
    console.log(`  ${pc.cyan(icon.name.padEnd(18))} ${icon.title}`)
  }
}

async function iconList(args: string[]): Promise<void> {
  const { options } = parseIconOptions(args)

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          icons: iconNames.map(name => iconMetadata[name]),
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(pc.bold('Available icons:'))
  printIconTable(iconNames)
}

async function iconSearch(args: string[]): Promise<void> {
  const { positional, options } = parseIconOptions(args)
  const query = positional.join(' ').trim()

  if (!query) {
    throw new Error('zweb icon search requires a query.')
  }

  const result = searchIcons(query)

  if (options.json) {
    console.log(JSON.stringify({ query, icons: result }, null, 2))
    return
  }

  if (result.length === 0) {
    console.log(pc.yellow(`No icons found for "${query}".`))
    return
  }

  console.log(pc.bold(`Icons matching "${query}":`))
  printIconTable(result.map(icon => icon.name))
}

async function iconShow(args: string[]): Promise<void> {
  const { positional, options } = parseIconOptions(args)
  const name = positional[0]

  if (!name) {
    throw new Error('zweb icon show requires an icon name.')
  }

  if (!isIconName(name)) {
    throw new Error(`Unknown icon: ${name}`)
  }

  const icon = iconMetadata[name]

  if (options.json) {
    console.log(JSON.stringify(icon, null, 2))
    return
  }

  console.log(pc.bold(icon.title))
  console.log(`Name: ${icon.name}`)
  console.log(`Category: ${icon.category}`)
  console.log(`Tags: ${icon.tags.join(', ')}`)
  console.log('')
  console.log('React:')
  console.log(
    `  import { Icon${toPascalIconName(icon.name)} } from '@zeus-web/icons/react'`,
  )
  console.log('')
  console.log('Web Component:')
  console.log(
    `  <zw-icon-${icon.name} aria-hidden="true"></zw-icon-${icon.name}>`,
  )
  console.log('')
  console.log('Raw SVG:')
  console.log(`  import iconUrl from '@zeus-web/icons/svg/${icon.name}.svg'`)
}

function toPascalIconName(name: string): string {
  return name
    .split('-')
    .map(part => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join('')
}

export async function icon(args: string[]): Promise<void> {
  try {
    const [subcommand, ...rest] = args
    const command = (subcommand ?? 'list') as IconSubcommand

    if (command === 'list') {
      await iconList(rest)
      return
    }

    if (command === 'search') {
      await iconSearch(rest)
      return
    }

    if (command === 'show') {
      await iconShow(rest)
      return
    }

    if (subcommand === '-h' || subcommand === '--help') {
      printIconUsage()
      return
    }

    throw new Error(`Unknown icon command: ${String(subcommand)}`)
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
```

---

# 9. 修改 `packages/cli/src/index.ts`

增加 import：

```ts
import { icon } from './commands/icon'
```

在 switch 中加：

```ts
    case 'icon':
      await icon(args)
      break
```

help 里追加：

```ts
console.log('  zweb icon list')
console.log('  zweb icon list --json')
console.log('  zweb icon search check')
console.log('  zweb icon show check')
```

完整 `printHelp()` 的新增位置建议放在 `zweb theme` 后、`zweb ai` 前。

---

# 10. 新增 `packages/cli/__tests__/phase14-icons.spec.ts`

```ts
import { iconNames, searchIcons } from '@zeus-web/icons'

describe('@zeus-web/cli phase 14 icon workflow', () => {
  it('can read icon names from icons package', () => {
    expect(iconNames).toContain('check')
    expect(iconNames).toContain('x')
    expect(iconNames).toContain('search')
  })

  it('can search icon metadata', () => {
    expect(searchIcons('success').map(icon => icon.name)).toContain('check')
    expect(searchIcons('warning').map(icon => icon.name)).toContain(
      'alert-triangle',
    )
  })
})
```

---

# 11. 修改 `packages/ai/src/types.ts`

当前 AI metadata 只有 components，没有 icons 字段。

增加：

```ts
export interface ZeusWebAiIcons {
  packageName: '@zeus-web/icons'
  installCommand: string
  reactImport: string
  vueImport: string
  webComponentImport: string
  rawSvgImport: string
  recommendedIcons: string[]
  aiRules: {
    do: string[]
    dont: string[]
  }
}
```

然后把 `ZeusWebAiMetadata` 改成：

```ts
export interface ZeusWebAiMetadata {
  schemaVersion: 1
  packageName: '@zeus-web/ai'
  libraryName: 'Zeus Web'
  registryPackage: '@zeus-web/registry'
  cliPackage: '@zeus-web/cli'
  recommendedWorkflow: string[]
  themes: ZeusWebAiThemeName[]
  icons: ZeusWebAiIcons
  globalRules: {
    do: string[]
    dont: string[]
  }
  components: ZeusWebAiComponent[]
}
```

`src/index.ts` 里导出类型：

```ts
export type { ZeusWebAiIcons } from './types'
```

---

# 12. 修改 `packages/ai/src/metadata.ts`

在 `aiMetadata` 顶层加入：

```ts
icons: {
  packageName: '@zeus-web/icons',
  installCommand: 'pnpm add @zeus-web/icons',
  reactImport: "import { IconCheck, IconX } from '@zeus-web/icons/react'",
  vueImport: "import { IconCheck, IconX } from '@zeus-web/icons/vue'",
  webComponentImport: "import '@zeus-web/icons/wc'",
  rawSvgImport: "import checkIcon from '@zeus-web/icons/svg/check.svg'",
  recommendedIcons: [
    'check',
    'x',
    'plus',
    'minus',
    'chevron-down',
    'chevron-up',
    'chevron-left',
    'chevron-right',
    'search',
    'menu',
    'settings',
    'user',
    'copy',
    'external-link',
    'info',
    'alert-triangle',
    'circle-check',
    'circle-x',
    'loader',
    'sun',
    'moon',
    'eye',
    'eye-off',
    'trash',
  ],
  aiRules: {
    do: [
      'Use @zeus-web/icons/react for React examples.',
      'Use @zeus-web/icons/vue for Vue examples.',
      'Use @zeus-web/icons/wc when showing native Web Component usage.',
      'Use aria-hidden for decorative icons.',
      'Provide an accessible label on the parent control when an icon-only button is used.',
      'Prefer currentColor icons so color follows text/theme tokens.',
    ],
    dont: [
      'Do not inline random SVG markup when an icon exists in @zeus-web/icons.',
      'Do not use icons as the only accessible name.',
      'Do not hardcode width/height when size can be controlled with className or CSS.',
      'Do not import React icons in Vue examples or Vue icons in React examples.',
    ],
  },
},
```

---

# 13. 修改 `packages/ai/src/render.ts`

当前 render 只输出 workflow/themes/global rules/components。

增加：

```ts
function renderIcons(metadata: ZeusWebAiMetadata): string {
  const icons = metadata.icons

  return [
    '## Icons',
    '',
    `Package: \`${icons.packageName}\``,
    `Install: \`${icons.installCommand}\``,
    `React: \`${icons.reactImport}\``,
    `Vue: \`${icons.vueImport}\``,
    `Web Component: \`${icons.webComponentImport}\``,
    `Raw SVG: \`${icons.rawSvgImport}\``,
    '',
    'Recommended icons:',
    renderList(icons.recommendedIcons.map(icon => `\`${icon}\``)),
    '',
    'Icon AI do:',
    renderList(icons.aiRules.do),
    '',
    'Icon AI do not:',
    renderList(icons.aiRules.dont),
  ].join('\n')
}
```

然后在 `renderAiMarkdown` 的 Themes 后面插入：

```ts
    '## Themes',
    '',
    renderList(metadata.themes.map(theme => `\`${theme}\``)),
    '',
    renderIcons(metadata),
    '',
```

---

# 14. 修改 `packages/ai/src/validate.ts`

增加 icons 校验：

```ts
function validateIcons(metadata: ZeusWebAiMetadata, errors: string[]): void {
  if (metadata.icons.packageName !== '@zeus-web/icons') {
    errors.push('icons.packageName must be @zeus-web/icons')
  }

  if (!metadata.icons.installCommand.includes('@zeus-web/icons')) {
    errors.push('icons.installCommand must include @zeus-web/icons')
  }

  if (!metadata.icons.reactImport.includes('@zeus-web/icons/react')) {
    errors.push('icons.reactImport must use @zeus-web/icons/react')
  }

  if (!metadata.icons.vueImport.includes('@zeus-web/icons/vue')) {
    errors.push('icons.vueImport must use @zeus-web/icons/vue')
  }

  if (!metadata.icons.webComponentImport.includes('@zeus-web/icons/wc')) {
    errors.push('icons.webComponentImport must use @zeus-web/icons/wc')
  }

  if (!metadata.icons.rawSvgImport.includes('@zeus-web/icons/svg/')) {
    errors.push('icons.rawSvgImport must use @zeus-web/icons/svg/*')
  }

  if (metadata.icons.recommendedIcons.length === 0) {
    errors.push('icons.recommendedIcons is required')
  }

  if (metadata.icons.aiRules.do.length === 0) {
    errors.push('icons.aiRules.do is required')
  }

  if (metadata.icons.aiRules.dont.length === 0) {
    errors.push('icons.aiRules.dont is required')
  }
}
```

在 `validateAiMetadata()` 里 `return` 前调用：

```ts
validateIcons(metadata, errors)
```

---

# 15. Docs 更新

## 新增 `apps/docs/guide/icons.md`

````md
# Icons

Zeus Web provides a multi-framework icon package.

## Install

```bash
pnpm add @zeus-web/icons
```
````

## React

```tsx
import { IconCheck, IconSearch } from '@zeus-web/icons/react'

export function Example() {
  return (
    <button aria-label="Search">
      <IconSearch aria-hidden />
    </button>
  )
}
```

## Vue

```vue
<script setup lang="ts">
import { IconCheck } from '@zeus-web/icons/vue'
</script>

<template>
  <IconCheck aria-hidden="true" />
</template>
```

## Web Component

```ts
import '@zeus-web/icons/wc'
```

```html
<zw-icon-check aria-hidden="true"></zw-icon-check>
```

## Raw SVG

```ts
import checkIcon from '@zeus-web/icons/svg/check.svg'
```

## CLI

```bash
zweb icon list
zweb icon search check
zweb icon show check
```

## AI usage rules

- Use `@zeus-web/icons/react` in React examples.
- Use `@zeus-web/icons/vue` in Vue examples.
- Use `@zeus-web/icons/wc` in native Web Component examples.
- Use `aria-hidden` for decorative icons.
- For icon-only buttons, put the accessible name on the button.

````

## 修改 `apps/docs/.vitepress/data/site.ts`

在 guide nav/sidebar 里加入：

```ts
{
  text: 'Icons',
  link: '/guide/icons',
}
````

## 修改 `scripts/checks/check-docs.ts`

在 `requiredDocs` 里加：

```ts
{
  path: 'guide/icons.md',
  mustContain: [
    '# Icons',
    '@zeus-web/icons',
    '@zeus-web/icons/react',
    '@zeus-web/icons/vue',
    '@zeus-web/icons/wc',
    'zweb icon list',
  ],
},
```

在 route 检查里加：

```ts
'/guide/icons',
```

---

# 16. 可选：根 `package.json` 增加快捷脚本

```json
{
  "scripts": {
    "icons:build": "pnpm --filter @zeus-web/icons build",
    "icons:test": "pnpm --filter @zeus-web/icons test"
  }
}
```

---

# 17. 验收命令

```bash
pnpm --filter @zeus-web/icons check
pnpm --filter @zeus-web/icons test
pnpm --filter @zeus-web/icons build

pnpm --filter @zeus-web/cli check
pnpm --filter @zeus-web/cli test
pnpm --filter @zeus-web/cli build

pnpm --filter @zeus-web/ai check
pnpm --filter @zeus-web/ai test
pnpm --filter @zeus-web/ai build

pnpm docs:generate
pnpm docs:check-generated
pnpm docs:check
pnpm docs:build

pnpm test
pnpm check
pnpm build
pnpm check:exports
pnpm check:build-output
pnpm site:check
```

手动验证：

```bash
node packages/cli/dist/index.js icon list
node packages/cli/dist/index.js icon list --json
node packages/cli/dist/index.js icon search warning
node packages/cli/dist/index.js icon show check
```

构建后检查：

```txt
packages/icons/dist/index.js
packages/icons/dist/index.d.ts
packages/icons/dist/react/index.js
packages/icons/dist/react/index.d.ts
packages/icons/dist/vue/index.js
packages/icons/dist/vue/index.d.ts
packages/icons/dist/wc/index.js
packages/icons/dist/wc/index.d.ts
packages/icons/dist/svg/check.svg
packages/icons/dist/manifest.json
```

---

# 建议提交

```txt
feat(icons): add zeus web icon package
feat(cli): add icon list search and show commands
feat(ai): document icon usage rules
docs: add icons guide
test(icons): add icon manifest contract coverage
```

Phase 14 完成后，生态就变成：

```txt
组件：@zeus-web/button/input/dialog/...
主题：@zeus-web/themes
图标：@zeus-web/icons
CLI：zweb init/add/list/diff/update/doctor/theme/icon/ai
AI：组件 + 主题 + 图标规则
```

下一阶段就可以进入 **Phase 15：Testing / Release / 0.1.0**。
