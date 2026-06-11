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

function resolveCwd(base: string, value: string): string {
  return isAbsolute(value) ? value : resolve(base, value)
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
    throw new Error(`Unknown theme command: ${String(subcommand)}`)
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
