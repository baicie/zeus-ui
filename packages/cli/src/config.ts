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
  tailwind: { css: string; cssVariables: boolean }
  aliases: { components: string; ui: string; lib: string }
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
  if (!existsSync(file))
    throw new Error('components.json not found. Run `zweb init` first.')
  return normalizeComponentsConfig(
    JSON.parse(readFileSync(file, 'utf-8')) as ComponentsConfig,
  )
}

export function normalizeComponentsConfig(
  config: ComponentsConfig,
): ComponentsConfig {
  return { ...config, theme: createDefaultThemeConfig(config.theme) }
}

export function validateComponentsConfig(config: ComponentsConfig): void {
  if (config.framework !== 'react')
    throw new Error('Only framework "react" is supported in this phase.')
  if (!isThemeName(config.style))
    throw new Error(`Unsupported style: ${String(config.style)}`)
  const theme = createDefaultThemeConfig(config.theme)
  if (!isRadiusPresetName(theme.radius))
    throw new Error(`Unsupported radius preset: ${String(theme.radius)}`)
  if (!isMotionPresetName(theme.motion))
    throw new Error(`Unsupported motion preset: ${String(theme.motion)}`)
  if (!isDarkModeStrategyName(theme.darkMode))
    throw new Error(`Unsupported dark mode strategy: ${String(theme.darkMode)}`)
  if (!config.tailwind?.css)
    throw new Error('components.json missing tailwind.css')
  if (!config.aliases?.ui) throw new Error('components.json missing aliases.ui')
  if (!config.aliases?.lib)
    throw new Error('components.json missing aliases.lib')
}

export async function writeComponentsConfig(params: {
  cwd: string
  config: ComponentsConfig
  overwrite: boolean
}): Promise<'created' | 'skipped'> {
  const file = getComponentsConfigPath(params.cwd)
  if (existsSync(file) && !params.overwrite) return 'skipped'
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
  const nextImport = `${createThemeImport(style)}\n`
  const hasImport = /@import ['"]@zeus-web\/themes\/[a-z-]+\.css['"];\n?/.test(
    source,
  )
  return hasImport
    ? source.replace(
        /@import ['"]@zeus-web\/themes\/[a-z-]+\.css['"];\n?/g,
        nextImport,
      )
    : source + (source.endsWith('\n') ? '' : '\n') + nextImport
}

function upsertThemeOverride(source: string, config: ComponentsConfig): string {
  const block = createThemeOverrideCss(config)
  const start = source.indexOf(themeOverrideStart)
  const end = source.indexOf(themeOverrideEnd)
  if (start >= 0 && end >= start) {
    return (
      source.slice(0, start) +
      block +
      source.slice(end + themeOverrideEnd.length).replace(/^\n/, '')
    )
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
    if (current === next) return 'skipped'
    if (params.overwrite) {
      await writeFile(
        cssPath,
        `${createThemeImport(config.style)}\n${next}`,
        'utf-8',
      )
      return 'updated'
    }
    await writeFile(cssPath, next, 'utf-8')
    return withImport !== current ? 'updated' : 'skipped'
  }
  await mkdir(dirname(cssPath), { recursive: true })
  await writeFile(
    cssPath,
    `${createThemeImport(config.style)}\n${createThemeOverrideCss(config)}`,
    'utf-8',
  )
  return 'created'
}
