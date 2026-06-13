import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

export interface PackageJsonLike {
  name?: string
  private?: boolean
  version?: string
  description?: string
  license?: string
  type?: string
  files?: string[]
  exports?: Record<string, unknown>
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, Record<string, unknown>>
  repository?:
    | string
    | {
        type?: string
        url?: string
        directory?: string
      }
  publishConfig?: {
    access?: string
    provenance?: boolean
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type WorkspacePackageKind = 'package' | 'primitive' | 'advanced'

export interface WorkspacePackage {
  name: string
  version: string
  dir: string
  relativeDir: string
  packageJsonPath: string
  packageJson: PackageJsonLike
  kind: WorkspacePackageKind
  isPrimitive: boolean
  isAdvanced: boolean
  isPrivate: boolean
}

export const packageRoots = [
  { dir: 'packages', kind: 'package' },
  { dir: 'packages/primitives', kind: 'primitive' },
  { dir: 'packages/advanced', kind: 'advanced' },
] as const

export const repositoryUrl = 'https://github.com/baicie/zeus-ui.git'

function toForwardSlash(value: string): string {
  return value.replace(/\\/g, '/')
}

function readPackageJson(file: string): PackageJsonLike {
  return JSON.parse(readFileSync(file, 'utf-8')) as PackageJsonLike
}

export function listWorkspacePackages(
  root = process.cwd(),
): WorkspacePackage[] {
  const result: WorkspacePackage[] = []

  for (const packageRoot of packageRoots) {
    const absoluteRoot = resolve(root, packageRoot.dir)

    if (!existsSync(absoluteRoot)) continue

    for (const entry of readdirSync(absoluteRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue

      const packageJsonPath = resolve(absoluteRoot, entry.name, 'package.json')

      if (!existsSync(packageJsonPath)) continue

      const packageJson = readPackageJson(packageJsonPath)

      if (!packageJson.name) {
        throw new Error(`${packageJsonPath} missing package name`)
      }

      const dir = resolve(absoluteRoot, entry.name)

      result.push({
        name: packageJson.name,
        version: packageJson.version ?? '0.0.0',
        dir,
        relativeDir: toForwardSlash(relative(root, dir)),
        packageJsonPath,
        packageJson,
        kind: packageRoot.kind,
        isPrimitive: packageRoot.kind === 'primitive',
        isAdvanced: packageRoot.kind === 'advanced',
        isPrivate: Boolean(packageJson.private),
      })
    }
  }

  return result.sort((a, b) => {
    const weight: Record<WorkspacePackageKind, number> = {
      primitive: 0,
      advanced: 1,
      package: 2,
    }

    const kindCompare = weight[a.kind] - weight[b.kind]
    if (kindCompare !== 0) return kindCompare

    return a.name.localeCompare(b.name)
  })
}

export function listPublishablePackages(
  root = process.cwd(),
): WorkspacePackage[] {
  return listWorkspacePackages(root).filter(pkg => !pkg.isPrivate)
}

export function getPackageByName(
  name: string,
  root = process.cwd(),
): WorkspacePackage | undefined {
  return listWorkspacePackages(root).find(pkg => pkg.name === name)
}

export function getUniqueVersions(packages: WorkspacePackage[]): string[] {
  return Array.from(new Set(packages.map(pkg => pkg.version))).sort()
}

export function getPackageDirectory(
  root: string,
  pkg: WorkspacePackage,
): string {
  return toForwardSlash(relative(root, pkg.dir))
}
