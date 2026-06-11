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

export interface WorkspacePackage {
  name: string
  version: string
  dir: string
  relativeDir: string
  packageJsonPath: string
  packageJson: PackageJsonLike
  isPrimitive: boolean
  isPrivate: boolean
}

export const packageRoots = ['packages', 'packages/primitives'] as const

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
    const absoluteRoot = resolve(root, packageRoot)

    if (!existsSync(absoluteRoot)) continue

    for (const entry of readdirSync(absoluteRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue

      const packageJsonPath = resolve(absoluteRoot, entry.name, 'package.json')

      if (!existsSync(packageJsonPath)) continue

      const packageJson = readPackageJson(packageJsonPath)

      if (!packageJson.name) {
        throw new Error(`${packageJsonPath} missing package name`)
      }

      result.push({
        name: packageJson.name,
        version: packageJson.version ?? '0.0.0',
        dir: resolve(absoluteRoot, entry.name),
        relativeDir: toForwardSlash(
          relative(root, resolve(absoluteRoot, entry.name)),
        ),
        packageJsonPath,
        packageJson,
        isPrimitive: packageRoot === 'packages/primitives',
        isPrivate: Boolean(packageJson.private),
      })
    }
  }

  return result.sort((a, b) => {
    if (a.isPrimitive !== b.isPrimitive) {
      return a.isPrimitive ? -1 : 1
    }

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
