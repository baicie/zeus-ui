import type { AddPlan } from './commands/add'

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { toRelativeProjectPath } from './config'

export const componentsLockFileName = 'components.lock.json'

export interface ComponentsLockFile {
  target: string
  source: string
  type?: string
  hash: string
}

export interface ComponentsLockComponent {
  registry: 'builtin'
  version: string
  files: ComponentsLockFile[]
}

export interface ComponentsLock {
  $schema: string
  components: Record<string, ComponentsLockComponent>
}

export function getComponentsLockPath(cwd: string): string {
  return resolve(cwd, componentsLockFileName)
}

export function hashString(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

export function hashFile(file: string): string {
  return hashString(readFileSync(file, 'utf-8'))
}

export function createEmptyComponentsLock(): ComponentsLock {
  return {
    $schema: 'https://zeus-web.dev/schema/components.lock.json',
    components: {},
  }
}

export function readComponentsLock(cwd: string): ComponentsLock {
  const file = getComponentsLockPath(cwd)
  if (!existsSync(file)) return createEmptyComponentsLock()
  return JSON.parse(readFileSync(file, 'utf-8')) as ComponentsLock
}

export async function writeComponentsLock(
  cwd: string,
  lock: ComponentsLock,
): Promise<void> {
  const file = getComponentsLockPath(cwd)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(lock, null, 2)}\n`, 'utf-8')
}

export function getLockedFile(
  lock: ComponentsLock,
  target: string,
): ComponentsLockFile | undefined {
  for (const component of Object.values(lock.components)) {
    const file = component.files.find(candidate => candidate.target === target)
    if (file) return file
  }
  return undefined
}

export async function updateComponentsLockFromPlans(params: {
  cwd: string
  plans: AddPlan[]
  writtenTargets: string[]
  version?: string
}): Promise<void> {
  const writtenTargets = new Set(params.writtenTargets)
  const lock = readComponentsLock(params.cwd)

  for (const plan of params.plans) {
    const files: ComponentsLockFile[] = []
    for (const file of plan.files) {
      const absoluteTarget = file.resolvedTarget ?? file.target
      const target = toRelativeProjectPath(params.cwd, absoluteTarget)
      if (!writtenTargets.has(target)) continue
      if (!existsSync(absoluteTarget)) continue
      files.push({
        target,
        source: file.source,
        type: file.type,
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

  await writeComponentsLock(params.cwd, lock)
}

function mergeLockedFiles(
  current: ComponentsLockFile[],
  next: ComponentsLockFile[],
): ComponentsLockFile[] {
  const files = new Map<string, ComponentsLockFile>()
  for (const file of current) files.set(file.target, file)
  for (const file of next) files.set(file.target, file)
  return Array.from(files.values()).sort((a, b) =>
    a.target.localeCompare(b.target),
  )
}
