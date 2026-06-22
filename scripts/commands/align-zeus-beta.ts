import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_VERSION = '0.1.0-beta.6'
const ZEUS_SCOPE = '@zeus-js/'

const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
] as const

const PEER_DEP_FIELDS = ['peerDependencies'] as const

interface PackageJson {
  name?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  [key: string]: unknown
}

export interface AlignZeusBetaOptions {
  root?: string
  version?: string
}

export interface AlignZeusBetaResult {
  version: string
  peerRange: string
  changedFiles: string[]
}

export function alignZeusBeta(
  options: AlignZeusBetaOptions = {},
): AlignZeusBetaResult {
  const root = options.root ?? process.cwd()
  const version = options.version ?? DEFAULT_VERSION
  const peerRange = createExpectedPeerRange(version)
  const packageJsonFiles = discoverPackageJsonFiles(root)
  const changedFiles: string[] = []

  for (const file of packageJsonFiles) {
    const before = readFileSync(file, 'utf8')
    const pkg = JSON.parse(before) as PackageJson

    let changed = false

    for (const field of DEP_FIELDS) {
      const deps = pkg[field]

      if (!deps) {
        continue
      }

      for (const dependencyName of Object.keys(deps)) {
        if (!dependencyName.startsWith(ZEUS_SCOPE)) {
          continue
        }

        if (deps[dependencyName] !== version) {
          deps[dependencyName] = version
          changed = true
        }
      }
    }

    for (const field of PEER_DEP_FIELDS) {
      const deps = pkg[field]

      if (!deps) {
        continue
      }

      for (const dependencyName of Object.keys(deps)) {
        if (!dependencyName.startsWith(ZEUS_SCOPE)) {
          continue
        }

        const expected =
          dependencyName === '@zeus-js/zeus' ? peerRange : version

        if (deps[dependencyName] !== expected) {
          deps[dependencyName] = expected
          changed = true
        }
      }
    }

    if (!changed) {
      continue
    }

    writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
    changedFiles.push(file)
  }

  return {
    version,
    peerRange,
    changedFiles,
  }
}

function discoverPackageJsonFiles(root: string): string[] {
  const files: string[] = []
  walk(root, root, files)
  return files.sort()
}

function walk(root: string, dir: string, files: string[]): void {
  for (const name of readdirSync(dir)) {
    const absolute = join(dir, name)
    const stat = statSync(absolute)

    if (stat.isDirectory()) {
      if (shouldSkipDirectory(name)) {
        continue
      }

      walk(root, absolute, files)
      continue
    }

    if (name === 'package.json') {
      files.push(absolute)
    }
  }
}

function shouldSkipDirectory(name: string): boolean {
  return (
    name === 'node_modules' ||
    name === 'dist' ||
    name === '.git' ||
    name === '.turbo' ||
    name === '.vitepress' ||
    name === '.next' ||
    name === 'coverage'
  )
}

function createExpectedPeerRange(version: string): string {
  const match = /^(\d+)\.(\d+)\.\d+/.exec(version)

  if (!match) {
    return `>=${version}`
  }

  const major = Number(match[1])
  const minor = Number(match[2])
  const upperBound = major === 0 ? `<0.${minor + 1}.0` : `<${major + 1}.0.0`

  return `>=${version} ${upperBound}`
}

function parseVersionArg(argv: string[]): string {
  const version = argv[0]

  if (!version) {
    return DEFAULT_VERSION
  }

  return version
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const version = parseVersionArg(process.argv.slice(2))
  const result = alignZeusBeta({
    version,
  })

  console.log(`Aligned @zeus-js/* to ${result.version}`)
  console.log(`Aligned @zeus-js/zeus peer range to ${result.peerRange}`)

  if (result.changedFiles.length === 0) {
    console.log('No package.json files changed.')
  } else {
    for (const file of result.changedFiles) {
      console.log(`  - ${file}`)
    }
  }
}
