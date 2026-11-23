import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { listZeusDependencyManifests } from '../release/zeus-dependency-manifests'
import { createZeusPeerRequirement } from '../release/zeus-peer-requirement'

const DEFAULT_VERSION = '0.1.1-beta.20'
const ZEUS_SCOPE = '@zeus-js/'

/**
 * Packages that carry their own version line and must not follow the
 * `@zeus-js/zeus` release.
 *
 * `check-zeus-beta-alignment.ts` has always known this — it substitutes the
 * same map when it decides whether a pin is correct. This command did not, so
 * aligning to 0.2.0-rc.5 rewrote `@zeus-js/vite-plugin` from its real `0.0.5`
 * to `0.2.0-rc.5`, a version that does not exist. `pnpm install` then failed
 * with ERR_PNPM_NO_MATCHING_VERSION, which is a confusing way to be told the
 * aligner invented a dependency.
 */
const INDEPENDENT_PACKAGE_VERSIONS: Readonly<Record<string, string>> = {
  '@zeus-js/vite-plugin': '0.0.5',
}

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
  const packageJsonFiles = listZeusDependencyManifests(root)
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

        const expected = INDEPENDENT_PACKAGE_VERSIONS[dependencyName] ?? version

        if (deps[dependencyName] !== expected) {
          deps[dependencyName] = expected
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
          INDEPENDENT_PACKAGE_VERSIONS[dependencyName] ??
          (dependencyName === '@zeus-js/zeus' ? peerRange : version)

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

function createExpectedPeerRange(version: string): string {
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    return '*'
  }

  return createZeusPeerRequirement(version)
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
