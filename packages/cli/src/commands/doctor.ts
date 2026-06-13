import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

import {
  getComponentsConfigPath,
  readComponentsConfig,
  resolveAliasToPath,
} from '../config'
import { legacyLockFileName, readLegacyLock } from '../lock'
import { loadRegistry } from './add'

type DoctorLevel = 'pass' | 'warn' | 'fail'
interface DoctorCheck {
  level: DoctorLevel
  message: string
}
interface DoctorOptions {
  cwd: string
  json: boolean
}

function parseDoctorArgs(args: string[], cwd = process.cwd()): DoctorOptions {
  const options: DoctorOptions = { cwd, json: false }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--json') {
      options.json = true
      continue
    }
    if (arg === '--cwd') {
      const v = args[++i]
      if (!v) throw new Error('--cwd requires a directory path')
      options.cwd = resolve(cwd, v)
      continue
    }
    if (arg.startsWith('--cwd=')) {
      options.cwd = resolve(cwd, arg.slice('--cwd='.length))
      continue
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

function readPackageJson(cwd: string): Record<string, unknown> | undefined {
  const file = resolve(cwd, 'package.json')
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>)
    : undefined
}

function hasDependency(
  pkg: Record<string, unknown> | undefined,
  dep: string,
): boolean {
  const deps = (pkg?.dependencies as Record<string, string> | undefined) ?? {}
  const dev = (pkg?.devDependencies as Record<string, string> | undefined) ?? {}
  return dep in deps || dep in dev
}

function printChecks(checks: DoctorCheck[]): void {
  for (const check of checks) {
    if (check.level === 'pass')
      console.log(`${pc.green('[PASS]')} ${check.message}`)
    else if (check.level === 'warn')
      console.log(`${pc.yellow('[WARN]')} ${check.message}`)
    else console.log(`${pc.red('[FAIL]')} ${check.message}`)
  }
}

export async function doctor(args: string[]): Promise<void> {
  try {
    const options = parseDoctorArgs(args)
    const checks: DoctorCheck[] = []

    try {
      loadRegistry()
      checks.push({ level: 'pass', message: '@zeus-web/registry is valid.' })
    } catch (e) {
      checks.push({ level: 'fail', message: (e as Error).message })
    }

    const configPath = getComponentsConfigPath(options.cwd)
    if (!existsSync(configPath)) {
      checks.push({
        level: 'fail',
        message: 'components.json not found. Run `zweb init` first.',
      })
    } else {
      checks.push({ level: 'pass', message: 'components.json exists.' })
      try {
        const config = readComponentsConfig(options.cwd)
        const cssPath = resolve(options.cwd, config.tailwind.css)
        const themeImport = `@import '@zeus-web/themes/${config.style}.css';`
        const componentsImport = "@import '@zeus-web/themes/components.css';"
        checks.push({ level: 'pass', message: 'components.json is valid.' })
        for (const [name, alias] of Object.entries(config.aliases)) {
          const aliasPath = resolveAliasToPath(options.cwd, alias)
          if (existsSync(aliasPath)) {
            checks.push({
              level: 'pass',
              message: `Alias ${name} resolves to ${aliasPath}.`,
            })
          } else {
            checks.push({
              level: 'warn',
              message: `Alias ${name} path does not exist yet: ${aliasPath}.`,
            })
          }
        }
        if (!existsSync(cssPath)) {
          checks.push({
            level: 'warn',
            message: `Theme css file does not exist: ${config.tailwind.css}.`,
          })
        } else {
          const css = readFileSync(cssPath, 'utf-8')
          checks.push({
            level: css.includes(themeImport) ? 'pass' : 'warn',
            message: css.includes(themeImport)
              ? 'Theme css import is configured.'
              : `Theme css import is missing: ${themeImport}`,
          })
          checks.push({
            level: css.includes(componentsImport) ? 'pass' : 'warn',
            message: css.includes(componentsImport)
              ? 'Component css import is configured.'
              : `Component css import is missing: ${componentsImport}`,
          })
        }
      } catch (e) {
        checks.push({ level: 'fail', message: (e as Error).message })
      }
    }

    const pkg = readPackageJson(options.cwd)
    if (!pkg) {
      checks.push({ level: 'warn', message: 'package.json not found.' })
    } else {
      checks.push({
        level: hasDependency(pkg, '@zeus-web/themes') ? 'pass' : 'warn',
        message: hasDependency(pkg, '@zeus-web/themes')
          ? '@zeus-web/themes is installed.'
          : '@zeus-web/themes is not installed.',
      })
    }

    const lock = readLegacyLock(options.cwd)
    const lockedComponents = Object.keys(lock.components)
    if (lockedComponents.length === 0) {
      checks.push({
        level: 'warn',
        message: `${legacyLockFileName} has no tracked components.`,
      })
    } else {
      checks.push({
        level: 'pass',
        message: `${legacyLockFileName} tracks ${lockedComponents.length} component(s).`,
      })
      for (const [component, item] of Object.entries(lock.components)) {
        for (const file of item.files) {
          const target = resolve(options.cwd, file.target)
          if (existsSync(target)) {
            checks.push({
              level: 'pass',
              message: `${component}: ${file.target} exists.`,
            })
          } else {
            checks.push({
              level: 'fail',
              message: `${component}: ${file.target} is missing.`,
            })
          }
        }
      }
    }

    if (options.json) console.log(JSON.stringify({ checks }, null, 2))
    else printChecks(checks)
    if (checks.some(c => c.level === 'fail')) process.exitCode = 1
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
