import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { toRelativeProjectPath } from './config'

// Phase 19 new lock format
export interface ComponentsLockFile {
  version: 1
  components: Record<
    string,
    {
      files: string[]
      dependencies: string[]
      registryDependencies: string[]
      updatedAt: string
    }
  >
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

  return lock
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

// Phase 19 new update lock helper (uses new lock format)
export async function updateComponentsLockFromPlans(params: {
  cwd: string
  plans: Array<{
    component: string
    dependencies: string[]
    registryDependencies: string[]
    files: Array<{ target: string; absoluteTarget: string; source: string }>
  }>
  writtenTargets: string[]
}): Promise<void> {
  const writtenTargets = new Set(params.writtenTargets)
  const lock = readComponentsLock(params.cwd)

  for (const plan of params.plans) {
    const files: string[] = []
    for (const file of plan.files) {
      if (!writtenTargets.has(file.target)) continue
      if (!existsSync(file.absoluteTarget)) continue
      files.push(file.target)
    }
    if (files.length === 0) continue
    lock.components[plan.component] = {
      files,
      dependencies: plan.dependencies,
      registryDependencies: plan.registryDependencies,
      updatedAt: new Date().toISOString(),
    }
  }

  await writeComponentsLock(params.cwd, lock)
}

// Legacy lock format (for backward compatibility with update.ts)
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

export async function writeLegacyLock(
  cwd: string,
  lock: LegacyComponentsLockFile,
): Promise<void> {
  const file = getLegacyLockPath(cwd)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(lock, null, 2)}\n`, 'utf-8')
}

export function getLockedFile(
  lock: LegacyComponentsLockFile,
  target: string,
): LegacyLockedFile | undefined {
  for (const component of Object.values(lock.components)) {
    const file = component.files.find(candidate => candidate.target === target)
    if (file) return file
  }
  return undefined
}

export function hashString(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

export function hashFile(file: string): string {
  return hashString(readFileSync(file, 'utf-8'))
}

function mergeLockedFiles(
  current: LegacyLockedFile[],
  next: LegacyLockedFile[],
): LegacyLockedFile[] {
  const files = new Map<string, LegacyLockedFile>()
  for (const file of current) files.set(file.target, file)
  for (const file of next) files.set(file.target, file)
  return Array.from(files.values()).sort((a, b) =>
    a.target.localeCompare(b.target),
  )
}

export async function updateLegacyLockFromPlans(params: {
  cwd: string
  plans: Array<{
    component: string
    files: Array<{ target: string; resolvedTarget?: string; source: string }>
  }>
  writtenTargets: string[]
  version?: string
}): Promise<void> {
  const writtenTargets = new Set(params.writtenTargets)
  const lock = readLegacyLock(params.cwd)

  for (const plan of params.plans) {
    const files: LegacyLockedFile[] = []
    for (const file of plan.files) {
      const absoluteTarget = file.resolvedTarget ?? file.target
      const target = toRelativeProjectPath(params.cwd, absoluteTarget)
      if (!writtenTargets.has(target)) continue
      if (!existsSync(absoluteTarget)) continue
      files.push({
        target,
        source: file.source,
        hash: hashFile(absoluteTarget),
      })
    }
    if (files.length === 0) continue
    const existing = lock.components[plan.component]
    lock.components[plan.component] = {
      registry: 'builtin',
      version: params.version ?? existing?.version ?? '0.0.0',
      files: mergeLockedFiles(existing?.files ?? [], files),
    }
  }

  await writeLegacyLock(params.cwd, lock)
}
