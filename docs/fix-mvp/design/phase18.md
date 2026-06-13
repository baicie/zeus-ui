下面给 **Phase 18：CLI init 与项目配置初始化** 的详细设计与完整代码。

这一阶段的重点不是再造 registry，也不是做 `add` 安装组件，而是把现有旧版 `zweb init` 从“theme 初始化命令”升级成真正的 **Zeus-UI 项目初始化命令**。

当前 `packages/cli` 已经有 `zweb` bin 入口，并且 `init/add/list/diff/update/...` 都已经挂在 CLI 入口里。
但当前 `init` 仍然写 `components.json`、只支持 `framework: 'react'`、并且主要做 `@zeus-web/themes` CSS import 初始化。  
Phase 18 要把它升级成：

```txt
zweb init
  -> 检测 React / Vue
  -> 生成 zeus-ui.json
  -> 生成 lib/cn.ts
  -> 生成 styles/zeus.css
  -> 保留旧 components.json 读取兼容
  -> 支持 --dry-run / --overwrite / --framework / --cwd
```

---

# Phase 18 目标

```txt
Phase 18 = CLI init and project configuration

新增 / 改造：
  - zeus-ui.json 项目配置
  - React/Vue framework 检测
  - TypeScript 检测
  - package manager 检测
  - cn util 初始化
  - zeus.css 初始化
  - dry-run 初始化计划
  - check-cli-init 脚本
  - init 单测重写
  - roadmap Phase 18 Done

不做：
  - 不实现 zweb add 的完整写入体验
  - 不安装 button/input 组件
  - 不处理 registry update/diff
  - 不切 showcase 到 registry usage
```

---

# 1. 修改根 `package.json`

新增：

```json
"check:cli-init": "tsx scripts/checks/check-cli-init.ts"
```

并接入 `site:check`。

```json
{
  "scripts": {
    "check:component-coverage": "tsx scripts/checks/check-component-coverage.ts",
    "check:showcase-metadata": "tsx scripts/checks/check-showcase-metadata.ts",
    "check:showcase-implementation": "tsx scripts/checks/check-showcase-implementation.ts",
    "check:product-layers": "tsx scripts/checks/check-product-layers.ts",
    "check:ui-package": "tsx scripts/checks/check-ui-package.ts",
    "check:registry": "tsx scripts/checks/check-registry.ts",
    "check:cli-init": "tsx scripts/checks/check-cli-init.ts",
    "site:check": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:product-layers && pnpm check:ui-package && pnpm check:registry && pnpm check:cli-init && pnpm docs:check && pnpm docs:build && pnpm examples:check && pnpm showcase:test"
  }
}
```

---

# 2. 新增 `packages/cli/src/project.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { PackageManager } from './package-manager'

export type SupportedFramework = 'react' | 'vue'

export interface ProjectDetectionResult {
  framework: SupportedFramework
  typescript: boolean
  srcDir: string
  packageManager?: PackageManager
}

interface PackageJsonLike {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function readPackageJson(cwd: string): PackageJsonLike | null {
  const file = resolve(cwd, 'package.json')
  if (!existsSync(file)) return null

  return JSON.parse(readFileSync(file, 'utf-8')) as PackageJsonLike
}

function hasDependency(
  packageJson: PackageJsonLike | null,
  dependency: string,
): boolean {
  if (!packageJson) return false

  return Boolean(
    packageJson.dependencies?.[dependency] ||
    packageJson.devDependencies?.[dependency],
  )
}

export function detectPackageManager(cwd: string): PackageManager | undefined {
  if (existsSync(resolve(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(resolve(cwd, 'package-lock.json'))) return 'npm'
  if (existsSync(resolve(cwd, 'yarn.lock'))) return 'yarn'
  if (
    existsSync(resolve(cwd, 'bun.lockb')) ||
    existsSync(resolve(cwd, 'bun.lock'))
  ) {
    return 'bun'
  }

  return undefined
}

export function detectProject(cwd: string): ProjectDetectionResult {
  const packageJson = readPackageJson(cwd)

  const hasReact = hasDependency(packageJson, 'react')
  const hasVue = hasDependency(packageJson, 'vue')

  if (hasReact && hasVue) {
    throw new Error(
      'Both React and Vue dependencies were detected. Pass --framework react or --framework vue.',
    )
  }

  const framework: SupportedFramework = hasVue ? 'vue' : 'react'

  const typescript =
    existsSync(resolve(cwd, 'tsconfig.json')) ||
    hasDependency(packageJson, 'typescript')

  const srcDir = existsSync(resolve(cwd, 'src')) ? 'src' : '.'

  return {
    framework,
    typescript,
    srcDir,
    packageManager: detectPackageManager(cwd),
  }
}
```

---

# 3. 新增 `packages/cli/src/registry-assets.ts`

用于从 `@zeus-web/registry` 读取模板。Phase 18 会复用 `cn.ts` 和 `globals.css`。

```ts
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export function readRegistryAsset(exportPath: string): string {
  const path = require.resolve(`@zeus-web/registry/${exportPath}`)
  return readFileSync(path, 'utf-8')
}

export function readRegistryCnTemplate(): string {
  return readRegistryAsset('templates/lib/cn.ts')
}

export function readRegistryGlobalsTemplate(): string {
  return readRegistryAsset('templates/css/globals.css')
}
```

---

# 4. 替换 `packages/cli/src/config.ts`

完整替换：

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

import {
  readRegistryCnTemplate,
  readRegistryGlobalsTemplate,
} from './registry-assets'

export type ComponentsFramework = 'react' | 'vue'

export interface ComponentsThemeConfig {
  radius: RadiusPresetName
  motion: MotionPresetName
  darkMode: DarkModeStrategyName
  accentColor?: string
}

export interface ComponentsConfig {
  $schema: string
  framework: ComponentsFramework
  style: ThemeName
  typescript: boolean
  srcDir: string
  theme: ComponentsThemeConfig
  tailwind: { css: string; cssVariables: boolean }
  aliases: {
    components: string
    ui: string
    lib: string
    styles: string
  }
}

export interface CreateConfigOptions {
  framework?: ComponentsFramework
  style?: ThemeName
  css?: string
  typescript?: boolean
  srcDir?: string
  theme?: Partial<ComponentsThemeConfig>
}

export const zeusUiConfigFileName = 'zeus-ui.json'
export const legacyComponentsConfigFileName = 'components.json'

export const themeOverrideStart = '/* zeus-web theme overrides:start */'
export const themeOverrideEnd = '/* zeus-web theme overrides:end */'

export const registryGlobalsStart = '/* zeus-web registry globals:start */'
export const registryGlobalsEnd = '/* zeus-web registry globals:end */'

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
  const srcDir = options.srcDir ?? 'src'
  const css = options.css ?? `${srcDir}/styles/zeus.css`

  return {
    $schema: 'https://zeus-web.dev/schema/zeus-ui.json',
    framework: options.framework ?? 'react',
    style: options.style ?? 'default',
    typescript: options.typescript ?? true,
    srcDir,
    theme: createDefaultThemeConfig(options.theme),
    tailwind: {
      css,
      cssVariables: true,
    },
    aliases: {
      components: '@/components',
      ui: '@/components/ui',
      lib: '@/lib',
      styles: '@/styles',
    },
  }
}

export function getComponentsConfigPath(cwd: string): string {
  return resolve(cwd, zeusUiConfigFileName)
}

export function getLegacyComponentsConfigPath(cwd: string): string {
  return resolve(cwd, legacyComponentsConfigFileName)
}

export function readComponentsConfig(cwd: string): ComponentsConfig {
  const file = existsSync(getComponentsConfigPath(cwd))
    ? getComponentsConfigPath(cwd)
    : getLegacyComponentsConfigPath(cwd)

  if (!existsSync(file)) {
    throw new Error('zeus-ui.json not found. Run `zweb init` first.')
  }

  const config = normalizeComponentsConfig(
    JSON.parse(readFileSync(file, 'utf-8')) as ComponentsConfig,
  )

  validateComponentsConfig(config)

  return config
}

export function normalizeComponentsConfig(
  config: ComponentsConfig,
): ComponentsConfig {
  return {
    ...createDefaultComponentsConfig({
      framework: config.framework,
      style: config.style,
      css: config.tailwind?.css,
      typescript: config.typescript,
      srcDir: config.srcDir,
      theme: config.theme,
    }),
    ...config,
    theme: createDefaultThemeConfig(config.theme),
    tailwind: {
      css: config.tailwind?.css ?? 'src/styles/zeus.css',
      cssVariables: config.tailwind?.cssVariables ?? true,
    },
    aliases: {
      components: config.aliases?.components ?? '@/components',
      ui: config.aliases?.ui ?? '@/components/ui',
      lib: config.aliases?.lib ?? '@/lib',
      styles: config.aliases?.styles ?? '@/styles',
    },
  }
}

export function validateComponentsConfig(config: ComponentsConfig): void {
  if (config.framework !== 'react' && config.framework !== 'vue') {
    throw new Error('Only framework "react" and "vue" are supported.')
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

  if (typeof config.typescript !== 'boolean') {
    throw new Error('zeus-ui.json missing boolean typescript field')
  }

  if (!config.srcDir) {
    throw new Error('zeus-ui.json missing srcDir')
  }

  if (!config.tailwind?.css) {
    throw new Error('zeus-ui.json missing tailwind.css')
  }

  if (!config.aliases?.components) {
    throw new Error('zeus-ui.json missing aliases.components')
  }

  if (!config.aliases?.ui) {
    throw new Error('zeus-ui.json missing aliases.ui')
  }

  if (!config.aliases?.lib) {
    throw new Error('zeus-ui.json missing aliases.lib')
  }

  if (!config.aliases?.styles) {
    throw new Error('zeus-ui.json missing aliases.styles')
  }
}

export async function writeComponentsConfig(params: {
  cwd: string
  config: ComponentsConfig
  overwrite: boolean
}): Promise<'created' | 'skipped'> {
  const file = getComponentsConfigPath(params.cwd)

  if (existsSync(file) && !params.overwrite) return 'skipped'

  const config = normalizeComponentsConfig(params.config)
  validateComponentsConfig(config)

  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')

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
  if (alias.startsWith('@/')) return alias.slice(2)
  if (alias === '@') return ''
  return alias.replace(/^\.?\//, '')
}

export function resolveAliasToPath(cwd: string, alias: string): string {
  if (isAbsolute(alias)) return alias

  if (alias.startsWith('@/')) {
    const withoutPrefix = normalizeAlias(alias)
    const srcRoot = resolve(cwd, 'src')

    return existsSync(srcRoot)
      ? resolve(srcRoot, withoutPrefix)
      : resolve(cwd, withoutPrefix)
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

  if (target === 'styles' || target.startsWith('styles/')) {
    const rest = target === 'styles' ? '' : target.slice('styles/'.length)
    return resolve(resolveAliasToPath(cwd, config.aliases.styles), rest)
  }

  return resolve(cwd, target)
}

export function toRelativeProjectPath(cwd: string, file: string): string {
  return relative(cwd, file).replace(/\\/g, '/')
}

function createThemeOverrideCss(config: ComponentsConfig): string {
  const theme = createDefaultThemeConfig(config.theme)
  const radius = radiusPresets[theme.radius]
  const motion = motionPresets[theme.motion]

  const lines = [
    themeOverrideStart,
    ':root {',
    `  --radius: ${radius};`,
    `  --zeus-radius-sm: ${theme.radius === 'none' ? '0rem' : '0.25rem'};`,
    `  --zeus-radius-md: ${radius};`,
    `  --zeus-radius-lg: ${theme.radius === 'none' ? '0rem' : '0.5rem'};`,
    `  --zw-duration-fast: ${motion.durationFast};`,
    `  --zw-duration-normal: ${motion.durationNormal};`,
    `  --zw-duration-slow: ${motion.durationSlow};`,
    `  --zw-easing-standard: ${motion.easingStandard};`,
    `  --zw-easing-emphasized: ${motion.easingEmphasized};`,
  ]

  if (theme.accentColor) {
    lines.push(`  --zeus-primary: ${theme.accentColor};`)
    lines.push(`  --zeus-ring: ${theme.accentColor};`)
    lines.push(`  --primary: ${theme.accentColor};`)
    lines.push(`  --ring: ${theme.accentColor};`)
  }

  lines.push(`  --zw-theme-dark-mode: ${theme.darkMode};`)
  lines.push('}')
  lines.push(themeOverrideEnd)

  return `${lines.join('\n')}\n`
}

function createRegistryGlobalsBlock(): string {
  const globals = readRegistryGlobalsTemplate().trim()

  return [registryGlobalsStart, globals, registryGlobalsEnd, ''].join('\n')
}

function replaceMarkedBlock(params: {
  source: string
  start: string
  end: string
  block: string
}): string {
  const startIndex = params.source.indexOf(params.start)
  const endIndex = params.source.indexOf(params.end)

  if (startIndex >= 0 && endIndex >= startIndex) {
    return `${params.source.slice(0, startIndex)}${params.block}${params.source.slice(endIndex + params.end.length).replace(/^\n/, '')}`
  }

  return params.source.endsWith('\n')
    ? `${params.source}${params.block}`
    : `${params.source}\n${params.block}`
}

function upsertRegistryGlobals(source: string): string {
  return replaceMarkedBlock({
    source,
    start: registryGlobalsStart,
    end: registryGlobalsEnd,
    block: createRegistryGlobalsBlock(),
  })
}

function upsertThemeOverride(source: string, config: ComponentsConfig): string {
  return replaceMarkedBlock({
    source,
    start: themeOverrideStart,
    end: themeOverrideEnd,
    block: createThemeOverrideCss(config),
  })
}

export async function ensureThemeCss(params: {
  cwd: string
  config: ComponentsConfig
  overwrite: boolean
}): Promise<'created' | 'updated' | 'skipped'> {
  const config = normalizeComponentsConfig(params.config)
  validateComponentsConfig(config)

  const cssPath = resolve(params.cwd, config.tailwind.css)
  const next = `${createRegistryGlobalsBlock()}${createThemeOverrideCss(config)}`

  if (existsSync(cssPath)) {
    const current = readFileSync(cssPath, 'utf-8')

    if (params.overwrite) {
      if (current === next) return 'skipped'

      await writeFile(cssPath, next, 'utf-8')
      return 'updated'
    }

    const withGlobals = upsertRegistryGlobals(current)
    const withOverride = upsertThemeOverride(withGlobals, config)

    if (current === withOverride) return 'skipped'

    await writeFile(cssPath, withOverride, 'utf-8')
    return 'updated'
  }

  await mkdir(dirname(cssPath), { recursive: true })
  await writeFile(cssPath, next, 'utf-8')

  return 'created'
}

export async function ensureCnUtil(params: {
  cwd: string
  config: ComponentsConfig
  overwrite: boolean
}): Promise<'created' | 'updated' | 'skipped'> {
  const config = normalizeComponentsConfig(params.config)
  const cnPath = resolveRegistryTarget(params.cwd, config, 'lib/cn.ts')

  if (existsSync(cnPath) && !params.overwrite) {
    return 'skipped'
  }

  const next = readRegistryCnTemplate()

  if (existsSync(cnPath)) {
    const current = readFileSync(cnPath, 'utf-8')
    if (current === next) return 'skipped'
  }

  await mkdir(dirname(cnPath), { recursive: true })
  await writeFile(cnPath, next, 'utf-8')

  return existsSync(cnPath) ? 'updated' : 'created'
}
```

---

# 5. 替换 `packages/cli/src/commands/init.ts`

```ts
import type {
  DarkModeStrategyName,
  MotionPresetName,
  RadiusPresetName,
  ThemeName,
} from '@zeus-web/themes'
import type { PackageManager } from '../package-manager'
import type { ComponentsFramework } from '../config'

import { isAbsolute, resolve } from 'node:path'

import {
  isDarkModeStrategyName,
  isMotionPresetName,
  isRadiusPresetName,
  motionPresetNames,
  radiusPresetNames,
  themeNames,
} from '@zeus-web/themes'
import pc from 'picocolors'

import {
  createDefaultComponentsConfig,
  ensureCnUtil,
  ensureThemeCss,
  getComponentsConfigPath,
  readComponentsConfig,
  toRelativeProjectPath,
  writeComponentsConfig,
} from '../config'
import {
  createInstallCommands,
  formatInstallCommands,
  installDependencies,
} from '../package-manager'
import { detectProject } from '../project'

interface InitOptions {
  cwd: string
  framework?: ComponentsFramework
  style: ThemeName
  css?: string
  overwrite: boolean
  dryRun: boolean
  install: boolean
  radius?: RadiusPresetName
  motion?: MotionPresetName
  darkMode?: DarkModeStrategyName
  accentColor?: string
  packageManager?: PackageManager
}

interface ParsedInitArgs {
  options: InitOptions
}

interface InitPlan {
  cwd: string
  configFile: string
  framework: ComponentsFramework
  typescript: boolean
  cssFile: string
  cnFile: string
  installDependencies: string[]
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

function parseFramework(value: string): ComponentsFramework {
  if (value === 'react' || value === 'vue') return value

  throw new Error('Unsupported framework. Available: react, vue')
}

function parseRadius(value: string): RadiusPresetName {
  if (isRadiusPresetName(value)) return value

  throw new Error(
    `Unsupported radius: ${value}. Available: ${radiusPresetNames.join(', ')}`,
  )
}

function parseMotion(value: string): MotionPresetName {
  if (isMotionPresetName(value)) return value

  throw new Error(
    `Unsupported motion: ${value}. Available: ${motionPresetNames.join(', ')}`,
  )
}

function parseDarkMode(value: string): DarkModeStrategyName {
  if (isDarkModeStrategyName(value)) return value

  throw new Error(
    `Unsupported dark mode: ${value}. Available: class, data, media`,
  )
}

export function parseInitArgs(
  args: string[],
  cwd = process.cwd(),
): ParsedInitArgs {
  const options: InitOptions = {
    cwd,
    style: 'default',
    overwrite: false,
    dryRun: false,
    install: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--overwrite' || arg === '--force') {
      options.overwrite = true
      continue
    }

    if (arg === '--dry-run') {
      options.dryRun = true
      options.install = false
      continue
    }

    if (arg === '--install') {
      options.install = true
      continue
    }

    if (arg === '--no-install') {
      options.install = false
      continue
    }

    if (arg === '--framework') {
      const value = args[index + 1]
      if (!value) throw new Error('--framework requires react or vue')
      options.framework = parseFramework(value)
      index += 1
      continue
    }

    if (arg.startsWith('--framework=')) {
      const value = arg.slice('--framework='.length)
      if (!value) throw new Error('--framework requires react or vue')
      options.framework = parseFramework(value)
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

function createInitPlan(options: InitOptions): InitPlan {
  const detected = detectProject(options.cwd)

  const framework = options.framework ?? detected.framework

  const config = createDefaultComponentsConfig({
    framework,
    style: options.style,
    css: options.css,
    typescript: detected.typescript,
    srcDir: detected.srcDir,
    theme: {
      radius: options.radius,
      motion: options.motion,
      darkMode: options.darkMode,
      accentColor: options.accentColor,
    },
  })

  const cnFile =
    framework === 'react' || framework === 'vue'
      ? 'src/lib/cn.ts'
      : 'src/lib/cn.ts'

  return {
    cwd: options.cwd,
    configFile: toRelativeProjectPath(
      options.cwd,
      getComponentsConfigPath(options.cwd),
    ),
    framework,
    typescript: detected.typescript,
    cssFile: config.tailwind.css,
    cnFile,
    installDependencies: [],
  }
}

function printPlan(plan: InitPlan): void {
  console.log(pc.bold('Init plan:'))
  console.log(`  cwd: ${plan.cwd}`)
  console.log(`  framework: ${plan.framework}`)
  console.log(`  typescript: ${String(plan.typescript)}`)
  console.log(`  create/update: ${plan.configFile}`)
  console.log(`  create/update: ${plan.cssFile}`)
  console.log(`  create/update: ${plan.cnFile}`)

  if (plan.installDependencies.length > 0) {
    console.log(`  dependencies: ${plan.installDependencies.join(', ')}`)
  }
}

function printInstallHint(options: InitOptions, dependencies: string[]): void {
  if (dependencies.length === 0) return

  const commands = createInstallCommands({
    cwd: options.cwd,
    packageManager: options.packageManager,
    dependencies,
  })

  console.log(pc.bold('Install dependencies:'))

  for (const command of formatInstallCommands(commands)) {
    console.log(`  ${command}`)
  }
}

export async function init(args: string[]) {
  try {
    const { options } = parseInitArgs(args)
    const detected = detectProject(options.cwd)

    const nextConfig = createDefaultComponentsConfig({
      framework: options.framework ?? detected.framework,
      style: options.style,
      css: options.css,
      typescript: detected.typescript,
      srcDir: detected.srcDir,
      theme: {
        radius: options.radius,
        motion: options.motion,
        darkMode: options.darkMode,
        accentColor: options.accentColor,
      },
    })

    const plan = createInitPlan(options)

    if (options.dryRun) {
      printPlan(plan)
      return
    }

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
      console.log(pc.green('Created zeus-ui.json'))
    } else {
      console.log(
        pc.yellow(
          'zeus-ui.json already exists. Using existing config. Use --overwrite to replace it.',
        ),
      )
    }

    const cssResult = await ensureThemeCss({
      cwd: options.cwd,
      config: activeConfig,
      overwrite: options.overwrite,
    })

    if (cssResult === 'created') {
      console.log(pc.green(`Created ${activeConfig.tailwind.css}`))
    } else if (cssResult === 'updated') {
      console.log(pc.green(`Updated ${activeConfig.tailwind.css}`))
    } else {
      console.log(
        pc.gray(`${activeConfig.tailwind.css} is already up to date.`),
      )
    }

    const cnResult = await ensureCnUtil({
      cwd: options.cwd,
      config: activeConfig,
      overwrite: options.overwrite,
    })

    if (cnResult === 'created') {
      console.log(pc.green('Created cn utility'))
    } else if (cnResult === 'updated') {
      console.log(pc.green('Updated cn utility'))
    } else {
      console.log(pc.gray('cn utility already exists.'))
    }

    if (options.install && plan.installDependencies.length > 0) {
      await installDependencies({
        cwd: options.cwd,
        packageManager: options.packageManager ?? detected.packageManager,
        dependencies: plan.installDependencies,
      })
    } else {
      printInstallHint(options, plan.installDependencies)
    }
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
```

---

# 6. 修改 `packages/cli/src/index.ts` help 文案

替换 `printHelp()` 里的 init 部分：

```ts
console.log('  zweb init')
console.log('  zweb init --framework react')
console.log('  zweb init --framework vue')
console.log('  zweb init --style slate --css src/styles/zeus.css')
console.log('  zweb init --style zinc --radius lg --motion reduced')
console.log('  zweb init --dry-run')
```

Options 增加：

```ts
console.log('  --framework <name>          react | vue')
```

---

# 7. 替换 `packages/cli/__tests__/init.spec.ts`

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { parseInitArgs } from '../src/commands/init'
import {
  createDefaultComponentsConfig,
  ensureCnUtil,
  ensureThemeCss,
  getComponentsConfigPath,
  readComponentsConfig,
  updateComponentsConfig,
} from '../src/config'
import { detectProject } from '../src/project'

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'zeus-web-cli-'))
}

function writePackageJson(root: string, dependencies: Record<string, string>) {
  writeFileSync(
    resolve(root, 'package.json'),
    `${JSON.stringify({ dependencies }, null, 2)}\n`,
    'utf-8',
  )
}

describe('@zeus-web/cli init', () => {
  it('parses init options', () => {
    const parsed = parseInitArgs(
      [
        '--cwd',
        'demo',
        '--framework',
        'vue',
        '--style',
        'slate',
        '--css',
        'app/zeus.css',
        '--overwrite',
        '--dry-run',
        '--package-manager',
        'npm',
      ],
      '/repo',
    )

    expect(parsed.options).toEqual({
      cwd: resolve('/repo', 'demo'),
      framework: 'vue',
      style: 'slate',
      css: 'app/zeus.css',
      overwrite: true,
      dryRun: true,
      install: false,
      packageManager: 'npm',
    })
  })

  it('rejects unsupported framework', () => {
    expect(() => parseInitArgs(['--framework', 'svelte'])).toThrow(
      'Unsupported framework',
    )
  })

  it('rejects unsupported style', () => {
    expect(() => parseInitArgs(['--style', 'bad'])).toThrow(
      'Unsupported style: bad',
    )
  })

  it('detects react projects', async () => {
    const root = await createTempDir()

    try {
      writePackageJson(root, { react: '^19.0.0' })
      writeFileSync(resolve(root, 'tsconfig.json'), '{}', 'utf-8')

      expect(detectProject(root)).toMatchObject({
        framework: 'react',
        typescript: true,
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('detects vue projects', async () => {
    const root = await createTempDir()

    try {
      writePackageJson(root, { vue: '^3.0.0' })

      expect(detectProject(root)).toMatchObject({
        framework: 'vue',
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('asks for explicit framework when both React and Vue exist', async () => {
    const root = await createTempDir()

    try {
      writePackageJson(root, {
        react: '^19.0.0',
        vue: '^3.0.0',
      })

      expect(() => detectProject(root)).toThrow(
        'Both React and Vue dependencies were detected',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('creates default zeus-ui config', () => {
    const config = createDefaultComponentsConfig({
      framework: 'vue',
      style: 'zinc',
      typescript: true,
      srcDir: 'src',
      theme: {
        radius: 'xl',
        motion: 'expressive',
        darkMode: 'media',
        accentColor: '240 5.9% 10%',
      },
    })

    expect(config.$schema).toBe('https://zeus-web.dev/schema/zeus-ui.json')
    expect(config.framework).toBe('vue')
    expect(config.style).toBe('zinc')
    expect(config.typescript).toBe(true)
    expect(config.srcDir).toBe('src')
    expect(config.tailwind.css).toBe('src/styles/zeus.css')
    expect(config.aliases.ui).toBe('@/components/ui')
    expect(config.theme).toEqual({
      radius: 'xl',
      motion: 'expressive',
      darkMode: 'media',
      accentColor: '240 5.9% 10%',
    })
  })

  it('writes managed registry globals and theme override block', async () => {
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

      const css = readFileSync(resolve(root, 'src/styles/zeus.css'), 'utf-8')

      expect(result).toBe('created')
      expect(css).toContain('/* zeus-web registry globals:start */')
      expect(css).toContain('--zeus-primary')
      expect(css).toContain('--zeus-destructive')
      expect(css).toContain('/* zeus-web theme overrides:start */')
      expect(css).toContain('--zeus-radius-md: 0.75rem;')
      expect(css).toContain('--zeus-primary: 220 90% 56%;')
      expect(css).toContain('--zw-theme-dark-mode: data;')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('creates cn utility from registry template', async () => {
    const root = await createTempDir()

    try {
      const config = createDefaultComponentsConfig()
      const result = await ensureCnUtil({
        cwd: root,
        config,
        overwrite: false,
      })

      const cnPath = resolve(root, 'src/lib/cn.ts')
      const cn = readFileSync(cnPath, 'utf-8')

      expect(result).toBe('updated')
      expect(cn).toContain('export function cn')
      expect(cn).toContain('ClassValue')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('writes zeus-ui.json and reads it back', async () => {
    const root = await createTempDir()

    try {
      const config = createDefaultComponentsConfig({
        framework: 'vue',
        style: 'neutral',
      })

      mkdirSync(resolve(root, 'src/styles'), { recursive: true })

      writeFileSync(
        getComponentsConfigPath(root),
        `${JSON.stringify(config, null, 2)}\n`,
        'utf-8',
      )

      const next = readComponentsConfig(root)

      expect(next.framework).toBe('vue')
      expect(next.style).toBe('neutral')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('keeps legacy components.json readable', async () => {
    const root = await createTempDir()

    try {
      const config = createDefaultComponentsConfig({
        framework: 'react',
        style: 'default',
      })

      writeFileSync(
        resolve(root, 'components.json'),
        `${JSON.stringify(config, null, 2)}\n`,
        'utf-8',
      )

      const next = readComponentsConfig(root)

      expect(next.framework).toBe('react')
      expect(next.style).toBe('default')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('updates zeus-ui.json theme config', async () => {
    const root = await createTempDir()

    try {
      const config = createDefaultComponentsConfig()
      writeFileSync(
        getComponentsConfigPath(root),
        `${JSON.stringify(config, null, 2)}\n`,
        'utf-8',
      )

      await updateComponentsConfig({
        cwd: root,
        updater: current => ({
          ...current,
          style: 'neutral',
          theme: {
            ...current.theme,
            radius: 'sm',
            motion: 'none',
            darkMode: 'media',
          },
        }),
      })

      const next = readComponentsConfig(root)

      expect(next.style).toBe('neutral')
      expect(next.theme.radius).toBe('sm')
      expect(next.theme.motion).toBe('none')
      expect(next.theme.darkMode).toBe('media')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('validates zeus-ui.json when reading config', async () => {
    const root = await createTempDir()

    try {
      const config = createDefaultComponentsConfig()
      writeFileSync(
        getComponentsConfigPath(root),
        JSON.stringify(
          {
            ...config,
            framework: 'svelte',
          },
          null,
          2,
        ),
        'utf-8',
      )

      expect(() => readComponentsConfig(root)).toThrow(
        'Only framework "react" and "vue" are supported.',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('updates existing css without duplicating managed blocks', async () => {
    const root = await createTempDir()

    try {
      mkdirSync(resolve(root, 'src/styles'), { recursive: true })
      writeFileSync(
        resolve(root, 'src/styles/zeus.css'),
        [
          'body { margin: 0; }',
          '/* zeus-web theme overrides:start */',
          ':root {',
          '  --zeus-radius-md: 0.375rem;',
          '}',
          '/* zeus-web theme overrides:end */',
          '',
        ].join('\n'),
        'utf-8',
      )

      const config = createDefaultComponentsConfig({
        theme: {
          radius: 'xl',
          motion: 'expressive',
          darkMode: 'class',
        },
      })

      const result = await ensureThemeCss({
        cwd: root,
        config,
        overwrite: false,
      })

      const css = readFileSync(resolve(root, 'src/styles/zeus.css'), 'utf-8')

      expect(result).toBe('updated')
      expect(css).toContain('body { margin: 0; }')
      expect(css).toContain('/* zeus-web registry globals:start */')
      expect(css).toContain('--zeus-radius-md: 1rem;')
      expect(
        css.match(/\/\* zeus-web theme overrides:start \*\//g),
      ).toHaveLength(1)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not overwrite cn utility by default', async () => {
    const root = await createTempDir()

    try {
      mkdirSync(resolve(root, 'src/lib'), { recursive: true })
      writeFileSync(
        resolve(root, 'src/lib/cn.ts'),
        'export const cn = () => "custom"\n',
        'utf-8',
      )

      const config = createDefaultComponentsConfig()
      const result = await ensureCnUtil({
        cwd: root,
        config,
        overwrite: false,
      })

      expect(result).toBe('skipped')
      expect(readFileSync(resolve(root, 'src/lib/cn.ts'), 'utf-8')).toContain(
        '"custom"',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
```

> 注意：上面 `ensureCnUtil` 当前实现里因为写完后 `existsSync(cnPath)` 一定为 true，返回会是 `updated`。如果你想语义更准，可以在写入前先记录 `const existed = existsSync(cnPath)`，然后返回 `existed ? 'updated' : 'created'`。推荐顺手改。

修正 `ensureCnUtil` 的最后部分：

```ts
const existed = existsSync(cnPath)

if (existed && !params.overwrite) {
  return 'skipped'
}

const next = readRegistryCnTemplate()

if (existed) {
  const current = readFileSync(cnPath, 'utf-8')
  if (current === next) return 'skipped'
}

await mkdir(dirname(cnPath), { recursive: true })
await writeFile(cnPath, next, 'utf-8')

return existed ? 'updated' : 'created'
```

---

# 8. 新增 `scripts/checks/check-cli-init.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

const requiredFiles = [
  'packages/cli/src/project.ts',
  'packages/cli/src/registry-assets.ts',
  'packages/cli/src/config.ts',
  'packages/cli/src/commands/init.ts',
  'packages/cli/__tests__/init.spec.ts',
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

function main(): void {
  const errors: string[] = []

  for (const file of requiredFiles) {
    checkFileExists(file, errors)
  }

  if (errors.length === 0) {
    checkSourceContains(
      'packages/cli/src/config.ts',
      [
        "export const zeusUiConfigFileName = 'zeus-ui.json'",
        "export const legacyComponentsConfigFileName = 'components.json'",
        "framework: 'react' | 'vue'",
        'ensureCnUtil',
        'ensureThemeCss',
        'readRegistryCnTemplate',
        'readRegistryGlobalsTemplate',
      ],
      errors,
    )

    checkSourceContains(
      'packages/cli/src/project.ts',
      [
        'detectProject',
        "SupportedFramework = 'react' | 'vue'",
        'detectPackageManager',
        'Both React and Vue dependencies were detected',
      ],
      errors,
    )

    checkSourceContains(
      'packages/cli/src/commands/init.ts',
      [
        '--framework',
        '--dry-run',
        'Created zeus-ui.json',
        'ensureCnUtil',
        'ensureThemeCss',
        'detectProject',
      ],
      errors,
    )

    checkSourceContains(
      'packages/cli/__tests__/init.spec.ts',
      [
        'detects react projects',
        'detects vue projects',
        'writes zeus-ui.json and reads it back',
        'keeps legacy components.json readable',
        'creates cn utility from registry template',
      ],
      errors,
    )
  }

  if (errors.length > 0) {
    console.error(pc.red('CLI init check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('CLI init check passed.'))
}

main()
```

---

# 9. 更新 `packages/cli/package.json`

把 test 脚本里确保包含 `init.spec.ts`。当前已经包含。
如果你想单独增加一个脚本，可以加：

```json
{
  "scripts": {
    "test:init": "vitest --root ../.. --project unit packages/cli/__tests__/init.spec.ts"
  }
}
```

---

# 10. 更新 `scripts/checks/check-product-layers.ts`

把 roadmap 相关检查更新到 Phase 18：

```ts
{
  path: 'docs/internal/examples/showcase-roadmap.md',
  mustContain: [
    '| Phase 15 | Done   | Product layering contract for primitives, themes, native styled Web-C, registry, CLI and showcase usage          |',
    '| Phase 16 | Done   | Native styled Web-C package with styled button and input entrypoints                                             |',
    '| Phase 17 | Done   | Registry foundation with React and Vue button/input templates                                                    |',
    '| Phase 18 | Done   | CLI init command with zeus-ui.json, project detection, cn utility and styles initialization                       |',
    'The showcase has eleven layers of checks:',
    'Product layer checks validate Zeus-UI package boundaries and usage entry decisions.',
    'Native styled Web-C checks validate @zeus-web/ui package exports, CSS entrypoints and primitive composition.',
    'Registry checks validate @zeus-web/registry schema, metadata, templates and primitive dependencies.',
    'CLI init checks validate zeus-ui.json initialization, project detection and base file generation.',
    'pnpm check:product-layers',
    'pnpm check:ui-package',
    'pnpm check:registry',
    'pnpm check:cli-init',
    'Phase 19: Add CLI add command for registry component installation.',
  ],
}
```

替换 `checkPhaseOrder`：

```ts
function checkPhaseOrder(source: string): string[] {
  const errors: string[] = []
  const phase15Index = source.indexOf('| Phase 15 |')
  const phase16Index = source.indexOf('| Phase 16 |')
  const phase17Index = source.indexOf('| Phase 17 |')
  const phase18Index = source.indexOf('| Phase 18 |')
  const phase19Index = source.indexOf('Phase 19:')

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
    errors.push('showcase-roadmap.md must contain Phase 19 next work')
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
    errors.push('Phase 19 next work must appear after Phase 18 status')
  }

  return errors
}
```

---

# 11. 新增设计文档 `docs/internal/design/zeus-ui-cli-init.md`

````md
# Zeus-UI CLI Init

## Status

Phase 18 design.

This document defines the `zweb init` command.

## Goal

`zweb init` prepares a React or Vue project for future `zweb add` commands.

It creates:

```txt
zeus-ui.json
src/lib/cn.ts
src/styles/zeus.css
```
````

## Command

```bash
zweb init
zweb init --framework react
zweb init --framework vue
zweb init --dry-run
zweb init --overwrite
```

## Project detection

The CLI detects:

- React dependency
- Vue dependency
- TypeScript
- package manager
- `src` directory

If both React and Vue are detected, the user must pass:

```bash
zweb init --framework react
```

or:

```bash
zweb init --framework vue
```

## Config file

Phase 18 uses:

```txt
zeus-ui.json
```

The old `components.json` file remains readable for compatibility but new writes use `zeus-ui.json`.

## Config shape

```json
{
  "$schema": "https://zeus-web.dev/schema/zeus-ui.json",
  "framework": "react",
  "style": "default",
  "typescript": true,
  "srcDir": "src",
  "theme": {
    "radius": "md",
    "motion": "normal",
    "darkMode": "class"
  },
  "tailwind": {
    "css": "src/styles/zeus.css",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "styles": "@/styles"
  }
}
```

## Generated CSS

`zweb init` writes registry globals into the configured CSS file.

The CSS uses `--zeus-*` variables because registry-installed React/Vue components consume those variables.

Native `@zeus-web/ui` uses `--zw-*` variables. That is a separate package-level styled Web-C token facade.

## Generated cn utility

`zweb init` writes:

```txt
src/lib/cn.ts
```

The content comes from `@zeus-web/registry`.

## Non-goals

Phase 18 does not:

- install components
- implement `zweb add`
- switch showcase to registry
- implement remote registry
- merge user-modified components

## Next phase

Phase 19 should implement:

```bash
zweb add button
```

using the registry metadata and files initialized by this phase.

````

---

# 12. 更新 roadmap

## `docs/internal/examples/showcase-roadmap.md`

追加：

```md
| Phase 18 | Done   | CLI init command with zeus-ui.json, project detection, cn utility and styles initialization                       |
````

把工程保障改为 11 层：

```md
The showcase has eleven layers of checks:

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
```

Commands 增加：

```bash
pnpm check:cli-init
pnpm --filter @zeus-web/cli test:init
```

Next work 改成：

```md
## Next work

Future phases should continue with CLI component installation:

- Phase 19: Add CLI add command for registry component installation.
- Phase 20: Switch React and Vue showcase to registry-installed styled usage.
- Phase 21: Add native showcase for @zeus-web/ui.
- Phase 22: Rewrite public docs around CLI, native styled Web-C and advanced primitive usage.
```

---

# 13. 文件清单

```txt
package.json
scripts/checks/check-cli-init.ts
scripts/checks/check-product-layers.ts

packages/cli/src/project.ts
packages/cli/src/registry-assets.ts
packages/cli/src/config.ts
packages/cli/src/commands/init.ts
packages/cli/src/index.ts
packages/cli/package.json
packages/cli/__tests__/init.spec.ts

docs/internal/design/zeus-ui-cli-init.md
docs/internal/examples/showcase-roadmap.md
```

---

# 14. 验收命令

```bash
pnpm check:cli-init
pnpm --filter @zeus-web/cli check
pnpm --filter @zeus-web/cli test:init
pnpm --filter @zeus-web/cli build
```

手工 dry-run：

```bash
pnpm --filter @zeus-web/cli build
node packages/cli/dist/index.js init --dry-run --cwd examples/react-showcase
node packages/cli/dist/index.js init --dry-run --framework vue --cwd examples/vue-showcase
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

# 15. Phase 18 完成判断

```txt
完成：
  - zweb init 写 zeus-ui.json
  - zweb init 可检测 React/Vue
  - zweb init 支持 --framework
  - zweb init 支持 --dry-run
  - zweb init 创建 cn utility
  - zweb init 创建 styles/zeus.css
  - readComponentsConfig 兼容旧 components.json
  - CLI init tests 覆盖 React/Vue/dry-run/config/css/cn
  - site:check 接入 check:cli-init
  - roadmap Phase 18 Done

未做：
  - 没有实现完整 zweb add
  - 没有复制 button/input 组件
  - 没有切换 showcase
```

---

# 16. 建议分支与 PR

分支名：

```txt
feat/cli-init
```

PR title：

```txt
feat(cli): add Zeus UI init project configuration
```
