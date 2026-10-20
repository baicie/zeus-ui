import type { AddPlan } from './add'

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import pc from 'picocolors'

import { readComponentsConfig } from '../config'
import {
  getLockedFileHash,
  getLockedRegistryHash,
  hashFile,
  hashString,
  readComponentsLock,
  resolveLockedTarget,
} from '../lock'
import { loadRegistrySource } from '../registry-source'
import {
  createAddPlan,
  listAvailableComponents,
  rewriteRegistrySource,
} from './add'

export type DiffStatus =
  | 'untracked-missing'
  | 'missing'
  | 'unchanged'
  | 'registry-changed'
  | 'locally-modified'
  | 'registry-and-local-changed'
  | 'untracked-existing'

export interface DiffEntry {
  component: string
  source: string
  target: string
  resolvedTarget: string
  status: DiffStatus
  registryHash: string
  currentHash?: string
  lockedFileHash?: string
  lockedRegistryHash?: string
  registrySource: string
  currentSource?: string
}

interface DiffOptions {
  cwd: string
  all: boolean
  json: boolean
  registry?: string
}

interface ParsedDiffArgs {
  components: string[]
  options: DiffOptions
}

function resolveCwdValue(base: string, value: string): string {
  return isAbsolute(value) ? value : resolve(base, value)
}

export function parseDiffArgs(
  args: string[],
  cwd = process.cwd(),
): ParsedDiffArgs {
  const components: string[] = []
  const options: DiffOptions = {
    cwd,
    all: false,
    json: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--all') {
      options.all = true
      continue
    }

    if (arg === '--json') {
      options.json = true
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

    if (arg === '--cwd') {
      const value = args[index + 1]
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwdValue(cwd, value)
      index += 1
      continue
    }

    if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwdValue(cwd, value)
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

function dedupeAddPlanFiles(plans: AddPlan[]): AddPlan['files'] {
  const byTarget = new Map<string, AddPlan['files'][number]>()

  for (const plan of plans) {
    for (const file of plan.files) {
      byTarget.set(file.target, file)
    }
  }

  return Array.from(byTarget.values())
}

async function readRegistryFileSource(params: {
  plan: AddPlan
  source: string
  config: ReturnType<typeof readComponentsConfig>
}): Promise<string> {
  const raw = await params.plan.readSource(params.source)
  return rewriteRegistrySource(raw, params.config)
}

function getDiffStatus(params: {
  exists: boolean
  currentHash?: string
  lockedFileHash?: string
  lockedRegistryHash?: string
  registryHash: string
}): DiffStatus {
  const tracked = Boolean(params.lockedFileHash || params.lockedRegistryHash)

  if (!params.exists) {
    return tracked ? 'missing' : 'untracked-missing'
  }

  if (!params.lockedFileHash) return 'untracked-existing'

  const localChanged = params.currentHash !== params.lockedFileHash
  const registryChanged =
    params.lockedRegistryHash === undefined
      ? params.currentHash !== params.registryHash
      : params.lockedRegistryHash !== params.registryHash

  if (localChanged && registryChanged) return 'registry-and-local-changed'
  if (localChanged) return 'locally-modified'
  if (registryChanged) return 'registry-changed'

  return 'unchanged'
}

export async function createDiffEntries(params: {
  cwd: string
  plans: AddPlan[]
}): Promise<DiffEntry[]> {
  const config = readComponentsConfig(params.cwd)
  const lock = readComponentsLock(params.cwd)

  const entries: DiffEntry[] = []

  for (const plan of params.plans) {
    for (const file of dedupeAddPlanFiles([plan])) {
      const resolvedTarget = resolveLockedTarget(params.cwd, file.target)
      const registrySource = await readRegistryFileSource({
        plan,
        source: file.source,
        config,
      })
      const registryHash = hashString(registrySource)
      const exists = existsSync(resolvedTarget)
      const lockedFileHash = getLockedFileHash({
        lock,
        target: file.target,
      })
      const lockedRegistryHash = getLockedRegistryHash({
        lock,
        target: file.target,
      })

      if (!exists) {
        entries.push({
          component: plan.component,
          source: file.source,
          target: file.target,
          resolvedTarget,
          status: getDiffStatus({
            exists: false,
            registryHash,
            lockedFileHash,
            lockedRegistryHash,
          }),
          registryHash,
          lockedFileHash,
          lockedRegistryHash,
          registrySource,
        })
        continue
      }

      const currentSource = await readFile(resolvedTarget, 'utf-8')
      const currentHash = hashFile(resolvedTarget)

      entries.push({
        component: plan.component,
        source: file.source,
        target: file.target,
        resolvedTarget,
        status: getDiffStatus({
          exists: true,
          currentHash,
          lockedFileHash,
          lockedRegistryHash,
          registryHash,
        }),
        registryHash,
        currentHash,
        lockedFileHash,
        lockedRegistryHash,
        registrySource,
        currentSource,
      })
    }
  }

  return entries
}

function getLockedRegistryReference(
  lock: ReturnType<typeof readComponentsLock>,
  component: string,
): string | undefined {
  const locked = lock.components[component]
  if (!locked) return undefined
  const source = lock.registries[locked.registry]
  if (!source) {
    throw new Error(`Registry lock is missing source ${locked.registry}`)
  }
  if (source.kind === 'bundled') return source.location
  if (source.kind === 'file') return fileURLToPath(source.location)
  return source.location
}

export async function createInstalledAddPlans(params: {
  components: string[]
  cwd: string
  config: ReturnType<typeof readComponentsConfig>
  all: boolean
  overwrite?: boolean
  registry?: string
}): Promise<AddPlan[]> {
  const lock = readComponentsLock(params.cwd)
  const explicitRegistry = params.registry?.trim()
  const fallback = await loadRegistrySource({
    reference: explicitRegistry,
    cwd: params.cwd,
  })
  const names = params.all
    ? explicitRegistry
      ? listAvailableComponents(fallback.registry)
      : Array.from(
          new Set([
            ...Object.keys(lock.components),
            ...listAvailableComponents(fallback.registry),
          ]),
        )
    : params.components

  if (names.length === 0) {
    throw new Error('Please provide components or use --all.')
  }

  const byReference = new Map<string, string[]>()
  const componentPathByComponent: Record<string, string> = {}
  for (const name of names) {
    const lockedPath = lock.components[name]?.componentPath
    if (lockedPath) componentPathByComponent[name] = lockedPath
    const reference = explicitRegistry
      ? fallback.source.location
      : (getLockedRegistryReference(lock, name) ?? fallback.source.location)
    const group = byReference.get(reference) ?? []
    group.push(name)
    byReference.set(reference, group)
  }

  const plans: AddPlan[] = []
  for (const [reference, groupedNames] of byReference) {
    const source =
      reference === fallback.source.location
        ? fallback
        : await loadRegistrySource({ reference, cwd: params.cwd })
    plans.push(
      ...createAddPlan({
        components: groupedNames,
        registrySource: source,
        cwd: params.cwd,
        config: params.config,
        overwrite: params.overwrite,
        componentPathByComponent,
      }),
    )
  }
  return plans
}

function printDiff(entries: DiffEntry[]): void {
  const changed = entries.filter(entry => entry.status !== 'unchanged')

  if (changed.length === 0) {
    console.log(pc.green('All registry files are up to date.'))
    return
  }

  console.log(pc.bold('Registry diff:'))

  for (const entry of changed) {
    const color =
      entry.status === 'missing' ||
      entry.status === 'untracked-missing' ||
      entry.status === 'untracked-existing'
        ? pc.yellow
        : entry.status === 'locally-modified' ||
            entry.status === 'registry-and-local-changed'
          ? pc.red
          : pc.cyan

    console.log(
      `  ${color(entry.status.padEnd(26))} ${entry.component} ${entry.target}`,
    )
  }
}

export async function diff(args: string[]): Promise<void> {
  try {
    const { components, options } = parseDiffArgs(args)
    const config = readComponentsConfig(options.cwd)
    const plans = await createInstalledAddPlans({
      components,
      cwd: options.cwd,
      config,
      all: options.all,
      registry: options.registry,
    })

    const entries = await createDiffEntries({
      cwd: options.cwd,
      plans,
    })

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            entries: entries.map(entry => ({
              component: entry.component,
              source: entry.source,
              target: entry.target,
              status: entry.status,
              registryHash: entry.registryHash,
              currentHash: entry.currentHash,
              lockedFileHash: entry.lockedFileHash,
              lockedRegistryHash: entry.lockedRegistryHash,
            })),
          },
          null,
          2,
        ),
      )
      return
    }

    printDiff(entries)
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
