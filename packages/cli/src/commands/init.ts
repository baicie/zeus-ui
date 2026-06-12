import type {
  DarkModeStrategyName,
  MotionPresetName,
  RadiusPresetName,
  ThemeName,
} from '@zeus-web/themes'
import type { ComponentsFramework } from '../config'
import type { PackageManager } from '../package-manager'

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
