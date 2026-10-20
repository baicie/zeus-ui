import type { AddPlan } from './commands/add'
import type { RegistrySourceSnapshot } from './registry-source'

import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { toRelativeProjectPath } from './config'

export interface ComponentsLockComponent {
  registry: string
  componentPath?: string
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
  version: 2
  registries: Record<string, RegistrySourceSnapshot>
  components: Record<string, ComponentsLockComponent>
}

export const componentsLockFileName = 'zeus-ui.lock.json'

export function getComponentsLockPath(cwd: string): string {
  return resolve(cwd, componentsLockFileName)
}

/** Lock targets are project-relative files, never directories or symlink paths. */
function resolveProjectTarget(cwd: string, target: string): string {
  const segments = target.split('/')
  if (
    !target ||
    target.includes('\\') ||
    target.includes('\0') ||
    segments.some(
      segment =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        segment.endsWith('.') ||
        segment.endsWith(' ') ||
        segment.includes(':'),
    )
  ) {
    throw new Error(`Unsafe lock target: ${target}`)
  }

  let path = resolve(cwd)
  for (const segment of segments) {
    path = resolve(path, segment)
    try {
      const stat = lstatSync(path)
      if (stat.isSymbolicLink()) {
        throw new Error(`Unsafe lock target uses a symbolic link: ${target}`)
      }
      if (path === resolve(cwd, target) && !stat.isFile()) {
        throw new Error(`Lock target is not a regular file: ${target}`)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  return path
}

const protectedProjectFiles = new Set([
  componentsLockFileName,
  'zeus-ui.json',
  'package.json',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
])

function isPackageLikeName(value: string): boolean {
  return /^(?:@\w[\w.-]*\/)?\w[\w.-]*$/.test(value)
}

function isValidRegistryLocation(kind: string, location: string): boolean {
  if (kind === 'bundled') return location === '@zeus-web/registry'
  try {
    const url = new URL(location)
    return kind === 'file'
      ? url.protocol === 'file:'
      : kind === 'url' &&
          (url.protocol === 'http:' || url.protocol === 'https:')
  } catch {
    return false
  }
}

/** Resolve a tracked source path while protecting project and VCS control files. */
export function resolveLockedTarget(cwd: string, target: string): string {
  const segments = target
    .split('/')
    .map(segment => segment.replace(/[. ]+$/g, '').toLowerCase())
  if (
    protectedProjectFiles.has(segments[0]) ||
    segments.some(segment => ['.git', '.hg', '.svn'].includes(segment))
  ) {
    throw new Error(
      `Invalid ${componentsLockFileName}: protected project file ${target}`,
    )
  }
  return resolveProjectTarget(cwd, target)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function validateComponentsLock(
  cwd: string,
  value: unknown,
): asserts value is ComponentsLockFile {
  if (
    !isRecord(value) ||
    value.version !== 2 ||
    !isRecord(value.registries) ||
    !isRecord(value.components)
  ) {
    throw new Error(
      `Invalid ${componentsLockFileName}: expected version 2, registries object and components object`,
    )
  }
  const hashesByTarget = new Map<
    string,
    { fileHash?: string; registryHash?: string }
  >()
  for (const [id, source] of Object.entries(value.registries)) {
    if (
      !isRecord(source) ||
      source.id !== id ||
      typeof source.kind !== 'string' ||
      !['bundled', 'file', 'url'].includes(source.kind) ||
      typeof source.location !== 'string' ||
      typeof source.name !== 'string' ||
      !isPackageLikeName(source.name) ||
      typeof source.version !== 'string' ||
      !source.version ||
      !isValidRegistryLocation(source.kind, source.location) ||
      typeof source.integrity !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(source.integrity)
    ) {
      throw new Error(`Invalid ${componentsLockFileName} registry: ${id}`)
    }
  }
  for (const [name, component] of Object.entries(value.components)) {
    if (
      !name ||
      !isRecord(component) ||
      typeof component.registry !== 'string' ||
      !(component.registry in value.registries) ||
      (component.componentPath !== undefined &&
        (typeof component.componentPath !== 'string' ||
          !component.componentPath ||
          component.componentPath.includes('\\') ||
          component.componentPath.startsWith('/') ||
          component.componentPath.split('/').includes('..'))) ||
      !isStringArray(component.files) ||
      !isStringArray(component.dependencies) ||
      !isStringArray(component.registryDependencies) ||
      typeof component.updatedAt !== 'string'
    ) {
      throw new Error(`Invalid ${componentsLockFileName} component: ${name}`)
    }
    const files = component.files
    if (new Set(files).size !== files.length) {
      throw new Error(`Invalid ${componentsLockFileName} files: ${name}`)
    }
    for (const target of files) resolveLockedTarget(cwd, target)
    for (const key of ['fileHashes', 'registryHashes']) {
      const hashes = component[key]
      if (hashes === undefined) continue
      if (
        !isRecord(hashes) ||
        Object.entries(hashes).some(
          ([target, hash]) =>
            !files.includes(target) ||
            typeof hash !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(hash),
        )
      ) {
        throw new Error(`Invalid ${componentsLockFileName} ${key}: ${name}`)
      }
      if (hashes !== undefined) {
        for (const [target, hash] of Object.entries(hashes)) {
          const tracked = hashesByTarget.get(target) ?? {}
          const valueKey = key === 'fileHashes' ? 'fileHash' : 'registryHash'
          const existing = tracked[valueKey]
          if (existing && existing !== hash) {
            throw new Error(
              `Invalid ${componentsLockFileName}: conflicting ${key} for ${target}`,
            )
          }
          tracked[valueKey] = hash as string
          hashesByTarget.set(target, tracked)
        }
      }
    }
  }
}

export function createEmptyComponentsLock(): ComponentsLockFile {
  return {
    version: 2,
    registries: {},
    components: {},
  }
}

export function readComponentsLock(cwd: string): ComponentsLockFile {
  const file = resolveProjectTarget(cwd, componentsLockFileName)

  if (!existsSync(file)) {
    return createEmptyComponentsLock()
  }

  const lock: unknown = JSON.parse(readFileSync(file, 'utf-8'))
  validateComponentsLock(cwd, lock)
  return lock
}

export async function writeComponentsLock(
  cwd: string,
  lock: ComponentsLockFile,
): Promise<void> {
  validateComponentsLock(cwd, lock)
  const file = resolveProjectTarget(cwd, componentsLockFileName)

  await mkdir(dirname(file), {
    recursive: true,
  })

  await writeFile(file, `${JSON.stringify(lock, null, 2)}\n`, 'utf-8')
}

export function hashString(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

export function hashFile(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
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

export function pruneUnusedRegistries(lock: ComponentsLockFile): void {
  const used = new Set(
    Object.values(lock.components).map(component => component.registry),
  )
  for (const id of Object.keys(lock.registries)) {
    if (!used.has(id)) delete lock.registries[id]
  }
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

    lock.registries[plan.registry.id] = plan.registry

    lock.components[plan.component] = {
      registry: plan.registry.id,
      componentPath: plan.componentPath,
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

  pruneUnusedRegistries(lock)
  await writeComponentsLock(params.cwd, lock)
}

export function toLockTarget(cwd: string, file: string): string {
  return toRelativeProjectPath(cwd, file)
}
