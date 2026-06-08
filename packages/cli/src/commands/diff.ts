import type { RegistryFilePlan } from './add'

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import pc from 'picocolors'

import { readComponentsConfig, toRelativeProjectPath } from '../config'
import { hashString } from '../lock'
import {
  createAddPlan,
  listAvailableComponents,
  loadRegistry,
  resolveAddPlanTargets,
  resolveRegistryRoot,
  rewriteRegistrySource,
} from './add'

export type DiffStatus = 'missing' | 'changed' | 'unchanged'

export interface DiffEntry {
  component: string
  source: string
  target: string
  resolvedTarget: string
  type: RegistryFilePlan['type']
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

function parseDiffArgs(args: string[], cwd = process.cwd()): ParsedDiffArgs {
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
      const v = args[++index]
      if (!v) throw new Error('--cwd requires a directory path')
      options.cwd = resolve(cwd, v)
      continue
    }
    if (arg.startsWith('--cwd=')) {
      options.cwd = resolve(cwd, arg.slice('--cwd='.length))
      continue
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
    components.push(arg)
  }
  return { components, options }
}

export async function createDiffEntries(params: {
  cwd: string
  plans: ReturnType<typeof createAddPlan>
  registryRoot?: string
}): Promise<DiffEntry[]> {
  const config = readComponentsConfig(params.cwd)
  const registryRoot = params.registryRoot ?? resolveRegistryRoot()
  const plans = resolveAddPlanTargets(params.plans, params.cwd, config)
  const entries: DiffEntry[] = []

  for (const plan of plans) {
    for (const file of plan.files) {
      const resolvedTarget = file.resolvedTarget ?? file.target
      const target = toRelativeProjectPath(params.cwd, resolvedTarget)
      const regFile = resolve(registryRoot, file.source)
      const registrySource = await readFile(regFile, 'utf-8')
      const registryHash = hashString(
        rewriteRegistrySource(registrySource, config),
      )

      if (!existsSync(resolvedTarget)) {
        entries.push({
          component: plan.component,
          source: file.source,
          target,
          resolvedTarget,
          type: file.type,
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
        target,
        resolvedTarget,
        type: file.type,
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

export async function diff(args: string[]): Promise<void> {
  try {
    const { components, options } = parseDiffArgs(args)
    const registry = loadRegistry()
    const finalComponents = options.all
      ? listAvailableComponents(registry)
      : components
    if (finalComponents.length === 0)
      throw new Error('Please provide components or use --all.')
    const plans = createAddPlan(finalComponents, registry)
    const entries = await createDiffEntries({ cwd: options.cwd, plans })
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            entries: entries.map(e => ({
              component: e.component,
              source: e.source,
              target: e.target,
              type: e.type,
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
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
