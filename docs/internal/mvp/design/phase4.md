下面给 **Phase 4：Theme System MVP** 的详细设计与完整代码。

基于当前 `mvp` 分支状态，Phase 3 的 headless primitives 已经成型；下一步不应该马上做 CLI 全量复制逻辑，而应该先把 **主题系统** 定稳。当前 `@zeus-web/themes` 还比较薄：只导出 `tokens.css/default.css`，变量也只有少量 `--zw-*`。
同时 `registry.json` 已经有 `button/input/checkbox/switch/tabs/dialog` 条目，但还没有真实 styled source 文件。 CLI 的 `add` 现在也只是打印依赖计划，还没真正复制组件和合并主题。

所以 Phase 4 的目标是：

```txt
Phase 4：Tailwind + CSS Variables Theme System

目标：
1. 建立 shadcn-like CSS Variables 主题基础。
2. 保留 zeus-web 前缀变量别名，方便未来内部使用。
3. 支持 light / dark。
4. 支持 default / slate / zinc / neutral / stone。
5. 为 Phase 5 registry styled components 提供稳定 token。
6. 每个新增能力同步补测试。
```

---

# 1. Phase 4 文件变更总览

```txt
修改：
  packages/themes/package.json
  packages/themes/src/index.ts
  packages/themes/src/tokens.css
  packages/themes/src/default.css

新增：
  packages/themes/src/slate.css
  packages/themes/src/zinc.css
  packages/themes/src/neutral.css
  packages/themes/src/stone.css
  packages/themes/__tests__/themes.spec.ts
```

Phase 4 不改 primitives，不改 registry，不改 CLI add 逻辑。
Phase 5 再基于这些 theme tokens 做 `components/ui/*.tsx` styled registry。

---

# 2. `packages/themes/package.json`

替换为：

```json
{
  "name": "@zeus-web/themes",
  "type": "module",
  "version": "0.0.0",
  "description": "Theme tokens for Zeus Web.",
  "license": "MIT",
  "sideEffects": ["./src/**/*.css"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./tokens.css": "./src/tokens.css",
    "./default.css": "./src/default.css",
    "./slate.css": "./src/slate.css",
    "./zinc.css": "./src/zinc.css",
    "./neutral.css": "./src/neutral.css",
    "./stone.css": "./src/stone.css"
  },
  "files": ["dist", "src"],
  "scripts": {
    "dev": "tsup src/index.ts --format esm --dts --clean --watch",
    "build": "tsup src/index.ts --format esm --dts --clean",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../.. --project unit packages/themes/__tests__/themes.spec.ts"
  }
}
```

说明：

```txt
1. CSS 继续从 src 导出，方便用户直接 import '@zeus-web/themes/default.css'。
2. sideEffects 必须包含 CSS，否则 bundler 可能误删样式。
3. 新增 slate / zinc / neutral / stone，为后续 zweb init 选择主题做准备。
```

---

# 3. `packages/themes/src/index.ts`

替换为：

```ts
export const themePackageName = '@zeus-web/themes'

export const themeNames = [
  'default',
  'slate',
  'zinc',
  'neutral',
  'stone',
] as const

export type ThemeName = (typeof themeNames)[number]

export const themeCssImports: Record<ThemeName, string> = {
  default: '@zeus-web/themes/default.css',
  slate: '@zeus-web/themes/slate.css',
  zinc: '@zeus-web/themes/zinc.css',
  neutral: '@zeus-web/themes/neutral.css',
  stone: '@zeus-web/themes/stone.css',
}

export const themeCssExports = {
  tokens: '@zeus-web/themes/tokens.css',
  ...themeCssImports,
} as const

export const semanticColorTokens = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
] as const

export type SemanticColorToken = (typeof semanticColorTokens)[number]

export const radiusTokens = [
  'radius',
  'radius-sm',
  'radius-md',
  'radius-lg',
  'radius-xl',
] as const

export type RadiusToken = (typeof radiusTokens)[number]

export function getThemeCssImport(theme: ThemeName = 'default'): string {
  return themeCssImports[theme]
}

export function isThemeName(value: string): value is ThemeName {
  return (themeNames as readonly string[]).includes(value)
}
```

设计点：

```txt
1. themeNames 是 CLI init 的可选项来源。
2. semanticColorTokens 是 registry 组件可使用的 token 白名单。
3. getThemeCssImport 后续给 CLI 用。
4. 不在运行时解析 CSS，只暴露元信息。
```

---

# 4. `packages/themes/src/tokens.css`

替换为：

```css
:root {
  --radius: 0.5rem;

  --zw-radius: var(--radius);
  --zw-radius-sm: calc(var(--radius) - 4px);
  --zw-radius-md: calc(var(--radius) - 2px);
  --zw-radius-lg: var(--radius);
  --zw-radius-xl: calc(var(--radius) + 4px);
}

/*
 * Tailwind v4 integration.
 *
 * Unknown at-rules are ignored by browsers when not processed by Tailwind v4,
 * so this remains safe for Tailwind v3 users. Tailwind v3 projects can still
 * map these CSS variables in tailwind.config.
 */
@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));

  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));

  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));

  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));

  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));

  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));

  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));

  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));

  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));

  --radius-sm: var(--zw-radius-sm);
  --radius-md: var(--zw-radius-md);
  --radius-lg: var(--zw-radius-lg);
  --radius-xl: var(--zw-radius-xl);
}
```

这里使用 shadcn-like 的无前缀变量，例如 `--background / --foreground / --primary`。
同时保留 `--zw-radius-*` 这种 zeus-web 别名，后续如果内部需要不会和用户变量冲突。

---

# 5. `packages/themes/src/default.css`

替换为：

```css
@import './tokens.css';

:root,
[data-theme='default'] {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;

  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;

  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;

  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;

  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;

  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;

  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;

  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;

  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 5.9% 10%;

  --zw-background: var(--background);
  --zw-foreground: var(--foreground);
  --zw-primary: var(--primary);
  --zw-primary-foreground: var(--primary-foreground);
  --zw-border: var(--border);
  --zw-input: var(--input);
  --zw-ring: var(--ring);
}

.dark,
[data-theme='default'].dark,
.dark [data-theme='default'] {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;

  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;

  --popover: 240 10% 3.9%;
  --popover-foreground: 0 0% 98%;

  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;

  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;

  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;

  --accent: 240 3.7% 15.9%;
  --accent-foreground: 0 0% 98%;

  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;

  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;

  --zw-background: var(--background);
  --zw-foreground: var(--foreground);
  --zw-primary: var(--primary);
  --zw-primary-foreground: var(--primary-foreground);
  --zw-border: var(--border);
  --zw-input: var(--input);
  --zw-ring: var(--ring);
}
```

---

# 6. `packages/themes/src/slate.css`

新增：

```css
@import './tokens.css';

:root,
[data-theme='slate'] {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;

  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;

  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;

  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;

  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;

  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;

  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;

  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;

  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;

  --zw-background: var(--background);
  --zw-foreground: var(--foreground);
  --zw-primary: var(--primary);
  --zw-primary-foreground: var(--primary-foreground);
  --zw-border: var(--border);
  --zw-input: var(--input);
  --zw-ring: var(--ring);
}

.dark,
[data-theme='slate'].dark,
.dark [data-theme='slate'] {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;

  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;

  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;

  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;

  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;

  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;

  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;

  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;

  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 212.7 26.8% 83.9%;

  --zw-background: var(--background);
  --zw-foreground: var(--foreground);
  --zw-primary: var(--primary);
  --zw-primary-foreground: var(--primary-foreground);
  --zw-border: var(--border);
  --zw-input: var(--input);
  --zw-ring: var(--ring);
}
```

---

# 7. `packages/themes/src/zinc.css`

新增：

```css
@import './tokens.css';

:root,
[data-theme='zinc'] {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;

  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;

  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;

  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;

  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;

  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;

  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;

  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;

  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 5.9% 10%;

  --zw-background: var(--background);
  --zw-foreground: var(--foreground);
  --zw-primary: var(--primary);
  --zw-primary-foreground: var(--primary-foreground);
  --zw-border: var(--border);
  --zw-input: var(--input);
  --zw-ring: var(--ring);
}

.dark,
[data-theme='zinc'].dark,
.dark [data-theme='zinc'] {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;

  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;

  --popover: 240 10% 3.9%;
  --popover-foreground: 0 0% 98%;

  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;

  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;

  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;

  --accent: 240 3.7% 15.9%;
  --accent-foreground: 0 0% 98%;

  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;

  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;

  --zw-background: var(--background);
  --zw-foreground: var(--foreground);
  --zw-primary: var(--primary);
  --zw-primary-foreground: var(--primary-foreground);
  --zw-border: var(--border);
  --zw-input: var(--input);
  --zw-ring: var(--ring);
}
```

---

# 8. `packages/themes/src/neutral.css`

新增：

```css
@import './tokens.css';

:root,
[data-theme='neutral'] {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;

  --card: 0 0% 100%;
  --card-foreground: 0 0% 3.9%;

  --popover: 0 0% 100%;
  --popover-foreground: 0 0% 3.9%;

  --primary: 0 0% 9%;
  --primary-foreground: 0 0% 98%;

  --secondary: 0 0% 96.1%;
  --secondary-foreground: 0 0% 9%;

  --muted: 0 0% 96.1%;
  --muted-foreground: 0 0% 45.1%;

  --accent: 0 0% 96.1%;
  --accent-foreground: 0 0% 9%;

  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;

  --border: 0 0% 89.8%;
  --input: 0 0% 89.8%;
  --ring: 0 0% 3.9%;

  --zw-background: var(--background);
  --zw-foreground: var(--foreground);
  --zw-primary: var(--primary);
  --zw-primary-foreground: var(--primary-foreground);
  --zw-border: var(--border);
  --zw-input: var(--input);
  --zw-ring: var(--ring);
}

.dark,
[data-theme='neutral'].dark,
.dark [data-theme='neutral'] {
  --background: 0 0% 3.9%;
  --foreground: 0 0% 98%;

  --card: 0 0% 3.9%;
  --card-foreground: 0 0% 98%;

  --popover: 0 0% 3.9%;
  --popover-foreground: 0 0% 98%;

  --primary: 0 0% 98%;
  --primary-foreground: 0 0% 9%;

  --secondary: 0 0% 14.9%;
  --secondary-foreground: 0 0% 98%;

  --muted: 0 0% 14.9%;
  --muted-foreground: 0 0% 63.9%;

  --accent: 0 0% 14.9%;
  --accent-foreground: 0 0% 98%;

  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;

  --border: 0 0% 14.9%;
  --input: 0 0% 14.9%;
  --ring: 0 0% 83.1%;

  --zw-background: var(--background);
  --zw-foreground: var(--foreground);
  --zw-primary: var(--primary);
  --zw-primary-foreground: var(--primary-foreground);
  --zw-border: var(--border);
  --zw-input: var(--input);
  --zw-ring: var(--ring);
}
```

---

# 9. `packages/themes/src/stone.css`

新增：

```css
@import './tokens.css';

:root,
[data-theme='stone'] {
  --background: 0 0% 100%;
  --foreground: 20 14.3% 4.1%;

  --card: 0 0% 100%;
  --card-foreground: 20 14.3% 4.1%;

  --popover: 0 0% 100%;
  --popover-foreground: 20 14.3% 4.1%;

  --primary: 24 9.8% 10%;
  --primary-foreground: 60 9.1% 97.8%;

  --secondary: 60 4.8% 95.9%;
  --secondary-foreground: 24 9.8% 10%;

  --muted: 60 4.8% 95.9%;
  --muted-foreground: 25 5.3% 44.7%;

  --accent: 60 4.8% 95.9%;
  --accent-foreground: 24 9.8% 10%;

  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 60 9.1% 97.8%;

  --border: 20 5.9% 90%;
  --input: 20 5.9% 90%;
  --ring: 20 14.3% 4.1%;

  --zw-background: var(--background);
  --zw-foreground: var(--foreground);
  --zw-primary: var(--primary);
  --zw-primary-foreground: var(--primary-foreground);
  --zw-border: var(--border);
  --zw-input: var(--input);
  --zw-ring: var(--ring);
}

.dark,
[data-theme='stone'].dark,
.dark [data-theme='stone'] {
  --background: 20 14.3% 4.1%;
  --foreground: 60 9.1% 97.8%;

  --card: 20 14.3% 4.1%;
  --card-foreground: 60 9.1% 97.8%;

  --popover: 20 14.3% 4.1%;
  --popover-foreground: 60 9.1% 97.8%;

  --primary: 60 9.1% 97.8%;
  --primary-foreground: 24 9.8% 10%;

  --secondary: 12 6.5% 15.1%;
  --secondary-foreground: 60 9.1% 97.8%;

  --muted: 12 6.5% 15.1%;
  --muted-foreground: 24 5.4% 63.9%;

  --accent: 12 6.5% 15.1%;
  --accent-foreground: 60 9.1% 97.8%;

  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 60 9.1% 97.8%;

  --border: 12 6.5% 15.1%;
  --input: 12 6.5% 15.1%;
  --ring: 24 5.7% 82.9%;

  --zw-background: var(--background);
  --zw-foreground: var(--foreground);
  --zw-primary: var(--primary);
  --zw-primary-foreground: var(--primary-foreground);
  --zw-border: var(--border);
  --zw-input: var(--input);
  --zw-ring: var(--ring);
}
```

---

# 10. 测试：`packages/themes/__tests__/themes.spec.ts`

新增：

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  getThemeCssImport,
  isThemeName,
  semanticColorTokens,
  themeCssImports,
  themeNames,
} from '../src'

const workspaceRoot = process.cwd()

function readThemeFile(file: string): string {
  return readFileSync(
    resolve(workspaceRoot, 'packages/themes/src', file),
    'utf-8',
  )
}

describe('@zeus-web/themes', () => {
  it('exposes supported theme names', () => {
    expect(themeNames).toEqual(['default', 'slate', 'zinc', 'neutral', 'stone'])
  })

  it('resolves css import path by theme name', () => {
    expect(getThemeCssImport()).toBe('@zeus-web/themes/default.css')
    expect(getThemeCssImport('slate')).toBe('@zeus-web/themes/slate.css')
  })

  it('checks theme name guard', () => {
    expect(isThemeName('default')).toBe(true)
    expect(isThemeName('slate')).toBe(true)
    expect(isThemeName('unknown')).toBe(false)
  })

  it('keeps css import map aligned with theme names', () => {
    expect(Object.keys(themeCssImports)).toEqual(themeNames)
  })

  it('declares all semantic tokens in default theme', () => {
    const source = readThemeFile('default.css')

    for (const token of semanticColorTokens) {
      expect(source).toContain(`--${token}:`)
    }
  })

  it('declares all semantic tokens in every theme file', () => {
    for (const theme of themeNames) {
      const source = readThemeFile(`${theme}.css`)

      for (const token of semanticColorTokens) {
        expect(source).toContain(`--${token}:`)
      }

      expect(source).toContain(`--zw-background: var(--background);`)
      expect(source).toContain(`--zw-ring: var(--ring);`)
    }
  })

  it('declares Tailwind v4 theme mappings in tokens.css', () => {
    const source = readThemeFile('tokens.css')

    expect(source).toContain('@theme inline')
    expect(source).toContain('--color-background: hsl(var(--background));')
    expect(source).toContain('--color-primary: hsl(var(--primary));')
    expect(source).toContain('--radius-lg: var(--zw-radius-lg);')
  })

  it('supports dark mode selectors in every theme file', () => {
    for (const theme of themeNames) {
      const source = readThemeFile(`${theme}.css`)

      expect(source).toContain('.dark')
      expect(source).toContain(`[data-theme='${theme}']`)
    }
  })
})
```

---

# 11. Phase 4 验收命令

```bash
pnpm --filter @zeus-web/themes check
pnpm --filter @zeus-web/themes test
pnpm --filter @zeus-web/themes build

pnpm check
pnpm test
pnpm check:exports
pnpm build
pnpm check:build-output
```

验收标准：

```txt
1. @zeus-web/themes 导出 default/slate/zinc/neutral/stone CSS。
2. 每个主题都包含完整 semantic tokens。
3. tokens.css 提供 Tailwind v4 @theme inline 映射。
4. CSS sideEffects 不会被 tree-shaking 删除。
5. Phase 5 registry 组件可以直接使用：
   bg-background
   text-foreground
   border-input
   ring-ring
   bg-primary
   text-primary-foreground
```

---

# 12. Phase 4 不做什么

```txt
不做 registry styled components。
不做 zweb add 真复制。
不做 Tailwind config 自动改写。
不做 docs playground。
不改 headless primitive 源码。
```

Phase 4 只解决：

```txt
Zeus Web 的主题 token 和 Tailwind/shadcn-like 样式基础。
```

---

# 13. 建议提交

```txt
feat(themes): add shadcn-like css variable theme system
test(themes): cover theme tokens and css exports
```

完成 Phase 4 后，Phase 5 就可以开始做：

```txt
@zeus-web/registry
  default/button.tsx
  default/input.tsx
  default/checkbox.tsx
  default/switch.tsx
  default/tabs.tsx
  default/dialog.tsx

zweb add input
  安装 @zeus-web/input
  复制 components/ui/input.tsx
  合并 theme css
```
