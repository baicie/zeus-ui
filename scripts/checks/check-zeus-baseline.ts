import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

interface PackageJsonLike {
  name?: string
  private?: boolean
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const rootDependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
] as const

const exactVersionRE =
  /^\d+\.\d+\.\d+(?:-[\da-z]+(?:[.-][\da-z]+)*)?(?:\+[\da-z]+(?:[.-][\da-z]+)*)?$/i

let hasError = false

function error(message: string): void {
  hasError = true
  console.error(pc.red(message))
}

function toForwardSlash(value: string): string {
  return value.replace(/\\/g, '/')
}

function readPackageJson(file: string): PackageJsonLike {
  return JSON.parse(readFileSync(file, 'utf8')) as PackageJsonLike
}

function listWorkspacePackageJsonFiles(): string[] {
  const files: string[] = []

  for (const rel of ['packages', 'packages/primitives']) {
    const abs = join(root, rel)

    if (!existsSync(abs)) continue

    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue

      const file = join(abs, entry.name, 'package.json')

      if (existsSync(file)) {
        files.push(file)
      }
    }
  }

  return files.sort()
}

function getExpectedPeerRange(version: string): string {
  const versionPart = /^\d+\.\d+\.\d+/.exec(version)?.[0]

  if (!versionPart) {
    throw new Error(`Invalid Zeus baseline version: ${version}`)
  }

  const [major, minor] = versionPart.split('.').map(Number)

  const upperBound = major === 0 ? `<0.${minor + 1}.0` : `<${major + 1}.0.0`

  return `>=${version} ${upperBound}`
}

const rootPackage = readPackageJson(join(root, 'package.json'))

const zeusDependencies: Array<{
  field: string
  name: string
  version: string
}> = []

for (const field of rootDependencyFields) {
  const dependencies = rootPackage[field] ?? {}

  for (const [name, version] of Object.entries(dependencies)) {
    if (!name.startsWith('@zeus-js/')) continue

    zeusDependencies.push({
      field,
      name,
      version,
    })
  }
}

if (zeusDependencies.length === 0) {
  error('Root package.json must declare at least one @zeus-js/* dependency.')
}

for (const dependency of zeusDependencies) {
  if (/-canary(?:[.-]|$)/.test(dependency.version)) {
    error(
      `${dependency.field}.${dependency.name} must not use a canary version: ${dependency.version}`,
    )
  }

  if (!exactVersionRE.test(dependency.version)) {
    error(
      `${dependency.field}.${dependency.name} must use an exact version: ${dependency.version}`,
    )
  }
}

const versions = new Set(zeusDependencies.map(item => item.version))

if (versions.size > 1) {
  error(
    `Root @zeus-js/* dependencies must use one synchronized baseline version: ${[
      ...versions,
    ].join(', ')}`,
  )
}

const baselineVersion = versions.size === 1 ? [...versions][0] : undefined

if (baselineVersion && exactVersionRE.test(baselineVersion)) {
  const expectedPeerRange = getExpectedPeerRange(baselineVersion)

  for (const file of listWorkspacePackageJsonFiles()) {
    const pkg = readPackageJson(file)

    if (pkg.private) continue

    const actualPeerRange = pkg.peerDependencies?.['@zeus-js/zeus']

    if (!actualPeerRange) continue

    if (actualPeerRange !== expectedPeerRange) {
      error(
        `${pkg.name ?? toForwardSlash(relative(root, file))}: @zeus-js/zeus peer range must be "${expectedPeerRange}", got "${actualPeerRange}"`,
      )
    }
  }
}

if (hasError) {
  console.error(
    pc.yellow(
      'Use a published beta/stable Zeus baseline in the repository. Canary versions are installed only inside zeus-canary-compat.yml.',
    ),
  )
  process.exit(1)
}

console.log(
  pc.green(
    `Zeus baseline dependency check passed: ${baselineVersion ?? 'unknown'}`,
  ),
)
