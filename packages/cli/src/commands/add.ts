import type {
  Registry,
  RegistryFile,
  RegistryFramework,
  RegistryItem,
} from '@zeus-web/registry'
import type { ComponentsConfig } from '../config'
import type { PackageManager } from '../package-manager'
import type {
  LoadedRegistrySource,
  RegistrySourceSnapshot,
} from '../registry-source'

import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

import { findRegistryItem, validateRegistry } from '@zeus-web/registry'
import pc from 'picocolors'

import {
  readComponentsConfig,
  resolveRegistryTarget,
  toRelativeProjectPath,
} from '../config'
import {
  hashString,
  readComponentsLock,
  resolveLockedTarget,
  updateComponentsLockFromPlans,
} from '../lock'
import {
  createInstallCommands,
  formatInstallCommands,
  installDependencies,
} from '../package-manager'
import { readRegistryAsset } from '../registry-assets'
import {
  createBundledRegistrySource,
  loadRegistrySource,
} from '../registry-source'

interface AddOptions {
  cwd: string
  all: boolean
  dryRun: boolean
  overwrite: boolean
  install: boolean
  skipDeps: boolean
  yes: boolean
  componentPath?: string
  registry?: string
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
  registry: RegistrySourceSnapshot
  readSource: LoadedRegistrySource['readSource']
  componentPath?: string
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFilePlan[]
}

interface AddResult {
  written: string[]
  skipped: string[]
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
  let installExplicit = false
  const options: AddOptions = {
    cwd,
    all: false,
    dryRun: false,
    overwrite: false,
    install: false,
    skipDeps: false,
    yes: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run') {
      options.dryRun = true
      options.install = false
      continue
    }

    if (arg === '--all') {
      options.all = true
      continue
    }

    if (arg === '--yes' || arg === '-y') {
      options.yes = true
      continue
    }

    if (arg === '--skip-deps') {
      options.skipDeps = true
      continue
    }

    if (arg === '--overwrite' || arg === '--force') {
      options.overwrite = true
      continue
    }

    if (arg === '--install') {
      options.install = true
      installExplicit = true
      continue
    }

    if (arg === '--no-install') {
      options.install = false
      installExplicit = true
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

    if (arg === '--path') {
      const value = args[index + 1]
      if (!value) throw new Error('--path requires a directory path')
      options.componentPath = value
      index += 1
      continue
    }

    if (arg.startsWith('--path=')) {
      const value = arg.slice('--path='.length)
      if (!value) throw new Error('--path requires a directory path')
      options.componentPath = value
      continue
    }

    if (arg === '--registry') {
      const value = args[index + 1]
      if (!value) throw new Error('--registry requires a URL or file path')
      options.registry = value
      index += 1
      continue
    }

    if (arg.startsWith('--registry=')) {
      const value = arg.slice('--registry='.length)
      if (!value) throw new Error('--registry requires a URL or file path')
      options.registry = value
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    }

    components.push(arg)
  }

  if (options.componentPath) {
    options.componentPath = normalizeComponentPath(
      options.cwd,
      options.componentPath,
    )
  }
  if (options.dryRun || options.skipDeps) options.install = false
  else if (options.yes && !installExplicit) options.install = true

  return {
    components,
    options,
  }
}

export function loadRegistry(): Registry {
  return createBundledRegistrySource().registry
}

function normalizeComponentPath(cwd: string, value: string): string {
  if (isAbsolute(value) || value.includes('\\') || value.includes('\0')) {
    throw new Error('--path must be a project-relative directory')
  }
  const normalized = relative(cwd, resolve(cwd, value)).replace(/\\/g, '/')
  if (
    !normalized ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    throw new Error('--path must resolve inside the project directory')
  }
  return normalized
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
  componentPath?: string
  item: RegistryItem
  file: RegistryFile
  overwrite: boolean
}): RegistryFilePlan {
  const targetConfig = params.componentPath
    ? {
        ...params.config,
        aliases: {
          ...params.config.aliases,
          ui: params.componentPath,
        },
      }
    : params.config
  const absoluteTarget = resolveRegistryTarget(
    params.cwd,
    targetConfig,
    params.file.target,
  )

  resolveLockedTarget(
    params.cwd,
    toRelativeProjectPath(params.cwd, absoluteTarget),
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
  componentPath?: string
  item: RegistryItem
  overwrite: boolean
  registry: RegistrySourceSnapshot
  readSource: LoadedRegistrySource['readSource']
}): AddPlan {
  return {
    component: params.item.name,
    registry: params.registry,
    readSource: params.readSource,
    componentPath: params.componentPath,
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
          componentPath: params.componentPath,
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
      registry: plan.registry,
      readSource: plan.readSource,
      componentPath: plan.componentPath,
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

export function createAddPlan(params: {
  components: string[]
  registry?: Registry
  registrySource?: LoadedRegistrySource
  cwd?: string
  config?: ComponentsConfig
  overwrite?: boolean
  componentPath?: string
  componentPathByComponent?: Record<string, string>
}): AddPlan[] {
  const loadedSource =
    params.registrySource ??
    (params.registry
      ? {
          registry: params.registry,
          source: {
            id: '@zeus-web/registry',
            kind: 'bundled' as const,
            location: '@zeus-web/registry',
            name: params.registry.name,
            version: params.registry.version,
            integrity: hashString(JSON.stringify(params.registry)),
          },
          readSource: async (source: string) => readRegistryAsset(source),
        }
      : createBundledRegistrySource())
  const registry = params.registry ?? loadedSource.registry
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
        componentPath:
          params.componentPathByComponent?.[item.name] ?? params.componentPath,
        item,
        overwrite,
        registry: loadedSource.source,
        readSource: loadedSource.readSource,
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

function flattenPlannedFiles(plans: AddPlan[]): Array<{
  plan: AddPlan
  file: RegistryFilePlan
}> {
  const byTarget = new Map<string, { plan: AddPlan; file: RegistryFilePlan }>()

  for (const plan of plans) {
    for (const file of plan.files) {
      const existing = byTarget.get(file.target)
      if (
        existing &&
        (existing.plan.registry.id !== plan.registry.id ||
          existing.file.source !== file.source)
      ) {
        throw new Error(
          `Registry target conflict for ${file.target}: ${existing.plan.registry.id}:${existing.file.source} and ${plan.registry.id}:${file.source}`,
        )
      }
      if (!existing) byTarget.set(file.target, { plan, file })
    }
  }

  return Array.from(byTarget.values())
}

function printAddPlan(params: {
  plans: AddPlan[]
  dependencies: string[]
  options: AddOptions
}): void {
  console.log(pc.bold('Add plan:'))

  for (const { file } of flattenPlannedFiles(params.plans)) {
    const action =
      file.action === 'create'
        ? pc.green('CREATE')
        : file.action === 'overwrite'
          ? pc.yellow('OVERWRITE')
          : pc.gray('SKIP')

    console.log(`  ${action} ${file.target}`)
  }

  if (params.dependencies.length > 0 && !params.options.skipDeps) {
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
  config: ComponentsConfig
  file: RegistryFilePlan
  readSource: LoadedRegistrySource['readSource']
  overwrite: boolean
}): Promise<'written' | 'skipped'> {
  if (existsSync(params.file.absoluteTarget) && !params.overwrite) {
    return 'skipped'
  }

  const raw = await params.readSource(params.file.source)
  const source = rewriteRegistrySource(raw, params.config)

  await mkdir(dirname(params.file.absoluteTarget), {
    recursive: true,
  })

  await writeFile(params.file.absoluteTarget, source, 'utf-8')

  return 'written'
}

async function writePlans(params: {
  config: ComponentsConfig
  plans: AddPlan[]
  overwrite: boolean
}): Promise<AddResult> {
  const written: string[] = []
  const skipped: string[] = []

  for (const { plan, file } of flattenPlannedFiles(params.plans)) {
    const result = await writeFilePlan({
      config: params.config,
      file,
      readSource: plan.readSource,
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

async function createRegistryHashes(params: {
  config: ComponentsConfig
  plans: AddPlan[]
}): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {}

  for (const { plan, file } of flattenPlannedFiles(params.plans)) {
    const raw = await plan.readSource(file.source)
    const source = rewriteRegistrySource(raw, params.config)
    hashes[file.target] = hashString(source)
  }

  return hashes
}

async function updateLock(params: {
  cwd: string
  plans: AddPlan[]
  writtenTargets: string[]
  config: ComponentsConfig
}): Promise<void> {
  await updateComponentsLockFromPlans({
    cwd: params.cwd,
    plans: params.plans,
    writtenTargets: params.writtenTargets,
    registryHashes: await createRegistryHashes({
      config: params.config,
      plans: params.plans,
    }),
  })
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
    const loadedRegistry = await loadRegistrySource({
      reference: parsed.options.registry,
      cwd: parsed.options.cwd,
    })
    readComponentsLock(parsed.options.cwd)
    const finalComponents = parsed.options.all
      ? listAvailableComponents(loadedRegistry.registry)
      : parsed.components

    const plans = createAddPlan({
      components: finalComponents,
      registrySource: loadedRegistry,
      cwd: parsed.options.cwd,
      config,
      overwrite: parsed.options.overwrite,
      componentPath: parsed.options.componentPath,
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
      config,
      plans,
      overwrite: parsed.options.overwrite,
    })

    printWriteResult(result)

    await updateLock({
      cwd: parsed.options.cwd,
      plans,
      writtenTargets: result.written,
      config,
    })

    if (dependencies.length > 0 && !parsed.options.skipDeps) {
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
