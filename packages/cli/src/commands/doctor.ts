import type { ComponentsConfig } from '../config'
import type {
  LoadedRegistrySource,
  RegistrySourceSnapshot,
} from '../registry-source'

import { existsSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import pc from 'picocolors'

import {
  getComponentsConfigPath,
  readComponentsConfig,
  registryGlobalsEnd,
  registryGlobalsStart,
  resolveAliasToPath,
  resolveRegistryTarget,
  themeOverrideEnd,
  themeOverrideStart,
  toRelativeProjectPath,
} from '../config'
import {
  componentsLockFileName,
  hashFile,
  readComponentsLock,
  resolveLockedTarget,
} from '../lock'
import { loadRegistrySource } from '../registry-source'

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
      if (!v || v.startsWith('--'))
        throw new Error('--cwd requires a directory path')
      options.cwd = resolve(cwd, v)
      continue
    }
    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = resolve(cwd, value)
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

function readPackageJson(cwd: string): Record<string, unknown> | undefined {
  const file = resolve(cwd, 'package.json')
  if (!existsSync(file)) return undefined
  const value: unknown = JSON.parse(readFileSync(file, 'utf-8'))
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('package.json must contain an object')
  }
  return value as Record<string, unknown>
}

function hasDependency(
  pkg: Record<string, unknown> | undefined,
  dep: string,
): boolean {
  const deps = (pkg?.dependencies as Record<string, string> | undefined) ?? {}
  const dev = (pkg?.devDependencies as Record<string, string> | undefined) ?? {}
  return Object.keys(deps).includes(dep) || Object.keys(dev).includes(dep)
}

function hasRegistryDependencyFiles(
  cwd: string,
  config: ComponentsConfig,
  source: LoadedRegistrySource,
  name: string,
): boolean {
  const item = source.registry.items.find(entry => entry.name === name)
  if (!item) return false
  const files = item.files.filter(
    file => file.framework === 'shared' || file.framework === config.framework,
  )
  return (
    files.length > 0 &&
    files.every(file => {
      const target = toRelativeProjectPath(
        cwd,
        resolveRegistryTarget(cwd, config, file.target),
      )
      return existsSync(resolveLockedTarget(cwd, target))
    }) &&
    item.registryDependencies.every(dependency =>
      hasRegistryDependencyFiles(cwd, config, source, dependency),
    )
  )
}

function getRegistryReference(source: RegistrySourceSnapshot): string {
  if (source.kind === 'bundled') return source.location
  if (source.kind === 'file') return fileURLToPath(source.location)
  return source.location
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
    let registry: LoadedRegistrySource | undefined
    let config: ComponentsConfig | undefined
    const loadedRegistrySources = new Map<string, LoadedRegistrySource>()

    try {
      registry = await loadRegistrySource()
      checks.push({ level: 'pass', message: '@zeus-web/registry is valid.' })
      loadedRegistrySources.set(registry.source.id, registry)
    } catch (e) {
      registry = undefined
      checks.push({ level: 'fail', message: (e as Error).message })
    }

    const configPath = getComponentsConfigPath(options.cwd)
    if (!existsSync(configPath)) {
      checks.push({
        level: 'fail',
        message: 'zeus-ui.json not found. Run `zweb init` first.',
      })
    } else {
      const configName = basename(configPath)
      checks.push({ level: 'pass', message: `${configName} exists.` })
      try {
        config = readComponentsConfig(options.cwd)
        const cssPath = resolve(options.cwd, config.tailwind.css)
        checks.push({ level: 'pass', message: `${configName} is valid.` })
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
          for (const [name, start, end] of [
            ['Registry globals', registryGlobalsStart, registryGlobalsEnd],
            ['Theme overrides', themeOverrideStart, themeOverrideEnd],
          ]) {
            const configured =
              css.includes(start) && css.indexOf(end) > css.indexOf(start)
            checks.push({
              level: configured ? 'pass' : 'warn',
              message: `${name} managed css block is ${configured ? 'configured' : 'missing'}.`,
            })
          }
        }
      } catch (e) {
        checks.push({ level: 'fail', message: (e as Error).message })
      }
    }

    let pkg: Record<string, unknown> | undefined
    try {
      pkg = readPackageJson(options.cwd)
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
    } catch (error) {
      checks.push({
        level: 'fail',
        message: `Invalid package.json: ${(error as Error).message}`,
      })
    }

    try {
      const lock = readComponentsLock(options.cwd)
      const lockedComponents = Object.keys(lock.components)
      checks.push({
        level: lockedComponents.length > 0 ? 'pass' : 'warn',
        message: `${componentsLockFileName} tracks ${lockedComponents.length} component(s).`,
      })
      for (const [id, lockedSource] of Object.entries(lock.registries)) {
        try {
          const source = await loadRegistrySource({
            reference: getRegistryReference(lockedSource),
            cwd: options.cwd,
          })
          loadedRegistrySources.set(id, source)
          const changed =
            source.source.name !== lockedSource.name ||
            source.source.version !== lockedSource.version ||
            source.source.integrity !== lockedSource.integrity
          checks.push({
            level: changed ? 'warn' : 'pass',
            message: changed
              ? `Registry source ${id} changed since the last add.`
              : `Registry source ${id} matches the lock.`,
          })
        } catch (error) {
          checks.push({
            level: 'fail',
            message: `Registry source ${id} is unavailable: ${(error as Error).message}`,
          })
        }
      }
      const dependencies = new Set<string>()
      for (const [component, item] of Object.entries(lock.components)) {
        for (const dependency of item.dependencies) dependencies.add(dependency)
        for (const dependency of item.registryDependencies) {
          if (!Object.keys(lock.components).includes(dependency)) {
            const source = loadedRegistrySources.get(item.registry)
            const filesExist = Boolean(
              config &&
              source &&
              hasRegistryDependencyFiles(
                options.cwd,
                config,
                source,
                dependency,
              ),
            )
            checks.push({
              level: filesExist ? 'warn' : 'fail',
              message: filesExist
                ? `${component}: registry dependency ${dependency} files exist but are not tracked.`
                : `${component}: registry dependency ${dependency} is not tracked.`,
            })
          }
        }
        for (const file of item.files) {
          const target = resolveLockedTarget(options.cwd, file)
          const exists = existsSync(target)
          checks.push({
            level: exists ? 'pass' : 'fail',
            message: `${component}: ${file} ${exists ? 'exists' : 'is missing'}.`,
          })
          const expected = item.fileHashes?.[file]
          if (exists && expected && hashFile(target) !== expected) {
            checks.push({
              level: 'warn',
              message: `${component}: ${file} has local changes.`,
            })
          }
        }
      }
      for (const dependency of dependencies) {
        const name = dependency.replace(/@[^@/]+$/, '')
        const installed = hasDependency(pkg, name)
        checks.push({
          level: installed ? 'pass' : 'warn',
          message: `${name} is ${installed ? '' : 'not '}installed.`,
        })
      }
    } catch (error) {
      checks.push({ level: 'fail', message: (error as Error).message })
    }

    if (options.json) console.log(JSON.stringify({ checks }, null, 2))
    else printChecks(checks)
    if (checks.some(c => c.level === 'fail')) process.exitCode = 1
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
