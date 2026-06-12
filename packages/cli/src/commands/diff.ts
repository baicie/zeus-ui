import type { AddPlan } from './add'

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

import pc from 'picocolors'

import { readComponentsConfig } from '../config'
import { readRegistryAsset } from '../registry-assets'
import {
  createAddPlan,
  listAvailableComponents,
  loadRegistry,
  rewriteRegistrySource,
} from './add'

export function hashString(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

export type DiffStatus = 'missing' | 'changed' | 'unchanged'

export interface DiffEntry {
  component: string
  source: string
  target: string
  resolvedTarget: string
  status: DiffStatus
  registryHash: string
  currentHash?: string
  registrySource: string
  currentSource?: string
}

interface DiffOptions {
  cwd: string
  all: boolean
  json: boolean
}

interface ParsedDiffArgs {
  components: string[]
  options: DiffOptions
}

function resolveCwdValue(base: string, value: string): string {
  return isAbsolute(value) ? value : resolve(base, value)
}

function assertSafeTarget(cwd: string, target: string): string {
  const absoluteTarget = resolve(cwd, target)
  const relativeTarget = relative(cwd, absoluteTarget).replace(/\\/g, '/')
  if (
    relativeTarget === '..' ||
    relativeTarget.startsWith('../') ||
    isAbsolute(relativeTarget)
  ) {
    throw new Error(`Refusing to access outside cwd: ${target}`)
  }
  return absoluteTarget
}

export function parseDiffArgs(
  args: string[],
  cwd = process.cwd(),
): ParsedDiffArgs {
  const components: string[] = []
  const options: DiffOptions = { cwd, all: false, json: false }
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
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
    components.push(arg)
  }
  return { components, options }
}

function readRegistrySource(params: {
  source: string
  config: ReturnType<typeof readComponentsConfig>
}): string {
  const raw = readRegistryAsset(params.source)
  return rewriteRegistrySource(raw, params.config)
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

export async function createDiffEntries(params: {
  cwd: string
  plans: AddPlan[]
}): Promise<DiffEntry[]> {
  const config = readComponentsConfig(params.cwd)
  const dedupedPlans = params.plans.map(plan => ({
    ...plan,
    files: dedupeAddPlanFiles([plan]),
  }))
  const entries: DiffEntry[] = []

  for (const plan of dedupedPlans) {
    for (const file of plan.files) {
      const resolvedTarget = assertSafeTarget(params.cwd, file.target)
      const registrySource = readRegistrySource({
        source: file.source,
        config,
      })
      const registryHash = hashString(registrySource)

      if (!existsSync(resolvedTarget)) {
        entries.push({
          component: plan.component,
          source: file.source,
          target: file.target,
          resolvedTarget,
          status: 'missing',
          registryHash,
          registrySource,
        })
        continue
      }
      const currentSource = await readFile(resolvedTarget, 'utf-8')
      const currentHash = hashString(currentSource)
      entries.push({
        component: plan.component,
        source: file.source,
        target: file.target,
        resolvedTarget,
        status: currentHash === registryHash ? 'unchanged' : 'changed',
        registryHash,
        currentHash,
        registrySource,
        currentSource,
      })
    }
  }
  return entries
}

function printDiff(entries: DiffEntry[]): void {
  const changed = entries.filter(e => e.status !== 'unchanged')
  if (changed.length === 0) {
    console.log(pc.green('All registry files are up to date.'))
    return
  }
  console.log(pc.bold('Registry diff:'))
  for (const entry of changed) {
    const color = entry.status === 'missing' ? pc.yellow : pc.cyan
    console.log(
      `  ${color(entry.status.padEnd(8))} ${entry.component} ${entry.target}`,
    )
  }
}

export async function diff(args: string[]): Promise<void> {
  try {
    const { components, options } = parseDiffArgs(args)
    const registry = loadRegistry()
    const finalComponents = options.all
      ? listAvailableComponents(registry)
      : components
    if (finalComponents.length === 0)
      throw new Error('Please provide components or use --all.')
    const plans = createAddPlan({ components: finalComponents, registry })
    const entries = await createDiffEntries({ cwd: options.cwd, plans })
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            entries: entries.map(e => ({
              component: e.component,
              source: e.source,
              target: e.target,
              status: e.status,
              registryHash: e.registryHash,
              currentHash: e.currentHash,
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
