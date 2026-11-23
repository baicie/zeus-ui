import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import {
  createExpectedPeerRange,
  FALLBACK_EXPECTED_ZEUS_VERSION,
  INDEPENDENT_PACKAGE_VERSIONS,
  resolveWorkspaceZeusVersion,
  DEP_FIELDS as SHARED_DEP_FIELDS,
  ZEUS_SCOPE,
} from '../release/zeus-alignment-contract'
import { listZeusDependencyManifests } from '../release/zeus-dependency-manifests'

/**
 * Every dependency field the contract covers, minus `peerDependencies`.
 *
 * Peers are treated differently: their value is a *range* for `@zeus-js/zeus`
 * and an exact version for everything else.
 */
const DEP_FIELDS = SHARED_DEP_FIELDS.filter(
  field => field !== 'peerDependencies',
)

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
  /**
   * The version to align to. When absent it is read from the workspace, so
   * running the command after a Zeus release aligns to that release instead
   * of to whatever literal was last hand-edited here.
   */
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
  const packageJsonFiles = listZeusDependencyManifests(root)
  const version =
    options.version ??
    resolveWorkspaceZeusVersion(packageJsonFiles) ??
    FALLBACK_EXPECTED_ZEUS_VERSION
  const peerRange = createExpectedPeerRange(version)
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

/**
 * The version named on the command line, or `null` when none was given.
 *
 * Returning a default here was the defect: a non-null value meant
 * `alignZeusBeta` took its `options.version` branch, so
 * `resolveWorkspaceZeusVersion` never ran and the command aligned to whatever
 * literal was written here — the previous release, once Zeus published a new
 * one.
 */
function parseVersionArg(argv: string[]): string | null {
  return argv[0] ?? null
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const version = parseVersionArg(process.argv.slice(2))
  const result = alignZeusBeta({
    ...(version ? { version } : {}),
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
