import type {
  Registry,
  RegistryItem,
  RegistryItemFile,
} from '@zeus-web/registry'
import type { ComponentsConfig } from '../config'
import type { PackageManager } from '../package-manager'

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

import { validateRegistry } from '@zeus-web/registry'
import pc from 'picocolors'

import {
  readComponentsConfig,
  resolveRegistryTarget,
  toRelativeProjectPath,
} from '../config'
import { updateComponentsLockFromPlans } from '../lock'
import {
  createInstallCommands,
  formatInstallCommands,
  installDependencies,
} from '../package-manager'

export interface RegistryFilePlan {
  source: string
  target: string
  resolvedTarget?: string
  type?: string
}

export interface AddPlan {
  component: string
  dependencies: string[]
  devDependencies: string[]
  files: RegistryFilePlan[]
}

export interface AddOptions {
  cwd: string
  dryRun: boolean
  overwrite: boolean
  install: boolean
  all: boolean
  yes: boolean
  packageManager?: PackageManager
}

export interface AddExecutionResult {
  planned: string[]
  written: string[]
  skipped: string[]
  dependencies: string[]
  devDependencies: string[]
}

interface ParsedAddArgs {
  components: string[]
  options: AddOptions
}

type CopyResult = 'planned' | 'written' | 'skipped'

const require = createRequire(import.meta.url)

export function resolveRegistryJsonPath(): string {
  return require.resolve('@zeus-web/registry/registry.json')
}

export function resolveRegistryRoot(): string {
  return dirname(resolveRegistryJsonPath())
}

function createInvalidRegistryError(errors: string[]): Error {
  return new Error(
    [
      'Invalid @zeus-web/registry/registry.json:',
      ...errors.map(error => `- ${error}`),
    ].join('\n'),
  )
}

function assertValidRegistry(registry: Registry): void {
  const result = validateRegistry(registry)

  if (!result.valid) {
    throw createInvalidRegistryError(result.errors)
  }
}

export function loadRegistry(): Registry {
  const registry = require('@zeus-web/registry/registry.json') as Registry

  assertValidRegistry(registry)

  return registry
}

function toFilePlan(file: RegistryItemFile): RegistryFilePlan {
  return {
    source: file.source ?? file.path ?? '',
    target: file.target,
    type: file.type,
  }
}

function toAddPlan(item: RegistryItem): AddPlan {
  return {
    component: item.name,
    dependencies: item.dependencies ?? [],
    devDependencies: item.devDependencies ?? [],
    files: item.files.map(toFilePlan),
  }
}

function findRegistryItem(registry: Registry, component: string): RegistryItem {
  const item = registry.items.find(entry => entry.name === component)

  if (!item) {
    throw new Error(`Unknown component: ${component}`)
  }

  return item
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort()
}

function dedupePlans(plans: AddPlan[]): AddPlan[] {
  return plans.map(plan => {
    const files = new Map<string, RegistryFilePlan>()

    for (const file of plan.files) {
      files.set(file.target, file)
    }

    return {
      ...plan,
      dependencies: uniqueSorted(plan.dependencies),
      devDependencies: uniqueSorted(plan.devDependencies),
      files: Array.from(files.values()),
    }
  })
}

export function listAvailableComponents(registry = loadRegistry()): string[] {
  assertValidRegistry(registry)

  return registry.items
    .filter(item => item.type === 'registry:ui')
    .map(item => item.name)
}

export function createAddPlan(
  components: string[],
  registry = loadRegistry(),
): AddPlan[] {
  assertValidRegistry(registry)

  const plans = components.map(component => {
    const item = findRegistryItem(registry, component)

    return toAddPlan(item)
  })

  return dedupePlans(plans)
}

export function resolveAddPlanTargets(
  plans: AddPlan[],
  cwd: string,
  config: ComponentsConfig,
): AddPlan[] {
  return plans.map(plan => ({
    ...plan,
    files: plan.files.map(file => ({
      ...file,
      resolvedTarget: resolveRegistryTarget(cwd, config, file.target),
    })),
  }))
}

export function createCombinedInstallPlan(plans: AddPlan[]): {
  dependencies: string[]
  devDependencies: string[]
} {
  return {
    dependencies: uniqueSorted(plans.flatMap(plan => plan.dependencies)),
    devDependencies: uniqueSorted(plans.flatMap(plan => plan.devDependencies)),
  }
}

function normalizeImportAlias(alias: string): string {
  return alias.replace(/\/$/, '')
}

export function rewriteRegistrySource(
  source: string,
  config: ComponentsConfig,
): string {
  const libAlias = normalizeImportAlias(config.aliases.lib)

  return source.replace(/@\/lib\/utils/g, `${libAlias}/utils`)
}

function parsePackageManagerValue(value: string): PackageManager {
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
    install: true,
    all: false,
    yes: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--all') {
      options.all = true
      continue
    }

    if (arg === '--yes' || arg === '-y') {
      options.yes = true
      continue
    }

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--overwrite' || arg === '--force') {
      options.overwrite = true
      continue
    }

    if (arg === '--no-install' || arg === '--skip-deps') {
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

    if (arg === '--package-manager') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('--package-manager requires a value')
      }

      options.packageManager = parsePackageManagerValue(value)
      index += 1
      continue
    }

    if (arg.startsWith('--package-manager=')) {
      options.packageManager = parsePackageManagerValue(
        arg.slice('--package-manager='.length),
      )
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

function assertSafeTarget(cwd: string, target: string): string {
  const absoluteTarget = resolve(cwd, target)
  const relativeTarget = relative(cwd, absoluteTarget).replace(/\\/g, '/')

  if (
    relativeTarget === '..' ||
    relativeTarget.startsWith('../') ||
    isAbsolute(relativeTarget)
  ) {
    throw new Error(`Refusing to write outside cwd: ${target}`)
  }

  return absoluteTarget
}

async function copyRegistryFile(params: {
  registryRoot: string
  cwd: string
  file: RegistryFilePlan
  config: ComponentsConfig
  dryRun: boolean
  overwrite: boolean
}): Promise<CopyResult> {
  const sourcePath = resolve(params.registryRoot, params.file.source)
  const rawTarget = params.file.resolvedTarget ?? params.file.target
  const targetPath = assertSafeTarget(params.cwd, rawTarget)

  if (!existsSync(sourcePath)) {
    throw new Error(
      `Registry source file does not exist: ${params.file.source}`,
    )
  }

  if (existsSync(targetPath) && !params.overwrite) {
    return 'skipped'
  }

  if (params.dryRun) {
    return 'planned'
  }

  await mkdir(dirname(targetPath), { recursive: true })

  const source = await readFile(sourcePath, 'utf-8')
  const nextSource = rewriteRegistrySource(source, params.config)

  await writeFile(targetPath, nextSource, 'utf-8')

  return 'written'
}

export async function executeAddPlan(
  plans: AddPlan[],
  options: AddOptions,
  registryRoot = resolveRegistryRoot(),
): Promise<AddExecutionResult> {
  const config = readComponentsConfig(options.cwd)
  const resolvedPlans = resolveAddPlanTargets(plans, options.cwd, config)

  const planned: string[] = []
  const written: string[] = []
  const skipped: string[] = []
  const seenTargets = new Set<string>()

  for (const plan of resolvedPlans) {
    for (const file of plan.files) {
      const targetPath = file.resolvedTarget ?? file.target
      const displayTarget = toRelativeProjectPath(options.cwd, targetPath)

      if (seenTargets.has(targetPath)) {
        continue
      }

      seenTargets.add(targetPath)

      const result = await copyRegistryFile({
        registryRoot,
        cwd: options.cwd,
        file,
        config,
        dryRun: options.dryRun,
        overwrite: options.overwrite,
      })

      if (result === 'planned') {
        planned.push(displayTarget)
      } else if (result === 'written') {
        written.push(displayTarget)
      } else {
        skipped.push(displayTarget)
      }
    }
  }

  const installPlan = createCombinedInstallPlan(plans)

  return {
    planned,
    written,
    skipped,
    dependencies: installPlan.dependencies,
    devDependencies: installPlan.devDependencies,
  }
}

function printPlan(plans: AddPlan[], options: AddOptions): void {
  for (const plan of plans) {
    console.log(pc.green(`Add ${plan.component}`))

    if (plan.dependencies.length > 0) {
      console.log(`Dependencies: ${plan.dependencies.join(', ')}`)
    }

    if (plan.devDependencies.length > 0) {
      console.log(`Dev dependencies: ${plan.devDependencies.join(', ')}`)
    }

    console.log('Files:')

    for (const file of plan.files) {
      console.log(`  ${file.source} -> ${file.target}`)
    }
  }

  if (options.dryRun) {
    console.log(pc.gray('Dry run enabled. No files will be written.'))
  }

  if (!options.overwrite) {
    console.log(
      pc.gray(
        'Existing files will be skipped. Use --overwrite to replace them.',
      ),
    )
  }
}

function printResult(result: AddExecutionResult, options: AddOptions): void {
  if (result.planned.length > 0) {
    console.log(pc.cyan('Planned files:'))

    for (const file of result.planned) {
      console.log(`  ${file}`)
    }
  }

  if (result.written.length > 0) {
    console.log(pc.green('Written files:'))

    for (const file of result.written) {
      console.log(`  ${file}`)
    }
  }

  if (result.skipped.length > 0) {
    console.log(pc.yellow('Skipped existing files:'))

    for (const file of result.skipped) {
      console.log(`  ${file}`)
    }
  }

  if (!options.install || options.dryRun) {
    const commands = createInstallCommands({
      cwd: options.cwd,
      packageManager: options.packageManager,
      dependencies: result.dependencies,
      devDependencies: result.devDependencies,
    })

    if (commands.length > 0) {
      console.log('')
      console.log(pc.bold('Install dependencies:'))

      for (const command of formatInstallCommands(commands)) {
        console.log(`  ${command}`)
      }
    }
  }
}

export async function add(args: string[]) {
  try {
    const { components, options } = parseAddArgs(args)
    const registry = loadRegistry()
    const finalComponents = options.all
      ? listAvailableComponents(registry)
      : components

    if (finalComponents.length === 0) {
      console.error(pc.red('Please provide at least one component.'))
      console.log(
        `Example: zweb add ${listAvailableComponents(registry).join(' ')}`,
      )
      process.exit(1)
    }

    const plans = createAddPlan(finalComponents, registry)

    printPlan(plans, options)

    const result = await executeAddPlan(plans, options)

    printResult(result, options)

    if (!options.dryRun) {
      const config = readComponentsConfig(options.cwd)
      const resolvedPlans = resolveAddPlanTargets(plans, options.cwd, config)

      await updateComponentsLockFromPlans({
        cwd: options.cwd,
        plans: resolvedPlans,
        writtenTargets: result.written,
      })
    }

    if (options.install && !options.dryRun) {
      await installDependencies({
        cwd: options.cwd,
        packageManager: options.packageManager,
        dependencies: result.dependencies,
        devDependencies: result.devDependencies,
      })
    }
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
