下面给 **Phase 13：Theming / Styling 进阶** 的详细设计与完整代码。

当前 `@zeus-web/themes` 还是 MVP：只导出 5 个主题名、CSS import map、semantic color tokens、radius tokens 和 `getThemeCssImport / isThemeName`。
`tokens.css` 也只有 radius 和 Tailwind v4 color/radius 映射，没有 motion、dark-mode 策略、theme registry、tokens JSON 导出能力。
CLI 的配置目前也只有 `style / tailwind.css / aliases`，没有 theme runtime 配置。
所以 Phase 13 的目标是把 theme 从“CSS 文件集合”升级成“可被 CLI、AI、docs、用户工程共同消费的 token system”。

---

# Phase 13 目标

```txt
Phase 13：Theming / Styling 进阶

13.1 @zeus-web/themes 增强
  - theme registry
  - typed token registry
  - radius presets
  - motion presets
  - dark mode strategies
  - JSON tokens export

13.2 CLI theme 命令
  - zweb theme list
  - zweb theme tokens
  - zweb theme tokens slate --json
  - zweb theme set slate
  - zweb theme set zinc --radius lg --motion reduced
  - zweb theme set default --accent "240 5.9% 10%"

13.3 components.json 扩展
  - theme.radius
  - theme.motion
  - theme.darkMode
  - theme.accentColor

13.4 CSS override
  - 在用户 css 中写入 managed override block
  - 后续 theme set 可重复更新

13.5 测试和 docs
  - themes package contract
  - CLI theme contract
  - docs guide/theming 更新
```

---

# 1. 替换 `packages/themes/src/index.ts`

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

export const motionTokens = [
  'duration-fast',
  'duration-normal',
  'duration-slow',
  'easing-standard',
  'easing-emphasized',
] as const

export type MotionToken = (typeof motionTokens)[number]

export const radiusPresetNames = ['none', 'sm', 'md', 'lg', 'xl'] as const

export type RadiusPresetName = (typeof radiusPresetNames)[number]

export const radiusPresets: Record<RadiusPresetName, string> = {
  none: '0rem',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
}

export const motionPresetNames = [
  'none',
  'reduced',
  'normal',
  'expressive',
] as const

export type MotionPresetName = (typeof motionPresetNames)[number]

export interface MotionPreset {
  durationFast: string
  durationNormal: string
  durationSlow: string
  easingStandard: string
  easingEmphasized: string
}

export const motionPresets: Record<MotionPresetName, MotionPreset> = {
  none: {
    durationFast: '0ms',
    durationNormal: '0ms',
    durationSlow: '0ms',
    easingStandard: 'linear',
    easingEmphasized: 'linear',
  },
  reduced: {
    durationFast: '80ms',
    durationNormal: '120ms',
    durationSlow: '160ms',
    easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    easingEmphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  },
  normal: {
    durationFast: '120ms',
    durationNormal: '180ms',
    durationSlow: '260ms',
    easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    easingEmphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  expressive: {
    durationFast: '140ms',
    durationNormal: '220ms',
    durationSlow: '340ms',
    easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    easingEmphasized: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
}

export const darkModeStrategyNames = ['class', 'data', 'media'] as const

export type DarkModeStrategyName = (typeof darkModeStrategyNames)[number]

export interface ThemeTokenSet {
  name: ThemeName
  cssImport: string
  colors: Record<SemanticColorToken, string>
}

const defaultLightColors: Record<SemanticColorToken, string> = {
  background: '0 0% 100%',
  foreground: '240 10% 3.9%',
  card: '0 0% 100%',
  'card-foreground': '240 10% 3.9%',
  popover: '0 0% 100%',
  'popover-foreground': '240 10% 3.9%',
  primary: '240 5.9% 10%',
  'primary-foreground': '0 0% 98%',
  secondary: '240 4.8% 95.9%',
  'secondary-foreground': '240 5.9% 10%',
  muted: '240 4.8% 95.9%',
  'muted-foreground': '240 3.8% 46.1%',
  accent: '240 4.8% 95.9%',
  'accent-foreground': '240 5.9% 10%',
  destructive: '0 84.2% 60.2%',
  'destructive-foreground': '0 0% 98%',
  border: '240 5.9% 90%',
  input: '240 5.9% 90%',
  ring: '240 5.9% 10%',
}

export const themeRegistry: Record<ThemeName, ThemeTokenSet> = {
  default: {
    name: 'default',
    cssImport: themeCssImports.default,
    colors: defaultLightColors,
  },
  slate: {
    name: 'slate',
    cssImport: themeCssImports.slate,
    colors: {
      ...defaultLightColors,
      foreground: '222.2 84% 4.9%',
      primary: '222.2 47.4% 11.2%',
      border: '214.3 31.8% 91.4%',
      input: '214.3 31.8% 91.4%',
      ring: '222.2 84% 4.9%',
    },
  },
  zinc: {
    name: 'zinc',
    cssImport: themeCssImports.zinc,
    colors: {
      ...defaultLightColors,
      foreground: '240 10% 3.9%',
      primary: '240 5.9% 10%',
      border: '240 5.9% 90%',
      input: '240 5.9% 90%',
      ring: '240 5.9% 10%',
    },
  },
  neutral: {
    name: 'neutral',
    cssImport: themeCssImports.neutral,
    colors: {
      ...defaultLightColors,
      foreground: '0 0% 3.9%',
      primary: '0 0% 9%',
      border: '0 0% 89.8%',
      input: '0 0% 89.8%',
      ring: '0 0% 3.9%',
    },
  },
  stone: {
    name: 'stone',
    cssImport: themeCssImports.stone,
    colors: {
      ...defaultLightColors,
      foreground: '20 14.3% 4.1%',
      primary: '24 9.8% 10%',
      border: '20 5.9% 90%',
      input: '20 5.9% 90%',
      ring: '20 14.3% 4.1%',
    },
  },
}

export interface ThemeTokensJson {
  themes: ThemeName[]
  semanticColorTokens: readonly SemanticColorToken[]
  radiusTokens: readonly RadiusToken[]
  motionTokens: readonly MotionToken[]
  radiusPresets: Record<RadiusPresetName, string>
  motionPresets: Record<MotionPresetName, MotionPreset>
  darkModeStrategies: readonly DarkModeStrategyName[]
}

export function getThemeCssImport(theme: ThemeName = 'default'): string {
  return themeCssImports[theme]
}

export function getThemeTokens(theme: ThemeName = 'default'): ThemeTokenSet {
  return themeRegistry[theme]
}

export function getThemeTokensJson(): ThemeTokensJson {
  return {
    themes: themeNames,
    semanticColorTokens,
    radiusTokens,
    motionTokens,
    radiusPresets,
    motionPresets,
    darkModeStrategies: darkModeStrategyNames,
  }
}

export function isThemeName(value: string): value is ThemeName {
  return (themeNames as readonly string[]).includes(value)
}

export function isRadiusPresetName(value: string): value is RadiusPresetName {
  return (radiusPresetNames as readonly string[]).includes(value)
}

export function isMotionPresetName(value: string): value is MotionPresetName {
  return (motionPresetNames as readonly string[]).includes(value)
}

export function isDarkModeStrategyName(
  value: string,
): value is DarkModeStrategyName {
  return (darkModeStrategyNames as readonly string[]).includes(value)
}
```

---

# 2. 替换 `packages/themes/src/tokens.css`

```css
:root {
  --radius: 0.5rem;

  --zw-radius: var(--radius);
  --zw-radius-sm: calc(var(--radius) - 4px);
  --zw-radius-md: calc(var(--radius) - 2px);
  --zw-radius-lg: var(--radius);
  --zw-radius-xl: calc(var(--radius) + 4px);

  --zw-duration-fast: 120ms;
  --zw-duration-normal: 180ms;
  --zw-duration-slow: 260ms;
  --zw-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --zw-easing-emphasized: cubic-bezier(0.16, 1, 0.3, 1);
}

[data-motion='none'] {
  --zw-duration-fast: 0ms;
  --zw-duration-normal: 0ms;
  --zw-duration-slow: 0ms;
  --zw-easing-standard: linear;
  --zw-easing-emphasized: linear;
}

[data-motion='reduced'] {
  --zw-duration-fast: 80ms;
  --zw-duration-normal: 120ms;
  --zw-duration-slow: 160ms;
  --zw-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --zw-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
}

[data-motion='normal'] {
  --zw-duration-fast: 120ms;
  --zw-duration-normal: 180ms;
  --zw-duration-slow: 260ms;
  --zw-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --zw-easing-emphasized: cubic-bezier(0.16, 1, 0.3, 1);
}

[data-motion='expressive'] {
  --zw-duration-fast: 140ms;
  --zw-duration-normal: 220ms;
  --zw-duration-slow: 340ms;
  --zw-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --zw-easing-emphasized: cubic-bezier(0.34, 1.56, 0.64, 1);
}

@media (prefers-reduced-motion: reduce) {
  :root:not([data-motion='normal']):not([data-motion='expressive']) {
    --zw-duration-fast: 0ms;
    --zw-duration-normal: 0ms;
    --zw-duration-slow: 0ms;
    --zw-easing-standard: linear;
    --zw-easing-emphasized: linear;
  }
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

  --ease-zeus-standard: var(--zw-easing-standard);
  --ease-zeus-emphasized: var(--zw-easing-emphasized);
  --animate-duration-fast: var(--zw-duration-fast);
  --animate-duration-normal: var(--zw-duration-normal);
  --animate-duration-slow: var(--zw-duration-slow);
}
```

---

# 3. 修改 `packages/cli/src/config.ts`

当前 `ComponentsConfig` 没有 `theme` 扩展。

直接替换整个文件：

```ts
import type {
  DarkModeStrategyName,
  MotionPresetName,
  RadiusPresetName,
  ThemeName,
} from '@zeus-web/themes'

import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

import {
  isDarkModeStrategyName,
  isMotionPresetName,
  isRadiusPresetName,
  isThemeName,
  motionPresets,
  radiusPresets,
} from '@zeus-web/themes'

export interface ComponentsThemeConfig {
  radius: RadiusPresetName
  motion: MotionPresetName
  darkMode: DarkModeStrategyName
  accentColor?: string
}

export interface ComponentsConfig {
  $schema: string
  framework: 'react'
  style: ThemeName
  theme: ComponentsThemeConfig
  tailwind: {
    css: string
    cssVariables: boolean
  }
  aliases: {
    components: string
    ui: string
    lib: string
  }
}

export interface CreateConfigOptions {
  style?: ThemeName
  css?: string
  theme?: Partial<ComponentsThemeConfig>
}

export const componentsConfigFileName = 'components.json'

export const themeOverrideStart = '/* zeus-web theme overrides:start */'
export const themeOverrideEnd = '/* zeus-web theme overrides:end */'

export function createDefaultThemeConfig(
  theme: Partial<ComponentsThemeConfig> = {},
): ComponentsThemeConfig {
  return {
    radius: theme.radius ?? 'md',
    motion: theme.motion ?? 'normal',
    darkMode: theme.darkMode ?? 'class',
    accentColor: theme.accentColor,
  }
}

export function createDefaultComponentsConfig(
  options: CreateConfigOptions = {},
): ComponentsConfig {
  return {
    $schema: 'https://zeus-web.dev/schema/components.json',
    framework: 'react',
    style: options.style ?? 'default',
    theme: createDefaultThemeConfig(options.theme),
    tailwind: {
      css: options.css ?? 'src/styles/globals.css',
      cssVariables: true,
    },
    aliases: {
      components: '@/components',
      ui: '@/components/ui',
      lib: '@/lib',
    },
  }
}

export function getComponentsConfigPath(cwd: string): string {
  return resolve(cwd, componentsConfigFileName)
}

export function readComponentsConfig(cwd: string): ComponentsConfig {
  const file = getComponentsConfigPath(cwd)

  if (!existsSync(file)) {
    throw new Error('components.json not found. Run `zweb init` first.')
  }

  const config = JSON.parse(readFileSync(file, 'utf-8')) as ComponentsConfig

  validateComponentsConfig(config)

  return config
}

export function normalizeComponentsConfig(
  config: ComponentsConfig,
): ComponentsConfig {
  return {
    ...config,
    theme: createDefaultThemeConfig(config.theme),
  }
}

export function validateComponentsConfig(config: ComponentsConfig): void {
  if (config.framework !== 'react') {
    throw new Error('Only framework "react" is supported in this phase.')
  }

  if (!isThemeName(config.style)) {
    throw new Error(`Unsupported style: ${String(config.style)}`)
  }

  const theme = createDefaultThemeConfig(config.theme)

  if (!isRadiusPresetName(theme.radius)) {
    throw new Error(`Unsupported radius preset: ${String(theme.radius)}`)
  }

  if (!isMotionPresetName(theme.motion)) {
    throw new Error(`Unsupported motion preset: ${String(theme.motion)}`)
  }

  if (!isDarkModeStrategyName(theme.darkMode)) {
    throw new Error(`Unsupported dark mode strategy: ${String(theme.darkMode)}`)
  }

  if (!config.tailwind?.css) {
    throw new Error('components.json missing tailwind.css')
  }

  if (!config.aliases?.ui) {
    throw new Error('components.json missing aliases.ui')
  }

  if (!config.aliases?.lib) {
    throw new Error('components.json missing aliases.lib')
  }
}

export async function writeComponentsConfig(params: {
  cwd: string
  config: ComponentsConfig
  overwrite: boolean
}): Promise<'created' | 'skipped'> {
  const file = getComponentsConfigPath(params.cwd)

  if (existsSync(file) && !params.overwrite) {
    return 'skipped'
  }

  await mkdir(dirname(file), { recursive: true })
  await writeFile(
    file,
    `${JSON.stringify(normalizeComponentsConfig(params.config), null, 2)}\n`,
    'utf-8',
  )

  return 'created'
}

export async function updateComponentsConfig(params: {
  cwd: string
  updater: (config: ComponentsConfig) => ComponentsConfig
}): Promise<ComponentsConfig> {
  const current = readComponentsConfig(params.cwd)
  const next = normalizeComponentsConfig(params.updater(current))
  const file = getComponentsConfigPath(params.cwd)

  validateComponentsConfig(next)

  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf-8')

  return next
}

function normalizeAlias(alias: string): string {
  if (alias.startsWith('@/')) {
    return alias.slice(2)
  }

  if (alias === '@') {
    return ''
  }

  return alias.replace(/^\.?\//, '')
}

export function resolveAliasToPath(cwd: string, alias: string): string {
  if (isAbsolute(alias)) {
    return alias
  }

  if (alias.startsWith('@/')) {
    const withoutPrefix = normalizeAlias(alias)
    const srcRoot = resolve(cwd, 'src')

    if (existsSync(srcRoot)) {
      return resolve(srcRoot, withoutPrefix)
    }

    return resolve(cwd, withoutPrefix)
  }

  return resolve(cwd, normalizeAlias(alias))
}

export function resolveRegistryTarget(
  cwd: string,
  config: ComponentsConfig,
  target: string,
): string {
  if (target === 'lib' || target.startsWith('lib/')) {
    const rest = target === 'lib' ? '' : target.slice('lib/'.length)
    return resolve(resolveAliasToPath(cwd, config.aliases.lib), rest)
  }

  if (target === 'components/ui' || target.startsWith('components/ui/')) {
    const rest =
      target === 'components/ui' ? '' : target.slice('components/ui/'.length)
    return resolve(resolveAliasToPath(cwd, config.aliases.ui), rest)
  }

  if (target === 'components' || target.startsWith('components/')) {
    const rest =
      target === 'components' ? '' : target.slice('components/'.length)
    return resolve(resolveAliasToPath(cwd, config.aliases.components), rest)
  }

  return resolve(cwd, target)
}

export function toRelativeProjectPath(cwd: string, file: string): string {
  return relative(cwd, file).replace(/\\/g, '/')
}

function createThemeImport(style: ThemeName): string {
  return `@import '@zeus-web/themes/${style}.css';`
}

function createThemeOverrideCss(config: ComponentsConfig): string {
  const theme = createDefaultThemeConfig(config.theme)
  const radius = radiusPresets[theme.radius]
  const motion = motionPresets[theme.motion]
  const lines = [
    themeOverrideStart,
    ':root {',
    `  --radius: ${radius};`,
    `  --zw-duration-fast: ${motion.durationFast};`,
    `  --zw-duration-normal: ${motion.durationNormal};`,
    `  --zw-duration-slow: ${motion.durationSlow};`,
    `  --zw-easing-standard: ${motion.easingStandard};`,
    `  --zw-easing-emphasized: ${motion.easingEmphasized};`,
  ]

  if (theme.accentColor) {
    lines.push(`  --primary: ${theme.accentColor};`)
    lines.push(`  --ring: ${theme.accentColor};`)
  }

  lines.push(`  --zw-theme-dark-mode: ${theme.darkMode};`)
  lines.push('}')
  lines.push(themeOverrideEnd)

  return `${lines.join('\n')}\n`
}

function replaceThemeImport(source: string, style: ThemeName): string {
  const importPattern = /@import ['"]@zeus-web\/themes\/[a-z-]+\.css['"];\n?/g
  const nextImport = `${createThemeImport(style)}\n`

  if (importPattern.test(source)) {
    return source.replace(importPattern, nextImport)
  }

  return source.endsWith('\n')
    ? `${source}${nextImport}`
    : `${source}\n${nextImport}`
}

function upsertThemeOverride(source: string, config: ComponentsConfig): string {
  const block = createThemeOverrideCss(config)
  const start = source.indexOf(themeOverrideStart)
  const end = source.indexOf(themeOverrideEnd)

  if (start >= 0 && end >= start) {
    const before = source.slice(0, start)
    const after = source.slice(end + themeOverrideEnd.length)

    return `${before}${block}${after.replace(/^\n/, '')}`
  }

  return source.endsWith('\n') ? `${source}${block}` : `${source}\n${block}`
}

export async function ensureThemeCss(params: {
  cwd: string
  config: ComponentsConfig
  overwrite: boolean
}): Promise<'created' | 'updated' | 'skipped'> {
  const config = normalizeComponentsConfig(params.config)
  const cssPath = resolve(params.cwd, config.tailwind.css)

  if (existsSync(cssPath)) {
    const current = readFileSync(cssPath, 'utf-8')
    const withImport = replaceThemeImport(current, config.style)
    const next = upsertThemeOverride(withImport, config)

    if (current === next) {
      return 'skipped'
    }

    if (params.overwrite) {
      await writeFile(
        cssPath,
        `${createThemeImport(config.style)}\n${createThemeOverrideCss(config)}`,
        'utf-8',
      )
      return 'updated'
    }

    await writeFile(cssPath, next, 'utf-8')
    return 'updated'
  }

  await mkdir(dirname(cssPath), { recursive: true })
  await writeFile(
    cssPath,
    `${createThemeImport(config.style)}\n${createThemeOverrideCss(config)}`,
    'utf-8',
  )

  return 'created'
}
```

---

# 4. 修改 `packages/cli/src/commands/init.ts`

只需要让 `init` 支持 Phase 13 参数：

```txt
--radius <none|sm|md|lg|xl>
--motion <none|reduced|normal|expressive>
--dark-mode <class|data|media>
--accent <hsl>
```

替换整个文件：

```ts
import type {
  DarkModeStrategyName,
  MotionPresetName,
  RadiusPresetName,
  ThemeName,
} from '@zeus-web/themes'
import type { PackageManager } from '../package-manager'

import { isAbsolute, resolve } from 'node:path'

import {
  darkModeStrategyNames,
  isDarkModeStrategyName,
  isMotionPresetName,
  isRadiusPresetName,
  themeNames,
} from '@zeus-web/themes'
import pc from 'picocolors'

import {
  createDefaultComponentsConfig,
  ensureThemeCss,
  readComponentsConfig,
  writeComponentsConfig,
} from '../config'
import {
  createInstallCommands,
  formatInstallCommands,
  installDependencies,
} from '../package-manager'

interface InitOptions {
  cwd: string
  style: ThemeName
  css: string
  radius: RadiusPresetName
  motion: MotionPresetName
  darkMode: DarkModeStrategyName
  accentColor?: string
  overwrite: boolean
  install: boolean
  packageManager?: PackageManager
}

interface ParsedInitArgs {
  options: InitOptions
}

function parsePackageManager(value: string): PackageManager {
  if (
    value === 'pnpm' ||
    value === 'npm' ||
    value === 'yarn' ||
    value === 'bun'
  ) {
    return value
  }

  throw new Error(`Unsupported package manager: ${value}`)
}

function parseThemeName(value: string): ThemeName {
  if ((themeNames as readonly string[]).includes(value)) {
    return value as ThemeName
  }

  throw new Error(
    `Unsupported style: ${value}. Available styles: ${themeNames.join(', ')}`,
  )
}

function parseRadius(value: string): RadiusPresetName {
  if (isRadiusPresetName(value)) return value

  throw new Error(`Unsupported radius preset: ${value}`)
}

function parseMotion(value: string): MotionPresetName {
  if (isMotionPresetName(value)) return value

  throw new Error(`Unsupported motion preset: ${value}`)
}

function parseDarkMode(value: string): DarkModeStrategyName {
  if (isDarkModeStrategyName(value)) return value

  throw new Error(
    `Unsupported dark mode strategy: ${value}. Available: ${darkModeStrategyNames.join(', ')}`,
  )
}

export function parseInitArgs(
  args: string[],
  cwd = process.cwd(),
): ParsedInitArgs {
  const options: InitOptions = {
    cwd,
    style: 'default',
    css: 'src/styles/globals.css',
    radius: 'md',
    motion: 'normal',
    darkMode: 'class',
    overwrite: false,
    install: true,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--overwrite') {
      options.overwrite = true
      continue
    }

    if (arg === '--no-install') {
      options.install = false
      continue
    }

    if (arg === '--cwd') {
      const value = args[index + 1]
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      continue
    }

    if (arg === '--style') {
      const value = args[index + 1]
      if (!value) throw new Error('--style requires a theme name')
      options.style = parseThemeName(value)
      index += 1
      continue
    }

    if (arg.startsWith('--style=')) {
      const value = arg.slice('--style='.length)
      if (!value) throw new Error('--style requires a theme name')
      options.style = parseThemeName(value)
      continue
    }

    if (arg === '--radius') {
      const value = args[index + 1]
      if (!value) throw new Error('--radius requires a preset name')
      options.radius = parseRadius(value)
      index += 1
      continue
    }

    if (arg.startsWith('--radius=')) {
      const value = arg.slice('--radius='.length)
      if (!value) throw new Error('--radius requires a preset name')
      options.radius = parseRadius(value)
      continue
    }

    if (arg === '--motion') {
      const value = args[index + 1]
      if (!value) throw new Error('--motion requires a preset name')
      options.motion = parseMotion(value)
      index += 1
      continue
    }

    if (arg.startsWith('--motion=')) {
      const value = arg.slice('--motion='.length)
      if (!value) throw new Error('--motion requires a preset name')
      options.motion = parseMotion(value)
      continue
    }

    if (arg === '--dark-mode') {
      const value = args[index + 1]
      if (!value) throw new Error('--dark-mode requires a strategy name')
      options.darkMode = parseDarkMode(value)
      index += 1
      continue
    }

    if (arg.startsWith('--dark-mode=')) {
      const value = arg.slice('--dark-mode='.length)
      if (!value) throw new Error('--dark-mode requires a strategy name')
      options.darkMode = parseDarkMode(value)
      continue
    }

    if (arg === '--accent') {
      const value = args[index + 1]
      if (!value) throw new Error('--accent requires a HSL value')
      options.accentColor = value
      index += 1
      continue
    }

    if (arg.startsWith('--accent=')) {
      const value = arg.slice('--accent='.length)
      if (!value) throw new Error('--accent requires a HSL value')
      options.accentColor = value
      continue
    }

    if (arg === '--css') {
      const value = args[index + 1]
      if (!value) throw new Error('--css requires a file path')
      options.css = value
      index += 1
      continue
    }

    if (arg.startsWith('--css=')) {
      const value = arg.slice('--css='.length)
      if (!value) throw new Error('--css requires a file path')
      options.css = value
      continue
    }

    if (arg === '--package-manager') {
      const value = args[index + 1]
      if (!value) throw new Error('--package-manager requires a value')
      options.packageManager = parsePackageManager(value)
      index += 1
      continue
    }

    if (arg.startsWith('--package-manager=')) {
      const value = arg.slice('--package-manager='.length)
      if (!value) throw new Error('--package-manager requires a value')
      options.packageManager = parsePackageManager(value)
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return { options }
}

function printInstallHint(options: InitOptions): void {
  const commands = createInstallCommands({
    cwd: options.cwd,
    packageManager: options.packageManager,
    dependencies: ['@zeus-web/themes'],
  })

  console.log(pc.bold('Install dependencies:'))

  for (const command of formatInstallCommands(commands)) {
    console.log(`  ${command}`)
  }
}

export async function init(args: string[]) {
  try {
    const { options } = parseInitArgs(args)

    const nextConfig = createDefaultComponentsConfig({
      style: options.style,
      css: options.css,
      theme: {
        radius: options.radius,
        motion: options.motion,
        darkMode: options.darkMode,
        accentColor: options.accentColor,
      },
    })

    const configResult = await writeComponentsConfig({
      cwd: options.cwd,
      config: nextConfig,
      overwrite: options.overwrite,
    })

    const activeConfig =
      configResult === 'created'
        ? nextConfig
        : readComponentsConfig(options.cwd)

    if (configResult === 'created') {
      console.log(pc.green('Created components.json'))
    } else {
      console.log(
        pc.yellow(
          'components.json already exists. Using existing config. Use --overwrite to replace it.',
        ),
      )
    }

    const cssResult = await ensureThemeCss({
      cwd: options.cwd,
      config: activeConfig,
      overwrite: false,
    })

    if (cssResult === 'created') {
      console.log(pc.green(`Created ${activeConfig.tailwind.css}`))
    } else if (cssResult === 'updated') {
      console.log(pc.green(`Updated ${activeConfig.tailwind.css}`))
    } else {
      console.log(
        pc.gray(`${activeConfig.tailwind.css} already includes theme import.`),
      )
    }

    if (options.install) {
      await installDependencies({
        cwd: options.cwd,
        packageManager: options.packageManager,
        dependencies: ['@zeus-web/themes'],
      })
    } else {
      printInstallHint(options)
    }
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
```

---

# 5. 新增 `packages/cli/src/commands/theme.ts`

```ts
import type {
  DarkModeStrategyName,
  MotionPresetName,
  RadiusPresetName,
  ThemeName,
} from '@zeus-web/themes'

import { isAbsolute, resolve } from 'node:path'

import {
  darkModeStrategyNames,
  getThemeTokens,
  getThemeTokensJson,
  isDarkModeStrategyName,
  isMotionPresetName,
  isRadiusPresetName,
  isThemeName,
  motionPresetNames,
  radiusPresetNames,
  themeNames,
} from '@zeus-web/themes'
import pc from 'picocolors'

import {
  ensureThemeCss,
  readComponentsConfig,
  updateComponentsConfig,
} from '../config'

type ThemeSubcommand = 'list' | 'tokens' | 'set'

interface BaseThemeOptions {
  cwd: string
  json: boolean
}

interface ThemeSetOptions extends BaseThemeOptions {
  style?: ThemeName
  radius?: RadiusPresetName
  motion?: MotionPresetName
  darkMode?: DarkModeStrategyName
  accentColor?: string
}

function resolveCwdValue(base: string, value: string): string {
  return isAbsolute(value) ? value : resolve(base, value)
}

function parseStyle(value: string): ThemeName {
  if (isThemeName(value)) return value
  throw new Error(
    `Unsupported theme: ${value}. Available: ${themeNames.join(', ')}`,
  )
}

function parseRadius(value: string): RadiusPresetName {
  if (isRadiusPresetName(value)) return value
  throw new Error(
    `Unsupported radius preset: ${value}. Available: ${radiusPresetNames.join(', ')}`,
  )
}

function parseMotion(value: string): MotionPresetName {
  if (isMotionPresetName(value)) return value
  throw new Error(
    `Unsupported motion preset: ${value}. Available: ${motionPresetNames.join(', ')}`,
  )
}

function parseDarkMode(value: string): DarkModeStrategyName {
  if (isDarkModeStrategyName(value)) return value
  throw new Error(
    `Unsupported dark mode strategy: ${value}. Available: ${darkModeStrategyNames.join(', ')}`,
  )
}

function parseBaseOptions(
  args: string[],
  cwd = process.cwd(),
): {
  positional: string[]
  options: BaseThemeOptions
} {
  const positional: string[] = []
  const options: BaseThemeOptions = {
    cwd,
    json: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg === '--cwd') {
      const value = args[index + 1]
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwdValue(cwd, value)
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwdValue(cwd, value)
      continue
    }

    if (arg.startsWith('-')) {
      positional.push(arg)
      continue
    }

    positional.push(arg)
  }

  return {
    positional,
    options,
  }
}

function parseSetOptions(args: string[], cwd = process.cwd()): ThemeSetOptions {
  const options: ThemeSetOptions = {
    cwd,
    json: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (index === 0 && !arg.startsWith('-')) {
      options.style = parseStyle(arg)
      continue
    }

    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg === '--cwd') {
      const value = args[index + 1]
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwdValue(cwd, value)
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwdValue(cwd, value)
      continue
    }

    if (arg === '--radius') {
      const value = args[index + 1]
      if (!value) throw new Error('--radius requires a preset name')
      options.radius = parseRadius(value)
      index += 1
      continue
    }

    if (arg.startsWith('--radius=')) {
      const value = arg.slice('--radius='.length)
      if (!value) throw new Error('--radius requires a preset name')
      options.radius = parseRadius(value)
      continue
    }

    if (arg === '--motion') {
      const value = args[index + 1]
      if (!value) throw new Error('--motion requires a preset name')
      options.motion = parseMotion(value)
      index += 1
      continue
    }

    if (arg.startsWith('--motion=')) {
      const value = arg.slice('--motion='.length)
      if (!value) throw new Error('--motion requires a preset name')
      options.motion = parseMotion(value)
      continue
    }

    if (arg === '--dark-mode') {
      const value = args[index + 1]
      if (!value) throw new Error('--dark-mode requires a strategy name')
      options.darkMode = parseDarkMode(value)
      index += 1
      continue
    }

    if (arg.startsWith('--dark-mode=')) {
      const value = arg.slice('--dark-mode='.length)
      if (!value) throw new Error('--dark-mode requires a strategy name')
      options.darkMode = parseDarkMode(value)
      continue
    }

    if (arg === '--accent') {
      const value = args[index + 1]
      if (!value) throw new Error('--accent requires a HSL value')
      options.accentColor = value
      index += 1
      continue
    }

    if (arg.startsWith('--accent=')) {
      const value = arg.slice('--accent='.length)
      if (!value) throw new Error('--accent requires a HSL value')
      options.accentColor = value
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }

    throw new Error(`Unexpected argument: ${arg}`)
  }

  return options
}

function printThemeList(): void {
  console.log(pc.bold('Themes:'))
  for (const theme of themeNames) {
    console.log(`  ${theme}`)
  }

  console.log('')
  console.log(pc.bold('Radius presets:'))
  for (const preset of radiusPresetNames) {
    console.log(`  ${preset}`)
  }

  console.log('')
  console.log(pc.bold('Motion presets:'))
  for (const preset of motionPresetNames) {
    console.log(`  ${preset}`)
  }

  console.log('')
  console.log(pc.bold('Dark mode strategies:'))
  for (const strategy of darkModeStrategyNames) {
    console.log(`  ${strategy}`)
  }
}

async function themeList(args: string[]): Promise<void> {
  const { options } = parseBaseOptions(args)

  if (options.json) {
    console.log(JSON.stringify(getThemeTokensJson(), null, 2))
    return
  }

  printThemeList()
}

async function themeTokens(args: string[]): Promise<void> {
  const { positional, options } = parseBaseOptions(args)
  const candidate = positional.find(arg => !arg.startsWith('-'))
  const theme = candidate ? parseStyle(candidate) : 'default'
  const tokens = getThemeTokens(theme)

  if (options.json) {
    console.log(JSON.stringify(tokens, null, 2))
    return
  }

  console.log(pc.bold(`Theme tokens: ${theme}`))
  console.log(`CSS import: ${tokens.cssImport}`)
  console.log('Colors:')

  for (const [name, value] of Object.entries(tokens.colors)) {
    console.log(`  --${name}: ${value};`)
  }
}

async function themeSet(args: string[]): Promise<void> {
  const options = parseSetOptions(args)
  const current = readComponentsConfig(options.cwd)

  const nextConfig = await updateComponentsConfig({
    cwd: options.cwd,
    updater: config => ({
      ...config,
      style: options.style ?? config.style,
      theme: {
        ...config.theme,
        radius: options.radius ?? config.theme.radius,
        motion: options.motion ?? config.theme.motion,
        darkMode: options.darkMode ?? config.theme.darkMode,
        accentColor:
          options.accentColor === undefined
            ? config.theme.accentColor
            : options.accentColor,
      },
    }),
  })

  await ensureThemeCss({
    cwd: options.cwd,
    config: nextConfig,
    overwrite: false,
  })

  if (options.json) {
    console.log(JSON.stringify(nextConfig, null, 2))
    return
  }

  console.log(pc.green(`Updated ${current.tailwind.css}`))
  console.log(`Theme: ${nextConfig.style}`)
  console.log(`Radius: ${nextConfig.theme.radius}`)
  console.log(`Motion: ${nextConfig.theme.motion}`)
  console.log(`Dark mode: ${nextConfig.theme.darkMode}`)

  if (nextConfig.theme.accentColor) {
    console.log(`Accent: ${nextConfig.theme.accentColor}`)
  }
}

export async function theme(args: string[]): Promise<void> {
  try {
    const [subcommand, ...rest] = args
    const command = (subcommand ?? 'list') as ThemeSubcommand

    if (command === 'list') {
      await themeList(rest)
      return
    }

    if (command === 'tokens') {
      await themeTokens(rest)
      return
    }

    if (command === 'set') {
      await themeSet(rest)
      return
    }

    throw new Error(`Unknown theme command: ${String(subcommand)}`)
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
```

---

# 6. 修改 `packages/cli/src/index.ts`

在 imports 里加：

```ts
import { theme } from './commands/theme'
```

在 switch 里加到 `doctor` 和 `ai` 之间：

```ts
    case 'theme':
      await theme(args)
      break
```

替换 `printHelp()`：

```ts
function printHelp() {
  console.log(`\n${pc.bold('zweb')} - Zeus Web CLI\n`)
  console.log('Usage:')
  console.log('  zweb init')
  console.log('  zweb init --style slate --css src/styles/globals.css')
  console.log('  zweb init --style zinc --radius lg --motion reduced')
  console.log('  zweb add button')
  console.log('  zweb add button input dialog')
  console.log('  zweb add --all')
  console.log('  zweb list')
  console.log('  zweb list --json')
  console.log('  zweb diff button')
  console.log('  zweb diff --all')
  console.log('  zweb update button')
  console.log('  zweb update --all')
  console.log('  zweb doctor')
  console.log('  zweb theme list')
  console.log('  zweb theme list --json')
  console.log('  zweb theme tokens')
  console.log('  zweb theme tokens slate --json')
  console.log('  zweb theme set slate')
  console.log('  zweb theme set zinc --radius lg --motion reduced')
  console.log('  zweb theme set default --accent "240 5.9% 10%"')
  console.log('  zweb ai')
  console.log('  zweb ai --cursor')
  console.log('  zweb ai --json')
  console.log('')
  console.log('Options:')
  console.log('  --cwd <dir>                 Use a specific project directory')
  console.log('  --style <name>              Theme style for init')
  console.log('  --css <file>                Tailwind css file for init')
  console.log('  --radius <name>             none | sm | md | lg | xl')
  console.log(
    '  --motion <name>             none | reduced | normal | expressive',
  )
  console.log('  --dark-mode <name>          class | data | media')
  console.log('  --accent <hsl>              Override primary/ring HSL value')
  console.log('  --all                       Select all registry components')
  console.log(
    '  --dry-run                   Print the plan without writing files',
  )
  console.log('  --overwrite, --force        Replace existing files')
  console.log('  --no-install, --skip-deps   Do not install dependencies')
  console.log('  --yes, -y                   Skip confirmations when supported')
  console.log('  --package-manager <name>    pnpm | npm | yarn | bun')
  console.log('  --json                      Print JSON output')
  console.log('  --format <name>             markdown | json')
  console.log('  --output <file>             Output file path')
  console.log('  --cursor                    Write .cursor/rules/zeus-web.mdc')
}
```

---

# 7. 替换 `packages/themes/__tests__/themes.spec.ts`

```ts
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  darkModeStrategyNames,
  getThemeCssImport,
  getThemeTokens,
  getThemeTokensJson,
  isDarkModeStrategyName,
  isMotionPresetName,
  isRadiusPresetName,
  isThemeName,
  motionPresetNames,
  motionPresets,
  motionTokens,
  radiusPresetNames,
  radiusPresets,
  semanticColorTokens,
  themeCssImports,
  themeNames,
  themeRegistry,
} from '../src'

const testDir = dirname(fileURLToPath(import.meta.url))
const themesSrcDir = resolve(testDir, '../src')

function readThemeFile(file: string): string {
  return readFileSync(resolve(themesSrcDir, file), 'utf-8')
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

  it('checks phase 13 preset guards', () => {
    expect(isRadiusPresetName('md')).toBe(true)
    expect(isRadiusPresetName('xxl')).toBe(false)
    expect(isMotionPresetName('normal')).toBe(true)
    expect(isMotionPresetName('slow')).toBe(false)
    expect(isDarkModeStrategyName('class')).toBe(true)
    expect(isDarkModeStrategyName('auto')).toBe(false)
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
    expect(source).toContain('--ease-zeus-standard: var(--zw-easing-standard);')
    expect(source).toContain(
      '--animate-duration-normal: var(--zw-duration-normal);',
    )
  })

  it('declares motion presets in tokens.css', () => {
    const source = readThemeFile('tokens.css')

    for (const token of motionTokens) {
      expect(token).toBeTruthy()
    }

    expect(source).toContain("[data-motion='none']")
    expect(source).toContain("[data-motion='reduced']")
    expect(source).toContain("[data-motion='normal']")
    expect(source).toContain("[data-motion='expressive']")
    expect(source).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('supports dark mode selectors in every theme file', () => {
    for (const theme of themeNames) {
      const source = readThemeFile(`${theme}.css`)

      expect(source).toContain('.dark')
      expect(source).toContain(`[data-theme='${theme}']`)
    }
  })

  it('exposes phase 13 token registries', () => {
    expect(Object.keys(themeRegistry)).toEqual(themeNames)
    expect(Object.keys(radiusPresets)).toEqual(radiusPresetNames)
    expect(Object.keys(motionPresets)).toEqual(motionPresetNames)
    expect(darkModeStrategyNames).toEqual(['class', 'data', 'media'])
    expect(getThemeTokens('slate').cssImport).toBe('@zeus-web/themes/slate.css')
  })

  it('exports serializable theme tokens json', () => {
    const json = getThemeTokensJson()

    expect(json.themes).toEqual(themeNames)
    expect(json.radiusPresets.md).toBe('0.5rem')
    expect(json.motionPresets.normal.durationNormal).toBe('180ms')
    expect(JSON.parse(JSON.stringify(json))).toEqual(json)
  })
})
```

---

# 8. 新增 `packages/cli/__tests__/phase13-theme.spec.ts`

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  createDefaultComponentsConfig,
  ensureThemeCss,
  readComponentsConfig,
  updateComponentsConfig,
} from '../src/config'
import { parseInitArgs } from '../src/commands/init'

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-cli-phase13-'))
}

function writeComponentsJson(root: string): void {
  mkdirSync(resolve(root, 'src/styles'), { recursive: true })
  writeFileSync(
    resolve(root, 'components.json'),
    `${JSON.stringify(createDefaultComponentsConfig(), null, 2)}\n`,
    'utf-8',
  )
}

describe('@zeus-web/cli phase 13 theme workflow', () => {
  it('parses init theme options', () => {
    const parsed = parseInitArgs([
      '--style',
      'slate',
      '--radius',
      'lg',
      '--motion',
      'reduced',
      '--dark-mode',
      'data',
      '--accent',
      '220 90% 56%',
      '--no-install',
    ])

    expect(parsed.options.style).toBe('slate')
    expect(parsed.options.radius).toBe('lg')
    expect(parsed.options.motion).toBe('reduced')
    expect(parsed.options.darkMode).toBe('data')
    expect(parsed.options.accentColor).toBe('220 90% 56%')
    expect(parsed.options.install).toBe(false)
  })

  it('creates default config with phase 13 theme config', () => {
    const config = createDefaultComponentsConfig({
      style: 'zinc',
      theme: {
        radius: 'xl',
        motion: 'expressive',
        darkMode: 'media',
        accentColor: '240 5.9% 10%',
      },
    })

    expect(config.style).toBe('zinc')
    expect(config.theme).toEqual({
      radius: 'xl',
      motion: 'expressive',
      darkMode: 'media',
      accentColor: '240 5.9% 10%',
    })
  })

  it('writes managed theme override block', async () => {
    const root = await createTempDir()

    try {
      const config = createDefaultComponentsConfig({
        style: 'slate',
        theme: {
          radius: 'lg',
          motion: 'reduced',
          darkMode: 'data',
          accentColor: '220 90% 56%',
        },
      })

      const result = await ensureThemeCss({
        cwd: root,
        config,
        overwrite: false,
      })

      const css = readFileSync(resolve(root, 'src/styles/globals.css'), 'utf-8')

      expect(result).toBe('created')
      expect(css).toContain("@import '@zeus-web/themes/slate.css';")
      expect(css).toContain('/* zeus-web theme overrides:start */')
      expect(css).toContain('--radius: 0.75rem;')
      expect(css).toContain('--zw-duration-normal: 120ms;')
      expect(css).toContain('--primary: 220 90% 56%;')
      expect(css).toContain('--zw-theme-dark-mode: data;')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('updates existing theme import and override block', async () => {
    const root = await createTempDir()

    try {
      mkdirSync(resolve(root, 'src/styles'), { recursive: true })
      writeFileSync(
        resolve(root, 'src/styles/globals.css'),
        [
          "@import '@zeus-web/themes/default.css';",
          'body { margin: 0; }',
          '/* zeus-web theme overrides:start */',
          ':root {',
          '  --radius: 0.5rem;',
          '}',
          '/* zeus-web theme overrides:end */',
          '',
        ].join('\n'),
        'utf-8',
      )

      const config = createDefaultComponentsConfig({
        style: 'stone',
        theme: {
          radius: 'xl',
          motion: 'expressive',
          darkMode: 'class',
        },
      })

      await ensureThemeCss({
        cwd: root,
        config,
        overwrite: false,
      })

      const css = readFileSync(resolve(root, 'src/styles/globals.css'), 'utf-8')

      expect(css).toContain("@import '@zeus-web/themes/stone.css';")
      expect(css).toContain('body { margin: 0; }')
      expect(css).toContain('--radius: 1rem;')
      expect(css).toContain('--zw-duration-normal: 220ms;')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('updates components.json theme config', async () => {
    const root = await createTempDir()

    try {
      writeComponentsJson(root)

      await updateComponentsConfig({
        cwd: root,
        updater: config => ({
          ...config,
          style: 'neutral',
          theme: {
            ...config.theme,
            radius: 'sm',
            motion: 'none',
            darkMode: 'media',
          },
        }),
      })

      const config = readComponentsConfig(root)

      expect(config.style).toBe('neutral')
      expect(config.theme.radius).toBe('sm')
      expect(config.theme.motion).toBe('none')
      expect(config.theme.darkMode).toBe('media')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
```

然后修改 `packages/cli/package.json` 的 test，把 `phase13-theme.spec.ts` 加进去：

```json
{
  "scripts": {
    "test": "vitest --root ../.. --project unit packages/cli/__tests__/add.spec.ts packages/cli/__tests__/ai.spec.ts packages/cli/__tests__/config.spec.ts packages/cli/__tests__/init.spec.ts packages/cli/__tests__/package-manager.spec.ts packages/cli/__tests__/phase12-cli.spec.ts packages/cli/__tests__/phase13-theme.spec.ts"
  }
}
```

---

# 9. Docs 更新建议

## 修改 `apps/docs/guide/theming.md`

追加：

````md
## CLI theme commands

```bash
zweb theme list
zweb theme list --json
zweb theme tokens
zweb theme tokens slate --json
zweb theme set slate
zweb theme set zinc --radius lg --motion reduced
zweb theme set default --accent "240 5.9% 10%"
```
````

## Theme config

`components.json` stores theme settings:

```json
{
  "style": "zinc",
  "theme": {
    "radius": "md",
    "motion": "normal",
    "darkMode": "class",
    "accentColor": "240 5.9% 10%"
  }
}
```

## Managed CSS override

`zweb init` and `zweb theme set` maintain a managed block in your CSS file:

```css
/* zeus-web theme overrides:start */
:root {
  --radius: 0.5rem;
  --zw-duration-fast: 120ms;
  --zw-duration-normal: 180ms;
  --zw-duration-slow: 260ms;
  --zw-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --zw-easing-emphasized: cubic-bezier(0.16, 1, 0.3, 1);
}
/* zeus-web theme overrides:end */
```

````

---

# 10. 验收命令

```bash
pnpm --filter @zeus-web/themes check
pnpm --filter @zeus-web/themes test
pnpm --filter @zeus-web/themes build

pnpm --filter @zeus-web/cli check
pnpm --filter @zeus-web/cli test
pnpm --filter @zeus-web/cli build

pnpm test
pnpm check
pnpm build
pnpm check:exports
pnpm check:build-output

pnpm docs:check
pnpm docs:build
pnpm site:check
````

手动验证：

```bash
node packages/cli/dist/index.js theme list
node packages/cli/dist/index.js theme list --json
node packages/cli/dist/index.js theme tokens
node packages/cli/dist/index.js theme tokens slate --json
node packages/cli/dist/index.js theme set zinc --radius lg --motion reduced --dry-run
```

> 上面 `theme set` 这版没有实现 `--dry-run`，如果你想支持 dry-run，可以作为 Phase 13.1 小补丁。当前建议先不加，避免修改链路分叉。

---

# 建议提交

```txt
feat(themes): add typed token registry and presets
feat(cli): add theme list tokens and set commands
feat(cli): persist theme presets in components config
test(themes): cover phase 13 token registry
test(cli): cover theme config and css override workflow
docs: document theme workflow
```

Phase 13 做完后，主题系统就从“导入某个 css 文件”升级为“可配置、可枚举、可导出、可被 CLI 管理”的主题生态。下一阶段按原路线进入：

```txt
Phase 14：Icons 生态
```
