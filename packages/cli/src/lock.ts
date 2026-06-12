import type { AddPlan } from './commands/add'

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { toRelativeProjectPath } from './config'

export interface ComponentsLockComponent {
  files: string[]
  dependencies: string[]
  registryDependencies: string[]
  updatedAt: string

  /**
   * Hash of the local file when it was last written by the CLI.
   *
   * Used by `zweb update` to detect local edits.
   */
  fileHashes?: Record<string, string>

  /**
   * Hash of the registry template content after alias rewriting when it was
   * last written by the CLI.
   *
   * Used by `zweb diff` and `zweb update` to distinguish registry changes from
   * local changes.
   */
  registryHashes?: Record<string, string>
}

export interface ComponentsLockFile {
  version: 1
  components: Record<string, ComponentsLockComponent>
}

export const componentsLockFileName = 'zeus-ui.lock.json'

export function getComponentsLockPath(cwd: string): string {
  return resolve(cwd, componentsLockFileName)
}

export function createEmptyComponentsLock(): ComponentsLockFile {
  return {
    version: 1,
    components: {},
  }
}

export function readComponentsLock(cwd: string): ComponentsLockFile {
  const file = getComponentsLockPath(cwd)

  if (!existsSync(file)) {
    return createEmptyComponentsLock()
  }

  const lock = JSON.parse(readFileSync(file, 'utf-8')) as ComponentsLockFile

  if (lock.version !== 1) {
    throw new Error(
      `Unsupported ${componentsLockFileName} version: ${lock.version}`,
    )
  }

  return {
    version: 1,
    components: lock.components ?? {},
  }
}

export async function writeComponentsLock(
  cwd: string,
  lock: ComponentsLockFile,
): Promise<void> {
  const file = getComponentsLockPath(cwd)

  await mkdir(dirname(file), {
    recursive: true,
  })

  await writeFile(file, `${JSON.stringify(lock, null, 2)}\n`, 'utf-8')
}

export function hashString(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

export function hashFile(file: string): string {
  return hashString(readFileSync(file, 'utf-8'))
}

export function getLockedComponent(
  lock: ComponentsLockFile,
  component: string,
): ComponentsLockComponent | undefined {
  return lock.components[component]
}

export function getLockedFileHash(params: {
  lock: ComponentsLockFile
  target: string
}): string | undefined {
  for (const component of Object.values(params.lock.components)) {
    const hash = component.fileHashes?.[params.target]
    if (hash) return hash
  }

  return undefined
}

export function getLockedRegistryHash(params: {
  lock: ComponentsLockFile
  target: string
}): string | undefined {
  for (const component of Object.values(params.lock.components)) {
    const hash = component.registryHashes?.[params.target]
    if (hash) return hash
  }

  return undefined
}

export async function updateComponentsLockFromPlans(params: {
  cwd: string
  plans: AddPlan[]
  writtenTargets: string[]
  registryHashes?: Record<string, string>
}): Promise<void> {
  const writtenTargets = new Set(params.writtenTargets)
  const lock = readComponentsLock(params.cwd)
  const updatedAt = new Date().toISOString()

  for (const plan of params.plans) {
    const files: string[] = []
    const fileHashes: Record<string, string> = {}
    const registryHashes: Record<string, string> = {}

    for (const file of plan.files) {
      if (!writtenTargets.has(file.target)) continue
      if (!existsSync(file.absoluteTarget)) continue

      files.push(file.target)
      fileHashes[file.target] = hashFile(file.absoluteTarget)

      const registryHash = params.registryHashes?.[file.target]
      if (registryHash) {
        registryHashes[file.target] = registryHash
      }
    }

    if (files.length === 0) continue

    const existing = lock.components[plan.component]

    lock.components[plan.component] = {
      files: Array.from(new Set([...(existing?.files ?? []), ...files])),
      dependencies: plan.dependencies,
      registryDependencies: plan.registryDependencies,
      updatedAt,
      fileHashes: {
        ...(existing?.fileHashes ?? {}),
        ...fileHashes,
      },
      registryHashes: {
        ...(existing?.registryHashes ?? {}),
        ...registryHashes,
      },
    }
  }

  await writeComponentsLock(params.cwd, lock)
}

/**
 * Legacy lock format remains readable for old projects, but Phase 23 update/diff
 * no longer writes components.lock.json.
 */
export const legacyLockFileName = 'components.lock.json'

export interface LegacyComponentsLockFile {
  $schema: string
  components: Record<string, LegacyComponentsLockComponent>
}

export interface LegacyComponentsLockComponent {
  registry: 'builtin'
  version: string
  files: LegacyLockedFile[]
}

export interface LegacyLockedFile {
  target: string
  source: string
  type?: string
  hash: string
}

export function getLegacyLockPath(cwd: string): string {
  return resolve(cwd, legacyLockFileName)
}

export function createEmptyLegacyLock(): LegacyComponentsLockFile {
  return {
    $schema: 'https://zeus-web.dev/schema/components.lock.json',
    components: {},
  }
}

export function readLegacyLock(cwd: string): LegacyComponentsLockFile {
  const file = getLegacyLockPath(cwd)
  if (!existsSync(file)) return createEmptyLegacyLock()
  return JSON.parse(readFileSync(file, 'utf-8')) as LegacyComponentsLockFile
}

export function getLegacyLockedFile(
  lock: LegacyComponentsLockFile,
  target: string,
): LegacyLockedFile | undefined {
  for (const component of Object.values(lock.components)) {
    const file = component.files.find(candidate => candidate.target === target)
    if (file) return file
  }

  return undefined
}

export async function migrateLegacyLockIfNeeded(params: {
  cwd: string
  plans: AddPlan[]
}): Promise<void> {
  const newLockPath = getComponentsLockPath(params.cwd)
  const legacyLockPath = getLegacyLockPath(params.cwd)

  if (existsSync(newLockPath) || !existsSync(legacyLockPath)) return

  const legacy = readLegacyLock(params.cwd)
  const next = createEmptyComponentsLock()

  for (const plan of params.plans) {
    const files: string[] = []
    const fileHashes: Record<string, string> = {}

    for (const file of plan.files) {
      const legacyFile = getLegacyLockedFile(legacy, file.target)
      if (!legacyFile) continue

      files.push(file.target)
      fileHashes[file.target] = legacyFile.hash
    }

    if (files.length === 0) continue

    next.components[plan.component] = {
      files,
      dependencies: plan.dependencies,
      registryDependencies: plan.registryDependencies,
      updatedAt: new Date().toISOString(),
      fileHashes,
      registryHashes: {},
    }
  }

  await writeComponentsLock(params.cwd, next)
}

export function createComponentsLockFromLegacy(params: {
  cwd: string
  plans: AddPlan[]
}): ComponentsLockFile {
  const legacy = readLegacyLock(params.cwd)
  const next = createEmptyComponentsLock()

  for (const plan of params.plans) {
    const files: string[] = []
    const fileHashes: Record<string, string> = {}

    for (const file of plan.files) {
      const legacyFile = getLegacyLockedFile(legacy, file.target)
      if (!legacyFile) continue

      files.push(file.target)
      fileHashes[file.target] = legacyFile.hash
    }

    if (files.length === 0) continue

    next.components[plan.component] = {
      files,
      dependencies: plan.dependencies,
      registryDependencies: plan.registryDependencies,
      updatedAt: new Date(0).toISOString(),
      fileHashes,
      registryHashes: {},
    }
  }

  return next
}

export function readEffectiveComponentsLock(params: {
  cwd: string
  plans: AddPlan[]
}): ComponentsLockFile {
  if (existsSync(getComponentsLockPath(params.cwd))) {
    return readComponentsLock(params.cwd)
  }

  if (existsSync(getLegacyLockPath(params.cwd))) {
    return createComponentsLockFromLegacy(params)
  }

  return createEmptyComponentsLock()
}

export function toLockTarget(cwd: string, file: string): string {
  return toRelativeProjectPath(cwd, file)
}
