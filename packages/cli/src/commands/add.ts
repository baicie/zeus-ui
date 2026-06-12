import type {
  Registry,
  RegistryFile,
  RegistryFramework,
  RegistryItem,
} from '@zeus-web/registry'
import type { ComponentsConfig } from '../config'
import type { PackageManager } from '../package-manager'

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, resolve } from 'node:path'

import { findRegistryItem, validateRegistry } from '@zeus-web/registry'
import pc from 'picocolors'

import {
  readComponentsConfig,
  resolveRegistryTarget,
  toRelativeProjectPath,
} from '../config'
import { readComponentsLock, writeComponentsLock } from '../lock'
import {
  createInstallCommands,
  formatInstallCommands,
  installDependencies,
} from '../package-manager'
import { readRegistryAsset } from '../registry-assets'

interface AddOptions {
  cwd: string
  dryRun: boolean
  overwrite: boolean
  install: boolean
  packageManager?: PackageManager
}

interface ParsedAddArgs {
  components: string[]
  options: AddOptions
}

interface RegistryFilePlan {
  source: string
  target: string
  absoluteTarget: string
  component: string
  framework: RegistryFramework
  action: 'create' | 'overwrite' | 'skip'
}

export interface AddPlan {
  component: string
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFilePlan[]
}

interface AddResult {
  written: string[]
  skipped: string[]
}

const require = createRequire(import.meta.url)

export function resolveRegistryJsonPath(): string {
  return require.resolve('@zeus-web/registry/registry.json')
}

export function resolveRegistryRoot(): string {
  return dirname(resolveRegistryJsonPath())
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

export function parseAddArgs(
  args: string[],
  cwd = process.cwd(),
): ParsedAddArgs {
  const components: string[] = []
  const options: AddOptions = {
    cwd,
    dryRun: false,
    overwrite: false,
    install: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run') {
      options.dryRun = true
      options.install = false
      continue
    }

    if (arg === '--overwrite' || arg === '--force') {
      options.overwrite = true
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

    components.push(arg)
  }

  return {
    components,
    options,
  }
}

export function loadRegistry(): Registry {
  const source = readRegistryAsset('registry.json')
  return JSON.parse(source) as Registry
}

function assertValidRegistry(registry: Registry): void {
  const result = validateRegistry(registry)

  if (!result.valid) {
    throw new Error(`Invalid registry:\n${result.errors.join('\n')}`)
  }
}

function getComponentItems(registry: Registry): RegistryItem[] {
  return registry.items.filter(item => item.type === 'component')
}

export function listAvailableComponents(registry = loadRegistry()): string[] {
  assertValidRegistry(registry)

  return getComponentItems(registry).map(item => item.name)
}

function assertComponentExists(registry: Registry, name: string): RegistryItem {
  const item = findRegistryItem(registry, name)

  if (!item) {
    const available = listAvailableComponents(registry).join(', ')
    throw new Error(
      `Unknown component "${name}". Available components: ${available}`,
    )
  }

  return item
}

function collectRegistryItems(params: {
  registry: Registry
  name: string
  collected: Map<string, RegistryItem>
  visiting: string[]
}): void {
  const { registry, name, collected, visiting } = params

  if (collected.has(name)) return

  if (visiting.includes(name)) {
    throw new Error(
      `Circular registry dependency: ${[...visiting, name].join(' -> ')}`,
    )
  }

  const item = assertComponentExistsOrRegistryDependency(registry, name)

  for (const dependency of item.registryDependencies) {
    collectRegistryItems({
      registry,
      name: dependency,
      collected,
      visiting: [...visiting, name],
    })
  }

  collected.set(item.name, item)
}

function assertComponentExistsOrRegistryDependency(
  registry: Registry,
  name: string,
): RegistryItem {
  const item = findRegistryItem(registry, name)

  if (!item) {
    const available = registry.items.map(entry => entry.name).join(', ')
    throw new Error(
      `Unknown registry item "${name}". Available items: ${available}`,
    )
  }

  return item
}

function shouldIncludeFileForFramework(
  file: RegistryFile,
  framework: ComponentsConfig['framework'],
): boolean {
  return file.framework === 'shared' || file.framework === framework
}

function normalizeImportAlias(alias: string): string {
  if (alias.endsWith('/')) return alias.slice(0, -1)
  return alias
}

export function rewriteRegistrySource(
  source: string,
  config: ComponentsConfig,
): string {
  const libAlias = normalizeImportAlias(config.aliases.lib)
  const uiAlias = normalizeImportAlias(config.aliases.ui)
  const stylesAlias = normalizeImportAlias(config.aliases.styles)

  return source
    .replace(/@\/lib\/cn/g, `${libAlias}/cn`)
    .replace(/@\/lib\/utils/g, `${libAlias}/utils`)
    .replace(/@\/components\/ui/g, uiAlias)
    .replace(/@\/styles/g, stylesAlias)
}

function createFilePlan(params: {
  cwd: string
  config: ComponentsConfig
  item: RegistryItem
  file: RegistryFile
  overwrite: boolean
}): RegistryFilePlan {
  const absoluteTarget = resolveRegistryTarget(
    params.cwd,
    params.config,
    params.file.target,
  )

  const exists = existsSync(absoluteTarget)

  return {
    source: params.file.source,
    target: toRelativeProjectPath(params.cwd, absoluteTarget),
    absoluteTarget,
    component: params.item.name,
    framework: params.file.framework,
    action: exists ? (params.overwrite ? 'overwrite' : 'skip') : 'create',
  }
}

function toAddPlan(params: {
  cwd: string
  config: ComponentsConfig
  item: RegistryItem
  overwrite: boolean
}): AddPlan {
  return {
    component: params.item.name,
    dependencies: [...params.item.dependencies],
    registryDependencies: [...params.item.registryDependencies],
    files: params.item.files
      .filter(file =>
        shouldIncludeFileForFramework(file, params.config.framework),
      )
      .map(file =>
        createFilePlan({
          cwd: params.cwd,
          config: params.config,
          item: params.item,
          file,
          overwrite: params.overwrite,
        }),
      ),
  }
}

function dedupePlans(plans: AddPlan[]): AddPlan[] {
  const byComponent = new Map<string, AddPlan>()

  for (const plan of plans) {
    const existing = byComponent.get(plan.component)

    if (!existing) {
      byComponent.set(plan.component, plan)
      continue
    }

    byComponent.set(plan.component, {
      component: plan.component,
      dependencies: Array.from(
        new Set([...existing.dependencies, ...plan.dependencies]),
      ),
      registryDependencies: Array.from(
        new Set([
          ...existing.registryDependencies,
          ...plan.registryDependencies,
        ]),
      ),
      files: dedupeFilePlans([...existing.files, ...plan.files]),
    })
  }

  return Array.from(byComponent.values())
}

function dedupeFilePlans(files: RegistryFilePlan[]): RegistryFilePlan[] {
  const byTarget = new Map<string, RegistryFilePlan>()

  for (const file of files) {
    byTarget.set(file.target, file)
  }

  return Array.from(byTarget.values())
}

export function resolveAddPlanTargets(params: {
  plans: AddPlan[]
  cwd: string
  config: ComponentsConfig
}): AddPlan[] {
  return params.plans.map(plan => ({
    ...plan,
    files: plan.files.map(file => ({
      ...file,
      absoluteTarget: resolveRegistryTarget(
        params.cwd,
        params.config,
        file.target,
      ),
    })),
  }))
}

export function createAddPlan(params: {
  components: string[]
  registry?: Registry
  cwd?: string
  config?: ComponentsConfig
  overwrite?: boolean
}): AddPlan[] {
  const registry = params.registry ?? loadRegistry()
  assertValidRegistry(registry)

  if (params.components.length === 0) {
    throw new Error(
      `No components provided. Available components: ${listAvailableComponents(registry).join(', ')}`,
    )
  }

  const cwd = params.cwd ?? process.cwd()
  const config = params.config ?? readComponentsConfig(cwd)
  const overwrite = params.overwrite ?? false

  const collected = new Map<string, RegistryItem>()

  for (const component of params.components) {
    const item = assertComponentExists(registry, component)

    if (item.type !== 'component') {
      throw new Error(`"${component}" is not a component registry item`)
    }

    collectRegistryItems({
      registry,
      name: component,
      collected,
      visiting: [],
    })
  }

  return dedupePlans(
    Array.from(collected.values()).map(item =>
      toAddPlan({
        cwd,
        config,
        item,
        overwrite,
      }),
    ),
  )
}

function flattenDependencies(plans: AddPlan[]): string[] {
  const dependencies = new Set<string>()

  for (const plan of plans) {
    for (const dependency of plan.dependencies) {
      dependencies.add(dependency)
    }
  }

  return Array.from(dependencies)
}

function flattenFiles(plans: AddPlan[]): RegistryFilePlan[] {
  return dedupeFilePlans(plans.flatMap(plan => plan.files))
}

function printAddPlan(params: {
  plans: AddPlan[]
  dependencies: string[]
  options: AddOptions
}): void {
  console.log(pc.bold('Add plan:'))

  for (const file of flattenFiles(params.plans)) {
    const action =
      file.action === 'create'
        ? pc.green('CREATE')
        : file.action === 'overwrite'
          ? pc.yellow('OVERWRITE')
          : pc.gray('SKIP')

    console.log(`  ${action} ${file.target}`)
  }

  if (params.dependencies.length > 0) {
    console.log(pc.bold('Dependencies:'))
    for (const dependency of params.dependencies) {
      console.log(`  ${dependency}`)
    }

    const commands = createInstallCommands({
      cwd: params.options.cwd,
      packageManager: params.options.packageManager,
      dependencies: params.dependencies,
    })

    console.log(pc.bold('Install command:'))
    for (const command of formatInstallCommands(commands)) {
      console.log(`  ${command}`)
    }
  }
}

async function writeFilePlan(params: {
  cwd: string
  config: ComponentsConfig
  file: RegistryFilePlan
  overwrite: boolean
}): Promise<'written' | 'skipped'> {
  if (existsSync(params.file.absoluteTarget) && !params.overwrite) {
    return 'skipped'
  }

  const registryRoot = resolveRegistryRoot()
  const sourcePath = resolve(registryRoot, params.file.source)
  const raw = await readFile(sourcePath, 'utf-8')
  const source = rewriteRegistrySource(raw, params.config)

  await mkdir(dirname(params.file.absoluteTarget), {
    recursive: true,
  })

  await writeFile(params.file.absoluteTarget, source, 'utf-8')

  return 'written'
}

async function writePlans(params: {
  cwd: string
  config: ComponentsConfig
  plans: AddPlan[]
  overwrite: boolean
}): Promise<AddResult> {
  const written: string[] = []
  const skipped: string[] = []

  for (const file of flattenFiles(params.plans)) {
    const result = await writeFilePlan({
      cwd: params.cwd,
      config: params.config,
      file,
      overwrite: params.overwrite,
    })

    if (result === 'written') written.push(file.target)
    else skipped.push(file.target)
  }

  return {
    written,
    skipped,
  }
}

async function updateLock(params: {
  cwd: string
  plans: AddPlan[]
  writtenTargets: string[]
}): Promise<void> {
  const lock = readComponentsLock(params.cwd)
  const writtenTargets = new Set(params.writtenTargets)
  const updatedAt = new Date().toISOString()

  for (const plan of params.plans) {
    const files = plan.files
      .filter(file => writtenTargets.has(file.target))
      .map(file => file.target)

    if (files.length === 0) continue

    lock.components[plan.component] = {
      files,
      dependencies: plan.dependencies,
      registryDependencies: plan.registryDependencies,
      updatedAt,
    }
  }

  await writeComponentsLock(params.cwd, lock)
}

function printWriteResult(result: AddResult): void {
  for (const file of result.written) {
    console.log(pc.green(`Created ${file}`))
  }

  for (const file of result.skipped) {
    console.log(
      pc.yellow(`Skipped existing ${file}. Use --overwrite to replace it.`),
    )
  }
}

export async function add(args: string[]) {
  try {
    const parsed = parseAddArgs(args)
    const config = readComponentsConfig(parsed.options.cwd)
    const registry = loadRegistry()

    const plans = createAddPlan({
      components: parsed.components,
      registry,
      cwd: parsed.options.cwd,
      config,
      overwrite: parsed.options.overwrite,
    })

    const dependencies = flattenDependencies(plans)

    if (parsed.options.dryRun) {
      printAddPlan({
        plans,
        dependencies,
        options: parsed.options,
      })
      return
    }

    const result = await writePlans({
      cwd: parsed.options.cwd,
      config,
      plans,
      overwrite: parsed.options.overwrite,
    })

    printWriteResult(result)

    await updateLock({
      cwd: parsed.options.cwd,
      plans,
      writtenTargets: result.written,
    })

    if (dependencies.length > 0) {
      if (parsed.options.install) {
        await installDependencies({
          cwd: parsed.options.cwd,
          packageManager: parsed.options.packageManager,
          dependencies,
        })
      } else {
        const commands = createInstallCommands({
          cwd: parsed.options.cwd,
          packageManager: parsed.options.packageManager,
          dependencies,
        })

        console.log(pc.bold('Install dependencies:'))
        for (const command of formatInstallCommands(commands)) {
          console.log(`  ${command}`)
        }
      }
    }
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
