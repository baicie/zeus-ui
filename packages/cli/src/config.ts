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
  getThemeColors,
  isDarkModeStrategyName,
  isMotionPresetName,
  isRadiusPresetName,
  isThemeName,
  motionPresets,
  radiusPresets,
  semanticColorTokens,
} from '@zeus-web/themes'

import { readRegistryCnTemplate } from './registry-assets'

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
    throw new TypeError('zeus-ui.json missing boolean typescript field')
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

function createRegistryGlobalsBlock(config: ComponentsConfig): string {
  const lightColors = getThemeColors(config.style, 'light')
  const darkColors = getThemeColors(config.style, 'dark')

  const lightLines = [
    registryGlobalsStart,
    ':root {',
    ...semanticColorTokens.map(
      token => `  --zeus-${token}: ${lightColors[token]};`,
    ),
    '}',
    '',
    '.dark {',
    ...semanticColorTokens.map(
      token => `  --zeus-${token}: ${darkColors[token]};`,
    ),
    '}',
    registryGlobalsEnd,
    '',
  ]

  return lightLines.join('\n')
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

function upsertRegistryGlobals(
  source: string,
  config: ComponentsConfig,
): string {
  return replaceMarkedBlock({
    source,
    start: registryGlobalsStart,
    end: registryGlobalsEnd,
    block: createRegistryGlobalsBlock(config),
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
  const next = `${createRegistryGlobalsBlock(config)}${createThemeOverrideCss(config)}`

  if (existsSync(cssPath)) {
    const current = readFileSync(cssPath, 'utf-8')

    if (params.overwrite) {
      if (current === next) return 'skipped'

      await writeFile(cssPath, next, 'utf-8')
      return 'updated'
    }

    const withGlobals = upsertRegistryGlobals(current, config)
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
}
