import type { ThemeName } from '@zeus-web/themes'

import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

import { isThemeName } from '@zeus-web/themes'

export interface ComponentsConfig {
  $schema: string
  framework: 'react'
  style: ThemeName
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
}

export const componentsConfigFileName = 'components.json'

export function createDefaultComponentsConfig(
  options: CreateConfigOptions = {},
): ComponentsConfig {
  return {
    $schema: 'https://zeus-web.dev/schema/components.json',
    framework: 'react',
    style: options.style ?? 'default',
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

export function validateComponentsConfig(config: ComponentsConfig): void {
  if (config.framework !== 'react') {
    throw new Error('Only framework "react" is supported in this phase.')
  }

  if (!isThemeName(config.style)) {
    throw new Error(`Unsupported style: ${String(config.style)}`)
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
  await writeFile(file, `${JSON.stringify(params.config, null, 2)}\n`, 'utf-8')

  return 'created'
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

export async function ensureThemeCss(params: {
  cwd: string
  config: ComponentsConfig
  overwrite: boolean
}): Promise<'created' | 'updated' | 'skipped'> {
  const cssPath = resolve(params.cwd, params.config.tailwind.css)
  const themeImport = `@import '@zeus-web/themes/${params.config.style}.css';`

  if (existsSync(cssPath)) {
    const current = readFileSync(cssPath, 'utf-8')

    if (current.includes(themeImport)) {
      return 'skipped'
    }

    if (!params.overwrite) {
      const next = current.endsWith('\n')
        ? `${current}${themeImport}\n`
        : `${current}\n${themeImport}\n`

      await writeFile(cssPath, next, 'utf-8')
      return 'updated'
    }

    await writeFile(cssPath, `${themeImport}\n`, 'utf-8')
    return 'updated'
  }

  await mkdir(dirname(cssPath), { recursive: true })
  await writeFile(cssPath, `${themeImport}\n`, 'utf-8')

  return 'created'
}
