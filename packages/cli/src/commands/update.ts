import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'

import pc from 'picocolors'

import { readComponentsConfig } from '../config'
import {
  getLockedFile,
  readLegacyLock,
  updateLegacyLockFromPlans,
} from '../lock'
import {
  createAddPlan,
  listAvailableComponents,
  loadRegistry,
  resolveAddPlanTargets,
} from './add'
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
      const v = args[++index]
      if (!v) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwdValue(cwd, v)
      continue
    }
    if (arg.startsWith('--cwd=')) {
      const v = arg.slice('--cwd='.length)
      if (!v) throw new Error('--cwd requires a directory path')
      options.cwd = resolveCwdValue(cwd, v)
      continue
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
    components.push(arg)
  }
  return { components, options }
}

export async function update(args: string[]): Promise<void> {
  try {
    const { components, options } = parseUpdateArgs(args)
    const registry = loadRegistry()
    const finalComponents = options.all
      ? listAvailableComponents(registry)
      : components
    if (finalComponents.length === 0)
      throw new Error('Please provide components or use --all.')
    const plans = createAddPlan({ components: finalComponents, registry })
    const config = readComponentsConfig(options.cwd)
    const resolvedPlans = resolveAddPlanTargets({
      plans,
      cwd: options.cwd,
      config,
    })
    const entries = await createDiffEntries({ cwd: options.cwd, plans })
    const lock = readLegacyLock(options.cwd)
    const changed = entries.filter(e => e.status !== 'unchanged')
    const writtenTargets: string[] = []

    if (changed.length === 0) {
      console.log(pc.green('All registry files are up to date.'))
      return
    }

    for (const entry of changed) {
      const locked = getLockedFile(lock, entry.target)
      const hasLocalChanges =
        entry.currentHash !== undefined &&
        locked !== undefined &&
        entry.currentHash !== locked.hash
      if (hasLocalChanges && !options.overwrite) {
        console.log(
          pc.yellow(
            `Skip modified file: ${entry.target}. Use --overwrite to replace it.`,
          ),
        )
        continue
      }
      if (entry.currentHash !== undefined && !locked && !options.overwrite) {
        console.log(
          pc.yellow(
            `Skip untracked existing file: ${entry.target}. Use --overwrite to replace it.`,
          ),
        )
        continue
      }
      if (options.dryRun) {
        console.log(pc.cyan(`Would update ${entry.target}`))
        continue
      }
      await mkdir(dirname(entry.resolvedTarget), { recursive: true })
      await writeFile(entry.resolvedTarget, entry.registrySource, 'utf-8')
      writtenTargets.push(entry.target)
      console.log(pc.green(`Updated ${entry.target}`))
    }

    if (!options.dryRun && writtenTargets.length > 0) {
      await updateLegacyLockFromPlans({
        cwd: options.cwd,
        plans: resolvedPlans,
        writtenTargets,
      })
    }
    if (!options.dryRun && writtenTargets.length === 0)
      console.log(pc.gray('No files were updated.'))
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
