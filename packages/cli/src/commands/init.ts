import type { ThemeName } from '@zeus-web/themes'

import type { PackageManager } from '../package-manager'

import { isAbsolute, resolve } from 'node:path'
import { themeNames } from '@zeus-web/themes'
import pc from 'picocolors'

import {
  createDefaultComponentsConfig,
  ensureThemeCss,
  writeComponentsConfig,
} from '../config'
import { installDependencies } from '../package-manager'

interface InitOptions {
  cwd: string
  style: ThemeName
  css: string
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

export function parseInitArgs(
  args: string[],
  cwd = process.cwd(),
): ParsedInitArgs {
  const options: InitOptions = {
    cwd,
    style: 'default',
    css: 'src/styles/globals.css',
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

      if (!value) {
        throw new Error('--cwd requires a directory path')
      }

      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)

      if (!value) {
        throw new Error('--cwd requires a directory path')
      }

      options.cwd = isAbsolute(value) ? value : resolve(cwd, value)
      continue
    }

    if (arg === '--style') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--style requires a theme name')
      }

      options.style = parseThemeName(value)
      index += 1
      continue
    }

    if (arg.startsWith('--style=')) {
      options.style = parseThemeName(arg.slice('--style='.length))
      continue
    }

    if (arg === '--css') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--css requires a file path')
      }

      options.css = value
      index += 1
      continue
    }

    if (arg.startsWith('--css=')) {
      options.css = arg.slice('--css='.length)
      continue
    }

    if (arg === '--package-manager') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--package-manager requires a value')
      }

      options.packageManager = parsePackageManager(value)
      index += 1
      continue
    }

    if (arg.startsWith('--package-manager=')) {
      options.packageManager = parsePackageManager(
        arg.slice('--package-manager='.length),
      )
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return {
    options,
  }
}

export async function init(args: string[]) {
  try {
    const { options } = parseInitArgs(args)
    const config = createDefaultComponentsConfig({
      style: options.style,
      css: options.css,
    })

    const configResult = await writeComponentsConfig({
      cwd: options.cwd,
      config,
      overwrite: options.overwrite,
    })

    if (configResult === 'created') {
      console.log(pc.green('Created components.json'))
    } else {
      console.log(
        pc.yellow(
          'components.json already exists. Use --overwrite to replace it.',
        ),
      )
    }

    const cssResult = await ensureThemeCss({
      cwd: options.cwd,
      config,
      overwrite: false,
    })

    if (cssResult === 'created') {
      console.log(pc.green(`Created ${config.tailwind.css}`))
    } else if (cssResult === 'updated') {
      console.log(pc.green(`Updated ${config.tailwind.css}`))
    } else {
      console.log(
        pc.gray(`${config.tailwind.css} already includes theme import.`),
      )
    }

    if (options.install) {
      await installDependencies({
        cwd: options.cwd,
        packageManager: options.packageManager,
        dependencies: ['@zeus-web/themes'],
      })
    } else {
      console.log(pc.bold('Install dependencies:'))
      console.log('  pnpm add @zeus-web/themes')
    }
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
