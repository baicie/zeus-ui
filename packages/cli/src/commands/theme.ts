import type {
  DarkModeStrategyName,
  MotionPresetName,
  RadiusPresetName,
  SemanticColorToken,
  ThemeName,
} from '@zeus-web/themes'

import { existsSync, realpathSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

import {
  createThemeCss,
  darkModeStrategyNames,
  getThemeTokens,
  getThemeTokensJson,
  isDarkModeStrategyName,
  isMotionPresetName,
  isRadiusPresetName,
  isThemeName,
  motionPresetNames,
  radiusPresetNames,
  semanticColorTokens,
  themeNames,
} from '@zeus-web/themes'
import pc from 'picocolors'

import {
  ensureThemeCss,
  readComponentsConfig,
  resolveAliasToPath,
  updateComponentsConfig,
} from '../config'

type ThemeSubcommand = 'list' | 'tokens' | 'set' | 'add'

interface BaseOptions {
  cwd: string
  json: boolean
}

interface SetOptions extends BaseOptions {
  style?: ThemeName
  radius?: RadiusPresetName
  motion?: MotionPresetName
  darkMode?: DarkModeStrategyName
  accentColor?: string
}

interface AddOptions extends BaseOptions {
  from: ThemeName
  light: Partial<Record<SemanticColorToken, string>>
  dark: Partial<Record<SemanticColorToken, string>>
}

function resolveCwd(base: string, value: string): string {
  return isAbsolute(value) ? value : resolve(base, value)
}

function assertProjectPath(cwd: string, target: string): void {
  const projectRoot = realpathSync.native(cwd)
  const absoluteTarget = resolve(target)
  let existingAncestor = absoluteTarget

  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor)
    if (parent === existingAncestor) break
    existingAncestor = parent
  }

  const canonicalAncestor = realpathSync.native(existingAncestor)
  const canonicalTarget = resolve(
    canonicalAncestor,
    relative(existingAncestor, absoluteTarget),
  )
  const relativeTarget = relative(projectRoot, canonicalTarget)
  if (
    relativeTarget === '..' ||
    relativeTarget.startsWith(`..${sep}`) ||
    isAbsolute(relativeTarget)
  ) {
    throw new Error('Configured styles alias must resolve inside the project.')
  }
}

function parseStyle(value: string): ThemeName {
  if (isThemeName(value)) return value
  throw new Error(
    `Unsupported style: ${value}. Available: ${themeNames.join(', ')}`,
  )
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
    `Unsupported dark mode: ${value}. Available: ${darkModeStrategyNames.join(', ')}`,
  )
}

interface ParsedBaseArgs {
  positional: string[]
  options: BaseOptions
}

function parseBaseOptions(args: string[], cwd = process.cwd()): ParsedBaseArgs {
  const positional: string[] = []
  const options: BaseOptions = { cwd, json: false }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--json') {
      options.json = true
      continue
    }
    if (arg === '--cwd') {
      const v = args[++i]
      if (!v) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwd(cwd, v)
      continue
    }
    if (arg.startsWith('--cwd=')) {
      const v = arg.slice('--cwd='.length)
      if (!v) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwd(cwd, v)
      continue
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
    positional.push(arg)
  }
  return { positional, options }
}

function parseSetOptions(args: string[], cwd = process.cwd()): SetOptions {
  const options: SetOptions = { cwd, json: false }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--json') {
      options.json = true
      continue
    }
    if (arg === '--cwd') {
      const v = args[++i]
      if (!v) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwd(cwd, v)
      continue
    }
    if (arg.startsWith('--cwd=')) {
      const v = arg.slice('--cwd='.length)
      if (!v) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwd(cwd, v)
      continue
    }
    if (arg === '--style') {
      const v = args[++i]
      if (!v) throw new Error('--style requires a theme name')
      options.style = parseStyle(v)
      continue
    }
    if (arg.startsWith('--style=')) {
      const v = arg.slice('--style='.length)
      if (!v) throw new Error('--style requires a theme name')
      options.style = parseStyle(v)
      continue
    }
    if (arg === '--radius') {
      const v = args[++i]
      if (!v) throw new Error('--radius requires a preset name')
      options.radius = parseRadius(v)
      continue
    }
    if (arg.startsWith('--radius=')) {
      const v = arg.slice('--radius='.length)
      if (!v) throw new Error('--radius requires a preset name')
      options.radius = parseRadius(v)
      continue
    }
    if (arg === '--motion') {
      const v = args[++i]
      if (!v) throw new Error('--motion requires a preset name')
      options.motion = parseMotion(v)
      continue
    }
    if (arg.startsWith('--motion=')) {
      const v = arg.slice('--motion='.length)
      if (!v) throw new Error('--motion requires a preset name')
      options.motion = parseMotion(v)
      continue
    }
    if (arg === '--dark-mode') {
      const v = args[++i]
      if (!v) throw new Error('--dark-mode requires a strategy name')
      options.darkMode = parseDarkMode(v)
      continue
    }
    if (arg.startsWith('--dark-mode=')) {
      const v = arg.slice('--dark-mode='.length)
      if (!v) throw new Error('--dark-mode requires a strategy name')
      options.darkMode = parseDarkMode(v)
      continue
    }
    if (arg === '--accent') {
      const v = args[++i]
      if (!v) throw new Error('--accent requires a HSL value')
      options.accentColor = v
      continue
    }
    if (arg.startsWith('--accent=')) {
      const v = arg.slice('--accent='.length)
      if (!v) throw new Error('--accent requires a HSL value')
      options.accentColor = v
      continue
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
    if (options.style === undefined) {
      options.style = parseStyle(arg)
      continue
    }
    throw new Error(`Unexpected argument: ${arg}`)
  }
  return options
}

function printThemeList(): void {
  console.log(pc.bold('Themes:'))
  for (const t of themeNames) console.log(`  ${t}`)
  console.log('')
  console.log(pc.bold('Radius presets:'))
  for (const p of radiusPresetNames) console.log(`  ${p}`)
  console.log('')
  console.log(pc.bold('Motion presets:'))
  for (const p of motionPresetNames) console.log(`  ${p}`)
  console.log('')
  console.log(pc.bold('Dark mode strategies:'))
  for (const s of darkModeStrategyNames) console.log(`  ${s}`)
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
  for (const [name, value] of Object.entries(tokens.colors))
    console.log(`  --${name}: ${value};`)
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
  if (nextConfig.theme.accentColor)
    console.log(`Accent: ${nextConfig.theme.accentColor}`)
}

function parseAddOptions(
  args: string[],
  cwd = process.cwd(),
): {
  name: string
  options: AddOptions
} {
  const positional: string[] = []
  const options: AddOptions = {
    cwd,
    json: false,
    from: 'default',
    light: {},
    dark: {},
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--json') {
      options.json = true
      continue
    }
    if (arg === '--cwd' || arg.startsWith('--cwd=')) {
      const value = arg === '--cwd' ? args[++i] : arg.slice('--cwd='.length)
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwd(cwd, value)
      continue
    }
    if (arg === '--from' || arg.startsWith('--from=')) {
      const value = arg === '--from' ? args[++i] : arg.slice('--from='.length)
      if (!value) throw new Error('--from requires a theme name')
      options.from = parseStyle(value)
      continue
    }
    if (arg === '--color' || arg.startsWith('--color=')) {
      const value = arg === '--color' ? args[++i] : arg.slice('--color='.length)
      if (!value) throw new Error('--color requires token=value')
      const separatorIndex = value.indexOf('=')
      const token = value.slice(0, separatorIndex)
      const color = value.slice(separatorIndex + 1)
      if (separatorIndex < 1 || !color) {
        throw new Error('--color requires token=value')
      }
      const parts = token.split('.')
      if (parts.length !== 2) {
        throw new Error(
          'Theme color must use exactly one mode and token: light.<token> or dark.<token>',
        )
      }
      const [mode, tokenName] = parts
      if (!(semanticColorTokens as readonly string[]).includes(tokenName)) {
        throw new Error(`Unsupported theme token: ${tokenName}`)
      }
      if (mode !== 'light' && mode !== 'dark') {
        throw new Error('Theme color must use light.<token> or dark.<token>')
      }
      options[mode][tokenName as SemanticColorToken] = color
      continue
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
    positional.push(arg)
  }
  if (positional.length !== 1) {
    throw new Error(
      'Usage: zweb theme add <name> [--from <theme>] [--color light.primary="240 5.9% 10%"]',
    )
  }
  return { name: positional[0], options }
}

async function themeAdd(args: string[]): Promise<void> {
  const { name, options } = parseAddOptions(args)
  const config = readComponentsConfig(options.cwd)
  const stylesPath = resolveAliasToPath(options.cwd, config.aliases.styles)
  const relativeStylesPath = relative(options.cwd, stylesPath)
  if (
    relativeStylesPath === '..' ||
    relativeStylesPath.startsWith(`..${sep}`) ||
    isAbsolute(relativeStylesPath)
  ) {
    throw new Error('Configured styles alias must resolve inside the project.')
  }
  const outputPath = resolve(stylesPath, 'themes', `${name}.css`)
  assertProjectPath(options.cwd, outputPath)
  const css = createThemeCss(name, options.from, {
    light: options.light,
    dark: options.dark,
  })
  await mkdir(resolve(outputPath, '..'), { recursive: true })
  await writeFile(outputPath, css, { encoding: 'utf-8', flag: 'wx' })
  const result = {
    name,
    from: options.from,
    file: relative(options.cwd, outputPath),
  }
  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  console.log(pc.green(`Created ${result.file}`))
}

export async function theme(args: string[]): Promise<void> {
  try {
    const [subcommand, ...rest] = args
    const cmd = (subcommand ?? 'list') as ThemeSubcommand
    if (cmd === 'list') {
      await themeList(rest)
      return
    }
    if (cmd === 'tokens') {
      await themeTokens(rest)
      return
    }
    if (cmd === 'set') {
      await themeSet(rest)
      return
    }
    if (cmd === 'add') {
      await themeAdd(rest)
      return
    }
    throw new Error(`Unknown theme command: ${String(subcommand)}`)
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
