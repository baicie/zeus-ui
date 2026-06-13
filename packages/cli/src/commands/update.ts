import type { AddPlan } from './add'
import type { DiffEntry } from './diff'

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'

import pc from 'picocolors'

import { readComponentsConfig } from '../config'
import { updateComponentsLockFromPlans } from '../lock'
import { createAddPlan, listAvailableComponents, loadRegistry } from './add'
import { createDiffEntries } from './diff'

interface UpdateOptions {
  cwd: string
  all: boolean
  dryRun: boolean
  overwrite: boolean
}

interface ParsedUpdateArgs {
  components: string[]
  options: UpdateOptions
}

interface UpdatePlan {
  entry: DiffEntry
  action: 'write' | 'skip'
  reason?: string
}

function resolveCwdValue(base: string, value: string): string {
  return isAbsolute(value) ? value : resolve(base, value)
}

export function parseUpdateArgs(
  args: string[],
  cwd = process.cwd(),
): ParsedUpdateArgs {
  const components: string[] = []
  const options: UpdateOptions = {
    cwd,
    all: false,
    dryRun: false,
    overwrite: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--all') {
      options.all = true
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

function createUpdatePlans(params: {
  entries: DiffEntry[]
  overwrite: boolean
}): UpdatePlan[] {
  return params.entries
    .filter(entry => entry.status !== 'unchanged')
    .map(entry => {
      if (entry.status === 'untracked-missing') {
        return {
          entry,
          action: 'skip' as const,
          reason: 'component is not installed; run zweb add first',
        }
      }

      if (params.overwrite) {
        return {
          entry,
          action: 'write' as const,
        }
      }

      if (entry.status === 'missing' || entry.status === 'registry-changed') {
        return {
          entry,
          action: 'write' as const,
        }
      }

      if (entry.status === 'locally-modified') {
        return {
          entry,
          action: 'skip' as const,
          reason: 'local changes detected',
        }
      }

      if (entry.status === 'registry-and-local-changed') {
        return {
          entry,
          action: 'skip' as const,
          reason: 'registry and local changes detected',
        }
      }

      if (entry.status === 'untracked-existing') {
        return {
          entry,
          action: 'skip' as const,
          reason: 'existing file is not tracked by zeus-ui.lock.json',
        }
      }

      return {
        entry,
        action: 'skip' as const,
        reason: `unsupported status ${entry.status}`,
      }
    })
}

function printUpdatePlan(params: {
  plans: UpdatePlan[]
  dryRun: boolean
}): void {
  if (params.plans.length === 0) {
    console.log(pc.green('All registry files are up to date.'))
    return
  }

  console.log(pc.bold(params.dryRun ? 'Update plan:' : 'Update result:'))

  for (const plan of params.plans) {
    if (plan.action === 'write') {
      console.log(
        `  ${pc.green(params.dryRun ? 'WOULD UPDATE' : 'UPDATED')} ${plan.entry.target}`,
      )
      continue
    }

    console.log(
      `  ${pc.yellow('SKIP')} ${plan.entry.target}${plan.reason ? ` (${plan.reason})` : ''}`,
    )
  }
}

function createRegistryHashes(entries: DiffEntry[]): Record<string, string> {
  const hashes: Record<string, string> = {}

  for (const entry of entries) {
    hashes[entry.target] = entry.registryHash
  }

  return hashes
}

async function writeUpdatePlans(plans: UpdatePlan[]): Promise<string[]> {
  const written: string[] = []

  for (const plan of plans) {
    if (plan.action !== 'write') continue

    await mkdir(dirname(plan.entry.resolvedTarget), {
      recursive: true,
    })

    await writeFile(
      plan.entry.resolvedTarget,
      plan.entry.registrySource,
      'utf-8',
    )
    written.push(plan.entry.target)
  }

  return written
}

export async function update(args: string[]): Promise<void> {
  try {
    const { components, options } = parseUpdateArgs(args)
    const registry = loadRegistry()
    const config = readComponentsConfig(options.cwd)
    const finalComponents = options.all
      ? listAvailableComponents(registry)
      : components

    if (finalComponents.length === 0) {
      throw new Error('Please provide components or use --all.')
    }

    const plans: AddPlan[] = createAddPlan({
      components: finalComponents,
      registry,
      cwd: options.cwd,
      config,
      overwrite: options.overwrite,
    })

    const entries = await createDiffEntries({
      cwd: options.cwd,
      plans,
    })

    const updatePlans = createUpdatePlans({
      entries,
      overwrite: options.overwrite,
    })

    printUpdatePlan({
      plans: updatePlans,
      dryRun: options.dryRun,
    })

    if (options.dryRun) return

    const writtenTargets = await writeUpdatePlans(updatePlans)

    if (writtenTargets.length === 0) return

    await updateComponentsLockFromPlans({
      cwd: options.cwd,
      plans,
      writtenTargets,
      registryHashes: createRegistryHashes(entries),
    })
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
