import type { ComponentsLockFile } from '../lock'

import { existsSync, realpathSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { resolve } from 'node:path'

import pc from 'picocolors'

import {
  hashFile,
  pruneUnusedRegistries,
  readComponentsLock,
  resolveLockedTarget,
  writeComponentsLock,
} from '../lock'

export interface RemoveOptions {
  cwd: string
  all: boolean
  dryRun: boolean
  force: boolean
}

export function parseRemoveArgs(
  args: string[],
  cwd = process.cwd(),
): {
  components: string[]
  options: RemoveOptions
} {
  const components: string[] = []
  const options = { cwd, all: false, dryRun: false, force: false }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--all') {
      options.all = true
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--force') {
      options.force = true
    } else if (arg === '--cwd') {
      const value = args[++index]
      if (!value || value.startsWith('--'))
        throw new Error('--cwd requires a directory path')
      options.cwd = resolve(cwd, value)
    } else if (arg.startsWith('--cwd=')) {
      const value = arg.slice('--cwd='.length)
      if (!value) throw new Error('--cwd requires a directory path')
      options.cwd = resolve(cwd, value)
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    } else {
      components.push(arg)
    }
  }
  return { components: Array.from(new Set(components)), options }
}

interface RemoveFile {
  target: string
  action: 'remove' | 'missing' | 'shared' | 'modified'
}

function canonicalTarget(cwd: string, target: string): string {
  const file = resolveLockedTarget(cwd, target)
  return existsSync(file) ? realpathSync.native(file) : file
}

function createRemovePlan(
  lock: ComponentsLockFile,
  components: string[],
  options: RemoveOptions,
): RemoveFile[] {
  const selected = new Set(components)
  for (const name of selected) {
    if (!Object.keys(lock.components).includes(name)) {
      throw new Error(`Component "${name}" is not tracked in zeus-ui.lock.json`)
    }
  }
  const shared = new Set<string>()
  for (const [name, component] of Object.entries(lock.components)) {
    if (selected.has(name)) continue
    const dependency = component.registryDependencies.find(item =>
      selected.has(item),
    )
    if (dependency) {
      throw new Error(
        `Cannot remove "${dependency}": still required by "${name}"`,
      )
    }
    for (const target of component.files)
      shared.add(canonicalTarget(options.cwd, target))
  }

  const targets = new Map<
    string,
    { target: string; hashes: Array<string | undefined> }
  >()
  for (const name of selected) {
    const component = lock.components[name]
    for (const target of component.files) {
      const canonical = canonicalTarget(options.cwd, target)
      const entry = targets.get(canonical) ?? { target, hashes: [] }
      entry.hashes.push(component.fileHashes?.[target])
      targets.set(canonical, entry)
    }
  }
  return Array.from(targets, ([canonical, { target, hashes }]) => {
    const file = resolveLockedTarget(options.cwd, target)
    if (shared.has(canonical)) return { target, action: 'shared' }
    if (!existsSync(file)) return { target, action: 'missing' }
    if (!options.force) {
      const current = hashFile(file)
      if (hashes.some(hash => !hash || hash !== current))
        return { target, action: 'modified' }
    }
    return { target, action: 'remove' }
  })
}

export async function remove(args: string[]): Promise<void> {
  try {
    const { components, options } = parseRemoveArgs(args)
    const lock = readComponentsLock(options.cwd)
    const selected = options.all ? Object.keys(lock.components) : components
    if (selected.length === 0)
      throw new Error('Please provide tracked components or use --all.')
    const plan = createRemovePlan(lock, selected, options)
    const hasProtectedFiles = plan.some(file => file.action === 'modified')
    const preview = options.dryRun || hasProtectedFiles

    for (const file of plan) {
      if (file.action === 'modified') {
        console.log(
          pc.yellow(
            `KEPT ${file.target} (local changes or missing hash; use --force to remove)`,
          ),
        )
      } else if (file.action === 'shared') {
        console.log(
          pc.yellow(`KEPT ${file.target} (tracked by another component)`),
        )
      } else {
        console.log(
          `${preview ? 'WOULD REMOVE' : 'REMOVE'} ${file.target}${file.action === 'missing' ? ' (already missing)' : ''}`,
        )
        if (!preview && file.action === 'remove') {
          await unlink(resolveLockedTarget(options.cwd, file.target))
        }
      }
    }
    if (hasProtectedFiles) {
      console.error(
        pc.yellow(
          'No files were removed. Resolve local changes or use --force.',
        ),
      )
      process.exitCode = 1
      return
    }
    if (options.dryRun) return

    for (const name of selected) delete lock.components[name]
    pruneUnusedRegistries(lock)
    await writeComponentsLock(options.cwd, lock)
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
